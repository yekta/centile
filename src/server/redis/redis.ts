import { env } from "@/lib/env";
import { Redis } from "ioredis";

const redis = new Redis(env.REDIS_URL + "?family=0");

const cacheTimes = {
  short: 8,
  medium: 24,
  long: 48,
};

export type TCacheTime = keyof typeof cacheTimes;

export async function setCache(
  key: string,
  value: unknown,
  cacheType: keyof typeof cacheTimes = "medium"
) {
  const start = Date.now();
  try {
    await redis.set(key, JSON.stringify(value), "EX", cacheTimes[cacheType]);
    console.log(`[CACHE][SET]: "${key}" | ${Date.now() - start}ms`);
    return true;
  } catch (error) {
    console.log(`[CACHE][ERROR]: Setting cache for "key"`, error);
  }
  return false;
}

export async function getCache<T>(key: string) {
  const start = Date.now();
  try {
    const value = await redis.get(key);
    if (!value) {
      console.log(`[CACHE][MISS]: "${key}" | ${Date.now() - start}ms`);
      return null;
    }
    console.log(`[CACHE][HIT]: "${key}" | ${Date.now() - start}ms`);
    return JSON.parse(value) as T;
  } catch (error) {
    console.log(`[CACHE][ERROR]: Getting cache for "key"`, error);
  }
  return null;
}
