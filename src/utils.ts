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
    const pairs = data?.pairs || [];
    const sortedPairs = pairs.sort((a: TPair, b: TPair) => b.fdv - a.fdv);
    // Check if token exists in DexScreener
    return sortedPairs?.[0] || null;
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
      if (/^\d+([KMB])?$/i.test(cleanWord)) continue;

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
    // Use direct text analysis first


    // Fallback to Grok only if needed
    const response = await client.chat.completions.create({
      model: "grok-2-vision-latest",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this tweet ${tweet.permanentUrl} and text: "${tweet.text}. Based on the up-to-date information on X"

Look for:
1. Cryptocurrency token symbols (prefixed with $ or followed by "token", "coin", etc.)
2. Smart contract addresses (0x... for ETH/BSC, or base58 for Solana)
3. Token names in context of trading, launching, or price discussion

Only include information explicitly stated in the tweet.

Format:
{
  "token": "<found token symbol or NO>",
  "summary": "<relevant quote from tweet or NO>",
  "contract": "<found contract address or NO>"
}`
          }
        ]
      }],
      max_tokens: 500,
      temperature: 0.1, // Reduced temperature for more deterministic results
    });

    const content = response.choices[0].message.content?.trim() || '';
    // Try to extract and parse JSON
    const parsedJson = extractJSONFromString(content);
    if (parsedJson && (parsedJson.token !== 'NO' || parsedJson.contract !== 'NO')) {
      return { ...parsedJson, summary: tweet.text };
    } else {
      const result = await extractAndVerifyTokenFromText(tweet.text || '');
      return { ...result, summary: tweet.text };
    }

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
      chain: tokenInfo.chainId,
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
  // Escape special characters for Markdown
  const escape = (text: string) => {
    if (!text) return '';
    return text.replace(/[-_*[\]()~`>#+=|{}.!]/g, '\\$&');
  };

  // Format numbers and escape dots
  const formatNum = (num: number) => {
    if (!num) return '0';
    return escape(formatNumber(num));
  };

  // Format price with 6 decimal places
  const formatPrice = (num: number) => {
    if (!num) return '0';
    return escape(num.toFixed(6));
  };

  const formatTimeAgo = (timestamp: number) => {
    const age = formatAge(timestamp);
    return age.replace(/\./g, '\\.');
  };

  // Generate GMGN link from contract address
  const getGMGNLink = (address: string, chain: string) => {
    if (!address) return '';
    const prefixChain = ['sol', 'eth', 'bsc', 'base', 'tron', 'blast']
    const prefix = prefixChain.find(prefix => chain.includes(prefix))
    return `https://gmgn.ai/${prefix}/token/${address}`;
  };

  return `
🔔 *Mentioned by [${escape(result.mentioned_by)}](https://x.com/${escape(result.mentioned_by)})*

${escape(result.summary)}

🚀 *${escape(result.token_info?.symbol)}* ${result.token_info?.fdv ? `\\[${formatNum(result.token_info.fdv)}\\]` : ''}
${result.token_info?.price ? `💰 Price: $${formatPrice(result.token_info.price)}` : ''}
${result.token_info?.fdv ? `💎 FDV: $${formatNum(result.token_info.fdv)}` : ''}
${result.token_info?.volume?.h24 ? `📊 Vol: $${formatNum(result.token_info.volume.h24)}` : ''} ${result.token_info?.pair_created_at ? `🕰️ Age: ${formatTimeAgo(result.token_info.pair_created_at)}` : ''}
${result.token_info?.address ? `📝 Contract: \`${result.token_info?.address}\`` : ''}

🔗 *Links*
💹 Chart: [DEX](${result?.token_info?.dexscreen_link}) ⋅ [GMGN](${getGMGNLink(result.token_info?.address, result.token_info?.chain)})
• [Buy with Trojan](${result?.token_info?.trojan_link})
• [Post](${result?.post_link_url})
`.trim();
}
