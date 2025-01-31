require('dotenv').config()
import { extractTweetFromGrok, formatResult, formatTelegramMessage } from "./utils";
import twitterService from "./services/twitter.service";
(async () => {
  const tweets = await twitterService.getTweetById('1885145903863902639');
  if (tweets) {
    const result = await extractTweetFromGrok(tweets);
    const formattedResult = await formatResult(result);
    console.log(formattedResult);
  }
})()
