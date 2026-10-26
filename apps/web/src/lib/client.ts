export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  let r: Response;
  const authHeaders: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    const csrf = localStorage.getItem('auth_csrf');
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
    if (csrf) {
      authHeaders['x-csrf-token'] = csrf;
    }
  }

  try {
    r = await fetch('/api' + path, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeaders,
        ...options.headers,
      },
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Connection unavailable. Your action is not confirmed; retry safely.', 0);
  }
  let data: any;
  try {
    data = await r.json();
  } catch {
    throw new ApiError('Service temporarily unavailable. No success is confirmed.', r.status);
  }
  if (!r.ok)
    throw new ApiError(
      data.message || 'The request could not be completed',
      r.status,
      data.fields || [],
    );
  return data;
}
