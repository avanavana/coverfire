import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import puppeteer from 'puppeteer';
import { ZodError } from 'zod';

import {
  buildCoverLetterSearchParams,
  parseCoverLetterRequest
} from '../src/cover-letter/index.ts';

const host = process.env.HOST || '0.0.0.0';
const port = parsePort(process.env.PORT);
const apiKey = process.env.COVERFIRE_API_KEY;
const configuredRenderOrigin = process.env.COVERFIRE_RENDER_ORIGIN;
const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
const puppeteerCacheDirectory = process.env.PUPPETEER_CACHE_DIR || path.resolve(process.cwd(), '.cache', 'puppeteer');

const app = express();
const distPath = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distPath, 'index.html');
const hasBuiltClient = fs.existsSync(indexPath);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/api/healthz', function healthzApiHandler(_request, response) {
  response.json({
    ok: true
  });
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
    const pdf = await renderCoverLetterPdf(coverLetterRequest);
    const filename = [
      'avana_vana',
      slugifyFilenamePart(coverLetterRequest.role),
      'cover_letter',
      slugifyFilenamePart(coverLetterRequest.company),
      formatFilenameDate()
    ].join('-') + '.pdf';

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(pdf);
  } catch (error) {
    next(error);
  }
});

if (hasBuiltClient) {
  app.use(express.static(distPath));
}

app.get('/{*path}', function appRouteHandler(_request, response) {
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
    response.status(400).json({
      error: 'Invalid cover letter request',
      details: error.issues.map(function mapIssue(issue) {
        return {
          path: issue.path.join('.'),
          message: issue.message
        };
      })
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

async function renderCoverLetterPdf(coverLetterRequest: ReturnType<typeof parseCoverLetterRequest>) {
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
    const renderUrl = buildRenderUrl(coverLetterRequest);

    await page.goto(renderUrl, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');

    return await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true
    });
  } finally {
    await browser.close();
  }
}

function buildRenderUrl(coverLetterRequest: ReturnType<typeof parseCoverLetterRequest>) {
  const renderOrigin = getRenderOrigin();

  if (!renderOrigin) {
    throw new Error(
      'No render origin is available. Run `pnpm build` or set `COVERFIRE_RENDER_ORIGIN` to a running Vite app.'
    );
  }

  const renderUrl = new URL('/', renderOrigin);

  renderUrl.search = buildCoverLetterSearchParams(coverLetterRequest).toString();

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

function ensureApiKeyConfiguration() {
  if (!apiKey) {
    throw new Error('Missing `COVERFIRE_API_KEY` environment variable.');
  }
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
