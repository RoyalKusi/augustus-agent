/**
 * Admin Dashboard API utility
 * VITE_API_URL should be empty in production (same-origin) or set to the full API URL.
 * When empty, requests go to the same origin which is correct since the API serves everything.
 */

// In production, the admin dashboard is at /admin-app/ and the API is at the same origin root.
// So we use an empty base URL to make all API calls relative to the origin (not the base path).
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function adminApiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('augustus_operator_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let rawMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      rawMessage = body.message || body.error || rawMessage;
    } catch {
      // ignore
    }
    throw new Error(rawMessage);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

// Alias for backwards compatibility with existing pages that import apiFetch
export const apiFetch = adminApiFetch;
