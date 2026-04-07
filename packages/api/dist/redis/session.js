import client from './client.js';
const key = (token) => `session:${token}`;
export async function setSession(token, data, ttlSeconds = 86400) {
    await client.set(key(token), JSON.stringify(data), 'EX', ttlSeconds);
}
export async function getSession(token) {
    const raw = await client.get(key(token));
    return raw ? JSON.parse(raw) : null;
}
export async function deleteSession(token) {
    await client.del(key(token));
}
//# sourceMappingURL=session.js.map