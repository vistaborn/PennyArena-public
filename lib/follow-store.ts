import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDataDir, isVercelServerless } from "@/lib/data-dir";
import {
  hasSharedStore,
  readSharedFollows,
  redisFollowAdd,
  redisFollowRemove,
  redisGetFollowRecord,
  redisIsFollowing,
  redisListFollowerAddresses,
  redisListFollowingAddresses,
  redisMigrateFollowRecords,
  writeSharedFollows,
} from "@/lib/shared-store";

export type Follow = {
  id: string;
  followerAddress: string;
  followingAddress: string;
  createdAt: string;
};

const MEMORY_KEY = "__penny_follows__";

function memoryFollows(): Follow[] {
  const g = globalThis as { [MEMORY_KEY]?: Follow[] };
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = [];
  return g[MEMORY_KEY]!;
}

function followsFile() {
  return path.join(getDataDir(), "follows.json");
}

let writeChain: Promise<unknown> = Promise.resolve();
let legacyMigrated = false;

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn);
  writeChain = run.catch(() => undefined);
  return run;
}

function sortFollows(rows: Follow[]) {
  return [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

async function readFileFollows(): Promise<Follow[]> {
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    const raw = await fs.readFile(followsFile(), "utf-8");
    return JSON.parse(raw) as Follow[];
  } catch {
    return [];
  }
}

async function writeFileFollows(data: Follow[]) {
  const mem = memoryFollows();
  mem.length = 0;
  mem.push(...data);
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    await fs.writeFile(followsFile(), JSON.stringify(data, null, 2));
  } catch {
    /* ephemeral fs on serverless */
  }
  if (hasSharedStore()) await writeSharedFollows(data);
}

async function migrateLegacyFollows() {
  if (!hasSharedStore() || legacyMigrated) return;
  legacyMigrated = true;
  const [fileData, legacy] = await Promise.all([readFileFollows(), readSharedFollows<Follow>()]);
  const seed = fileData.length > 0 ? fileData : Array.isArray(legacy) ? legacy : [];
  if (seed.length > 0) await redisMigrateFollowRecords(seed);
}

async function recordForPair(follower: string, following: string): Promise<Follow> {
  const existing = await redisGetFollowRecord(follower, following);
  if (existing) {
    return {
      ...existing,
      followerAddress: follower,
      followingAddress: following,
    };
  }
  return {
    id: randomUUID(),
    followerAddress: follower,
    followingAddress: following,
    createdAt: new Date().toISOString(),
  };
}

async function readFollows(): Promise<Follow[]> {
  if (hasSharedStore()) {
    await migrateLegacyFollows();
    const legacy = await readSharedFollows<Follow>();
    if (Array.isArray(legacy) && legacy.length > 0) {
      await redisMigrateFollowRecords(legacy);
    }
  }

  const mem = memoryFollows();
  if (mem.length > 0) return sortFollows([...mem]);

  const fileData = await readFileFollows();
  mem.length = 0;
  mem.push(...fileData);
  return sortFollows(fileData);
}

export async function isFollowing(
  followerAddress: string,
  followingAddress: string,
): Promise<boolean> {
  const follower = followerAddress.toLowerCase();
  const following = followingAddress.toLowerCase();

  if (hasSharedStore()) {
    await migrateLegacyFollows();
    const hit = await redisIsFollowing(follower, following);
    if (hit !== null) return hit;
  }

  const all = await readFollows();
  return all.some(
    (f) => f.followerAddress === follower && f.followingAddress === following,
  );
}

export async function listFollowing(followerAddress: string): Promise<Follow[]> {
  const key = followerAddress.toLowerCase();

  if (hasSharedStore()) {
    await migrateLegacyFollows();
    const addresses = await redisListFollowingAddresses(key);
    if (addresses) {
      const rows = await Promise.all(
        addresses.map((following) => recordForPair(key, following)),
      );
      return sortFollows(rows);
    }
  }

  const all = await readFollows();
  return sortFollows(all.filter((f) => f.followerAddress === key));
}

export async function listFollowers(followingAddress: string): Promise<Follow[]> {
  const key = followingAddress.toLowerCase();

  if (hasSharedStore()) {
    await migrateLegacyFollows();
    const addresses = await redisListFollowerAddresses(key);
    if (addresses) {
      const rows = await Promise.all(
        addresses.map((follower) => recordForPair(follower, key)),
      );
      return sortFollows(rows);
    }
  }

  const all = await readFollows();
  return sortFollows(all.filter((f) => f.followingAddress === key));
}

export async function toggleFollow(
  followerAddress: string,
  followingAddress: string,
): Promise<{ following: boolean }> {
  if (followerAddress.toLowerCase() === followingAddress.toLowerCase()) {
    return { following: false };
  }

  return withWriteLock(async () => {
    const follower = followerAddress.toLowerCase();
    const following = followingAddress.toLowerCase();

    if (hasSharedStore()) {
      await migrateLegacyFollows();
      const exists = await redisIsFollowing(follower, following);
      if (exists) {
        await redisFollowRemove(follower, following);
        const all = (await readFollows()).filter(
          (f) => !(f.followerAddress === follower && f.followingAddress === following),
        );
        await writeFileFollows(all);
        return { following: false };
      }
      const record: Follow = {
        id: randomUUID(),
        followerAddress: follower,
        followingAddress: following,
        createdAt: new Date().toISOString(),
      };
      const ok = await redisFollowAdd(record);
      if (!ok) throw new Error("Failed to save follow");
      const all = await readFollows();
      all.unshift(record);
      await writeFileFollows(all);
      return { following: true };
    }

    const all = await readFollows();
    const idx = all.findIndex(
      (f) => f.followerAddress === follower && f.followingAddress === following,
    );
    if (idx >= 0) {
      all.splice(idx, 1);
      await writeFileFollows(all);
      return { following: false };
    }
    all.unshift({
      id: randomUUID(),
      followerAddress: follower,
      followingAddress: following,
      createdAt: new Date().toISOString(),
    });
    await writeFileFollows(all);
    return { following: true };
  });
}
