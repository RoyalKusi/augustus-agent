const BASE_URL = import.meta.env.VITE_API_URL || '';

// User-friendly messages for common HTTP status codes
function friendlyError(status: number, rawMessage: string): string {
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You don\'t have permission to do that.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 422) return rawMessage; // validation errors are user-facing
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our end. Please try again shortly.';
  return rawMessage || `Request failed (${status})`;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('augustus_token');
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

    if (res.status === 401) {
      localStorage.removeItem('augustus_token');
      // Only redirect if not already on an auth page to avoid loops
      if (!window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }

    throw new Error(friendlyError(res.status, rawMessage));
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const token = localStorage.getItem('augustus_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}
