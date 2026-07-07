import { USDC_ERC20_DECIMALS } from "@/lib/arc";

export const PUBLISH_FEE_USDC = 0.01;
export const DUEL_ENTRY_FEE_USDC = 0.01;
export const VOTE_UNIT_USDC = 0.001;
export const LIKE_FEE_USDC = 0.001;
export const MIN_VOTE_POOL_USDC = 0.02;
export const DUEL_DURATION_MS = 60 * 60 * 1000;
export const DUEL_DURATION_HOURS = 1;
export const AUTHOR_WIN_SHARE = 0.5;
export const VOTER_WIN_SHARE = 0.5;

export function usdcToUnits(amountUsdc: number): bigint {
  const safe = Math.max(0, amountUsdc);
  return BigInt(Math.round(safe * 10 ** USDC_ERC20_DECIMALS));
}

export function getTreasuryAddress(): `0x${string}` | null {
  const address = process.env.NEXT_PUBLIC_PENNY_TREASURY_ADDRESS;
  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) return null;
  return address.toLowerCase() as `0x${string}`;
}

export function voteWeightFromAmount(amountUsdc: number): number {
  return Math.floor(amountUsdc / VOTE_UNIT_USDC);
}

export function formatUsdc(amount: number): string {
  if (amount >= 1) return amount.toFixed(2);
  if (amount >= 0.01) return amount.toFixed(4);
  return amount.toFixed(6);
}

/** Human label for battle voting window, e.g. "1 hour". */
export function formatDuelDurationLabel(): string {
  return DUEL_DURATION_HOURS === 1 ? "1 hour" : `${DUEL_DURATION_HOURS} hours`;
}

/** Short label for UI chips, e.g. "1 hr". */
export function formatDuelDurationShort(): string {
  return DUEL_DURATION_HOURS === 1 ? "1 hr" : `${DUEL_DURATION_HOURS} hrs`;
}

export function formatDuelCountdown(hours: number, mins: number, secs: number): string {
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export function contentEarningsUsdc(item: {
  tipsTotalUsdc: number;
  votesTotalUsdc?: number;
  likeCount: number;
}): number {
  const votes =
    item.votesTotalUsdc ?? Math.round(item.likeCount * LIKE_FEE_USDC * 1_000_000) / 1_000_000;
  return Math.round((item.tipsTotalUsdc + votes) * 1_000_000) / 1_000_000;
}
