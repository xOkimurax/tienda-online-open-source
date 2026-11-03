const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let accessToken: string | null = null;

export function setStoreAccessToken(token: string | null) {
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
type RefreshResult = { accessToken: string; customer: unknown } | null;
let refreshInFlight: Promise<RefreshResult> | null = null;

function refreshSession(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = rawFetch('/api/store/auth/refresh', { method: 'POST' })
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

// Exposed so StoreAuthContext's mount-time session restore shares the same
// de-duplication as the automatic 401-retry path below.
export async function refreshStoreSession<T extends { accessToken: string }>(): Promise<T | null> {
  return (await refreshSession()) as T | null;
}

export async function storeFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);
  if (res.status === 401 && path !== '/api/store/auth/refresh') {
    const refreshed = await refreshSession();
    if (refreshed) res = await rawFetch(path, options);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function storeJson<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  return storeFetch<T>(path, { method, body: body !== undefined ? JSON.stringify(body) : undefined });
}

// For authenticated binary downloads (e.g. the order ticket PDF) — same
// auth-header + refresh-on-401 handling as storeFetch, but returns the raw
// blob instead of assuming a JSON body.
export async function storeDownload(path: string): Promise<Blob> {
  let res = await rawFetch(path, { method: 'GET' });
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) res = await rawFetch(path, { method: 'GET' });
  }
  if (!res.ok) throw await parseError(res);
  return res.blob();
}
