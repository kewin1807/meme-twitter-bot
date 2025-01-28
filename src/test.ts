require('dotenv').config()
import { extractTweetFromGrok, formatResult, formatTelegramMessage } from "./utils";
import twitterService from "./services/twitter.service";
(async () => {
  const tweets = await twitterService.getTweetById('1884160913437253635');
  if (tweets) {
    const result = await extractTweetFromGrok(tweets);
    console.log(result);
  }
})()