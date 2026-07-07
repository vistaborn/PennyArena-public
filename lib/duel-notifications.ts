import { hasSharedStore } from "@/lib/shared-store";
import { Redis } from "@upstash/redis";

const ACK_KEY = "penny:duel_ack:v1";

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";
  if (!url || !token || !hasSharedStore()) {
    redis = null;
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

const memoryAck = new Map<string, Set<string>>();

export async function getAcknowledgedDuels(address: string): Promise<Set<string>> {
  const key = address.toLowerCase();
  const client = getRedis();
  if (client) {
    try {
      const data = await client.hget<string[]>(ACK_KEY, key);
      return new Set(data ?? []);
    } catch {
      /* fall through */
    }
  }
  return new Set(memoryAck.get(key) ?? []);
}

export async function acknowledgeDuels(address: string, duelIds: string[]): Promise<void> {
  const key = address.toLowerCase();
  const existing = await getAcknowledgedDuels(key);
  for (const id of duelIds) existing.add(id);
  const arr = [...existing];
  const client = getRedis();
  if (client) {
    try {
      await client.hset(ACK_KEY, { [key]: arr });
      return;
    } catch {
      /* fall through */
    }
  }
  memoryAck.set(key, existing);
}
