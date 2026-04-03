// ioredis v5 with NodeNext module resolution requires this pattern
import IORedis, { type Redis } from 'ioredis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RedisConstructor = (IORedis as any).default ?? IORedis;

const client: Redis = process.env.REDIS_URL
  ? new RedisConstructor(process.env.REDIS_URL)
  : new RedisConstructor({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });

export default client;
