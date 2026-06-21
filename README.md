<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/coverfire-logo-dark.gif">
    <source media="(prefers-color-scheme: light)" srcset=".github/coverfire-logo-light.gif">
    <img src=".github/coverfire-logo-light.gif" alt="Coverfire" width="460">
  </picture>
</p>

---

Coverfire recreates a configurable cover letter in HTML/CSS and generates print-ready PDF or plain-text output from the same content model.

The project currently has two parts:

- A Vite + React letter renderer
- A small Node + Puppeteer API with protected external routes and admin-only editing/generation routes

## External API

External API routes require the `x-coverfire-key` header. The header value must match `COVERFIRE_API_KEY`.

### `GET /api/templates`

Returns the available body templates without exposing template body content.

Response:

```json
[
  {
    "id": "standard",
    "slug": "standard",
    "name": "Standard"
  }
]
```

### `POST /api/pdf`

Generates a PDF cover letter.

Headers:

```http
content-type: application/json
x-coverfire-key: replace-me
```

Request body:

```json
{
  "hiringManager": "Jane Doe",
  "salutation": "Dear Jane,",
  "title": "Senior Product Designer & Full-Stack Developer",
  "role": "Senior Product Designer",
  "company": "Acme",
  "templateId": "standard"
}
```

Rules:

- `hiringManager` is optional and falls back to `Hiring Manager`
- `salutation` is optional and overrides the template greeting when provided
- `title` is optional and falls back to `Senior Product Designer & Full-Stack Developer`
- `role` is required
- `company` is required
- `templateId` is optional and selects a body template by id
- `templateId: ""` or a whitespace-only `templateId` resolves to the default body template
- `versionId` is accepted as a legacy alias when `templateId` is not provided

Response:

- `200 OK`
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="...pdf"`
- Binary PDF body

### `POST /api/text`

Generates the same cover-letter content as plain text.

Headers and request body match `POST /api/pdf`.

Response:

- `200 OK`
- `Content-Type: text/plain; charset=utf-8`
- `Content-Disposition: inline; filename="...txt"`
- Plain-text body

### Error responses

Missing or invalid API key:

```json
{
  "error": "Unauthorized"
}
```

Invalid request payload:

```json
{
  "error": "Invalid cover letter request",
  "message": "role: Invalid input: expected string, received undefined",
  "details": [
    {
      "path": "role",
      "message": "Invalid input: expected string, received undefined"
    }
  ]
}
```

## Environment variables

Copy `.env.example` and provide values as needed:

- `COVERFIRE_API_KEY`: required shared secret for `x-coverfire-key`
- `ADMIN_BASIC_AUTH_ENABLED`: optional explicit Basic Auth toggle for admin routes
- `ADMIN_BASIC_AUTH_USERNAME`: optional Basic Auth username for admin routes
- `ADMIN_BASIC_AUTH_PASSWORD`: optional Basic Auth password for admin routes
- `ADMIN_BASIC_AUTH_REALM`: optional Basic Auth realm, defaults to `Coverfire Admin`
- `PORT`: optional server port, defaults to `3000`
- `COVERFIRE_RENDER_ORIGIN`: optional render origin for local development when the Vite app is already running
- `PUPPETEER_EXECUTABLE_PATH`: optional explicit Chrome/Chromium path
- `PUPPETEER_CACHE_DIR`: optional explicit Puppeteer cache directory
- `COVERFIRE_LOCAL_STORE_PATH`: optional local JSON admin store path, defaults to `.data/coverfire-admin.json`
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL for persisted admin state
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token for persisted admin state

## Local development

Run the Vite app and API server together:

```bash
COVERFIRE_API_KEY='replace-me' \
pnpm dev
```

Run only the API server against an already-running Vite app:

```bash
COVERFIRE_API_KEY='replace-me' \
COVERFIRE_RENDER_ORIGIN='http://127.0.0.1:5173' \
PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
pnpm start
```

If you are deploying to Render, use this build command so Chrome for Testing is installed into a project-local Puppeteer cache that is available at runtime:

```bash
pnpm install && pnpm run build:render
```

Example request:

```bash
curl -X POST http://127.0.0.1:3000/api/pdf \
  -H 'content-type: application/json' \
  -H 'x-coverfire-key: replace-me' \
  --data '{
    "hiringManager": "Jane Doe",
    "role": "Senior Product Designer",
    "company": "Acme",
    "templateId": "standard"
  }' \
  --output cover-letter.pdf
```

Text example:

```bash
curl -X POST http://127.0.0.1:3000/api/text \
  -H 'content-type: application/json' \
  -H 'x-coverfire-key: replace-me' \
  --data '{
    "role": "Senior Product Designer",
    "company": "Acme",
    "templateId": ""
  }'
```

## Admin API

Admin routes are under `/api/admin`. They use Basic Auth when admin Basic Auth is enabled or when admin credentials are configured for non-local requests.

- `GET /api/admin`
- `PUT /api/admin`
- `GET /api/admin/logs`
- `GET /api/admin/logs/:id`
- `POST /api/admin/logs/:id/regenerate`
- `POST /api/admin/templates`
- `GET /api/admin/templates/:id`
- `PUT /api/admin/templates/:id`
- `DELETE /api/admin/templates/:id`
- `POST /api/admin/templates/:id/duplicate`
- `POST /api/admin/templates/:id/default`
- `POST /api/admin/pdf`
- `POST /api/admin/text`

Legacy aliases remain available:

- `POST /api/admin/generate` maps to `POST /api/admin/pdf`
- `POST /api/admin/generate-text` maps to `POST /api/admin/text`

### Admin document

`GET /api/admin` returns the full admin document:

```json
{
  "schemaVersion": 2,
  "profile": {
    "name": "Avana Vana",
    "logoAlt": "Coverfire",
    "addressLines": [],
    "footerAddressLines": [],
    "contacts": []
  },
  "defaults": {
    "title": "Senior Product Designer & Full-Stack Developer",
    "hiringManager": "Hiring Manager",
    "defaultBodyTemplateId": "standard"
  },
  "bodyTemplates": [
    {
      "id": "standard",
      "slug": "standard",
      "name": "Standard",
      "greeting": "Dear {{hiringManager}},",
      "body": "Paragraph one.\n\nParagraph two for {{company}}.",
      "signOff": "Warm regards,",
      "isDefault": true,
      "createdAt": "2026-06-21T00:00:00.000Z",
      "updatedAt": "2026-06-21T00:00:00.000Z"
    }
  ]
}
```

`PUT /api/admin` accepts the same full document shape and returns the saved document.

### Body template payload

Template create/update routes accept:

```json
{
  "name": "Template Name",
  "slug": "template-slug",
  "greeting": "Dear {{hiringManager}},",
  "body": "Paragraph one.\n\nParagraph two for {{company}}.",
  "signOff": "Warm regards,"
}
```

Create, update, duplicate, and default routes return the saved body template:

```json
{
  "id": "template-id",
  "slug": "template-slug",
  "name": "Template Name",
  "greeting": "Dear {{hiringManager}},",
  "body": "Paragraph one.\n\nParagraph two for {{company}}.",
  "signOff": "Warm regards,",
  "isDefault": false,
  "createdAt": "2026-06-21T00:00:00.000Z",
  "updatedAt": "2026-06-21T00:00:00.000Z"
}
```

`DELETE /api/admin/templates/:id` returns `204 No Content`. The API rejects deleting the only body template.

### Admin generation payload

`POST /api/admin/pdf` and `POST /api/admin/text` accept the same cover-letter request as the external generation routes, plus optional preview fields used by the admin UI:

```json
{
  "role": "Senior Product Designer",
  "company": "Acme",
  "templateId": "standard",
  "previewBodyTemplateId": "standard",
  "previewBodyTemplate": {
    "name": "Draft Template",
    "slug": "draft-template",
    "greeting": "Dear {{hiringManager}},",
    "body": "Draft body for {{company}}.",
    "signOff": "Warm regards,"
  }
}
```

Admin PDF responses match `/api/pdf`. Admin text responses match `/api/text`.

Admin generation supports these optional headers:

- `X-Coverfire-Method: admin-ui | admin-preview`
- `X-Coverfire-Render-Origin: http://127.0.0.1:5173`

### Generation logs

`GET /api/admin/logs` returns generation log summaries:

```json
[
  {
    "id": "log-entry-id",
    "bodyTemplateId": "standard",
    "bodyTemplateName": "Standard",
    "company": "Acme",
    "createdAt": "2026-06-21T00:00:00.000Z",
    "filename": "avana_vana_senior_product_designer_cover_letter_acme_2026-21-06.pdf",
    "hiringManager": "Jane Doe",
    "method": {
      "kind": "api",
      "detail": "zapier"
    },
    "role": "Senior Product Designer",
    "title": "Senior Product Designer & Full-Stack Developer"
  }
]
```

`GET /api/admin/logs/:id` returns the full log entry, including the request and admin document used for that generation. `POST /api/admin/logs/:id/regenerate` regenerates a PDF from that saved log entry and returns the same response shape as `/api/admin/pdf`.

If Upstash credentials are configured, admin state is stored in Redis. Otherwise the server persists admin state to a local JSON file for local development.

## Deployment notes

The current service can run as a single Node web service that:

- serves the built frontend from `dist`
- exposes the external API
- renders PDFs from the same deployed page

That makes it a good fit for lightweight Git-based platforms like Render.

For Render specifically:

- Build Command: `pnpm install && pnpm run build:render`
- Start Command: `pnpm start`
- Health Check Path: `/api/healthz`
- Optional Environment Variable: `PUPPETEER_CACHE_DIR=.cache/puppeteer`
