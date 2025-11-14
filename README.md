# Createlen — server + export

This repository contains a small server that generates a landing page JSON (via OpenAI or mock) and can export a ZIP (landing.html + landing.json).

Quick status: server.js already contains robust token handling, MOCK_OPENAI support, and export endpoint.

## Getting started (local)

1. Copy env example:
   ```
   cp .env.example .env
   ```
   Then edit `.env`:
   - `ALLOWED_TOKEN` — required for token auth in requests.
   - `OPENAI_KEY` — optional (only required if you want real OpenAI calls).
   - `MOCK_OPENAI` — set to `true` for local development without OpenAI.

2. Install:
   ```
   npm ci
   ```

3. Start (mock mode recommended while developing):
   ```
   MOCK_OPENAI=true ALLOWED_TOKEN="your_token_here" npm start
   ```
   or
   ```
   npm run dev
   ```

4. Test endpoints:
   - Generate (token in body):
     ```
     curl -X POST http://localhost:3000/generate -H "Content-Type: application/json" -d '{"token":"your_token_here","brief":"Тестовый бриф"}'
     ```
   - Export:
     ```
     curl "http://localhost:3000/export?sessionId=session-1&token=your_token_here" -o landing.zip
     unzip -l landing.zip
     ```

## Replit
- Import repository into Replit.
- In Replit Secrets, add:
  - `ALLOWED_TOKEN` (same value you use locally)
  - optionally `OPENAI_KEY` (if you want real OpenAI)
  - optionally `MOCK_OPENAI=true` for mock mode
- .replit already contains `run = "node server.js"`.

## CI
- A mock smoke workflow is already present: `.github/workflows/smoke-tests.yml` — it requires `ALLOWED_TOKEN` secret in GitHub Actions.

## Tests
- Run `npm test` to execute Jest + supertest integration tests (they use MOCK_OPENAI).

## Security
- Never commit real `OPENAI_KEY` into the repo. Use GitHub Secrets or Replit Secrets.