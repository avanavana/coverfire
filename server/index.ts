import './env.ts';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import puppeteer, { type Page } from 'puppeteer';
import { ZodError } from 'zod';

import {
  adminBodyVersionInputSchema,
  adminDocumentSchema,
  buildBodyVersion,
  getAdminDocument,
  saveAdminDocument
} from './admin-store.ts';
import {
  type CoverLetterAdminDocument,
  type CoverLetterBodyVersion,
  buildCoverLetter,
  buildCoverLetterSearchParams,
  parseCoverLetterRequest,
  serializeCoverLetterAdminDocument,
} from '../src/cover-letter/index.ts';

const host = process.env.HOST || '0.0.0.0';
const port = parsePort(process.env.PORT);
const apiKey = process.env.COVERFIRE_API_KEY;
const adminBasicAuthUsername = process.env.ADMIN_BASIC_AUTH_USERNAME;
const adminBasicAuthPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;
const adminBasicAuthRealm = process.env.ADMIN_BASIC_AUTH_REALM || 'Coverfire Admin';
const configuredRenderOrigin = process.env.COVERFIRE_RENDER_ORIGIN;
const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
const puppeteerCacheDirectory = process.env.PUPPETEER_CACHE_DIR || path.resolve(process.cwd(), '.cache', 'puppeteer');

const app = express();
const distPath = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distPath, 'index.html');
const hasBuiltClient = fs.existsSync(indexPath);

app.disable('x-powered-by');
validateAdminBasicAuthConfiguration();
app.use(function localDevelopmentCorsHandler(request, response, next) {
  const origin = request.header('origin');

  if (origin && isAllowedDevelopmentOrigin(origin)) {
    response.header('Access-Control-Allow-Origin', origin);
    response.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Coverfire-Key');
    response.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.header('Access-Control-Expose-Headers', 'Content-Disposition');
    response.header('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});
app.use(express.json({ limit: '1mb' }));
app.use('/admin', adminBasicAuthMiddleware);
app.use('/api/admin', adminBasicAuthMiddleware);

app.get('/api/healthz', function healthzApiHandler(_request, response) {
  response.json({
    ok: true
  });
});

app.get('/api/admin', async function adminHandler(_request, response, next) {
  try {
    const adminDocument = await getAdminDocument();

    response.json(adminDocument);
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin', async function updateAdminHandler(request, response, next) {
  try {
    const adminDocument = adminDocumentSchema.parse(request.body);
    const savedAdminDocument = await saveAdminDocument(adminDocument);

    response.json(savedAdminDocument);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/body', async function createAdminBodyHandler(request, response, next) {
  try {
    const input = adminBodyVersionInputSchema.parse(request.body);
    const adminDocument = await getAdminDocument();
    const newBodyVersion = buildBodyVersion(input);
    const nextAdminDocument = {
      ...adminDocument,
      bodyVersions: [
        ...adminDocument.bodyVersions,
        newBodyVersion
      ]
    };
    const savedAdminDocument = await saveAdminDocument(nextAdminDocument);

    response.status(201).json(getBodyVersionById(savedAdminDocument, newBodyVersion.id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/body/:id', async function adminBodyDetailHandler(request, response, next) {
  try {
    const adminDocument = await getAdminDocument();
    const bodyVersion = getBodyVersionById(adminDocument, request.params.id);

    response.json(bodyVersion);
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/body/:id', async function updateAdminBodyHandler(request, response, next) {
  try {
    const input = adminBodyVersionInputSchema.parse(request.body);
    const adminDocument = await getAdminDocument();
    const existingBodyVersion = getBodyVersionById(adminDocument, request.params.id);
    const nextBodyVersion = buildBodyVersion(input, existingBodyVersion);
    const nextAdminDocument = {
      ...adminDocument,
      bodyVersions: adminDocument.bodyVersions.map(function mapBodyVersion(bodyVersion) {
        return bodyVersion.id === request.params.id ? nextBodyVersion : bodyVersion;
      })
    };
    const savedAdminDocument = await saveAdminDocument(nextAdminDocument);

    response.json(getBodyVersionById(savedAdminDocument, request.params.id));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/body/:id', async function deleteAdminBodyHandler(request, response, next) {
  try {
    const adminDocument = await getAdminDocument();

    if (adminDocument.bodyVersions.length === 1) {
      response.status(400).json({
        error: 'Cannot delete the only body version.'
      });
      return;
    }

    const bodyVersion = getBodyVersionById(adminDocument, request.params.id);
    const remainingBodyVersions = adminDocument.bodyVersions.filter(function filterBodyVersion(candidateBodyVersion) {
      return candidateBodyVersion.id !== bodyVersion.id;
    });
    const nextDefaultBodyVersionId = adminDocument.defaults.defaultBodyVersionId === bodyVersion.id
      ? remainingBodyVersions[0].id
      : adminDocument.defaults.defaultBodyVersionId;
    const nextAdminDocument = {
      ...adminDocument,
      defaults: {
        ...adminDocument.defaults,
        defaultBodyVersionId: nextDefaultBodyVersionId
      },
      bodyVersions: remainingBodyVersions.map(function mapBodyVersion(candidateBodyVersion) {
        return {
          ...candidateBodyVersion,
          isDefault: candidateBodyVersion.id === nextDefaultBodyVersionId
        };
      })
    };

    await saveAdminDocument(nextAdminDocument);

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/body/:id/duplicate', async function duplicateAdminBodyHandler(request, response, next) {
  try {
    const adminDocument = await getAdminDocument();
    const bodyVersion = getBodyVersionById(adminDocument, request.params.id);
    const duplicatedSlug = buildUniqueSlug(adminDocument, `${bodyVersion.slug}-copy`);
    const duplicatedBodyVersion = {
      ...bodyVersion,
      id: crypto.randomUUID(),
      name: `Copy of ${bodyVersion.name}`,
      slug: duplicatedSlug,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const nextAdminDocument = {
      ...adminDocument,
      bodyVersions: [
        ...adminDocument.bodyVersions,
        duplicatedBodyVersion
      ]
    };
    const savedAdminDocument = await saveAdminDocument(nextAdminDocument);

    response.status(201).json(getBodyVersionById(savedAdminDocument, duplicatedBodyVersion.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/body/:id/default', async function defaultAdminBodyHandler(request, response, next) {
  try {
    const adminDocument = await getAdminDocument();
    const bodyVersion = getBodyVersionById(adminDocument, request.params.id);
    const nextAdminDocument = {
      ...adminDocument,
      defaults: {
        ...adminDocument.defaults,
        defaultBodyVersionId: bodyVersion.id
      },
      bodyVersions: adminDocument.bodyVersions.map(function mapBodyVersion(candidateBodyVersion) {
        return {
          ...candidateBodyVersion,
          isDefault: candidateBodyVersion.id === bodyVersion.id,
          updatedAt: candidateBodyVersion.id === bodyVersion.id
            ? new Date().toISOString()
            : candidateBodyVersion.updatedAt
        };
      })
    };
    const savedAdminDocument = await saveAdminDocument(nextAdminDocument);

    response.json(getBodyVersionById(savedAdminDocument, bodyVersion.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/generate', async function adminGeneratePdfHandler(request, response, next) {
  try {
    const coverLetterRequest = parseCoverLetterRequest(request.body);
    const adminDocument = applyPreviewBodyVersion(
      await getAdminDocument(),
      request.body.previewBodyVersionId,
      request.body.previewBodyVersion
    );
    const pdf = await renderCoverLetterPdf(
      coverLetterRequest,
      adminDocument,
      getRequestedRenderOrigin(request)
    );

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${buildPdfFilename(coverLetterRequest)}"`);
    response.send(pdf);
  } catch (error) {
    next(error);
  }
});

app.post('/api/pdf', async function coverLetterPdfHandler(request, response, next) {
  try {
    ensureApiKeyConfiguration();

    if (!isAuthorizedRequest(request.header('x-coverfire-key'))) {
      response.status(401).json({
        error: 'Unauthorized'
      });
      return;
    }

    const coverLetterRequest = parseCoverLetterRequest(request.body);
    const adminDocument = await getAdminDocument();
    const pdf = await renderCoverLetterPdf(coverLetterRequest, adminDocument);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${buildPdfFilename(coverLetterRequest)}"`);
    response.send(pdf);
  } catch (error) {
    next(error);
  }
});

if (hasBuiltClient) {
  app.use(express.static(distPath));
}

app.get('/{*path}', function appRouteHandler(_request, response) {
  if (_request.path.startsWith('/letter') && !isAuthorizedRequest(_request.header('x-coverfire-key'))) {
    response.status(404).type('text/plain').send('Not found');
    return;
  }

  if (!hasBuiltClient) {
    response.status(503).type('text/plain').send(
      'Frontend build not found. Run `pnpm build` or set `COVERFIRE_RENDER_ORIGIN` to a running Vite app.'
    );
    return;
  }

  response.sendFile(indexPath);
});

app.use(function errorHandler(error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) {
  void next;

  if (error instanceof ZodError) {
    const details = error.issues.map(function mapIssue(issue) {
      return {
        path: issue.path.join('.'),
        message: issue.message
      };
    });
    const firstDetail = details[0];
    const message = firstDetail
      ? [ firstDetail.path, firstDetail.message ].filter(Boolean).join(': ')
      : 'Invalid cover letter request';

    response.status(400).json({
      error: 'Invalid cover letter request',
      message,
      details
    });
    return;
  }

  if (error instanceof Error) {
    response.status(500).json({
      error: error.message
    });
    return;
  }

  response.status(500).json({
    error: 'Unknown server error'
  });
});

app.listen(port, host, function listenHandler() {
  const renderOrigin = getRenderOrigin();

  console.log(`Coverfire server listening on http://${host}:${port}`);
  console.log(`PDF render origin: ${renderOrigin}`);
  console.log(`Puppeteer cache directory: ${puppeteerCacheDirectory}`);
  console.log(`Puppeteer cache exists: ${fs.existsSync(puppeteerCacheDirectory)}`);
});

async function renderCoverLetterPdf(
  coverLetterRequest: ReturnType<typeof parseCoverLetterRequest>,
  adminDocument: Awaited<ReturnType<typeof getAdminDocument>>,
  renderOriginOverride?: string | null
) {
  const browser = await puppeteer.launch({
    args: [
      '--disable-setuid-sandbox',
      '--no-sandbox'
    ],
    executablePath: puppeteerExecutablePath,
    headless: true
  });

  try {
    const page = await browser.newPage();
    const renderUrl = buildRenderUrl(coverLetterRequest, adminDocument, renderOriginOverride);

    if (apiKey) {
      await page.setExtraHTTPHeaders({
        'x-coverfire-key': apiKey
      });
    }

    await gotoRenderUrl(page, renderUrl);
    await page.evaluateHandle('document.fonts.ready');

    return await page.pdf({
      format: 'Letter',
      pageRanges: '1',
      printBackground: true,
      preferCSSPageSize: true
    });
  } finally {
    await browser.close();
  }
}

async function gotoRenderUrl(page: Page, renderUrl: string) {
  try {
    await page.goto(renderUrl, { waitUntil: 'networkidle0' });
  } catch (error) {
    const fallbackRenderUrl = getLocalRenderUrlFallback(renderUrl);

    if (!fallbackRenderUrl) {
      throw error;
    }

    await page.goto(fallbackRenderUrl, { waitUntil: 'networkidle0' });
  }
}

function buildRenderUrl(
  coverLetterRequest: ReturnType<typeof parseCoverLetterRequest>,
  adminDocument: Awaited<ReturnType<typeof getAdminDocument>>,
  renderOriginOverride?: string | null
) {
  const renderOrigin = renderOriginOverride || getRenderOrigin();

  if (!renderOrigin) {
    throw new Error(
      'No render origin is available. Run `pnpm build` or set `COVERFIRE_RENDER_ORIGIN` to a running Vite app.'
    );
  }

  const renderUrl = new URL('/letter', renderOrigin);
  const resolvedCoverLetter = buildCoverLetter(coverLetterRequest, adminDocument);
  const adminDocumentJson = serializeCoverLetterAdminDocument(adminDocument);

  renderUrl.search = buildCoverLetterSearchParams({
    ...coverLetterRequest,
    hiringManager: resolvedCoverLetter.recipient.hiringManager,
    title: resolvedCoverLetter.signature.title,
    versionId: resolvedCoverLetter.bodyVersion.id
  }).toString();
  renderUrl.searchParams.set('adminDocument', adminDocumentJson);

  return renderUrl.toString();
}

function getRenderOrigin() {
  if (configuredRenderOrigin) {
    return configuredRenderOrigin;
  }

  if (hasBuiltClient) {
    return `http://127.0.0.1:${port}`;
  }

  return null;
}

function getLocalRenderUrlFallback(renderUrl: string) {
  const url = new URL(renderUrl);

  if (url.hostname === '127.0.0.1') {
    url.hostname = 'localhost';
    return url.toString();
  }

  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
    return url.toString();
  }

  return null;
}

function getRequestedRenderOrigin(request: express.Request) {
  const requestedRenderOrigin = request.header('x-coverfire-render-origin');

  if (!requestedRenderOrigin) {
    return null;
  }

  return isAllowedDevelopmentOrigin(requestedRenderOrigin) ? requestedRenderOrigin : null;
}

function ensureApiKeyConfiguration() {
  if (!apiKey) {
    throw new Error('Missing `COVERFIRE_API_KEY` environment variable.');
  }
}

function adminBasicAuthMiddleware(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
) {
  if (!isAdminBasicAuthEnabled()) {
    next();
    return;
  }

  const authorizationHeader = request.header('authorization');
  const credentials = parseBasicAuthorizationHeader(authorizationHeader);

  if (!credentials || !isAuthorizedAdminRequest(credentials.username, credentials.password)) {
    response.setHeader('WWW-Authenticate', `Basic realm="${adminBasicAuthRealm}", charset="UTF-8"`);
    response.status(401).type('text/plain').send('Authentication required.');
    return;
  }

  next();
}

function validateAdminBasicAuthConfiguration() {
  const hasAdminBasicAuthUsername = typeof adminBasicAuthUsername === 'string' && adminBasicAuthUsername.length > 0;
  const hasAdminBasicAuthPassword = typeof adminBasicAuthPassword === 'string' && adminBasicAuthPassword.length > 0;

  if (hasAdminBasicAuthUsername === hasAdminBasicAuthPassword) {
    return;
  }

  throw new Error(
    'Set both `ADMIN_BASIC_AUTH_USERNAME` and `ADMIN_BASIC_AUTH_PASSWORD`, or leave both unset.'
  );
}

function isAdminBasicAuthEnabled() {
  return typeof adminBasicAuthUsername === 'string'
    && adminBasicAuthUsername.length > 0
    && typeof adminBasicAuthPassword === 'string'
    && adminBasicAuthPassword.length > 0;
}

function isAuthorizedRequest(requestApiKey: string | undefined) {
  if (!apiKey || !requestApiKey) {
    return false;
  }

  const expectedApiKey = Buffer.from(apiKey);
  const providedApiKey = Buffer.from(requestApiKey);

  if (expectedApiKey.length !== providedApiKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedApiKey, providedApiKey);
}

function isAuthorizedAdminRequest(username: string, password: string) {
  if (!adminBasicAuthUsername || !adminBasicAuthPassword) {
    return false;
  }

  const expectedUsername = Buffer.from(adminBasicAuthUsername);
  const providedUsername = Buffer.from(username);
  const expectedPassword = Buffer.from(adminBasicAuthPassword);
  const providedPassword = Buffer.from(password);

  return expectedUsername.length === providedUsername.length
    && expectedPassword.length === providedPassword.length
    && crypto.timingSafeEqual(expectedUsername, providedUsername)
    && crypto.timingSafeEqual(expectedPassword, providedPassword);
}

function parseBasicAuthorizationHeader(authorizationHeader: string | undefined) {
  if (!authorizationHeader?.startsWith('Basic ')) {
    return null;
  }

  try {
    const decodedCredentials = Buffer.from(authorizationHeader.slice('Basic '.length), 'base64').toString('utf8');
    const separatorIndex = decodedCredentials.indexOf(':');

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decodedCredentials.slice(0, separatorIndex),
      password: decodedCredentials.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function buildPdfFilename(coverLetterRequest: ReturnType<typeof parseCoverLetterRequest>) {
  return [
    'avana_vana',
    slugifyFilenamePart(coverLetterRequest.role),
    'cover_letter',
    slugifyFilenamePart(coverLetterRequest.company),
    formatFilenameDate()
  ].join('-') + '.pdf';
}

function parsePort(portValue: string | undefined) {
  if (!portValue) {
    return 3000;
  }

  const parsedPort = Number(portValue);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid PORT value: ${portValue}`);
  }

  return parsedPort;
}

function isAllowedDevelopmentOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function slugifyFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '') || 'value';
}

function formatFilenameDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    day: '2-digit',
    month: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(function findPart(part) {
    return part.type === 'year';
  })?.value;
  const day = parts.find(function findPart(part) {
    return part.type === 'day';
  })?.value;
  const month = parts.find(function findPart(part) {
    return part.type === 'month';
  })?.value;

  if (!year || !day || !month) {
    throw new Error('Unable to format filename date.');
  }

  return `${year}-${day}-${month}`;
}

function getBodyVersionById(adminDocument: CoverLetterAdminDocument, bodyVersionId: string) {
  const bodyVersion = adminDocument.bodyVersions.find(function findBodyVersion(candidateBodyVersion: CoverLetterBodyVersion) {
    return candidateBodyVersion.id === bodyVersionId;
  });

  if (!bodyVersion) {
    throw new Error(`Body version not found: ${bodyVersionId}`);
  }

  return bodyVersion;
}

function applyPreviewBodyVersion(
  adminDocument: CoverLetterAdminDocument,
  previewBodyVersionId: unknown,
  previewBodyVersionInput: unknown
) {
  const parsedPreviewBodyVersion = adminBodyVersionInputSchema.safeParse(previewBodyVersionInput);

  if (!parsedPreviewBodyVersion.success) {
    return adminDocument;
  }

  const existingBodyVersion = typeof previewBodyVersionId === 'string'
    ? adminDocument.bodyVersions.find(function findBodyVersion(bodyVersion) {
        return bodyVersion.id === previewBodyVersionId;
      })
    : undefined;
  const previewBodyVersion = buildBodyVersion(parsedPreviewBodyVersion.data, existingBodyVersion);
  const hasExistingBodyVersion = adminDocument.bodyVersions.some(function someBodyVersion(bodyVersion) {
    return bodyVersion.id === previewBodyVersion.id;
  });

  return {
    ...adminDocument,
    bodyVersions: hasExistingBodyVersion
      ? adminDocument.bodyVersions.map(function mapBodyVersion(bodyVersion) {
          return bodyVersion.id === previewBodyVersion.id ? previewBodyVersion : bodyVersion;
        })
      : [
          ...adminDocument.bodyVersions,
          previewBodyVersion
        ]
  };
}

function buildUniqueSlug(adminDocument: CoverLetterAdminDocument, baseSlug: string) {
  let nextSlug = baseSlug;
  let suffix = 2;

  while (adminDocument.bodyVersions.some(function someBodyVersion(bodyVersion: CoverLetterBodyVersion) {
    return bodyVersion.slug === nextSlug;
  })) {
    nextSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return nextSlug;
}
