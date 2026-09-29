# Backend build checklist

Status: core backend implemented on 2026-09-29 for private, single-owner remote access, with `gpt-6-luna` configured through the OpenAI Responses API. See [the implemented API contract](../../aiops-backend/docs/api.md) and [setup guide](../../aiops-backend/README.md). Checked items below have backend verification; remaining boxes include partial or future work. The frontend still uses browser-local demo data. Live OpenAI access and internet deployment require the owner's credentials and hosting setup. Gmail task check-ins are now implemented in the backend but require OAuth setup, account connection, and explicit opt-in. Use [the feature plan](feature-plan.md) for product priority and [the agent workspace plan](agent-workspaces-plan.md) for record and connector details.

## What exists today

- [x] Spring Boot, PostgreSQL, Flyway, and tests exist in `../aiops-backend`.
- [x] Legacy `/api/users` is retired: unauthenticated reads return 401, and the owner receives 410. Existing legacy data is preserved.
- [x] Legacy `/api/messages` is retired. New conversation messages have owner, agent, conversation, and run relationships.
- [x] Retire those public CRUD routes. Owner bootstrap and session login are separate from profile CRUD.
- [ ] Integrate the frontend with server APIs; all current frontend records and replies are browser-local prototypes.

## 1. Foundation: identity, privacy, and API rules

- [x] Decide whether the backend will be reachable beyond the owner's machine. Choose an owner sign-in/session design for that deployment; protect every personal-data route and provider callback. If it remains local-only, define the local access boundary explicitly.
- [x] Implement sign-in, session renewal or expiry, sign-out, and `GET /api/me` (owner ID, display name, timezone, safe account settings). Define any signup or owner bootstrap flow separately from users CRUD.
- [x] Add owner IDs and database migrations for all personal records. Resolve ownership from the authenticated session, never from a client-supplied `ownerId`; check it on list, detail, mutation, worker, and connector tool paths.
- [ ] Define versioned request/response DTOs, validation, pagination for growing lists, stable IDs, ISO 8601 instants, and date-only task deadlines. Return consistent private-safe errors such as `{code,message,fieldErrors?,requestId}` with meaningful 400, 401/403, 404, 409, 410, 429, and 503 responses.
- [ ] Set HTTPS, credential handling, CORS, cookie/CSRF rules if using browser sessions, rate limits, request size limits, and safe logging. Keep model keys, OAuth secrets, and provider tokens server-side; encrypt stored tokens and keep them out of responses.
- [x] Add migrations, indexes, backup/restore procedure, and tests for owner isolation, validation, stale versions, idempotency, and failure recovery. Decide retention, export, and deletion for messages, uploads, provider excerpts, and work history before using real private data.

## 2. Named agents and sources (`/agents`)

- [x] `GET /api/agents`, `POST /api/agents`, `GET /api/agents/{id}`, `PATCH /api/agents/{id}`: persist name, role, focus, instructions, status, timestamps, and version. Seed the four starter roles (School Agent, My Email, Study Coach, Projects Partner) for the owner; allow later creation without deployment.
- [x] `POST /api/agents/{id}/archive` and `/restore`: retain history; define behavior for queued or running work when an agent is archived.
- [x] `POST /api/source-uploads`: accept bounded `.md` uploads (the prototype limits files to 50 KB), store safely, parse as untrusted text, and return an upload ID and processing status.
- [ ] `GET /api/agents/{id}/sources`, `POST /api/agents/{id}/sources`, `DELETE /api/agents/{id}/sources/{sourceId}`: attach/detach approved upload or provider resources, return parse/sync status, and enforce owner plus agent grants. Do not fetch arbitrary user URLs server-side.
- [x] Preserve the agent profile version used for each run so editing instructions does not silently change an in-flight job.

## 3. Conversations and real assistant replies (`/assistant`)

- [x] `GET/POST /api/agents/{id}/conversations`, `GET /api/conversations/{id}/messages`, `POST /api/conversations/{id}/messages`: persist ordered, agent-specific history. A send should return the user message ID plus a run ID/status; use a client request ID so retries do not duplicate a message.
- [ ] Add a model execution service/worker with bounded time, token/cost budget, cancellation, and a visible failed state. Store assistant output and citations to allowed sources; never treat model text as an authorized action.
- [ ] Isolate context by agent and explicit source selection. Label user facts, assistant suggestions, and saved actions distinctly in stored records and responses.
- [x] Provide `GET /api/runs/{id}` (or an equivalent status stream) for pending, running, complete, and failed replies. Make retry behavior explicit.

## 4. Work queue and results (`/work`)

- [x] `GET/POST /api/work-items`, `GET /api/work-items/{id}`: create an agent-owned request with instruction, desired outcome, optional capture ID, and client request ID; return timestamps, run ID, state, result, and error summary.
- [x] `POST /api/work-items/{id}/notes`, `/cancel`, `/retry`: persist clarifications and safe transitions. A note added during execution must start a revision/new run or wait for the next run; it cannot silently alter a running job.
- [ ] Persist queue jobs and worker leases so a restart cannot lose work or execute a completed step twice. Use clear `queued`, `running`, `awaiting_approval`, `completed`, `failed`, and `cancelled` states, plus attempt history.
- [ ] Record source references and outcomes. Return an honest result for plan/research work and surface provider or model failures instead of claiming success.

## 5. Exact approvals and external actions (`/approvals`)

Implemented: versioned owner-entered task/event drafts, 24-hour expiry, explicit confirmation, decline/revision, and transactional one-time internal saves. Model text remains a suggestion. External actions and agent-generated structured proposals remain future work.

- [ ] `GET /api/proposals?status=pending`, `GET /api/proposals/{id}`, `POST /api/proposals/{id}/confirm`, `/decline`, `/request-revision`: persist proposal origin, exact task/date/email payload, version, expiry, status, and work item link. Require `expectedVersion` and an idempotency key on confirmation.
- [ ] Keep a user-entered draft distinct from an agent suggestion. Any material edit supersedes the old proposal and requires review of the new exact payload.
- [ ] On confirmation, recheck owner, connection health, agent grant, resource scope, and proposal version server-side. Save an internal task/date once or dispatch an external email/calendar operation once; record operation ID and outcome.
- [ ] Reconcile uncertain provider outcomes before retrying after a timeout or crash. Show pending, succeeded, failed, and unknown outcomes without silently sending a second email or creating a second event.

## 6. Connections and agent access (`/connections`)

Gmail send-only task check-ins are implemented. Gmail remains unavailable until server OAuth settings and an encryption key are configured. Other providers remain unavailable. Google refresh tokens are encrypted server-side after the owner connects Gmail; no agent gets Gmail access.

- [ ] `GET /api/connectors`, `GET /api/connections`, `POST /api/connections/{provider}/authorize`, provider callback, `DELETE /api/connections/{id}`: show safe account labels/scopes/status; implement OAuth state, callback validation, token refresh, disconnect, and expiry handling.
- [ ] `GET/PUT /api/agents/{id}/grants`: grant specific capabilities on a specific connection and optional resource IDs. A connected account gives no agent access by default; planned browser checkboxes are not grants.
- [ ] Implement provider adapters in slices: Gmail **send** for owner-approved recurring task check-ins first; email read/draft/agent send separately; one calendar provider before the second; Canvas read-only courses/assignments if institutional access is available; selected GitHub repository or Projects resources as needed.
- [ ] Enforce provider consent and per-agent grants at every tool call, outside model output. Handle disconnected, denied, expired, rate-limited, and unavailable states. Treat retrieved email, course, repository, and Markdown content as untrusted input.

## 7. Persistent tasks and routines (`/tasks`)

- [x] `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/{id}`, `POST /api/tasks/{id}/complete` and `/reopen`: persist title, priority, optional date-only deadline, completion state, and daily/weekly repeat rule.
- [x] Store routine occurrences and completion history. Advance a repeat only once per completed occurrence, even on retry; calculate the next date in the owner's chosen IANA timezone.
- [x] Define how edits/deletion affect past occurrences and scheduled notifications. Return the current task and next occurrence after a mutation.

## 8. Calendar items and reminders (`/calendar`)

Local calendar records and durable `scheduled`/`ready`/`acknowledged` reminders are implemented, including snooze. The scheduler runs with the browser closed, but this release does not deliver email, push, or OS notifications.

- [x] `GET/POST /api/dated-items`, `GET/PATCH/DELETE /api/dated-items/{id}`: persist title, start/end instants where applicable, timezone, and optional reminder rule. Keep local app items distinct from external provider events.
- [ ] Add reminder delivery/status endpoints (for example `GET /api/reminders`, `POST /api/reminders/{id}/acknowledge` and `/snooze`) once the delivery behavior is chosen.
- [ ] Run a durable scheduler while the browser is closed. Decide channel, quiet hours, missed reminder behavior, timezone changes, and retry policy; record delivered/failed state. Open-page browser alerts alone do not satisfy this feature.

## 9. Gmail check-ins for unfinished tasks

- [x] `GET/PUT /api/settings/task-check-ins`: store enabled flag, destination address, IANA timezone, schedule, next slot, and last delivery outcome. Enabling requires an explicit owner action and a connected Gmail send connection; disabling stops future sends.
- [x] Implement the proposed schedule from the feature plan: one digest at 09:00 within seven days of a date-only deadline, extra 15:00 and 21:00 digests on the due date, then one 09:00 digest each overdue day until completion or deletion. The settings API requires explicit schedule confirmation before enabling. Never send an empty digest.
- [x] Recompute eligibility from persisted tasks for each slot; completion/removal excludes a task from the next digest and a repeating task becomes eligible for its next occurrence.
- [x] Store one delivery record per owner and scheduled slot with a unique key, provider message ID, attempt/result, and no automatic retry of unknown outcomes. Pause and report expired Gmail authorization or send failures; do not report a message as delivered until the provider confirms it.
- [x] Keep these owner-authorized recurring digests separate from agent-authored email, which always needs exact proposal review.

## 10. Capture inbox and Today summary (`/inbox`, `/`)

- [x] `GET/POST /api/captures`, `PATCH /api/captures/{id}`: persist text, open/sent/archived status, timestamps, and links to routed work or task; support reopen.
- [x] Route capture to `POST /api/work-items` or task creation atomically or with an idempotent conversion operation. Preserve the original capture and its outcome on retry.
- [x] Supply Today from owned pending approvals, queued/running work, open captures, due/overdue tasks, and upcoming dated items. Start with the list endpoints above; add `GET /api/today` only if one summary response is useful after integration.

## Build order and done criteria

1. [ ] **Private persistence:** identity/session, owner checks, API errors, database migrations, and safe configuration. Verify a second or unauthenticated identity cannot read/write personal records.
2. [ ] **First usable slice:** agents, separate conversations, work queue, run status, and real results. Verify refresh/another signed-in device, cancellation, failure, and retry.
3. [ ] **Controlled integrations:** connection lifecycle, narrow agent grants, versioned proposals, and one-time execution. Verify denied tools and crash/retry cases.
4. [ ] **Personal records:** tasks, routines, dated items, captures, Today aggregation, and reminder scheduling. Verify timezone, repeat completion, and refresh.
5. [ ] **First closed-app delivery:** Gmail task check-ins with explicit opt-in, durable slots, and visible delivery state. Verify completion stops a future digest and duplicate workers do not double-send.
6. [ ] **Further sources/providers:** Canvas, GitHub, mail reading, and additional calendar/mail providers only after the relevant access and scope decisions are settled.

Before each frontend screen switches to the API, verify its loading, empty, success, validation, denied, expired/disconnected, and retry states. The frontend must not silently migrate or upload browser-local prototype data; decide an explicit import/reset path if old demo records should survive.

## Decisions needed before the affected slice

- [x] Owner-only remote access, configured BCrypt password and secure browser session behind HTTPS.
- [x] OpenAI `gpt-6-luna`; text planning and selected Markdown analysis, bounded input/output/time and daily runs. Records remain until explicit deletion. Model account access remains a runtime check.
- [ ] First calendar provider; Canvas institutional access; GitHub repository versus Projects scope.
- [ ] Owner timezone, Gmail destination address, final check-in schedule, and reminder quiet hours/channel.
- [x] Paginated personal-data export and explicit workspace deletion; retained until deletion. Provider content is not ingested in this release.
