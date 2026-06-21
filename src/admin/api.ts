import type {
  CoverLetterAdminDocument,
  CoverLetterBodyTemplate,
  CoverLetterRequest,
} from '@/cover-letter';
import type {
  CoverLetterGenerationLogEntry,
  CoverLetterGenerationLogSummary,
} from '@/admin/generation-logs';

export interface AdminBodyTemplateInput {
  name: string;
  slug: string;
  greeting: string;
  body: string;
  signOff: string;
}

interface GenerateAdminPdfOptions {
  method?: 'admin-preview' | 'admin-ui';
  previewBodyTemplate?: AdminBodyTemplateInput;
  previewBodyTemplateId?: string;
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

const adminRequestTimeoutMs = 1500;
const pdfRequestTimeoutMs = 30000;

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

export async function fetchCoverLetterGenerationLog(logEntryId: string) {
  return request<CoverLetterGenerationLogEntry>(`/api/admin/logs/${logEntryId}`);
}

export async function fetchCoverLetterGenerationLogs() {
  return request<CoverLetterGenerationLogSummary[]>('/api/admin/logs');
}

export async function saveAdminDocument(adminDocument: CoverLetterAdminDocument) {
  return request<CoverLetterAdminDocument>('/api/admin', {
    body: JSON.stringify(adminDocument),
    method: 'PUT'
  });
}

export async function createBodyTemplate(input: AdminBodyTemplateInput) {
  return request<CoverLetterBodyTemplate>('/api/admin/templates', {
    body: JSON.stringify(input),
    method: 'POST'
  });
}

export async function updateBodyTemplate(id: string, input: AdminBodyTemplateInput) {
  return request<CoverLetterBodyTemplate>(`/api/admin/templates/${id}`, {
    body: JSON.stringify(input),
    method: 'PUT'
  });
}

export async function duplicateBodyTemplate(id: string) {
  return request<CoverLetterBodyTemplate>(`/api/admin/templates/${id}/duplicate`, {
    method: 'POST'
  });
}

export async function deleteBodyTemplate(id: string) {
  await request<void>(`/api/admin/templates/${id}`, {
    method: 'DELETE'
  });
}

export async function setDefaultBodyTemplate(id: string) {
  return request<CoverLetterBodyTemplate>(`/api/admin/templates/${id}/default`, {
    method: 'POST'
  });
}

export async function generateAdminPdf(requestBody: CoverLetterRequest, options: GenerateAdminPdfOptions = {}) {
  const response = await fetchWithRetry(buildApiUrl('/api/admin/generate'), {
    body: JSON.stringify({
      ...requestBody,
      previewBodyTemplate: options.previewBodyTemplate,
      previewBodyTemplateId: options.previewBodyTemplateId
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Coverfire-Method': options.method || 'admin-ui',
      ...(typeof window !== 'undefined'
        ? { 'X-Coverfire-Render-Origin': window.location.origin }
        : {})
    },
    method: 'POST'
  }, {
    timeoutMs: pdfRequestTimeoutMs
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(response.headers.get('Content-Disposition'))
  };
}

export async function generateAdminText(requestBody: CoverLetterRequest, options: GenerateAdminPdfOptions = {}) {
  const response = await fetchWithRetry(buildApiUrl('/api/admin/generate-text'), {
    body: JSON.stringify({
      ...requestBody,
      previewBodyTemplate: options.previewBodyTemplate,
      previewBodyTemplateId: options.previewBodyTemplateId
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Coverfire-Method': options.method || 'admin-ui',
      ...(typeof window !== 'undefined'
        ? { 'X-Coverfire-Render-Origin': window.location.origin }
        : {})
    },
    method: 'POST'
  }, {
    timeoutMs: pdfRequestTimeoutMs
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  return {
    text: await response.text(),
    filename: getFilenameFromDisposition(response.headers.get('Content-Disposition'))
  };
}

export async function generatePdf(requestBody: CoverLetterRequest, apiKey: string) {
  const response = await fetchWithRetry(buildApiUrl('/api/pdf'), {
    body: JSON.stringify(requestBody),
    headers: {
      'Content-Type': 'application/json',
      'X-Coverfire-Key': apiKey
    },
    method: 'POST'
  }, {
    timeoutMs: pdfRequestTimeoutMs
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(response.headers.get('Content-Disposition'))
  };
}

export async function generateText(requestBody: CoverLetterRequest, apiKey: string) {
  const response = await fetchWithRetry(buildApiUrl('/api/text'), {
    body: JSON.stringify(requestBody),
    headers: {
      'Content-Type': 'application/json',
      'X-Coverfire-Key': apiKey
    },
    method: 'POST'
  }, {
    timeoutMs: pdfRequestTimeoutMs
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  return {
    text: await response.text(),
    filename: getFilenameFromDisposition(response.headers.get('Content-Disposition'))
  };
}

export async function regenerateCoverLetterGenerationLog(logEntryId: string) {
  const response = await fetchWithRetry(
    buildApiUrl(`/api/admin/logs/${logEntryId}/regenerate`),
    {
      headers: {
        ...(typeof window !== 'undefined'
          ? { 'X-Coverfire-Render-Origin': window.location.origin }
          : {})
      },
      method: 'POST'
    },
    {
      timeoutMs: pdfRequestTimeoutMs
    },
  );

  if (!response.ok) {
    throw await buildError(response);
  }

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(
      response.headers.get('Content-Disposition'),
    )
  };
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetchWithRetry(buildApiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  }, {
    timeoutMs: adminRequestTimeoutMs
  });

  if (!response.ok) {
    throw await buildError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: {
    timeoutMs: number;
  }
) {
  const candidateUrls = getCandidateApiUrls(url);
  let lastError: unknown = null;

  for (const candidateUrl of candidateUrls) {
    try {
      return await fetchWithTimeout(candidateUrl, init, options.timeoutMs);
    } catch (error) {
      lastError = error;

      if (!isRetriableNetworkError(error)) {
        break;
      }
    }
  }

  throw lastError;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const abortController = new AbortController();
  const cleanupAbortListener = init.signal
    ? subscribeToAbort(init.signal, abortController)
    : null;
  const timeoutId = window.setTimeout(function abortSlowRequest() {
    abortController.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: abortController.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
    cleanupAbortListener?.();
  }
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
  return path;
}

function getCandidateApiUrls(url: string) {
  if (typeof window === 'undefined') {
    return [ url ];
  }

  try {
    const parsedUrl = new URL(url, window.location.origin);
    const candidateUrls = [ parsedUrl.toString() ];

    if (parsedUrl.pathname.startsWith('/api/') && (window.location.port === '5173' || window.location.port === '4173')) {
      candidateUrls.push(`http://127.0.0.1:3000${parsedUrl.pathname}${parsedUrl.search}`);
      candidateUrls.push(`http://localhost:3000${parsedUrl.pathname}${parsedUrl.search}`);
    }

    if (parsedUrl.hostname === 'localhost') {
      candidateUrls.push(parsedUrl.toString().replace('://localhost', '://127.0.0.1'));
    }

    if (parsedUrl.hostname === '127.0.0.1') {
      candidateUrls.push(parsedUrl.toString().replace('://127.0.0.1', '://localhost'));
    }

    return Array.from(new Set(candidateUrls));
  } catch {
    return [ url ];
  }
}

function isRetriableNetworkError(error: unknown) {
  return error instanceof TypeError || error instanceof DOMException;
}

function subscribeToAbort(signal: AbortSignal, abortController: AbortController) {
  if (signal.aborted) {
    abortController.abort();
    return null;
  }

  function abortFromSignal() {
    abortController.abort();
  }

  signal.addEventListener('abort', abortFromSignal, { once: true });

  return function cleanupAbortSubscription() {
    signal.removeEventListener('abort', abortFromSignal);
  };
}

function getFilenameFromDisposition(disposition: string | null) {
  if (!disposition) {
    return null;
  }

  const filenameMatch = disposition.match(/filename="([^"]+)"/i);

  return filenameMatch?.[1] || null;
}
