import twitterService from "./services/twitter.service";
import storage from "./services/storage.service"; import { extractTweetFromGrok, formatResult, formatTelegramMessage } from "./utils";
import telegramCommands from "./bot.handler";
import schedule from 'node-schedule';
import express, { Request, Response } from 'express';

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript with Express!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


async function scheduler() {
  const kols = await storage.findAllKOLs();
  const extractedTweets = []
  for (const kol of kols) {
    console.log(`Getting latest tweet for ${kol.handleName}`);
    const tweets = await twitterService.getLatestTweet(kol.handleName);
    if (tweets && (tweets.id !== kol.lastPostId || !kol.lastPostId)) {
      // update lastPostId
      await storage.updateLastPostId(kol._id!, tweets.id || '');
      extractedTweets.push({ kol_name: kol.handleName, tweet: tweets });
    }
  }

  for (const tweet of extractedTweets) {
    console.log(`Extracting tweet id: ${tweet.tweet.id}`);
    const result = await extractTweetFromGrok(tweet.tweet);
    console.log('result tweet', result);
    const formattedResult = await formatResult(result);
    if (result.token || result.contract) {
      if (formattedResult) {
        formattedResult.mentioned_by = tweet.kol_name;
        formattedResult.post_link_url = `https://x.com/${tweet.kol_name}/status/${tweet.tweet.id}`;
        formattedResult.summary = result.summary || tweet.tweet.text;
        try {
          const telegramMessage = formatTelegramMessage(formattedResult);
          await telegramCommands.sendMessage(process.env.TELEGRAM_CHANNEL_ID || '', telegramMessage);
        } catch (error) {
          console.error("send message error", error);
        }
      }
    }
  }
}

schedule.scheduleJob('*/3 * * * *', async () => {
  console.log('Running scheduler job at:', new Date().toISOString());
  await scheduler();
});

console.log('Telegram bot initialized');

// Initialize bot commands()
telegramCommands.initializeCommands();
console.log('Bot commands registered');
scheduler();


