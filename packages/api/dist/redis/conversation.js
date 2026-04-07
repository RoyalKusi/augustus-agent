import client from './client.js';
const key = (conversationId) => `conv_ctx:${conversationId}`;
export async function getConversationContext(conversationId) {
    const items = await client.lrange(key(conversationId), 0, -1);
    return items.map((item) => JSON.parse(item));
}
export async function appendMessage(conversationId, message, maxMessages = 30, ttlSeconds = 3600) {
    const k = key(conversationId);
    await client.rpush(k, JSON.stringify(message));
    await client.ltrim(k, -maxMessages, -1);
    await client.expire(k, ttlSeconds);
}
export async function clearConversationContext(conversationId) {
    await client.del(key(conversationId));
}
//# sourceMappingURL=conversation.js.map