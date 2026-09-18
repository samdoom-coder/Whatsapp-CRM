import { useAuth } from '@/store/auth';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let authToken: string | null = null;

export function setApiToken(token: string | null) {
  authToken = token;
}

export function clearApiToken() {
  authToken = null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const state = useAuth.getState();
  const token = authToken ?? state.token;
  const workspaceId = state.currentWorkspaceId;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (workspaceId && !path.includes('/api/auth') && !path.startsWith('/api/workspaces')) {
    headers['x-workspace-id'] = workspaceId;
  }

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    const code = data?.error?.code ?? 'ERROR';
    if (res.status === 401 && !path.includes('/api/auth/login')) {
      useAuth.getState().logout();
    }
    throw new ApiError(res.status, message, code, data?.error?.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  setToken: setApiToken,
  clearToken: clearApiToken,
};