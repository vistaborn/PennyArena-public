const KEY_PREFIX = "penny_username_";

export function cacheUsername(walletAddress: string, username: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${KEY_PREFIX}${walletAddress.toLowerCase()}`, username);
}

export function getCachedUsername(walletAddress: string | null | undefined): string | null {
  if (typeof window === "undefined" || !walletAddress) return null;
  return localStorage.getItem(`${KEY_PREFIX}${walletAddress.toLowerCase()}`);
}

export function clearCachedUsername(walletAddress: string | null | undefined) {
  if (typeof window === "undefined" || !walletAddress) return;
  localStorage.removeItem(`${KEY_PREFIX}${walletAddress.toLowerCase()}`);
}
