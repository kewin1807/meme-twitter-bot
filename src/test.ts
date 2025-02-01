require('dotenv').config()
import { extractTweetFromGrok, formatResult, formatTelegramMessage } from "./utils";
import twitterService from "./services/twitter.service";
(async () => {

  // 1885213689906704633
  const tweets = await twitterService.getTweetById('1885559762927948123');
  if (tweets) {
    const result = await extractTweetFromGrok(tweets);
    const formattedResult = await formatResult(result);
    console.log(formattedResult);
  }
})()
