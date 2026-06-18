import { z } from 'zod';

import {
  coverLetterAdminDocumentSchema,
  coverLetterRequestSchema,
} from '../cover-letter/index.ts';

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
  versionId: string;
}

export interface CoverLetterGenerationLogEntry {
  id: string;
  createdAt: string;
  filename: string;
  method: CoverLetterGenerationMethod;
  request: CoverLetterGenerationLogRequest;
  adminDocument: z.infer<typeof coverLetterAdminDocumentSchema>;
}

export interface CoverLetterGenerationLogSummary {
  id: string;
  bodyVersionId: string;
  bodyVersionName: string;
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
    versionId: z.string().trim().min(1),
  });

export const coverLetterGenerationLogEntrySchema: z.ZodType<CoverLetterGenerationLogEntry> =
  z.object({
    adminDocument: coverLetterAdminDocumentSchema,
    createdAt: z.string().trim().min(1),
    filename: z.string().trim().min(1),
    id: z.string().trim().min(1),
    method: coverLetterGenerationMethodSchema,
    request: coverLetterGenerationLogRequestSchema,
  });

export const coverLetterGenerationLogEntriesSchema = z.array(
  coverLetterGenerationLogEntrySchema,
);

export const coverLetterGenerationLogSummarySchema: z.ZodType<CoverLetterGenerationLogSummary> =
  z.object({
    bodyVersionId: z.string().trim().min(1),
    bodyVersionName: z.string().trim().min(1),
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
  const bodyVersion = entry.adminDocument.bodyVersions.find(
    function findBodyVersion(bodyVersionCandidate) {
      return bodyVersionCandidate.id === entry.request.versionId;
    },
  );

  return {
    bodyVersionId: entry.request.versionId,
    bodyVersionName: bodyVersion?.name || entry.request.versionId,
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
