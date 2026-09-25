# Personal AIOps feature plan

Status: frontend prototype updated 2026-09-25. This is a private, single-user product. The backend implementation is still separate work.

## Product goal

Give a named agent a job, see whether it is queued, needs a decision, finished, or failed, and let AIOps keep track of the related tasks and reminders. The home view should show what needs attention today, including pending approvals, agent work, and captured items.

## Current frontend behavior

All records below are browser-local demo data. They survive refresh in the same browser only. The frontend does not call the sibling backend, an AI model, Canvas LMS, GitHub, email, or a calendar provider.

| Area | Browser-local prototype |
| --- | --- |
| Today | Today's and overdue tasks, next dated item, upcoming items, assistant suggestion, and counts linking to approvals, queued work, and capture inbox. |
| Agents | Four named starters: School Agent, My Email, Study Coach, and Projects Partner. Create or edit a name, role, focus, and instructions. Add HTTPS source links; Projects Partner accepts GitHub repository or Projects board links. Add and preview a local `.md` file up to 50 KB. Links and files are saved references, not read by an AI. |
| Agent conversations | Choose an agent and keep its scripted demo conversations separate from other agents. The older general demo conversation remains available. There is no live model response. |
| Work queue | Assign a request to an agent. Plan/research requests wait for a backend. Structured task, dated-item, external-calendar, and email proposals can be reviewed. A request has a status, follow-up instructions, and a visible result where an action completes. |
| Approvals | Review exact proposed details. Confirming a task or dated item saves it locally once. Email and external-calendar drafts show their intended provider and exact details, but cannot be executed. External actions need a fresh server-side confirmation after integration. |
| Connections | Shows Canvas LMS, Gmail, Outlook Mail, Google Calendar, Outlook Calendar, and GitHub as disconnected. Per-agent checkboxes save intended access only; they do not connect accounts or grant access. |
| Tasks and routines | Add, edit, complete, reopen, and remove tasks. Optional due date, priority, and daily or weekly repeat. Completing a repeating task moves its next due date beyond today. |
| Calendar and reminders | Add, edit, and remove dated items and in-app reminder times. Due reminders appear while AIOps is open. Optional browser alerts require permission and also need the page open. Closed-tab, phone, or email delivery does not exist. |
| Capture inbox | Save a thought, send it to an agent work request, archive it, or reopen it. |
| Sign-in | `/login` and `/signup` are explanatory placeholders. There is no account or remote privacy boundary yet. |

The demo uses two local-storage records: existing tasks/events/conversations in `aiops-frontend-demo-v1`, and new agent/work/inbox state in `aiops-workspace-demo-v1`. Reset sample data replaces both. The task record adds an optional repeat field, and conversations add an optional agent ID, so older stored demo records remain readable. A due reminder stays active until 30 minutes after the dated item's start while the app is open. Local Markdown content and messages are plain browser storage; use non-sensitive examples in the prototype.

## Confirmed priority order

1. **Own agents with names.** Start with the four named agents above; allow later creation and editing without a deployment. Each agent has a separate conversation and explicit source/access settings.
2. **Agent work queue and results.** A request needs an owner agent, status, timestamps, clarifications, proposal, and final result. The user must be able to tell whether anything actually happened. Runs and retries belong on the backend.
3. **Calendar and email connections, agent access, and outside-action approval.** First connect the service account, then grant specific capabilities to specific agents. The agent can discuss a proposed action, but sending email or writing to an external calendar requires confirmation of exact details.
4. **Persistent tasks, recurring routines, and active reminders.** Server persistence, timezone-aware recurrence, and reliable reminder delivery replace browser-only storage and open-page alerts.
5. **One capture inbox.** Quick capture routes an item into an agent request or a saved task without losing the original source and status.

The detailed backend contracts and connector boundaries are in [configurable agents and connected services](agent-workspaces-plan.md).

## First integrated acceptance flow

1. Create or rename an agent, attach a selected project source, and revisit the same profile and conversation on another signed-in device.
2. Give that agent a job. The queue shows queued, running, needs approval, completed, failed, or cancelled, with a real result and a safe retry path.
3. Connect an account and grant one agent a narrow capability. Another agent remains unable to access it.
4. Review exact email or calendar details, request a revision if needed, and confirm the final proposal. A retry or crash must not repeat an external action.
5. Add a task with a daily or weekly routine, complete an occurrence, and receive the next reminder according to the chosen timezone and delivery channel.
6. Capture a thought, send it to an agent, and see its final outcome without losing the capture history.
7. Empty, loading, disconnected, denied, expired, failed, and success states remain understandable on keyboard and narrow screens.

## Decisions to settle with the backend build

- App sign-in/session design and HTTPS backend host before using personal data remotely.
- Gmail or Outlook Mail first; Google or Outlook Calendar first; one provider in each category can be implemented before the other.
- Whether DLSU permits an OAuth developer key for Canvas LMS and which courses/assignments may be read.
- Whether Projects Partner should read repositories, GitHub Projects boards, or both first; private resources need a GitHub connection.
- Reminder channel, quiet hours, timezone, and how to handle missed reminders.
- Retention and deletion rules for conversations, Markdown content, source excerpts, work runs, and archived agents.
- Model provider, cost limit, run timeout, and the initial set of jobs an agent may perform.

