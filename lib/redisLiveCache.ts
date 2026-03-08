/**
 * Shared Redis cache for YouTube live API responses.
 * Used so all serverless instances share one cache and quota stays low.
 */

import { createClient, type RedisClientType } from "redis";

const KEY_PREFIX = "yt-live:";

let client: RedisClientType | null = null;

async function getClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url?.startsWith("redis://")) return null;
  if (client?.isOpen) return client;
  try {
    client = createClient({ url });
    await client.connect();
    return client;
  } catch {
    client = null;
    return null;
  }
}

/** Get cached JSON string for key. Returns null on miss or error. */
export async function redisGet(key: string): Promise<string | null> {
  try {
    const c = await getClient();
    if (!c) return null;
    const fullKey = KEY_PREFIX + key;
    const value = await c.get(fullKey);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/** Set key to value with TTL in seconds. No-op if Redis unavailable. */
export async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    const c = await getClient();
    if (!c) return;
    const fullKey = KEY_PREFIX + key;
    await c.set(fullKey, value, { EX: ttlSeconds });
  } catch {
    // ignore
  }
}
