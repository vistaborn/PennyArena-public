/** System account for PennyArena editorial content — no Circle wallet required. */
export const OFFICIAL_WALLET_ADDRESS =
  "0x0000000000000000000000000000000000000001" as const;

export const OFFICIAL_USERNAME = "pennyarena";

export const OFFICIAL_AVATAR_URL = "/brand/pixel_coin.svg";

export const OFFICIAL_BIO =
  "Official PennyArena account — news, topics, and arena updates. Vote on posts for $0.001 USDC.";

export function isOfficialAddress(address: string) {
  return address.toLowerCase() === OFFICIAL_WALLET_ADDRESS;
}

export function isOfficialUsername(username: string) {
  return username.toLowerCase() === OFFICIAL_USERNAME;
}
