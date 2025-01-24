require('dotenv').config()
import { extractTweetFromGrok, formatResult, formatTelegramMessage } from "./utils";
import twitterService from "./services/twitter.service";
(async () => {
  const tweets = await twitterService.getTweetById('1882831992615747703');
  console.log(tweets);
  if (tweets) {
    const result = await extractTweetFromGrok(tweets);
    console.log(result);
  }
})()