require('dotenv').config()
import { extractTweetFromGrok, formatResult, formatTelegramMessage } from "./utils";
import twitterService from "./services/twitter.service";
(async () => {
  const tweets = await twitterService.getLatestTweet('asset_anchor');
  console.log(tweets);
  if (tweets) {
    const result = await extractTweetFromGrok(tweets);
    console.log(result);
  }
})()