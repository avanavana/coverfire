import crypto from 'node:crypto';

import { Redis } from '@upstash/redis';
import { z } from 'zod';

import {
  coverLetterAdminDocumentSchema,
  createDefaultCoverLetterAdminDocument,
  type CoverLetterAdminDocument,
  type CoverLetterBodyVersion
} from '../src/cover-letter/index.ts';

const ADMIN_DOCUMENT_KEY = 'coverfire:admin';
const upstashRedisRestUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashRedisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = upstashRedisRestUrl && upstashRedisRestToken
  ? new Redis({
      url: upstashRedisRestUrl,
      token: upstashRedisRestToken
    })
  : null;
let localAdminDocument = createDefaultCoverLetterAdminDocument();

export const adminDocumentSchema = coverLetterAdminDocumentSchema;

export const adminBodyVersionInputSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  greeting: z.string().trim().min(1),
  body: z.string().trim().min(1),
  signOff: z.string().trim().min(1)
});

export async function getAdminDocument() {
  if (!redis) {
    return localAdminDocument;
  }

  const storedDocument = await redis.get<unknown>(ADMIN_DOCUMENT_KEY);

  if (!storedDocument) {
    await redis.set(ADMIN_DOCUMENT_KEY, localAdminDocument);

    return localAdminDocument;
  }

  return adminDocumentSchema.parse(storedDocument);
}

export async function saveAdminDocument(adminDocument: CoverLetterAdminDocument) {
  const parsedDocument = adminDocumentSchema.parse(adminDocument);

  if (!redis) {
    localAdminDocument = parsedDocument;

    return localAdminDocument;
  }

  await redis.set(ADMIN_DOCUMENT_KEY, parsedDocument);

  return parsedDocument;
}

export function buildBodyVersion(input: z.infer<typeof adminBodyVersionInputSchema>, existingBodyVersion?: CoverLetterBodyVersion): CoverLetterBodyVersion {
  const timestamp = new Date().toISOString();

  return {
    id: existingBodyVersion?.id || crypto.randomUUID(),
    slug: input.slug,
    name: input.name,
    greeting: input.greeting,
    body: input.body,
    signOff: input.signOff,
    isDefault: existingBodyVersion?.isDefault || false,
    createdAt: existingBodyVersion?.createdAt || timestamp,
    updatedAt: timestamp
  };
}
