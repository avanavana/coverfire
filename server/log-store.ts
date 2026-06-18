import './env.ts';

import fs from 'node:fs/promises';
import path from 'node:path';

import { Redis } from '@upstash/redis';

import {
  buildCoverLetterGenerationLogSummary,
  coverLetterGenerationLogEntriesSchema,
  coverLetterGenerationLogEntrySchema,
  type CoverLetterGenerationLogEntry,
} from '../src/admin/generation-logs.ts';

const COVER_LETTER_GENERATION_LOGS_KEY = 'coverfire:generation-logs';
const localLogStorePath =
  process.env.COVERFIRE_LOCAL_LOG_STORE_PATH
  || path.resolve(process.cwd(), '.data', 'coverfire-generation-logs.json');
const upstashRedisRestUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashRedisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis =
  upstashRedisRestUrl && upstashRedisRestToken
    ? new Redis({
        token: upstashRedisRestToken,
        url: upstashRedisRestUrl,
      })
    : null;
let localGenerationLogEntries: CoverLetterGenerationLogEntry[] = [];

export async function appendCoverLetterGenerationLogEntry(
  entry: CoverLetterGenerationLogEntry,
) {
  const parsedEntry = coverLetterGenerationLogEntrySchema.parse(entry);

  if (!redis) {
    await loadLocalGenerationLogEntries();
    localGenerationLogEntries = sortCoverLetterGenerationLogEntries([
      parsedEntry,
      ...localGenerationLogEntries,
    ]);
    await writeLocalGenerationLogEntries(localGenerationLogEntries);

    return parsedEntry;
  }

  const currentEntries = await readStoredGenerationLogEntries();
  const nextEntries = sortCoverLetterGenerationLogEntries([
    parsedEntry,
    ...currentEntries,
  ]);

  await redis.set(COVER_LETTER_GENERATION_LOGS_KEY, nextEntries);

  return parsedEntry;
}

export async function findCoverLetterGenerationLogEntry(logEntryId: string) {
  const generationLogEntries = await getCoverLetterGenerationLogEntries();

  return (
    generationLogEntries.find(function findLogEntry(logEntry) {
      return logEntry.id === logEntryId;
    }) || null
  );
}

export async function getCoverLetterGenerationLogEntries() {
  if (!redis) {
    await loadLocalGenerationLogEntries();

    return localGenerationLogEntries;
  }

  return readStoredGenerationLogEntries();
}

export async function getCoverLetterGenerationLogSummaries() {
  const generationLogEntries = await getCoverLetterGenerationLogEntries();

  return generationLogEntries.map(buildCoverLetterGenerationLogSummary);
}

async function loadLocalGenerationLogEntries() {
  try {
    const fileContents = await fs.readFile(localLogStorePath, 'utf8');

    localGenerationLogEntries = sortCoverLetterGenerationLogEntries(
      coverLetterGenerationLogEntriesSchema.parse(JSON.parse(fileContents)),
    );
  } catch (error) {
    if (isMissingFileError(error)) {
      await writeLocalGenerationLogEntries(localGenerationLogEntries);
      return;
    }

    throw error;
  }
}

async function readStoredGenerationLogEntries() {
  const storedEntries = await redis?.get<unknown>(
    COVER_LETTER_GENERATION_LOGS_KEY,
  );

  return sortCoverLetterGenerationLogEntries(
    coverLetterGenerationLogEntriesSchema.parse(storedEntries || []),
  );
}

function sortCoverLetterGenerationLogEntries(
  entries: CoverLetterGenerationLogEntry[],
) {
  return entries.toSorted(function compareLogEntries(
    firstGenerationLogEntry,
    secondGenerationLogEntry,
  ) {
    return (
      new Date(secondGenerationLogEntry.createdAt).getTime()
      - new Date(firstGenerationLogEntry.createdAt).getTime()
    );
  });
}

async function writeLocalGenerationLogEntries(
  generationLogEntries: CoverLetterGenerationLogEntry[],
) {
  await fs.mkdir(path.dirname(localLogStorePath), { recursive: true });
  await fs.writeFile(
    localLogStorePath,
    JSON.stringify(generationLogEntries, null, 2),
  );
}

function isMissingFileError(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  return error.code === 'ENOENT';
}
