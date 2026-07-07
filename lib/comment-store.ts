import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDataDir, isVercelServerless } from "@/lib/data-dir";
import { hasSharedStore, readSharedComments, writeSharedComments } from "@/lib/shared-store";
import { bumpCommentCount } from "@/lib/content-store";

export type Comment = {
  id: string;
  contentId: string | null;
  duelId: string | null;
  authorAddress: string;
  authorUsername: string;
  body: string;
  createdAt: string;
};

const MEMORY_KEY = "__penny_comments__";

function memoryComments(): Comment[] {
  const g = globalThis as { [MEMORY_KEY]?: Comment[] };
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = [];
  return g[MEMORY_KEY]!;
}

function commentsFile() {
  return path.join(getDataDir(), "comments.json");
}

let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn);
  writeChain = run.catch(() => undefined);
  return run;
}

function normalizeComment(raw: Partial<Comment> & { id: string }): Comment {
  return {
    id: raw.id,
    contentId: raw.contentId ?? null,
    duelId: raw.duelId ?? null,
    authorAddress: raw.authorAddress ?? "",
    authorUsername: raw.authorUsername ?? "",
    body: raw.body ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

async function readComments(): Promise<Comment[]> {
  const mem = memoryComments();

  if (isVercelServerless() && hasSharedStore()) {
    const shared = await readSharedComments<Comment>();
    if (shared) {
      const data = shared.map((c) => normalizeComment(c));
      mem.length = 0;
      mem.push(...data);
      return [...data];
    }
  }

  if (mem.length > 0) return [...mem];

  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(commentsFile(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<Comment>[];
    const data = parsed.map((c) => normalizeComment(c as Comment));
    if (isVercelServerless()) {
      mem.length = 0;
      mem.push(...data);
      if (hasSharedStore()) await writeSharedComments(data);
    }
    return data;
  } catch {
    return [];
  }
}

async function writeComments(data: Comment[]) {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(commentsFile(), JSON.stringify(data, null, 2));
  if (isVercelServerless()) {
    const mem = memoryComments();
    mem.length = 0;
    mem.push(...data);
    if (hasSharedStore()) await writeSharedComments(data);
  }
}

export async function listComments(contentId: string): Promise<Comment[]> {
  const all = await readComments();
  return all
    .filter((c) => c.contentId === contentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function listCommentsByDuel(duelId: string): Promise<Comment[]> {
  const all = await readComments();
  return all
    .filter((c) => c.duelId === duelId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function listCommentsByAuthor(authorAddress: string): Promise<Comment[]> {
  const all = await readComments();
  return all
    .filter((c) => c.authorAddress === authorAddress.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createComment(input: {
  contentId?: string | null;
  duelId?: string | null;
  authorAddress: string;
  authorUsername: string;
  body: string;
}): Promise<Comment> {
  return withWriteLock(async () => {
    const all = await readComments();
    const comment: Comment = {
      id: randomUUID(),
      contentId: input.contentId ?? null,
      duelId: input.duelId ?? null,
      authorAddress: input.authorAddress.toLowerCase(),
      authorUsername: input.authorUsername,
      body: input.body.trim(),
      createdAt: new Date().toISOString(),
    };
    all.unshift(comment);
    await writeComments(all);
    if (input.contentId) await bumpCommentCount(input.contentId, 1);
    return comment;
  });
}

export async function seedCommentsBulk(items: Comment[]) {
  return withWriteLock(async () => {
    const existing = await readComments();
    const ids = new Set(existing.map((c) => c.id));
    await writeComments([...items.filter((i) => !ids.has(i.id)), ...existing]);
  });
}
