const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let accessToken: string | null = null;

export function setAdminAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function parseError(res: Response) {
  try {
    const body = await res.json();
    return new ApiError(res.status, body.error ?? res.statusText, body.details);
  } catch {
    return new ApiError(res.status, res.statusText);
  }
}

async function rawFetch(path: string, options: RequestInit) {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
}

// The refresh token rotates on every use (old one is revoked), so concurrent
// callers must share a single in-flight request — otherwise several 401s
// firing at once (e.g. a page's parallel data fetches right after reload)
// each try to refresh independently, and all but the first fail.
type RefreshResult = { accessToken: string; user: unknown } | null;
let refreshInFlight: Promise<RefreshResult> | null = null;

function refreshSession(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = rawFetch('/api/admin/auth/refresh', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        accessToken = data.accessToken;
        return data as RefreshResult;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Exposed so AdminAuthContext's mount-time session restore shares the same
// de-duplication as the automatic 401-retry path below.
export async function refreshAdminSession<T extends { accessToken: string }>(): Promise<T | null> {
  return (await refreshSession()) as T | null;
}

export async function adminFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);
  if (res.status === 401 && path !== '/api/admin/auth/refresh') {
    const refreshed = await refreshSession();
    if (refreshed) res = await rawFetch(path, options);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function adminJson<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  return adminFetch<T>(path, { method, body: body !== undefined ? JSON.stringify(body) : undefined });
}

// For binary downloads (report PDF/Excel exports) — a plain <a href> can't
// carry the Authorization header this API needs, so the file has to be
// fetched as a blob and handed to the browser via a throwaway object URL.
export async function adminDownload(path: string, filename: string): Promise<void> {
  let res = await rawFetch(path, { method: 'GET' });
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) res = await rawFetch(path, { method: 'GET' });
  }
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
