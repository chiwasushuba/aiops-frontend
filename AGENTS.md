# AIOps frontend project guidance

## Product and current state

This is the frontend for a personal AIOps application intended to help with day-to-day life. The first release is for one private user. Use [the feature plan](docs/feature-plan.md) for proposed capabilities and open product decisions; proposed features are not implemented behavior.

The app uses React 19, TypeScript, Vite, and React Router. `src/main.tsx` mounts the router from `src/router.tsx`. `/`, `/tasks`, `/calendar`, and `/assistant` are browser-local prototype routes with sample data and scripted replies; `/login` and `/signup` are informational placeholders. The sibling `../aiops-backend` repository currently exposes users and messages CRUD APIs. It has no authentication, task, calendar, reminder, or AI assistant contract. Do not treat `POST /api/users` as signup or the messages CRUD API as a complete chat service.

## Work in this repository

- Inspect the relevant route, component, and sibling API contract before implementing a feature. Keep `docs/feature-plan.md` aligned when scope or priority is decided.
- Use typed interfaces at the API boundary. Handle loading, empty, error, and success states in user-facing flows. Keep forms keyboard accessible and layouts usable on narrow screens.
- Do not invent backend responses, authorization, or AI capabilities. Single-user scope does not make the existing users CRUD API a login system. If a screen depends on an unavailable API, describe the required contract and use clearly labeled local prototype data only when a prototype is requested.
- Keep personal data private in the UI: avoid logging message content, task details, or profile data. Do not put model or service credentials in Vite client code or `VITE_` variables.
- For assistant features, distinguish user-entered facts, model suggestions, and actions actually saved. Require a visible user confirmation before an assistant changes or sends personal data.
- Preserve unrelated changes. Follow the global working agreement and use the smallest coherent change for each feature.

## Commands and checks

- Install: `npm ci`
- Run locally: `npm run dev`
- Lint: `npm run lint`
- Type-check and build: `npm run build`

Run `npm test` for the prototype's domain behavior. Run lint and build for UI or configuration changes; add focused behavior tests when a feature introduces meaningful interactions or failure paths.

## Project Codex agents

Use `.codex/agents/personal-workflow-planner.toml` to turn a requested day-to-day workflow into a small, testable feature slice. Use `.codex/agents/ui-ux-engineer.toml` for this product's visual and interaction design, including scoped frontend implementation. Use `.codex/agents/frontend-contract-reviewer.toml` to review a proposed or implemented frontend/API integration for real contract gaps and personal-data handling. The planner and contract reviewer are read-only roles. Use the global `frontend-developer` for other frontend implementation and global specialists for other boundaries when needed. Delegate only bounded work that benefits from a separate context or review.

## Project Codex skills

Project workflows live under `.codex/skills/` and are registered in `.codex/config.toml`. Use `personal-dashboard-flow` for task, calendar/reminder, or chat slices that affect the daily dashboard; its interface reference records researched examples and the intended visual direction. Use `frontend-api-contract` when planning, wiring, or reviewing requests to the sibling backend. Continue using global skills for general frontend, debugging, security, and verification work.
