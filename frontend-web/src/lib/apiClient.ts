export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(`${payload.message} (${payload.code})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const getErrorPayload = (body: any, status: number): ApiErrorPayload => {
  const standardized = body?.error;
  if (standardized && typeof standardized === 'object') {
    return {
      code: standardized.code || `ERR_HTTP_${status}`,
      message: standardized.message || 'The request could not be completed.',
      details: standardized.details,
    };
  }

  return {
    code: body?.errorCode || `ERR_HTTP_${status}`,
    message: body?.message || 'The request could not be completed.',
    details: body?.details,
  };
};

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('cira_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiClient = {
  fetch: async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    const authHeaders = getAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value));

    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (response.ok) return response;

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      // Preserve a useful typed error even when a proxy returns non-JSON output.
    }
    throw new ApiError(response.status, getErrorPayload(body, response.status));
  },
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
};
