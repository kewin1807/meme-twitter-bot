import TelegramBot from 'node-telegram-bot-api';
import mongodb from './services/mongodb.service';

// Types
interface UserState {
  step: string;
  data: any;
}

// State management
const userStates = new Map<string, UserState>();

class TelegramCommands {
  private bot: TelegramBot;

  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || '', {
      polling: {
        interval: 300,
        autoStart: true,
        params: {
          timeout: 10,
        },
      },
    });

    this.bot.on('polling_error', (error) => {
      if (error.message.includes('ECONNRESET')) {
        this.restartBot();
      }
    });

    // Initialize MongoDB connection
    mongodb.connect().catch(console.error);
  }

  getInstance() {
    return this.bot;
  }

  initializeCommands() {
    this.bot.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'create_kol', description: 'Add new KOLs to tracking list' },
      { command: 'list_kols', description: 'Show all tracked KOLs' },
      { command: 'delete_kol', description: 'Delete KOLs from tracking list' }
    ]);

    this.bot.onText(/\/start/, this.handleStart.bind(this));
    this.bot.onText(/\/create_kol/, this.handleCreateKol.bind(this));
    this.bot.onText(/\/list_kols/, this.handleListKols.bind(this));
    this.bot.onText(/\/delete_kol/, this.handleDeleteKol.bind(this));

    this.bot.on('text', this.handleConversation.bind(this));
  }

  private async handleStart(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(
      chatId,
      '👋 Welcome! I can help you manage your KOL tracking list.\n\n' +
      'Available commands:\n' +
      '/create_kol - Add new KOLs\n' +
      '/list_kols - View all KOLs\n' +
      '/delete_kol - Remove KOLs'
    );
  }

  private async handleCreateKol(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();

    if (!userId) return;

    userStates.set(userId, {
      step: 'awaiting_usernames',
      data: {}
    });

    await this.bot.sendMessage(
      chatId,
      '📝 Please provide Twitter usernames of KOLs (separated by commas).\n' +
      'Example: elonmusk, VitalikButerin, cz_binance'
    );
  }

  private async handleListKols(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;

    try {
      const kols = await mongodb.findAllKOLs();

      if (kols.length === 0) {
        await this.bot.sendMessage(chatId, '📭 No KOLs found in the database.');
        return;
      }

      const message = '📋 List of KOLs:\n' +
        kols.map((kol, index) =>
          `${index + 1}. @${kol.handleName}`
        ).join('\n');

      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Error fetching KOLs:', error);
      await this.bot.sendMessage(chatId, '❌ Error fetching KOL list. Please try again.');
    }
  }

  private async handleDeleteKol(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();

    if (!userId) return;

    try {
      const kols = await mongodb.findAllKOLs();

      if (kols.length === 0) {
        await this.bot.sendMessage(chatId, '📭 No KOLs found in the database.');
        return;
      }

      userStates.set(userId, {
        step: 'awaiting_delete',
        data: { kols }
      });

      const message = '🗑️ Select KOLs to delete by entering their numbers:\n\n' +
        kols.map((kol, index) =>
          `${index + 1}. @${kol.handleName}`
        ).join('\n');

      await this.bot.sendMessage(chatId, message + '\n\nExample: 1,3,5');
    } catch (error) {
      console.error('Error in delete command:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  private async handleConversation(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    const text = msg.text;

    if (!userId || !text || text.startsWith('/')) return;

    const userState = userStates.get(userId);
    if (!userState) return;

    switch (userState.step) {
      case 'awaiting_usernames':
        await this.handleCreateKolResponse(chatId, userId, text);
        break;
      case 'awaiting_delete':
        await this.handleDeleteKolResponse(chatId, userId, text);
        break;
    }
  }

  private async handleCreateKolResponse(chatId: number, userId: string, text: string) {
    try {
      const usernames = text
        .split(',')
        .map(username => username.trim().replace('@', ''))
        .filter(username => username.length > 0);

      if (usernames.length === 0) {
        await this.bot.sendMessage(chatId, '❌ Please provide valid usernames.');
        return;
      }

      const createdKols = await Promise.all(
        usernames.map(async (username) => {
          try {
            return await mongodb.createKOL(username);
          } catch (error) {
            console.error(`Error creating KOL ${username}: `, error);
            return null;
          }
        })
      );

      const successfulKols = createdKols.filter((kol) => kol !== null);

      if (successfulKols.length > 0) {
        await this.bot.sendMessage(
          chatId,
          `✅ Successfully added ${successfulKols.length} KOLs: \n` +
          successfulKols.map((kol) => `- @${kol?.handleName}`).join('\n')
        );
      } else {
        await this.bot.sendMessage(chatId, '❌ Failed to add any KOLs. Please try again.');
      }
    } catch (error) {
      console.error('Error in create KOL response:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    } finally {
      userStates.delete(userId);
    }
  }

  private async handleDeleteKolResponse(chatId: number, userId: string, text: string) {
    try {
      const userState = userStates.get(userId);
      if (!userState?.data.kols) return;

      const numbers = text
        .split(',')
        .map(num => parseInt(num.trim()))
        .filter(num => !isNaN(num) && num > 0 && num <= userState.data.kols.length);

      if (numbers.length === 0) {
        await this.bot.sendMessage(chatId, '❌ Please provide valid numbers from the list.');
        return;
      }

      const kolsToDelete = numbers.map(num => userState.data.kols[num - 1]);

      await Promise.all(
        kolsToDelete.map(kol =>
          mongodb.deleteKOL(kol._id!)
        )
      );

      await this.bot.sendMessage(
        chatId,
        `✅ Successfully deleted ${kolsToDelete.length} KOLs: \n` +
        kolsToDelete.map(kol => `- @${kol.handleName}`).join('\n')
      );
    } catch (error) {
      console.error('Error in delete KOL response:', error);
      await this.bot.sendMessage(chatId, '❌ Error deleting KOLs. Please try again.');
    } finally {
      userStates.delete(userId);
    }
  }

  private restartBot() {
    try {
      this.bot.stopPolling();
      setTimeout(() => {
        this.bot.startPolling();
      }, 5000);
    } catch (error) {
      console.error('Error restarting bot:', error);
    }
  }

  async sendMessage(chatId: string, message: string) {
    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error('Error sending message:', error);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true
        });
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
  }
}

const telegramCommands = new TelegramCommands();
export default telegramCommands;
