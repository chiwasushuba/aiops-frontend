# Personal AIOps frontend

React, TypeScript, Vite, and React Router frontend for a private, single-user day-to-day dashboard. The product direction and proposed delivery slices are in [the feature plan](docs/feature-plan.md).

The frontend has a browser-local prototype of Today, Tasks, Calendar, agent-specific scripted conversations, Agents, Work queue, Approvals, Connections, and Capture inbox. It starts with four named agents: School Agent, My Email, Study Coach, and Projects Partner. Agent names, work requests, planned service access, GitHub links, small Markdown previews, captured notes, tasks, and dated items survive refresh in the same browser. Daily and weekly tasks advance after completion. Due reminders appear while AIOps is open; optional browser alerts also require the page to remain open.

The assistant's replies are scripted. Plan/research jobs wait for a backend; reviewed task and dated-item proposals can be saved locally once. The Connections page does not connect accounts, and email or external-calendar proposals cannot execute. `/login` and `/signup` do not provide authentication. The sibling `../aiops-backend` currently provides users and individual messages CRUD only; this frontend does not call it. The proposed backend records, HTTP contracts, security boundaries, and delivery slices are in [the agent workspaces plan](docs/agent-workspaces-plan.md).

## Local development

Use a Node.js version compatible with this repository's Vite and TypeScript dependencies.

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite. To check the frontend:

```powershell
npm run lint
npm run build
npm test
```

The demo stores personal entries, including uploaded Markdown text, in plain browser local storage; use sample or non-sensitive information while trying it. Reset sample data from the banner to replace local changes in both demo stores. Project instructions for Codex and the team are in [AGENTS.md](AGENTS.md); project-specific agents and skills are in `.codex/agents/` and `.codex/skills/`, with skills registered in `.codex/config.toml`.

## Vercel frontend deployment

Local development remains the first test environment. When you want a hosted frontend, import this repository into Vercel as a Vite project. Use the repository root, the existing npm run build command, and the dist output directory; Vercel can detect these Vite settings automatically. The included vercel.json sends direct visits and refreshes on all frontend routes to the React app.

Before deploying, run npm ci, npm run lint, npm run build, and npm test locally. After a deployment, open a nested route directly and refresh it to check the rewrite. See the [Vite deployment guide](https://vite.dev/guide/static-deploy) and [Vercel SPA rewrite guidance](https://vercel.com/docs/project-configuration/vercel-json).

The deployed site is still a browser-local demo: each browser has its own sample data and scripted replies, and the placeholder login pages do not protect it. Treat the hosted URL as reachable by others and use sample data while testing. Personal accounts, real agents, and cross-device records require a separately deployed HTTPS backend with authentication, server-side credentials, and API contracts before those features go online. Never put model or OAuth secrets in VITE_ variables; [Vite exposes them in the client bundle](https://vite.dev/guide/env-and-mode).
