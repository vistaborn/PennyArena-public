import { Redis } from "@upstash/redis";

const CONTENT_KEY = "penny:content:v1";
const PROFILES_KEY = "penny:profiles:v1";
const USERNAMES_KEY = "penny:usernames:v1";
const DUELS_KEY = "penny:duels:v1";
const VOTES_KEY = "penny:votes:v1";
const COMMENTS_KEY = "penny:comments:v1";
const FOLLOWS_KEY = "penny:follows:v1";
const BOOKMARKS_KEY = "penny:bookmarks:v1";
const LIKES_KEY = "penny:likes:v1";
const TIPS_KEY = "penny:tips:v1";
const USED_TX_KEY = "penny:used_tx:v1";

let redis: Redis | null | undefined;

function redisEnv(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";
  if (!url || !token) return null;
  return { url, token };
}

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const env = redisEnv();
  if (env) {
    redis = new Redis({ url: env.url, token: env.token });
  } else {
    redis = null;
  }
  return redis;
}

export function hasSharedStore(): boolean {
  return getRedis() !== null;
}

async function readJson<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const data = await client.get<T>(key);
    return data ?? null;
  } catch (e) {
    console.error(`[shared-store] read ${key} failed`, e);
    return null;
  }
}

async function writeJson<T>(key: string, data: T): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, data);
  } catch (e) {
    console.error(`[shared-store] write ${key} failed`, e);
  }
}

export async function readSharedContent<T>(): Promise<T[] | null> {
  const data = await readJson<T[]>(CONTENT_KEY);
  return Array.isArray(data) ? data : null;
}

export async function writeSharedContent<T>(data: T[]): Promise<void> {
  await writeJson(CONTENT_KEY, data);
}

export async function readSharedProfiles<T>(): Promise<Record<string, T> | null> {
  const data = await readJson<Record<string, T>>(PROFILES_KEY);
  if (!data || typeof data !== "object") return null;
  return data;
}

export async function writeSharedProfiles<T>(data: Record<string, T>): Promise<void> {
  await writeJson(PROFILES_KEY, data);
}

export async function readSharedUsernames(): Promise<Record<string, string> | null> {
  const data = await readJson<Record<string, string>>(USERNAMES_KEY);
  if (!data || typeof data !== "object") return null;
  return data;
}

export async function writeSharedUsernames(data: Record<string, string>): Promise<void> {
  await writeJson(USERNAMES_KEY, data);
}

export async function readSharedDuels<T>(): Promise<T[] | null> {
  const data = await readJson<T[]>(DUELS_KEY);
  return Array.isArray(data) ? data : null;
}

export async function writeSharedDuels<T>(data: T[]): Promise<void> {
  await writeJson(DUELS_KEY, data);
}

export async function readSharedVotes<T>(): Promise<T[] | null> {
  const data = await readJson<T[]>(VOTES_KEY);
  return Array.isArray(data) ? data : null;
}

export async function writeSharedVotes<T>(data: T[]): Promise<void> {
  await writeJson(VOTES_KEY, data);
}

export async function readSharedComments<T>(): Promise<T[] | null> {
  const data = await readJson<T[]>(COMMENTS_KEY);
  return Array.isArray(data) ? data : null;
}

export async function writeSharedComments<T>(data: T[]): Promise<void> {
  await writeJson(COMMENTS_KEY, data);
}

export async function readSharedFollows<T>(): Promise<T[] | null> {
  const data = await readJson<T[]>(FOLLOWS_KEY);
  return Array.isArray(data) ? data : null;
}

export async function writeSharedFollows<T>(data: T[]): Promise<void> {
  await writeJson(FOLLOWS_KEY, data);
}

const FOLLOWING_SET_PREFIX = "penny:following-set:v1:";
const FOLLOWERS_SET_PREFIX = "penny:followers-set:v1:";
const FOLLOW_RECORDS_HASH = "penny:follow-records:v1";

function followField(follower: string, following: string) {
  return `${follower.toLowerCase()}:${following.toLowerCase()}`;
}

export async function redisFollowAdd(record: {
  id: string;
  followerAddress: string;
  followingAddress: string;
  createdAt: string;
}): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  const follower = record.followerAddress.toLowerCase();
  const following = record.followingAddress.toLowerCase();
  try {
    await Promise.all([
      client.sadd(`${FOLLOWING_SET_PREFIX}${follower}`, following),
      client.sadd(`${FOLLOWERS_SET_PREFIX}${following}`, follower),
      client.hset(FOLLOW_RECORDS_HASH, { [followField(follower, following)]: record }),
    ]);
    return true;
  } catch (e) {
    console.error("[shared-store] redisFollowAdd failed", e);
    return false;
  }
}

export async function redisFollowRemove(
  followerAddress: string,
  followingAddress: string,
): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  const follower = followerAddress.toLowerCase();
  const following = followingAddress.toLowerCase();
  try {
    await Promise.all([
      client.srem(`${FOLLOWING_SET_PREFIX}${follower}`, following),
      client.srem(`${FOLLOWERS_SET_PREFIX}${following}`, follower),
      client.hdel(FOLLOW_RECORDS_HASH, followField(follower, following)),
    ]);
    return true;
  } catch (e) {
    console.error("[shared-store] redisFollowRemove failed", e);
    return false;
  }
}

export async function redisIsFollowing(
  followerAddress: string,
  followingAddress: string,
): Promise<boolean | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const hit = await client.sismember(
      `${FOLLOWING_SET_PREFIX}${followerAddress.toLowerCase()}`,
      followingAddress.toLowerCase(),
    );
    return hit === 1;
  } catch (e) {
    console.error("[shared-store] redisIsFollowing failed", e);
    return null;
  }
}

export async function redisListFollowingAddresses(
  followerAddress: string,
): Promise<string[] | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const rows = await client.smembers(`${FOLLOWING_SET_PREFIX}${followerAddress.toLowerCase()}`);
    return Array.isArray(rows) ? rows.map((a) => String(a).toLowerCase()) : [];
  } catch (e) {
    console.error("[shared-store] redisListFollowingAddresses failed", e);
    return null;
  }
}

export async function redisListFollowerAddresses(
  followingAddress: string,
): Promise<string[] | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const rows = await client.smembers(`${FOLLOWERS_SET_PREFIX}${followingAddress.toLowerCase()}`);
    return Array.isArray(rows) ? rows.map((a) => String(a).toLowerCase()) : [];
  } catch (e) {
    console.error("[shared-store] redisListFollowerAddresses failed", e);
    return null;
  }
}

export async function redisGetFollowRecord(
  followerAddress: string,
  followingAddress: string,
): Promise<{
  id: string;
  followerAddress: string;
  followingAddress: string;
  createdAt: string;
} | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const row = await client.hget(
      FOLLOW_RECORDS_HASH,
      followField(followerAddress, followingAddress),
    );
    if (!row || typeof row !== "object") return null;
    return row as {
      id: string;
      followerAddress: string;
      followingAddress: string;
      createdAt: string;
    };
  } catch (e) {
    console.error("[shared-store] redisGetFollowRecord failed", e);
    return null;
  }
}

export async function redisMigrateFollowRecords(
  records: {
    id: string;
    followerAddress: string;
    followingAddress: string;
    createdAt: string;
  }[],
): Promise<void> {
  if (records.length === 0) return;
  await Promise.all(records.map((record) => redisFollowAdd(record)));
}

export async function readSharedBookmarks<T>(): Promise<T[] | null> {
  const data = await readJson<T[]>(BOOKMARKS_KEY);
  return Array.isArray(data) ? data : null;
}

export async function writeSharedBookmarks<T>(data: T[]): Promise<void> {
  await writeJson(BOOKMARKS_KEY, data);
}

export async function readSharedLikes<T>(): Promise<T[] | null> {
  const data = await readJson<T[]>(LIKES_KEY);
  return Array.isArray(data) ? data : null;
}

export async function writeSharedLikes<T>(data: T[]): Promise<void> {
  await writeJson(LIKES_KEY, data);
}

export async function readSharedTips<T>(): Promise<T[] | null> {
  const data = await readJson<T[]>(TIPS_KEY);
  return Array.isArray(data) ? data : null;
}

export async function writeSharedTips<T>(data: T[]): Promise<void> {
  await writeJson(TIPS_KEY, data);
}

export async function readSharedUsedTx(): Promise<Record<string, string> | null> {
  const data = await readJson<Record<string, string>>(USED_TX_KEY);
  return data && typeof data === "object" ? data : null;
}

export async function writeSharedUsedTx(data: Record<string, string>): Promise<void> {
  await writeJson(USED_TX_KEY, data);
}
