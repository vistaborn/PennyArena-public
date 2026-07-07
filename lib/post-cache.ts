import type { ContentItem } from "@/lib/content-store";

const KEY_PREFIX = "penny_posts_";
const MAX_CACHED = 40;

export function getCachedUserPosts(
  walletAddress: string | null | undefined,
): ContentItem[] {
  if (typeof window === "undefined" || !walletAddress) return [];
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${walletAddress.toLowerCase()}`);
    if (!raw) return [];
    return JSON.parse(raw) as ContentItem[];
  } catch {
    return [];
  }
}

export function cacheUserPost(walletAddress: string, item: ContentItem) {
  if (typeof window === "undefined") return;
  const key = `${KEY_PREFIX}${walletAddress.toLowerCase()}`;
  const existing = getCachedUserPosts(walletAddress);
  const byId = new Map(existing.map((p) => [p.id, p]));
  byId.set(item.id, item);
  const next = [...byId.values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_CACHED);
  localStorage.setItem(key, JSON.stringify(next));
}

export function mergePosts(
  apiPosts: ContentItem[],
  cachedPosts: ContentItem[],
): ContentItem[] {
  const byId = new Map<string, ContentItem>();
  for (const p of [...apiPosts, ...cachedPosts]) {
    byId.set(p.id, p);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function removeCachedPost(walletAddress: string, contentId: string) {
  if (typeof window === "undefined") return;
  const key = `${KEY_PREFIX}${walletAddress.toLowerCase()}`;
  const existing = getCachedUserPosts(walletAddress).filter((p) => p.id !== contentId);
  if (existing.length === 0) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(existing));
}

export async function syncCachedPostsToServer(
  address: string,
  items: ContentItem[],
): Promise<void> {
  if (items.length === 0) return;
  await fetch("/api/content/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ address, items }),
  });
}
