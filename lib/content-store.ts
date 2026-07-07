import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDataDir, isVercelServerless } from "@/lib/data-dir";
import {
  readSharedContent,
  writeSharedContent,
  readSharedLikes,
  writeSharedLikes,
  readSharedTips,
  writeSharedTips,
  hasSharedStore,
} from "@/lib/shared-store";
import type { ContentType } from "@/lib/security/validation";
import type { TopicSlug } from "@/lib/topics";

export type ContentItem = {
  id: string;
  authorAddress: string;
  authorUsername: string;
  topicSlug: TopicSlug;
  type: ContentType;
  title: string;
  body: string;
  mediaUrl: string | null;
  linkUrl: string | null;
  linkPreviewImage: string | null;
  repostOfId: string | null;
  publishTxHash: string;
  tipsTotalUsdc: number;
  tipCount: number;
  likeCount: number;
  votesTotalUsdc: number;
  commentCount: number;
  repostCount: number;
  voteScore: number;
  createdAt: string;
};

export type TipRecord = {
  id: string;
  contentId: string;
  fromAddress: string;
  toAddress: string;
  amountUsdc: number;
  txHash: string;
  createdAt: string;
};

export type LikeRecord = {
  id: string;
  contentId: string;
  fromAddress: string;
  amountUsdc: number;
  txHash: string;
  createdAt: string;
};

const MEMORY_KEY = "__penny_content__";
const TIPS_KEY = "__penny_tips__";
const LIKES_KEY = "__penny_likes__";

function memoryContent(): ContentItem[] {
  const g = globalThis as { [MEMORY_KEY]?: ContentItem[] };
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = [];
  return g[MEMORY_KEY]!;
}

function memoryTips(): TipRecord[] {
  const g = globalThis as { [TIPS_KEY]?: TipRecord[] };
  if (!g[TIPS_KEY]) g[TIPS_KEY] = [];
  return g[TIPS_KEY]!;
}

function memoryLikes(): LikeRecord[] {
  const g = globalThis as { [LIKES_KEY]?: LikeRecord[] };
  if (!g[LIKES_KEY]) g[LIKES_KEY] = [];
  return g[LIKES_KEY]!;
}

function contentFile() {
  return path.join(getDataDir(), "content.json");
}

function tipsFile() {
  return path.join(getDataDir(), "tips.json");
}

function likesFile() {
  return path.join(getDataDir(), "likes.json");
}

let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn);
  writeChain = run.catch(() => undefined);
  return run;
}

function normalizeItem(raw: Partial<ContentItem> & Pick<ContentItem, "id">): ContentItem {
  return {
    id: raw.id,
    authorAddress: raw.authorAddress ?? "",
    authorUsername: raw.authorUsername ?? "",
    topicSlug: raw.topicSlug as TopicSlug,
    type: raw.type ?? "post",
    title: raw.title ?? "",
    body: raw.body ?? "",
    mediaUrl: raw.mediaUrl ?? null,
    linkUrl: raw.linkUrl ?? null,
    linkPreviewImage: raw.linkPreviewImage ?? null,
    repostOfId: raw.repostOfId ?? null,
    publishTxHash: raw.publishTxHash ?? "",
    tipsTotalUsdc: raw.tipsTotalUsdc ?? 0,
    tipCount: raw.tipCount ?? 0,
    likeCount: raw.likeCount ?? 0,
    votesTotalUsdc:
      raw.votesTotalUsdc ??
      Math.round((raw.likeCount ?? 0) * 0.001 * 1_000_000) / 1_000_000,
    commentCount: raw.commentCount ?? 0,
    repostCount: raw.repostCount ?? 0,
    voteScore: raw.voteScore ?? 0,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

async function readContent(): Promise<ContentItem[]> {
  const mem = memoryContent();

  if (hasSharedStore()) {
    const shared = await readSharedContent<ContentItem>();
    if (shared !== null) {
      const data = shared.map((c) => normalizeItem(c));
      mem.length = 0;
      mem.push(...data);
      return [...data];
    }
  }

  if (mem.length > 0) return [...mem];

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(contentFile(), "utf-8");
    const data = (JSON.parse(raw) as Partial<ContentItem>[]).map((c) =>
      normalizeItem(c as ContentItem),
    );
    mem.length = 0;
    mem.push(...data);
    if (hasSharedStore() && data.length > 0) await writeSharedContent(data);
    return data;
  } catch {
    return [];
  }
}

async function writeContent(data: ContentItem[]) {
  const mem = memoryContent();
  mem.length = 0;
  mem.push(...data);
  if (hasSharedStore()) {
    await writeSharedContent(data);
  }
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    await fs.writeFile(contentFile(), JSON.stringify(data, null, 2));
  } catch {
    /* ignore ephemeral fs errors on serverless */
  }
}

async function readTips(): Promise<TipRecord[]> {
  const mem = memoryTips();

  if (isVercelServerless() && hasSharedStore()) {
    const shared = await readSharedTips<TipRecord>();
    if (shared) {
      mem.length = 0;
      mem.push(...shared);
      return [...shared];
    }
  }

  if (mem.length > 0) return [...mem];

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(tipsFile(), "utf-8");
    const data = JSON.parse(raw) as TipRecord[];
    if (isVercelServerless()) {
      mem.length = 0;
      mem.push(...data);
      if (hasSharedStore()) await writeSharedTips(data);
    }
    return data;
  } catch {
    return [];
  }
}

async function writeTips(data: TipRecord[]) {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(tipsFile(), JSON.stringify(data, null, 2));
  if (isVercelServerless()) {
    const mem = memoryTips();
    mem.length = 0;
    mem.push(...data);
    if (hasSharedStore()) await writeSharedTips(data);
  }
}

async function readLikes(): Promise<LikeRecord[]> {
  const mem = memoryLikes();

  if (isVercelServerless() && hasSharedStore()) {
    const shared = await readSharedLikes<LikeRecord>();
    if (shared) {
      mem.length = 0;
      mem.push(...shared);
      return [...shared];
    }
  }

  if (mem.length > 0) return [...mem];

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(likesFile(), "utf-8");
    const data = JSON.parse(raw) as LikeRecord[];
    if (isVercelServerless()) {
      mem.length = 0;
      mem.push(...data);
      if (hasSharedStore()) await writeSharedLikes(data);
    }
    return data;
  } catch {
    return [];
  }
}

async function writeLikes(data: LikeRecord[]) {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(likesFile(), JSON.stringify(data, null, 2));
  if (isVercelServerless()) {
    const mem = memoryLikes();
    mem.length = 0;
    mem.push(...data);
    if (hasSharedStore()) await writeSharedLikes(data);
  }
}

export async function replaceAllContent(data: ContentItem[]) {
  await writeContent(data);
}

export async function getContent(id: string): Promise<ContentItem | null> {
  const all = await readContent();
  return all.find((c) => c.id === id) ?? null;
}

export async function listContent(filters?: {
  topicSlug?: string;
  authorAddress?: string;
  limit?: number;
  offset?: number;
}): Promise<ContentItem[]> {
  let all = await readContent();
  if (filters?.topicSlug) {
    all = all.filter((c) => c.topicSlug === filters.topicSlug);
  }
  if (filters?.authorAddress) {
    all = all.filter(
      (c) => c.authorAddress === filters.authorAddress!.toLowerCase(),
    );
  }
  all.sort((a, b) => {
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? 50;
  return all.slice(offset, offset + limit);
}

export async function searchContent(query: string): Promise<ContentItem[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const all = await readContent();
  return all
    .filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.body.toLowerCase().includes(q) ||
        c.authorUsername.includes(q) ||
        c.topicSlug.includes(q),
    )
    .slice(0, 50);
}

export async function countByTopic(topicSlug: string, excludeAuthor?: string) {
  const all = await readContent();
  return all.filter(
    (c) =>
      c.topicSlug === topicSlug &&
      (!excludeAuthor || c.authorAddress !== excludeAuthor.toLowerCase()),
  );
}

export async function createContent(input: {
  authorAddress: string;
  authorUsername: string;
  topicSlug: TopicSlug;
  type: ContentType;
  title: string;
  body: string;
  mediaUrl: string | null;
  linkUrl?: string | null;
  linkPreviewImage?: string | null;
  repostOfId?: string | null;
  publishTxHash: string;
}): Promise<ContentItem> {
  return withWriteLock(async () => {
    const all = await readContent();
    const item: ContentItem = {
      id: randomUUID(),
      authorAddress: input.authorAddress.toLowerCase(),
      authorUsername: input.authorUsername,
      topicSlug: input.topicSlug,
      type: input.type,
      title: input.title,
      body: input.body,
      mediaUrl: input.mediaUrl,
      linkUrl: input.linkUrl ?? null,
      linkPreviewImage: input.linkPreviewImage ?? null,
      repostOfId: input.repostOfId ?? null,
      publishTxHash: input.publishTxHash,
      tipsTotalUsdc: 0,
      tipCount: 0,
      likeCount: 0,
      votesTotalUsdc: 0,
      commentCount: 0,
      repostCount: 0,
      voteScore: 0,
      createdAt: new Date().toISOString(),
    };
    all.unshift(item);
    if (item.repostOfId) {
      const idx = all.findIndex((c) => c.id === item.repostOfId);
      if (idx >= 0) all[idx].repostCount += 1;
    }
    await writeContent(all);
    return item;
  });
}

export async function upsertUserPosts(
  ownerAddress: string,
  items: ContentItem[],
): Promise<number> {
  return withWriteLock(async () => {
    const owner = ownerAddress.toLowerCase();
    const all = await readContent();
    const byId = new Map(all.map((c) => [c.id, c]));
    let added = 0;
    for (const raw of items) {
      if (raw.authorAddress?.toLowerCase() !== owner) continue;
      const existing = byId.get(raw.id);
      if (!existing) added += 1;
      byId.set(raw.id, normalizeItem(raw as ContentItem));
    }
    const merged = [...byId.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    await writeContent(merged);
    return added;
  });
}

export async function seedContentBulk(items: ContentItem[]) {
  return withWriteLock(async () => {
    const existing = await readContent();
    const ids = new Set(existing.map((c) => c.id));
    const merged = [...items.filter((i) => !ids.has(i.id)), ...existing];
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    await writeContent(merged);
    return merged.length;
  });
}

export async function bumpCommentCount(contentId: string, delta = 1) {
  return withWriteLock(async () => {
    const all = await readContent();
    const idx = all.findIndex((c) => c.id === contentId);
    if (idx < 0) return;
    all[idx].commentCount = Math.max(0, all[idx].commentCount + delta);
    await writeContent(all);
  });
}

export async function addTip(input: {
  contentId: string;
  fromAddress: string;
  toAddress: string;
  amountUsdc: number;
  txHash: string;
}): Promise<TipRecord | null> {
  return withWriteLock(async () => {
    const tips = await readTips();
    if (tips.some((t) => t.txHash === input.txHash)) return null;

    const all = await readContent();
    const idx = all.findIndex((c) => c.id === input.contentId);
    if (idx < 0) return null;

    const record: TipRecord = {
      id: randomUUID(),
      contentId: input.contentId,
      fromAddress: input.fromAddress.toLowerCase(),
      toAddress: input.toAddress.toLowerCase(),
      amountUsdc: input.amountUsdc,
      txHash: input.txHash,
      createdAt: new Date().toISOString(),
    };
    tips.unshift(record);
    all[idx].tipsTotalUsdc =
      Math.round((all[idx].tipsTotalUsdc + input.amountUsdc) * 1_000_000) / 1_000_000;
    all[idx].tipCount += 1;
    await writeTips(tips);
    await writeContent(all);
    return record;
  });
}

export async function addLike(input: {
  contentId: string;
  fromAddress: string;
  amountUsdc: number;
  txHash: string;
}): Promise<LikeRecord | null> {
  return withWriteLock(async () => {
    const likes = await readLikes();
    if (likes.some((l) => l.txHash === input.txHash)) return null;
    if (
      likes.some(
        (l) =>
          l.contentId === input.contentId &&
          l.fromAddress === input.fromAddress.toLowerCase(),
      )
    ) {
      return null;
    }

    const all = await readContent();
    const idx = all.findIndex((c) => c.id === input.contentId);
    if (idx < 0) return null;

    const record: LikeRecord = {
      id: randomUUID(),
      contentId: input.contentId,
      fromAddress: input.fromAddress.toLowerCase(),
      amountUsdc: input.amountUsdc,
      txHash: input.txHash,
      createdAt: new Date().toISOString(),
    };
    likes.unshift(record);
    all[idx].likeCount += 1;
    all[idx].votesTotalUsdc =
      Math.round((all[idx].votesTotalUsdc + input.amountUsdc) * 1_000_000) / 1_000_000;
    await writeLikes(likes);
    await writeContent(all);
    return record;
  });
}

export async function userLikedContent(
  contentId: string,
  fromAddress: string,
): Promise<boolean> {
  const likes = await readLikes();
  return likes.some(
    (l) =>
      l.contentId === contentId &&
      l.fromAddress === fromAddress.toLowerCase(),
  );
}

export async function userTippedContent(
  contentId: string,
  fromAddress: string,
): Promise<boolean> {
  const tips = await readTips();
  return tips.some(
    (t) =>
      t.contentId === contentId &&
      t.fromAddress === fromAddress.toLowerCase(),
  );
}

export async function bumpVoteScore(contentId: string, weight: number) {
  return withWriteLock(async () => {
    const all = await readContent();
    const idx = all.findIndex((c) => c.id === contentId);
    if (idx < 0) return;
    all[idx].voteScore += weight;
    await writeContent(all);
  });
}

export async function getPopularContent(limit = 20): Promise<ContentItem[]> {
  const all = await readContent();
  return [...all]
    .sort((a, b) => {
      if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
}

export async function deleteContent(
  contentId: string,
  authorAddress: string,
): Promise<boolean> {
  return withWriteLock(async () => {
    const all = await readContent();
    const idx = all.findIndex(
      (c) =>
        c.id === contentId &&
        c.authorAddress.toLowerCase() === authorAddress.toLowerCase(),
    );
    if (idx < 0) return false;
    all.splice(idx, 1);
    await writeContent(all);
    return true;
  });
}
