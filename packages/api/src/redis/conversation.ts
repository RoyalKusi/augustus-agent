import client from './client.js';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const key = (conversationId: string) => `conv_ctx:${conversationId}`;
const REDIS_TIMEOUT_MS = 800;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), REDIS_TIMEOUT_MS)),
  ]).catch(() => fallback);
}

export async function getConversationContext(conversationId: string): Promise<Message[]> {
  try {
    const items = await withTimeout(client.lrange(key(conversationId), 0, -1), []);
    return items.map((item: string) => JSON.parse(item) as Message);
  } catch {
    return [];
  }
}

export async function appendMessage(
  conversationId: string,
  message: Message,
  maxMessages = 30,
  ttlSeconds = 3600,
): Promise<void> {
  const k = key(conversationId);
  try {
    await withTimeout(
      client.rpush(k, JSON.stringify(message)).then(() => client.ltrim(k, -maxMessages, -1)).then(() => client.expire(k, ttlSeconds)),
      undefined,
    );
  } catch {
    // non-fatal — context will just be empty on next message
  }
}

export async function clearConversationContext(conversationId: string): Promise<void> {
  try {
    await withTimeout(client.del(key(conversationId)), 0);
  } catch {
    // non-fatal
  }
}
