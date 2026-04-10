// ioredis v5 with NodeNext module resolution requires this pattern
import IORedis, { type Redis } from 'ioredis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RedisConstructor = (IORedis as any).default ?? IORedis;

let client: Redis;

try {
  client = process.env.REDIS_URL
    ? new RedisConstructor(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        // enableOfflineQueue: true (default) — queue commands during reconnect
        tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
      })
    : new RedisConstructor({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
      });

  client.on('error', (err) => {
    console.error('[Redis] Connection error (non-fatal):', err.message);
  });
} catch (err) {
  console.error('[Redis] Failed to create client:', err);
  client = new RedisConstructor({
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: 0,
  });
}

export default client;
