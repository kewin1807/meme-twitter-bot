import { Tweet } from "agent-twitter-client";
import OpenAI from "openai";
import { TExtractedToken, TFormattedResult, TPair } from "./types";

export const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY || '',
  baseURL: 'https://api.x.ai/v1'
});


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

function extractJSONFromString(text: string): any {
  try {
    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    // Clean the matched JSON string
    const jsonString = jsonMatch[0]
      .replace(/[\u201C\u201D]/g, '"') // Replace curly quotes with straight quotes
      .replace(/[\n\r]/g, ' ') // Replace newlines with spaces
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      .trim();

    // Parse the cleaned JSON
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return null;
  }
}

export async function extractTweetFromGrok(tweet: Tweet): Promise<TExtractedToken> {
  try {
    const tweetUrl = tweet.permanentUrl;
    console.log('tweetUrl', tweetUrl);
    const response = await client.chat.completions.create({
      model: "grok-2-latest",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a crypto token detector. Analyze this tweet thoroughly: ${tweetUrl}

Your task:
1. Find any token symbols, names, or contract addresses mentioned

Format your response as JSON:
{
  "token": "<token symbol or NO>",
  "summary": "<brief description including price, market cap if found, or NO>",
  "contract": "<contract address or NO>"
}

Examples:
{"token": "TOSHI", "summary": "TOSHI token mentioned with price movement", "contract": "0x..."}
{"token": "NO", "summary": "NO", "contract": "NO"}`
          }
        ]
      }],
      max_tokens: 500,
      temperature: 0.3, // Lower temperature for more focused responses
    });

    const content = response.choices[0].message.content?.trim() || '';

    // Try to extract and parse JSON
    const parsedJson = extractJSONFromString(content);
    if (parsedJson) {
      return parsedJson;
    }

    // Fallback to text analysis if JSON parsing fails
    return {
      token: undefined,
      contract: undefined,
      summary: content
    };
  } catch (error) {
    console.error('Grok extraction failed:', error);
    return {
      token: undefined,
      contract: undefined,
      summary: tweet.text
    };
  }
}

export async function formatResult(result: TExtractedToken): Promise<TFormattedResult | null> {
  if (!result.token && !result.contract) {
    return null;
  }
  if (result.token === 'NO' && result.contract === 'NO') {
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
  // Escape special characters for Markdown (not MarkdownV2)
  const escape = (text: string) => {
    if (!text) return '';
    return text.replace(/[_*[\]()]/g, '\\$&');
  };

  // Format numbers without escaping dots
  const formatNum = (num: number) => {
    if (!num) return '0';
    return formatNumber(num);
  };

  return `
🔔 *New Token Mention*
👤 Mentioned by: @${result.mentioned_by}

📝 *Summary*
${escape(result.summary)}

🪙 *Token Info*
• Name: ${escape(result.token_info?.name)}
• Symbol: $${escape(result.token_info?.symbol)}
• Contract: \`${result.token_info?.address}\`
${result.token_info?.fdv ? `• FDV: $${formatNum(result.token_info.fdv)}` : ''}
${result.token_info?.volume?.h24 ? `• 24h Volume: $${formatNum(result.token_info.volume.h24)}` : ''}
${result.token_info?.pair_created_at ? `• Age: ${formatAge(result.token_info.pair_created_at)}` : ''}

🔗 *Links*
• [Post](${result?.post_link_url})
${result?.token_info?.social_link ? `• [Social](${result?.token_info?.social_link})` : ''}
${result?.token_info?.dexscreen_link ? `• [Chart](${result?.token_info?.dexscreen_link})` : ''}
${result?.token_info?.trojan_link ? `• [Buy Now](${result?.token_info?.trojan_link})` : ''}
`.trim();
}
