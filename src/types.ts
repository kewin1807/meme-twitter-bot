export type TokenInfo = {
  address: string;
  name: string;
  symbol: string;
}

export type Transactions = {
  buys: number;
  sells: number;
}

export type TimeFrameMetrics = {
  m5: number | Transactions;
  h1: number | Transactions;
  h6: number | Transactions;
  h24: number | Transactions;
}

export type WebsiteInfo = {
  label: string;
  url: string;
}

export type SocialInfo = {
  type: string;
  url: string;
}

export type TokenExtendedInfo = {
  imageUrl?: string;
  header?: string;
  openGraph?: string;
  websites?: WebsiteInfo[];
  socials?: SocialInfo[];
}

export type TPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: TokenInfo;
  quoteToken: TokenInfo;
  priceNative: string;
  priceUsd: string;
  txns: TimeFrameMetrics;
  volume: TimeFrameMetrics;
  priceChange: TimeFrameMetrics;
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: TokenExtendedInfo;
}

export type TExtractedToken = {
  token?: string;
  contract?: string;
  error?: string;
  summary?: string;
}

export type TFormattedResult = {
  mentioned_by?: string;
  summary?: string;
  post_link_url?: string;
  token_info?: {
    chain?: string;
    name?: string;
    symbol?: string;
    address?: string;
    social_link?: string;
    fdv?: number;
    volume?: TimeFrameMetrics;
    pair_created_at?: number;
    dexscreen_link?: string;
    trojan_link?: string;
    liquidity?: number;
  };
}
