import { z } from 'zod';

import {
  coverLetterAdminDocumentSchema,
  coverLetterRequestSchema,
  normalizeCoverLetterAdminDocument,
} from '../cover-letter/index.ts';

export const coverLetterGenerationLogSchemaVersion = 2;

export const coverLetterGenerationMethodKinds = [
  'api',
  'admin-ui',
  'admin-preview',
] as const;

export type CoverLetterGenerationMethodKind =
  (typeof coverLetterGenerationMethodKinds)[number];

export interface CoverLetterGenerationMethod {
  kind: CoverLetterGenerationMethodKind;
  detail?: string;
}

export interface CoverLetterGenerationLogRequest {
  company: string;
  hiringManager: string;
  role: string;
  salutation?: string;
  title: string;
  templateId: string;
}

export interface CoverLetterGenerationLogEntry {
  schemaVersion: typeof coverLetterGenerationLogSchemaVersion;
  id: string;
  createdAt: string;
  filename: string;
  method: CoverLetterGenerationMethod;
  request: CoverLetterGenerationLogRequest;
  adminDocument: z.infer<typeof coverLetterAdminDocumentSchema>;
}

export interface CoverLetterGenerationLogSummary {
  id: string;
  bodyTemplateId: string;
  bodyTemplateName: string;
  company: string;
  createdAt: string;
  filename: string;
  hiringManager: string;
  method: CoverLetterGenerationMethod;
  role: string;
  title: string;
}

export const coverLetterGenerationMethodSchema: z.ZodType<CoverLetterGenerationMethod> =
  z.object({
    detail: z.string().trim().min(1).optional(),
    kind: z.enum(coverLetterGenerationMethodKinds),
  });

export const coverLetterGenerationLogRequestSchema: z.ZodType<CoverLetterGenerationLogRequest> =
  coverLetterRequestSchema.extend({
    hiringManager: z.string().trim().min(1),
    title: z.string().trim().min(1),
    templateId: z.string().trim().min(1),
  });

export const coverLetterGenerationLogEntrySchema: z.ZodType<CoverLetterGenerationLogEntry> =
  z.object({
    adminDocument: coverLetterAdminDocumentSchema,
    createdAt: z.string().trim().min(1),
    filename: z.string().trim().min(1),
    id: z.string().trim().min(1),
    method: coverLetterGenerationMethodSchema,
    request: coverLetterGenerationLogRequestSchema,
    schemaVersion: z.literal(coverLetterGenerationLogSchemaVersion),
  });

export const coverLetterGenerationLogSummarySchema: z.ZodType<CoverLetterGenerationLogSummary> =
  z.object({
    bodyTemplateId: z.string().trim().min(1),
    bodyTemplateName: z.string().trim().min(1),
    company: z.string().trim().min(1),
    createdAt: z.string().trim().min(1),
    filename: z.string().trim().min(1),
    hiringManager: z.string().trim().min(1),
    id: z.string().trim().min(1),
    method: coverLetterGenerationMethodSchema,
    role: z.string().trim().min(1),
    title: z.string().trim().min(1),
  });

export function buildCoverLetterGenerationLogSummary(
  entry: CoverLetterGenerationLogEntry,
): CoverLetterGenerationLogSummary {
  const bodyTemplate = entry.adminDocument.bodyTemplates.find(
    function findBodyTemplate(bodyTemplateCandidate) {
      return bodyTemplateCandidate.id === entry.request.templateId;
    },
  );

  return {
    bodyTemplateId: entry.request.templateId,
    bodyTemplateName: bodyTemplate?.name || entry.request.templateId,
    company: entry.request.company,
    createdAt: entry.createdAt,
    filename: entry.filename,
    hiringManager: entry.request.hiringManager,
    id: entry.id,
    method: entry.method,
    role: entry.request.role,
    title: entry.request.title,
  };
}

export function normalizeCoverLetterGenerationLogEntry(
  input: unknown,
): CoverLetterGenerationLogEntry {
  const rawInput = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const rawRequest = rawInput.request && typeof rawInput.request === 'object' && !Array.isArray(rawInput.request)
    ? rawInput.request as Record<string, unknown>
    : {};
  const rawTemplateId =
    typeof rawRequest.templateId === 'string'
      ? rawRequest.templateId
      : typeof rawRequest.versionId === 'string'
        ? rawRequest.versionId
        : undefined;
  const normalizedEntry = {
    ...rawInput,
    adminDocument: normalizeCoverLetterAdminDocument(rawInput.adminDocument),
    request: {
      ...rawRequest,
      templateId: rawTemplateId,
    },
    schemaVersion: coverLetterGenerationLogSchemaVersion,
  };

  return coverLetterGenerationLogEntrySchema.parse(normalizedEntry);
}

export function normalizeCoverLetterGenerationLogEntries(
  input: unknown,
): CoverLetterGenerationLogEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map(normalizeCoverLetterGenerationLogEntry);
}

export function formatCoverLetterGenerationMethodLabel(
  method: CoverLetterGenerationMethod,
) {
  if (method.kind === 'admin-ui') {
    return 'Admin UI';
  }

  if (method.kind === 'admin-preview') {
    return 'Admin Preview';
  }

  const methodDetailLabel = formatCoverLetterGenerationMethodDetailLabel(
    method.detail,
  );

  if (!methodDetailLabel) {
    return 'API';
  }

  return `API (via ${methodDetailLabel})`;
}

function formatCoverLetterGenerationMethodDetailLabel(detail?: string) {
  if (!detail) {
    return '';
  }

  const normalizedDetail = detail
    .trim()
    .replace(/^ios[-_\s]+/i, '')
    .replace(/[-_]+/g, ' ');

  if (!normalizedDetail) {
    return '';
  }

  return normalizedDetail;
}
