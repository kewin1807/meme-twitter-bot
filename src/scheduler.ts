import twitterService from "./services/twitter.service";
import prisma from './services/prisma.service';
import { extractTweetFromGrok, formatResult, formatTelegramMessage, telegramBot } from "./utils";


async function scheduler() {

  const kols = await prisma.kol.findMany();
  const extractedTweets = []
  for (const kol of kols) {
    const tweets = await twitterService.getLatestTweet(kol.handleName);
    if (tweets && tweets.id !== kol.lastPostId) {
      // update lastPostId
      await prisma.kol.update({
        where: { id: kol.id },
        data: { lastPostId: tweets.id }
      });
      extractedTweets.push({ kol_name: kol.handleName, tweet: tweets });
    }
  }

  for (const tweet of extractedTweets) {
    const result = await extractTweetFromGrok(tweet.tweet);
    const formattedResult = await formatResult(result);
    if (result.token || result.contract) {
      if (formattedResult) {
        formattedResult.mentioned_by = tweet.kol_name;
        formattedResult.post_link_url = `https://x.com/${tweet.kol_name}/status/${tweet.tweet.id}`;
        formattedResult.summary = result.summary || tweet.tweet.text;
        try {
          const telegramMessage = formatTelegramMessage(formattedResult);
          await telegramBot.sendMessage(process.env.TELEGRAM_CHANNEL_ID || '', telegramMessage, {
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true
          });
        } catch (error) {
          console.error(error);
        }
      }
    }
  }
}

scheduler();