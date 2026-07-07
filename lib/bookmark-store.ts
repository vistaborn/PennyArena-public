import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDataDir, isVercelServerless } from "@/lib/data-dir";
import {
  hasSharedStore,
  readSharedBookmarks,
  writeSharedBookmarks,
} from "@/lib/shared-store";

export type Bookmark = {
  id: string;
  userAddress: string;
  contentId: string;
  createdAt: string;
};

const MEMORY_KEY = "__penny_bookmarks__";

function memoryBookmarks(): Bookmark[] {
  const g = globalThis as { [MEMORY_KEY]?: Bookmark[] };
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = [];
  return g[MEMORY_KEY]!;
}

function bookmarksFile() {
  return path.join(getDataDir(), "bookmarks.json");
}

let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn);
  writeChain = run.catch(() => undefined);
  return run;
}

async function readBookmarks(): Promise<Bookmark[]> {
  const mem = memoryBookmarks();

  if (hasSharedStore()) {
    const shared = await readSharedBookmarks<Bookmark>();
    if (shared !== null) {
      mem.length = 0;
      mem.push(...shared);
      return [...shared];
    }
  }

  if (mem.length > 0) return [...mem];

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(bookmarksFile(), "utf-8");
    const data = JSON.parse(raw) as Bookmark[];
    mem.length = 0;
    mem.push(...data);
    if (hasSharedStore() && data.length > 0) await writeSharedBookmarks(data);
    return data;
  } catch {
    return [];
  }
}

async function writeBookmarks(data: Bookmark[]) {
  const mem = memoryBookmarks();
  mem.length = 0;
  mem.push(...data);
  if (hasSharedStore()) {
    await writeSharedBookmarks(data);
  }
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    await fs.writeFile(bookmarksFile(), JSON.stringify(data, null, 2));
  } catch {
    /* ignore ephemeral fs errors on serverless */
  }
}

export async function listBookmarks(userAddress: string): Promise<Bookmark[]> {
  const all = await readBookmarks();
  return all
    .filter((b) => b.userAddress === userAddress.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function isBookmarked(
  userAddress: string,
  contentId: string,
): Promise<boolean> {
  const all = await readBookmarks();
  return all.some(
    (b) =>
      b.userAddress === userAddress.toLowerCase() && b.contentId === contentId,
  );
}

export async function toggleBookmark(
  userAddress: string,
  contentId: string,
): Promise<{ bookmarked: boolean }> {
  return withWriteLock(async () => {
    const all = await readBookmarks();
    const key = userAddress.toLowerCase();
    const idx = all.findIndex(
      (b) => b.userAddress === key && b.contentId === contentId,
    );
    if (idx >= 0) {
      all.splice(idx, 1);
      await writeBookmarks(all);
      return { bookmarked: false };
    }
    all.unshift({
      id: randomUUID(),
      userAddress: key,
      contentId,
      createdAt: new Date().toISOString(),
    });
    await writeBookmarks(all);
    return { bookmarked: true };
  });
}

export async function addBookmark(
  userAddress: string,
  contentId: string,
): Promise<{ bookmarked: boolean }> {
  return withWriteLock(async () => {
    const all = await readBookmarks();
    const key = userAddress.toLowerCase();
    const exists = all.some((b) => b.userAddress === key && b.contentId === contentId);
    if (exists) return { bookmarked: true };
    all.unshift({
      id: randomUUID(),
      userAddress: key,
      contentId,
      createdAt: new Date().toISOString(),
    });
    await writeBookmarks(all);
    return { bookmarked: true };
  });
}
