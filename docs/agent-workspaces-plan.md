# Agent workspaces and backend handoff

Status: frontend-only prototype implemented 2026-09-25; every HTTP contract below is proposed backend work. The sibling Spring Boot backend currently exposes users and individual messages CRUD only. Those routes are not sign-in, conversations, work execution, or connected-service APIs.

## Product scope and order

The user's confirmed order is: (1) named personal agents, (2) work queue and results, (3) calendar and email connections with per-agent access and outside-action approval, (4) persistent tasks, recurring routines, and active reminders, (5) one capture inbox. Authentication, ownership, and secure transport are prerequisites for any remotely reachable personal data.

The first four agents are **School Agent**, **My Email**, **Study Coach**, and **Projects Partner**. Canvas means the [DLSU Canvas LMS](https://dlsu.instructure.com/), not Canva. The School Agent should eventually read authorized courses, assignments, and due dates. My Email should review selected mail, draft responses, and track follow-ups. Study Coach should plan and practice using explicitly shared course context. Projects Partner should use selected GitHub repositories, Projects boards, or uploaded Markdown documents and track milestones and decisions.

## Current frontend states and handoff

| View | Current local behavior | Backend replacement |
| --- | --- | --- |
| `/agents` | Named profiles, focus/instructions, source URL metadata, local Markdown preview | Owned profile and source records; server-side source ingestion |
| `/assistant` | Agent-separated scripted conversations | Authenticated conversations, messages, model runs, and source citations |
| `/work` | Requests and instructions saved locally; plan/research waits for backend; structured local proposal previews | Durable queue, worker execution, status, results, retry/cancel |
| `/approvals` | Exact local task/date proposal can be saved; email and external-calendar previews cannot execute | Versioned proposals and one-time external execution after confirmation |
| `/connections` | Supported-service catalog and intended per-agent access; no account connected | OAuth/account state, granted scopes, resource filters, revoke/refresh |
| `/tasks`, `/calendar` | Browser-local tasks, daily/weekly repeat, open-page reminder alerts | Owned records, occurrence history, timezone-aware scheduler and delivery |
| `/inbox` | Capture, route to work request, archive/reopen | Durable capture and conversion provenance |

The frontend uses two local-storage keys and does not call the backend. Do not reuse local prototype checkboxes as authorization or a local email preview as permission to send later. A backend-integrated screen must load server state and show loading, empty, denied, disconnected, expired, failure, and success explicitly.

## Trust and data ownership

- Authenticate the single owner; every agent, source, connection, conversation, work item, proposal, task, dated item, routine, reminder, and capture belongs to that identity. Enforce ownership on every read and mutation, including source and tool calls. The existing `POST /api/users` is profile CRUD, not signup.
- Keep model keys, provider OAuth secrets, access/refresh tokens, and Canvas or GitHub credentials on the backend. Never return them to the browser or place them in `VITE_` variables, URLs, logs, or Markdown uploads.
- Separate **provider consent** from **agent grants**. A connected account grants no agent access by default. A grant names a connection, capability, and optional resource filter: selected Canvas course IDs, mail folders/labels, calendar IDs, or repository IDs. Check the grant at each tool call outside the model.
- Treat email bodies, Canvas course content, GitHub files, Markdown uploads, retrieved pages, and model output as untrusted data. They can inform an answer but cannot change system rules, grants, or approval requirements.
- Store source references and short evidence excerpts with a run. Agent profiles and conversations remain separate unless the user deliberately shares a source. Retention, export, archive, and deletion rules should be decided before storing real personal data.

## Suggested records

| Record | Essential fields |
| --- | --- |
| `agent_profiles` | id, ownerId, name, roleKey, focus, instructions, status, version, timestamps |
| `agent_sources` | id, agentId, kind (Canvas course, GitHub repo, GitHub Projects board, Markdown), provider/resource ID or upload ID, consent and parse status, timestamps |
| `connections` | id, ownerId, provider, account label, encrypted token reference, granted provider scopes, status, expiry |
| `agent_grants` | agentId, connectionId, capability, resource filter, enabled, version |
| `conversations/messages` | ownerId, agentId, conversationId, role, content, order, status, timestamps |
| `work_items/runs` | id, ownerId, agentId, instruction, desired outcome, state, run ID, profile version, client request ID, timestamps, result, source references, error/cancel metadata |
| `work_notes` | workItemId, author, text, createdAt; a clarification is never silently inserted into an already executing run |
| `action_proposals` | id, workItemId, kind, exact payload, version, status, expiry, required connection/grant, confirmation identity, operation ID, execution result |
| `tasks/routines/occurrences` | ownerId, title, priority, due date, repeat rule, IANA timezone, series/occurrence IDs, completion history |
| `dated_items/reminders` | ownerId, start/end instants, timezone, reminder rule, delivery channel, delivered/acknowledged state |
| `capture_items` | id, ownerId, text, status, routed work/task ID, timestamps |

Use stable IDs and ISO 8601 timestamps on the wire. Keep a date-only due date distinct from a timed event. The current browser demo advances a daily or weekly task past today after completion and shows a due reminder through 30 minutes after its item's start; the backend should retain completed occurrences and calculate the next occurrence in the user's chosen IANA timezone.

## Proposed HTTP contract

This is a suggested contract for implementing the current frontend, not a claim that these routes exist. All routes require authenticated ownership checks. Return a consistent error such as `{ code, message, fieldErrors?, requestId }` without echoing private content. Typical failures: 400 validation, 401/403 access, 404 absent or hidden, 409 stale version or invalid transition, 410 expired proposal, 429 rate/budget, and 503 provider outage.

| Method and path | Input and response | Important behavior |
| --- | --- | --- |
| `GET /api/agents`, `POST /api/agents` | List profiles; create `{name,roleKey,focus,instructions}` -> profile + version | New agents require no code change; validate lengths and role. |
| `GET /api/agents/{id}`, `PATCH /api/agents/{id}` | Profile; patch with `expectedVersion` -> new version | A stale edit returns 409; existing runs keep their original profile version. |
| `POST /api/agents/{id}/archive`, `POST /restore` | Status update | History and unresolved work remain visible. Decide deletion separately. |
| `POST /api/source-uploads` | Multipart `.md` -> upload ID, name, size, parse status | Validate size/type and sanitize extracted text; never execute Markdown instructions. |
| `GET/POST/DELETE /api/agents/{id}/sources` | Attach Canvas course, GitHub repo or Projects board, or upload ID; list status | Reject arbitrary server-side URL fetches; resolve supported provider IDs or validated GitHub URLs only. |
| `GET /api/connectors`, `GET /api/connections` | Catalog; account labels, scopes, status only | Never return token material. |
| `POST /api/connections/{provider}/authorize`, provider callback, `DELETE /api/connections/{id}` | OAuth URL/state; callback exchanges token; disconnect/revoke result | Validate state, redirect URI, expiry, and replay; report local vs provider revocation separately. |
| `GET/PUT /api/agents/{id}/grants` | Connection ID, capability, resource IDs, enabled, expected version | Reject anything outside actual provider consent or adapter support. |
| `GET/POST /api/agents/{id}/conversations`, `GET /api/conversations/{id}/messages` | Agent-bound history and ordered messages | Switching agent never sends another agent's context. |
| `POST /api/conversations/{id}/messages` | `{text,clientRequestId,selectedSourceIds?}` -> message ID and run ID/status | Duplicate request ID returns the original result; failed sends can be retried safely. |
| `GET/POST /api/work-items`, `GET /api/work-items/{id}` | Create `{agentId,instruction,desiredOutcome,clientRequestId,captureId?}` -> queued ID; list/detail includes state, notes, result | A user-entered draft and an agent-generated proposal must have distinct origins. |
| `POST /api/work-items/{id}/notes`, `POST /cancel`, `GET /api/runs/{id}` | Clarification, cancellation, run status/result | If already running, apply a note only to a new run or explicit revision. |
| `GET /api/proposals?status=pending`, `POST /api/proposals/{id}/confirm`, `POST /decline`, `POST /request-revision` | Exact payload/version; confirm with `expectedVersion` and idempotency key -> operation outcome | Material edits invalidate confirmation. Never infer approval from an old local preview. |
| `GET/POST/PATCH/DELETE /api/tasks`, `POST /api/tasks/{id}/complete` | Owned task/routine data; complete with occurrence ID and idempotency key | Do not create duplicate next occurrences on retry. |
| `GET/POST/PATCH/DELETE /api/dated-items`, reminder status/snooze routes | Timed items and reminder delivery status | Keep timezone, overdue, quiet hours, and missed-delivery rules explicit. |
| `GET/POST/PATCH /api/captures` | Text, status, routed work/task ID | Routing is idempotent and preserves the original captured item. |

For an agent run use bounded states: `queued -> running -> awaiting_approval -> completed/failed/cancelled`. A proposal can be pending, confirmed, declined, expired, or superseded. Persist tool call and provider operation IDs. If a provider times out after dispatch, reconcile its outcome before retrying so a second email or calendar event is not silently created.

## Connector order and feasibility

1. **DLSU Canvas LMS:** start with read-only courses, assignments, and due dates for the School Agent; optionally share selected course data with Study Coach. Canvas exposes an API with OAuth2 and developer keys, but keys and endpoint scopes are controlled by the institution. Confirm DLSU enables an appropriate key before promising automatic sync. See [Canvas OAuth2](https://canvas.instructure.com/doc/api/file.oauth.html) and [developer keys](https://sso.canvaslms.com/doc/api/file.developer_keys.html).
2. **One mail provider:** choose Gmail or Outlook based on the user's account. Start with selected read/search, then draft, then exact reviewed send. Gmail read scopes are restricted and can add verification/security requirements; request narrow scopes. See [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) and [Microsoft Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-reference).
3. **One calendar provider:** choose Google or Outlook. Read selected calendars and availability before adding approved event creation. See [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth) and [Microsoft Graph calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar-overview?view=graph-rest-1.0).
4. **GitHub:** accept repository and GitHub Projects board links as references in the frontend. Reading repository README/Markdown files and reading Projects board items are different backend operations. Choose which to implement first based on the user's actual links; private resources need authorized access. For repositories, fetch selected files server-side with a bounded repository/path allowlist and record source commit SHA. See [GitHub repository contents API](https://docs.github.com/en/rest/repos/contents) and [GitHub Projects API guidance](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects).

The user can attach a GitHub URL or `.md` file in the frontend now, but the current app does not fetch or analyze it. Canva design editing is outside this confirmed scope.

## Delivery slices and acceptance checks

| Slice | Backend deliverable | Acceptance check |
| --- | --- | --- |
| 0. Private foundation | Sign-in/session, HTTPS, ownership, database migrations, server-side model credentials | A second user cannot read or mutate any first-user record; refresh preserves data. |
| 1. Agents and chat | Profiles, sources, agent-bound conversations, bounded model runs | Create two agents, keep contexts separate, inspect source evidence, retry without duplicate message. |
| 2. Work and approvals | Queue, run history, notes, cancellation, versioned proposals, idempotent confirm | A completed result names the saved record or external operation; denial/revision/failure is visible. |
| 3. Connections | Canvas, one mail and one calendar adapter, GitHub repository reads, per-agent grants | A connected account alone grants no agent access; revoked/expired grants stop tool calls. |
| 4. Tasks and reminders | Durable tasks, routine occurrences, dated items, scheduler and chosen delivery channel | Daily/weekly completion and reminder delivery work across refresh, timezone changes, and duplicate jobs. |
| 5. Capture inbox | Persist capture, route it to work/task, retain provenance | A retried route does not create a second request or lose the capture. |

Before broader automatic behavior, verify tool denial, prompt injection in retrieved content, ambiguous provider results, cancellation, timeout, duplicate submission, consent revocation, and recovery after a worker restart. Record task success, latency, and model/provider cost on real examples.

## Open implementation decisions

- Which email and calendar provider should be built first?
- Can the DLSU Canvas account authorize a developer-key integration, and which courses may be read?
- Are the links repositories, GitHub Projects boards, or both, and are they public or private?
- Which reminder delivery channel should run when the app is closed? What are the timezone and quiet-hour settings?
- What are the retention and deletion rules for uploaded Markdown, provider excerpts, conversations, and work history?
- Which model provider, per-run budget, timeout, and allowed agent actions should the backend use first?

