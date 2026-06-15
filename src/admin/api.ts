import type { CoverLetterAdminDocument, CoverLetterBodyVersion, CoverLetterRequest } from '@/cover-letter';

export interface AdminBodyVersionInput {
  name: string;
  slug: string;
  greeting: string;
  body: string;
  signOff: string;
}

interface ApiErrorDetail {
  path: string;
  message: string;
}

interface ApiErrorPayload {
  error?: string;
  message?: string;
  details?: ApiErrorDetail[];
}

export class AdminApiError extends Error {
  details?: ApiErrorDetail[];
  status: number;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || payload.error || 'Request failed.');
    this.name = 'AdminApiError';
    this.status = status;
    this.details = payload.details;
  }
}

export async function fetchAdminDocument() {
  return request<CoverLetterAdminDocument>('/api/admin');
}

export async function saveAdminDocument(adminDocument: CoverLetterAdminDocument) {
  return request<CoverLetterAdminDocument>('/api/admin', {
    body: JSON.stringify(adminDocument),
    method: 'PUT'
  });
}

export async function createBodyVersion(input: AdminBodyVersionInput) {
  return request<CoverLetterBodyVersion>('/api/admin/body', {
    body: JSON.stringify(input),
    method: 'POST'
  });
}

export async function updateBodyVersion(id: string, input: AdminBodyVersionInput) {
  return request<CoverLetterBodyVersion>(`/api/admin/body/${id}`, {
    body: JSON.stringify(input),
    method: 'PUT'
  });
}

export async function duplicateBodyVersion(id: string) {
  return request<CoverLetterBodyVersion>(`/api/admin/body/${id}/duplicate`, {
    method: 'POST'
  });
}

export async function deleteBodyVersion(id: string) {
  await request<void>(`/api/admin/body/${id}`, {
    method: 'DELETE'
  });
}

export async function setDefaultBodyVersion(id: string) {
  return request<CoverLetterBodyVersion>(`/api/admin/body/${id}/default`, {
    method: 'POST'
  });
}

export async function generatePdf(requestBody: CoverLetterRequest, apiKey: string) {
  const response = await fetch(buildApiUrl('/api/pdf'), {
    body: JSON.stringify(requestBody),
    headers: {
      'Content-Type': 'application/json',
      'X-Coverfire-Key': apiKey
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(response.headers.get('Content-Disposition'))
  };
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function buildError(response: Response) {
  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    return new AdminApiError(response.status, await response.json());
  }

  return new AdminApiError(response.status, {
    error: await response.text()
  });
}

function buildApiUrl(path: string) {
  if (typeof window === 'undefined') {
    return path;
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    if (window.location.port === '5173' || window.location.port === '4173') {
      return `http://${window.location.hostname}:3000${path}`;
    }
  }

  return path;
}

function getFilenameFromDisposition(disposition: string | null) {
  if (!disposition) {
    return null;
  }

  const filenameMatch = disposition.match(/filename="([^"]+)"/i);

  return filenameMatch?.[1] || null;
}
