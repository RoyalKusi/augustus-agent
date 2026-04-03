import client from './client.js';

const key = (token: string) => `session:${token}`;

export async function setSession(token: string, data: object, ttlSeconds = 86400): Promise<void> {
  await client.set(key(token), JSON.stringify(data), 'EX', ttlSeconds);
}

export async function getSession(token: string): Promise<object | null> {
  const raw = await client.get(key(token));
  return raw ? JSON.parse(raw) : null;
}

export async function deleteSession(token: string): Promise<void> {
  await client.del(key(token));
}
