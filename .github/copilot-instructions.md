# Copilot repository instructions

Repository: Createlen (landing generator & webhook handler)

## General rules

- You have full permission to:
  - read and list files;
  - create, delete and modify files;
  - refactor code and project structure;
  - create branches, commits and pushes;
  - open Pull Requests.
- Work **autonomously**. Do not ask the user for confirmation on each small step.
- If you hit an error (TypeError, SyntaxError, build failure, CI failure, ESLint/Jest error, etc.) — **debug and fix it yourself**, then re-run.
- Prefer small, focused commits, but it is OK to do a larger atomic change if it’s one feature.
- Never commit directly to `main`. Always use a feature branch.

## Tools

You are allowed to use all available tools, including but not limited to:

- `read_file`, `list_files`
- `apply_patch`, `create_file`, `delete_file`
- `push_files`
- `run`, `npm`, `node` (to run scripts / dev server / tests)
- `create_pull_request`

If the UI asks whether to use `push_files` or similar tools, assume the user already agreed.

## Branch & PR conventions

- For your work, create branches with prefix `copilot/`, for example:
  - `copilot/panel-integration`
  - `copilot/panel-fixes`
  - `copilot/openai-workflow`.
- Commit messages: short, meaningful, in English, e.g.:
  - `fix: landing generation panel tabs and presets`
  - `feat: add openai landing github workflow`.
- Always open a Pull Request into `main` when the task is complete and tests pass.

## Project specifics

- Node.js project.
- Default commands:
  - Install deps: `npm ci`
  - Start webhook handler: `npm start` (runs `node webhook/webhook-handler.js`)
  - Start panel server (if `server.js` exists): `node server.js`
- Panel for landing generation:
  - HTML: `public/panel.html`
  - Webhook endpoint: `POST /webhook`
  - Panel route: `GET /panel`
  - Panel must:
    - switch tabs on the left sidebar (`data-page="main|investment|gosuslugi|influence"`);
    - fill `<textarea id="promptInput">` with JSON preset when clicking
      **“Вставить рекомендованный промт”**;
    - send `POST /webhook` with JSON body `{ source: "dashboard", page, spec }`;
    - show log messages in `<pre id="log">`;
    - work without JavaScript syntax errors in the browser console.

## Quality requirements

- No `SyntaxError` or `ReferenceError` in browser console for `/panel`.
- No failing `npm` scripts used in the task.
- Keep code readable and consistent (ES modules, modern JS, no unused variables).
- Prefer minimal dependencies; do not add heavy libraries unless really needed.

## When in doubt

- If some behaviour is unclear, choose the most pragmatic option and document it briefly in the Pull Request description.
- Assume the user wants a **fully working, tested feature**, not только «почти готовый» прототип.
