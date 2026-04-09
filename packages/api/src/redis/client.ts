// ioredis v5 with NodeNext module resolution requires this pattern
import IORedis, { type Redis } from 'ioredis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RedisConstructor = (IORedis as any).default ?? IORedis;

let client: Redis;

try {
  client = process.env.REDIS_URL
    ? new RedisConstructor(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 3000,
        commandTimeout: 2000,
        enableOfflineQueue: false,
      })
    : new RedisConstructor({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 3000,
        commandTimeout: 2000,
        enableOfflineQueue: false,
      });

  client.on('error', (err) => {
    console.error('[Redis] Connection error (non-fatal):', err.message);
  });
} catch (err) {
  console.error('[Redis] Failed to create client:', err);
  // Create a dummy client that fails gracefully
  client = new RedisConstructor({
    host: '127.0.0.1',
    port: 6379,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  });
}

export default client;
