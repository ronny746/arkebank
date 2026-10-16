import Redis from 'ioredis';

// In-Memory fallback cache entry
interface MemoryCacheItem {
  value: any;
  expiresAt: number;
}

// Global scope singleton for Next.js hot-reloading
const globalForCache = global as unknown as {
  _redisClient?: Redis | null;
  _memoryCache?: Map<string, MemoryCacheItem>;
};

if (!globalForCache._memoryCache) {
  globalForCache._memoryCache = new Map<string, MemoryCacheItem>();
}

const memoryCache = globalForCache._memoryCache;

// Periodic cleanup of expired items from in-memory fallback (every 2 mins)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, item] of memoryCache.entries()) {
      if (item.expiresAt > 0 && item.expiresAt <= now) {
        memoryCache.delete(key);
      }
    }
  }, 120000).unref?.();
}

/**
 * Initialize or get Redis client
 */
function getRedisClient(): Redis | null {
  if (globalForCache._redisClient !== undefined) {
    return globalForCache._redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) return null; // stop reconnecting after 3 attempts, fallback to memory
        return Math.min(times * 200, 1000);
      },
    });

    client.on('error', (err) => {
      // Graceful error logging - won't crash app
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Redis notice:', err.message);
      }
    });

    client.on('connect', () => {
      console.log('⚡ Redis Cache Connected successfully!');
    });

    globalForCache._redisClient = client;
    return client;
  } catch (err) {
    console.warn('Redis connection init failed, using memory cache fallback:', err);
    globalForCache._redisClient = null;
    return null;
  }
}

/**
 * Get item from Cache (Redis -> Memory Fallback)
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();

  if (redis && redis.status === 'ready') {
    try {
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch {
      // Fallback to memory on Redis read error
    }
  }

  // Memory fallback
  const item = memoryCache.get(key);
  if (item) {
    if (item.expiresAt > 0 && item.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return item.value as T;
  }

  return null;
}

/**
 * Set item in Cache with TTL (in seconds)
 */
export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const redis = getRedisClient();
  const serialized = JSON.stringify(value);

  // Always store in memory fallback as well for zero-latency local hits
  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0,
  });

  if (redis && redis.status === 'ready') {
    try {
      if (ttlSeconds > 0) {
        await redis.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await redis.set(key, serialized);
      }
    } catch {
      // Ignore Redis write errors since memory cache already has it
    }
  }
}

/**
 * Delete a specific key from Cache
 */
export async function delCache(key: string): Promise<void> {
  memoryCache.delete(key);
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
}

/**
 * Delete all keys matching a pattern (e.g. "filters:*")
 */
export async function delCachePattern(pattern: string): Promise<void> {
  // Clear memory cache matching prefix
  const prefix = pattern.replace('*', '');
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k);
    }
  }

  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Cached Wrapper: Fetch from cache or execute fetcher and cache result
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = await getCache<T>(key);
  if (existing !== null && existing !== undefined) {
    return existing;
  }

  const freshData = await fetcher();
  if (freshData !== null && freshData !== undefined) {
    await setCache(key, freshData, ttlSeconds);
  }
  return freshData;
}
