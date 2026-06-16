import './env.ts';

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

import { Redis } from '@upstash/redis';
import { z } from 'zod';

import {
  coverLetterAdminDocumentSchema,
  createDefaultCoverLetterAdminDocument,
  normalizeCoverLetterAdminDocument,
  type CoverLetterAdminDocument,
  type CoverLetterBodyVersion
} from '../src/cover-letter/index.ts';

const ADMIN_DOCUMENT_KEY = 'coverfire:admin';
const localStorePath = process.env.COVERFIRE_LOCAL_STORE_PATH || path.resolve(process.cwd(), '.data', 'coverfire-admin.json');
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
    await loadLocalAdminDocument();

    return localAdminDocument;
  }

  const storedDocument = await redis.get<unknown>(ADMIN_DOCUMENT_KEY);

  if (!storedDocument) {
    await redis.set(ADMIN_DOCUMENT_KEY, localAdminDocument);

    return localAdminDocument;
  }

  return normalizeCoverLetterAdminDocument(storedDocument);
}

export async function saveAdminDocument(adminDocument: CoverLetterAdminDocument) {
  const parsedDocument = adminDocumentSchema.parse(
    normalizeCoverLetterAdminDocument(adminDocument)
  );

  if (!redis) {
    localAdminDocument = parsedDocument;
    await writeLocalAdminDocument(localAdminDocument);

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

async function loadLocalAdminDocument() {
  try {
    const fileContents = await fs.readFile(localStorePath, 'utf8');

    localAdminDocument = normalizeCoverLetterAdminDocument(JSON.parse(fileContents));
  } catch (error) {
    if (isMissingFileError(error)) {
      await writeLocalAdminDocument(localAdminDocument);
      return;
    }

    throw error;
  }
}

async function writeLocalAdminDocument(adminDocument: CoverLetterAdminDocument) {
  await fs.mkdir(path.dirname(localStorePath), { recursive: true });
  await fs.writeFile(localStorePath, JSON.stringify(adminDocument, null, 2));
}

function isMissingFileError(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  return error.code === 'ENOENT';
}
