import client from './client.js';

const key = (lockKey: string) => `lock:${lockKey}`;

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function acquireLock(lockKey: string, ttlSeconds = 30): Promise<string | null> {
  const token = generateToken();
  const result = await client.set(key(lockKey), token, 'EX', ttlSeconds, 'NX');
  return result === 'OK' ? token : null;
}

export async function releaseLock(lockKey: string, lockToken: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await client.eval(script, 1, key(lockKey), lockToken);
  return result === 1;
}
