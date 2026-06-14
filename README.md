# Coverfire

Coverfire recreates a standard cover letter in HTML/CSS and generates a print-ready PDF from that same rendered page.

The project currently has two parts:

- A Vite + React letter renderer
- A small Node + Puppeteer API that returns PDFs from protected `POST` requests

## Request payload

`POST /api/cover-letter/pdf`

```json
{
  "hiringManager": "Jane Doe",
  "title": "Senior Product Designer & Full-Stack Developer",
  "role": "Senior Product Designer",
  "company": "Acme"
}
```

Rules:

- `hiringManager` is optional and falls back to `Hiring Manager`
- `title` is optional and falls back to `Senior Product Designer & Full-Stack Developer`
- `role` is required
- `company` is required

## Environment variables

Copy `.env.example` and provide values as needed:

- `COVERFIRE_API_KEY`: required shared secret for `x-coverfire-key`
- `PORT`: optional server port, defaults to `3000`
- `COVERFIRE_RENDER_ORIGIN`: optional render origin for local development when the Vite app is already running
- `PUPPETEER_EXECUTABLE_PATH`: optional explicit Chrome/Chromium path

## Local development

Run the Vite app:

```bash
pnpm dev
```

Run the API server in another terminal:

```bash
COVERFIRE_API_KEY='replace-me' \
COVERFIRE_RENDER_ORIGIN='http://127.0.0.1:5173' \
PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
pnpm start
```

Example request:

```bash
curl -X POST http://127.0.0.1:3000/api/cover-letter/pdf \
  -H 'content-type: application/json' \
  -H 'x-coverfire-key: replace-me' \
  --data '{
    "hiringManager": "Jane Doe",
    "role": "Senior Product Designer",
    "company": "Acme"
  }' \
  --output cover-letter.pdf
```

## Deployment notes

The current service can run as a single Node web service that:

- serves the built frontend from `dist`
- exposes the PDF API
- renders PDFs from the same deployed page

That makes it a good fit for lightweight Git-based platforms like Render.
