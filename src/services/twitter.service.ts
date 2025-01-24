import { Scraper, Tweet } from "agent-twitter-client";

require('dotenv').config()
class TwitterService {
  private client: Scraper;
  private lastLoginTime: number;
  private readonly LOGIN_TIMEOUT = 3600000; // 1 hour in milliseconds


  constructor() {
    this.client = new Scraper();
    this.lastLoginTime = 0;
  }

  async ensureLogin(): Promise<void> {
    const now = Date.now();
    if (now - this.lastLoginTime > this.LOGIN_TIMEOUT) {
      await this.client.login(process.env['TWITTER_USERNAME'] || '', process.env['TWITTER_PASSWORD'] || '');
      this.lastLoginTime = now;
    }
  }

  async getLatestTweet(handleName: string): Promise<Tweet | null | void> {
    try {
      // await this.ensureLogin();
      const tweet = await this.client.getLatestTweet(handleName, false, 1);
      return tweet;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async getTweetById(id: string): Promise<Tweet | null | void> {
    try {
      // await this.ensureLogin();
      const tweet = await this.client.getTweet(id);
      return tweet;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}


const twitterService = new TwitterService();
export default twitterService;
