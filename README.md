# Personal AIOps frontend

React, TypeScript, Vite, and React Router frontend for a private, single-user day-to-day dashboard. The product direction and proposed delivery slices are in [the feature plan](docs/feature-plan.md).

The frontend now has a browser-local prototype of the Today dashboard, Tasks, Calendar, and Assistant views. It starts with sample records and saves edits to this browser’s local storage so they survive refresh. The assistant uses scripted demo replies; suggestions are only saved after you review and confirm their details. `/login` and `/signup` do not provide authentication.

The sibling `../aiops-backend` repository currently provides users and individual messages CRUD APIs. This prototype does not call them. Persistent multi-device use needs task and dated-item CRUD with ownership and stable IDs, timezone-aware timestamps, conversation and message ordering, a server-side assistant operation with an idempotent retry key, and a defined access-control design before remote access.

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

The demo stores personal entries in plain browser local storage; use sample or non-sensitive information while trying it. Reset sample data from the banner to replace local changes. Project instructions for Codex and the team are in [AGENTS.md](AGENTS.md); project-specific agents and skills are in `.codex/agents/` and `.codex/skills/`, with skills registered in `.codex/config.toml`.
