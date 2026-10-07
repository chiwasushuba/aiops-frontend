# Personal AIOps frontend

React, TypeScript, Vite, and React Router frontend for a private, single-user day-to-day dashboard. The product direction and proposed delivery slices are in [the feature plan](docs/feature-plan.md).

The main routes now use the sibling backend's owner session and persisted records: employee profiles and selected Markdown, conversations, work status/results and attempts, internal approvals, tasks, local calendar items/reminders, captures, and Today. The backend seeds four editable employees. Results are suggestions; confirmed internal drafts show their saved record ID. No browser-local demo records are automatically imported.

`/login` signs in the configured owner; public signup is unavailable. Mutations use cookies and CSRF, edits use record versions, and explicit submission/confirmation retries preserve idempotency keys. Provider credentials and `OPENAI_API_KEY` stay on the backend. Work failures show safe repair instructions, including replacing an incorrect, expired, or revoked key. Connections currently show backend metadata; employee mail/calendar/Drive capabilities remain later implementation phases. Read [the actual API contract](../aiops-backend/docs/api.md), rather than the historical users/messages contracts.

## Local development

Use a Node.js version compatible with this repository's Vite and TypeScript dependencies.

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite. To check the frontend:

Start the backend on `127.0.0.1:8080` first; Vite proxies `/api` to it. Use the
backend's `local` profile for loopback HTTP cookies and open
`http://localhost:5173`, matching its allowed origin. Set the OpenAI key in the
backend environment only. Compose reads `aiops-backend/.env`; direct Maven runs
require process environment variables. A `.env` file alone is not loaded by Spring.

```powershell
npm run lint
npm run build
npm test
```

Historical prototype modules and their tests remain in the source; the main router no longer loads them. Their local-storage keys are untouched. Project instructions for Codex are in [AGENTS.md](AGENTS.md).

For browser acceptance without credentials or paid calls, start the disposable
fixture from `aiops-backend`: `./mvnw.cmd spring-boot:test-run
-Dspring-boot.run.main-class=com.aiops.aiops_backend.WorkspacePreview`. It binds
loopback port 8080, uses in-memory H2 and a fake model, and logs in with
`owner` / `test-only-password`. Keep a real backend off that port. Start Vite,
then run `node tests/workspace.browser.mjs` with Playwright available (or set
`AIOPS_PLAYWRIGHT_MODULE` to its `index.mjs`). The test uses installed Chrome,
checks refresh persistence and review, and writes ignored screenshots beneath
`node_modules/.cache/acceptance`. Stop the fixture after testing; it is not a
deployment mode.

## Vercel frontend deployment

The backend hosting plan uses Oracle Cloud Infrastructure (OCI) Always Free
compute. See [the backend deployment guide](../aiops-backend/README.md#oracle-cloud-always-free-deployment).
Vercel continues to build and host this frontend separately from the Oracle VM.

Local development remains the first test environment. When you want a hosted frontend, import this repository into Vercel as a Vite project. Use the repository root, the existing npm run build command, and the dist output directory; Vercel can detect these Vite settings automatically. The included vercel.json sends direct visits and refreshes on all frontend routes to the React app.

Before deploying, run npm ci, npm run lint, npm run build, and npm test locally. After a deployment, open a nested route directly and refresh it to check the rewrite. See the [Vite deployment guide](https://vite.dev/guide/static-deploy) and [Vercel SPA rewrite guidance](https://vercel.com/docs/project-configuration/vercel-json).

Before deploying this integrated frontend, configure an HTTPS same-origin
`/api` proxy/rewrite to the private backend, ahead of the SPA fallback in
`vercel.json`. The backend hostname has not been selected here; the existing
SPA-only rewrite is insufficient for API requests. Validate cookie/session and
CSRF behavior on the actual host. Remote deployment was not performed during
implementation. Never put model or OAuth secrets in VITE_ variables;
[Vite exposes them in the client bundle](https://vite.dev/guide/env-and-mode).

Connections now includes Google account consent and per-employee mailbox
permissions. Choose selected threads, selected labels, or the entire mailbox;
thread/label pickers show actual account resources after connection. Access is
absent by default and can be revoked. These saved permissions are the authority
foundation; model mail tools, reviewed external sending, and recurring employee
automation remain under implementation.
