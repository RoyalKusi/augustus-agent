import client from './client.js';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const key = (conversationId: string) => `conv_ctx:${conversationId}`;

export async function getConversationContext(conversationId: string): Promise<Message[]> {
  const items = await client.lrange(key(conversationId), 0, -1);
  return items.map((item: string) => JSON.parse(item) as Message);
}

export async function appendMessage(
  conversationId: string,
  message: Message,
  maxMessages = 30,
  ttlSeconds = 3600,
): Promise<void> {
  const k = key(conversationId);
  await client.rpush(k, JSON.stringify(message));
  await client.ltrim(k, -maxMessages, -1);
  await client.expire(k, ttlSeconds);
}

export async function clearConversationContext(conversationId: string): Promise<void> {
  await client.del(key(conversationId));
}
