import { Tweet } from "agent-twitter-client";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import { TExtractedToken, TFormattedResult, TPair } from "./types";

require('dotenv').config()

export const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});

export const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || '', { polling: true });

// Add command to bot's menu

const commonWords = new Set(['THE', 'AND', 'FOR', 'NEW', 'NOW', 'ALL', 'GET']);

const tokenContext = {
  contractPrefixes: new Set([
    'CA:', 'CONTRACT:', 'ADDRESS:', 'SMART CONTRACT:',
    'DEPLOYED AT:', 'LAUNCH ON', 'DEPLOYING TO'
  ]),

  tickerPrefixes: new Set([
    'TOKEN:', 'SYMBOL:', 'TICKER:', '$',
    'TRADING', 'LAUNCHING', 'APE IN',
    'BULLISH ON', 'CHECK OUT', 'COIN'
  ]),

  tokenSuffixes: new Set([
    'COIN', 'TOKEN', 'INU', 'SWAP', 'DAO',
    'PROTOCOL', 'FINANCE', 'FI', 'NETWORK',
    'CHAIN', 'AI', 'ETH', 'SOL', 'VERSE'
  ]),

  contractPatterns: {
    ethereum: /0x[a-fA-F0-9]{40}/i,
    solana: /[1-9A-HJ-NP-Za-km-z]{32,44}/,
    bsc: /0x[a-fA-F0-9]{40}/i
  }
};



async function verifyTokenWithDexscreener(
  tickerOrContract: string,
  chainId?: string
): Promise<TPair | null> {
  try {
    // DexScreener API endpoint
    const endpoint = `https://api.dexscreener.com/latest/dex/search/?q=${tickerOrContract}`;
    const response = await fetch(endpoint);
    const data = await response.json();
    console.log({ data, tickerOrContract });
    // Check if token exists in DexScreener
    return data?.pairs?.[0]
  } catch (error) {
    console.error('DexScreener verification failed:', error);
    return null;
  }
}



export async function extractAndVerifyTokenFromText(text: string): Promise<TExtractedToken> {
  const words = text.split(/\s+/);
  let potentialTicker: string | undefined;
  let potentialContract: string | undefined;
  let chain: string | undefined;

  // Look for words followed by token suffixes
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i];
    // const prevWord = i > 0 ? words[i - 1].toUpperCase() : '';

    // Check if word is a potential ticker
    if (Array.from(tokenContext.tickerPrefixes)
      .some(prefix => word.includes(prefix))) {
      // Skip if the word is just a number (with or without $ prefix)
      const cleanWord = word.replace('$', '');
      if (/^\d+$/.test(cleanWord)) continue;

      potentialTicker = cleanWord;
      break;
    }

    // Skip if current word is a number or contains $ prefix
    // Check if next word is a known token suffix
    if (tokenContext.tokenSuffixes.has(words[i + 1].toUpperCase())) {
      potentialTicker = words[i];
      break;
    }
  }

  // Check for contract addresses
  for (const [chainName, pattern] of Object.entries(tokenContext.contractPatterns)) {
    const match = text.match(pattern);
    if (match) {
      potentialContract = match[0];
      chain = chainName;
      break;
    }
  }

  return {
    token: potentialTicker,
    contract: potentialContract,
    error: '',
    summary: text
  };
}

export async function extractTweetFromGrok(tweet: Tweet): Promise<TExtractedToken> {
  try {
    const response = await client.chat.completions.create({
      model: "grok-2-vision-latest",
      messages: [{ role: "user", content: `What is the token or token contract that is mentioned in this tweet? ${tweet?.text}. Please response the name or ticker of token and the summary of token follow the format: {"token": "BTC", "summary": "Bitcoin is a cryptocurrency.", "contract": "0x1234567890"}. If there is no token and token contract, please response {"token": "NO", "summary": "NO", "contract": "NO"}.` }],
      max_tokens: 200,
    });
    const content = response.choices[0].message.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // check if there is photos media
      if (tweet?.photos && tweet?.photos.length > 0) {
        const photoUrls = tweet.photos.map(item => item.url).join('\n');
        const responsePhoto = await client.chat.completions.create({
          model: "grok-2-vision-latest",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `What is the token or token contract that is mentioned in this image?. Please response the name or ticker of token and the summary of token follow the format: {"token": "BTC", "summary": "Bitcoin is a cryptocurrency.", "contract": "0x1234567890"}. If there is no token and token contract, please response {"token": "NO", "summary": "NO", "contract": "NO"}.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: photoUrls,
                    detail: "high"
                  }
                }
              ],
            }
          ],
          max_tokens: 200,
        });
        const content = responsePhoto.choices[0].message.content?.trim() || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedResponse = JSON.parse(jsonMatch[0]);
          return parsedResponse;
        }


      }

      const response = await extractAndVerifyTokenFromText(tweet?.text || '');
      return response;

    }
    else {
      const parsedResponse = JSON.parse(jsonMatch[0]);
      return parsedResponse;
    }
  }
  catch (error) {
    console.error('Grok extraction failed:', error);
    return {
      token: '',
      contract: '',
      summary: '',
      error: 'Grok extraction failed'
    };
  }
}

export async function formatResult(result: TExtractedToken): Promise<TFormattedResult | null> {
  if (!result.token && !result.contract) {
    return null;
  }

  const tokenInfo = await verifyTokenWithDexscreener(result.token?.replace('$', '') || result.contract || '');
  if (!tokenInfo) {
    return {
      summary: result.summary,
      token_info: {
        name: result.token,
        symbol: result.token,
        address: result.contract,
        social_link: '',
        fdv: 0,
      }
    };
  }

  return {
    summary: result.summary,
    token_info: {
      name: tokenInfo.baseToken.symbol,
      symbol: tokenInfo.baseToken.symbol,
      address: tokenInfo.baseToken.address,
      social_link: tokenInfo.info?.socials?.[0]?.url,
      fdv: tokenInfo.fdv,
      volume: tokenInfo.volume,
      pair_created_at: tokenInfo.pairCreatedAt,
      dexscreen_link: tokenInfo.url,
      trojan_link: `https://t.me/solana_trojanbot?start=r-kewin1807-${tokenInfo.baseToken.address}`,
    }
  };
}

export function formatNumber(num: number): string {
  if (!num) return '0';

  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(2)}B`;
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

/**
 * Format timestamp to relative time (e.g., 2 days ago)
 */
export function formatAge(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} days`;
  if (hours > 0) return `${hours} hours`;
  return `${minutes} minutes`;
}


export function formatTelegramMessage(result: any) {
  // Escape special characters for Telegram MarkdownV2
  const escape = (text: string) => {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  };

  // Escape numbers with dots (like 1.23M)
  const escapeNumber = (num: number) => {
    if (!num) return '0';
    return formatNumber(num).replace(/\./g, '\\.');
  };

  return `
🔔 *New Token Mention*
👤 Mentioned by: [${escape(result.mentioned_by)}](https://twitter\\.com/${escape(result.mentioned_by)})

📝 *Summary*
${escape(result.summary)}

🪙 *Token Info*
• Name: ${escape(result.token_info?.name)}
• Symbol: $${escape(result.token_info?.symbol)}
• Contract: \`${escape(result.token_info?.address)}\`
${result.token_info?.fdv ? `• FDV: $${escapeNumber(result.token_info.fdv)}` : ''}
${result.token_info?.volume?.h24 ? `• 24h Volume: $${escapeNumber(result.token_info.volume.h24)}` : ''}
${result.token_info?.pair_created_at ? `• Age: ${escape(formatAge(result.token_info.pair_created_at))}` : ''}

🔗 *Links*
• [Post](${escape(result?.post_link_url)})
${result?.token_info?.social_link ? `• [Social](${escape(result?.token_info?.social_link)})` : ''}
${result?.token_info?.dexscreen_link ? `• [Chart](${escape(result?.token_info?.dexscreen_link)})` : ''}
${result?.token_info?.trojan_link ? `• [Buy Now](${escape(result?.token_info?.trojan_link)})` : ''}
`.trim();
}
