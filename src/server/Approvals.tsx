import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  type EventInput,
  type Page,
  type Proposal,
  type TaskInput,
} from "../api";
import { useSession } from "./Session";
import { Field, LoadState, Pager, useAction, useResource } from "./shared";

export default function Approvals() {
  const [query] = useSearchParams();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("pending");
  const [kind, setKind] = useState("task");
  const resource = useResource<Page<Proposal>>(
    `/proposals?status=${status}&page=${page}&size=20`,
  );
  const action = useAction();
  const { owner } = useSession();
  return (
    <>
      <h1>Internal approvals</h1>
      <p>
        Review exact owner-authored drafts before saving a task or local
        calendar item. Email and Google Calendar execution are not available
        yet.
      </p>
      {action.feedback}
      <section className="workspace-panel">
        <h2>Create a draft</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fields = new FormData(form);
            void action.run(async () => {
              const title = String(fields.get("title"));
              const payload: TaskInput | EventInput =
                kind === "task"
                  ? {
                      title,
                      priority: String(fields.get("priority")),
                      dueDate: String(fields.get("dueDate")) || null,
                      repeatRule: String(fields.get("repeatRule")) || null,
                    }
                  : {
                      title,
                      startsAt: new Date(
                        String(fields.get("startsAt")),
                      ).toISOString(),
                      endsAt: fields.get("endsAt")
                        ? new Date(String(fields.get("endsAt"))).toISOString()
                        : null,
                      timezone: owner!.timezone,
                      reminderAt: fields.get("reminderAt")
                        ? new Date(
                            String(fields.get("reminderAt")),
                          ).toISOString()
                        : null,
                    };
              await api.mutate("/proposals", {
                kind,
                payload,
                workItemId: query.get("work"),
              });
              form.reset();
              setPage(0);
              setStatus("pending");
              resource.reload();
            }, "Draft saved for review. No task or calendar item has been created yet.");
          }}
        >
          <Field label="Draft type">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="task">Task</option>
              <option value="event">Local calendar item</option>
            </select>
          </Field>
          <Field label="Title">
            <input name="title" maxLength={300} required />
          </Field>
          {kind === "task" ? (
            <>
              <Field label="Priority">
                <select name="priority">
                  <option>normal</option>
                  <option>high</option>
                  <option>low</option>
                </select>
              </Field>
              <Field label="Due date">
                <input type="date" name="dueDate" />
              </Field>
              <Field label="Repeat">
                <select name="repeatRule">
                  <option value="">No repeat</option>
                  <option>daily</option>
                  <option>weekly</option>
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Start (your browser's local time)">
                <input type="datetime-local" name="startsAt" required />
              </Field>
              <Field label="End (optional)">
                <input type="datetime-local" name="endsAt" />
              </Field>
              <Field label="Reminder (optional, local time)">
                <input type="datetime-local" name="reminderAt" />
              </Field>
              <p>Saved timezone: {owner?.timezone}</p>
            </>
          )}
          {query.get("work") && (
            <p>Linked to completed work {query.get("work")}.</p>
          )}
          <button className="button primary" disabled={action.busy}>
            Save draft for review
          </button>
        </form>
      </section>
      <Field label="Status">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
        >
          {["pending", "confirmed", "declined", "revision_requested"].map(
            (value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ),
          )}
        </select>
      </Field>
      <button className="button secondary" onClick={resource.reload}>
        Refresh
      </button>
      <LoadState {...resource}>
        {resource.data?.content.length === 0 && (
          <p>No drafts with this status.</p>
        )}
        {resource.data?.content.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            reload={resource.reload}
          />
        ))}
        <Pager page={page} setPage={setPage} data={resource.data} />
      </LoadState>
    </>
  );
}

function ProposalCard({
  proposal,
  reload,
}: {
  proposal: Proposal;
  reload: () => void;
}) {
  const action = useAction();
  const confirmation = useRef<{
    expectedVersion: number;
    idempotencyKey: string;
  } | null>(null);
  return (
    <article className="workspace-panel">
      <h2>{proposal.payload.title}</h2>
      <p>
        {proposal.kind} ·{" "}
        {proposal.origin === "owner_draft" ? "Owner draft" : proposal.origin} ·{" "}
        {proposal.status}
        {proposal.expired ? " · Expired" : ""}
      </p>
      <dl>
        {Object.entries(proposal.payload).map(([key, value]) => (
          <div key={key}>
            <dt>
              {(
                {
                  dueDate: "Due date",
                  repeatRule: "Repeat",
                  startsAt: "Start",
                  endsAt: "End",
                  reminderAt: "Reminder",
                } as Record<string, string>
              )[key] ?? key}
            </dt>
            <dd>{value ?? "None"}</dd>
          </div>
        ))}
      </dl>
      <p>Expires: {new Date(proposal.expiresAt).toLocaleString()}</p>
      {action.feedback}
      {proposal.status === "pending" && (
        <div className="workspace-actions">
          <button
            className="button primary"
            disabled={action.busy || proposal.expired}
            onClick={() =>
              void action.run(async () => {
                confirmation.current ??= {
                  expectedVersion: proposal.version,
                  idempotencyKey: crypto.randomUUID(),
                };
                const result = await api.mutate<Proposal>(
                  `/proposals/${proposal.id}/confirm`,
                  confirmation.current,
                );
                if (!result.resultId)
                  throw new Error(
                    "The server did not return a saved record ID. Refresh this draft before retrying.",
                  );
                reload();
              }, "Confirmed. The internal record was saved once.")
            }
          >
            Confirm exact draft
          </button>
          {["decline", "request-revision"].map((decision) => (
            <button
              key={decision}
              className="button secondary"
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  async () => {
                    await api.mutate(`/proposals/${proposal.id}/${decision}`, {
                      expectedVersion: proposal.version,
                    });
                    reload();
                  },
                  decision === "decline"
                    ? "Draft declined."
                    : "Old draft closed. Create and review a new draft above.",
                )
              }
            >
              {decision === "decline" ? "Decline" : "Request revision"}
            </button>
          ))}
        </div>
      )}
      {proposal.resultId && (
        <p>
          Saved record:{" "}
          <Link to={proposal.kind === "task" ? "/tasks" : "/calendar"}>
            {proposal.resultId}
          </Link>
        </p>
      )}
    </article>
  );
}
