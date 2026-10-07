import { useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type Capture,
  type EventRecord,
  type Page,
  type Task,
  type TaskInput,
} from "../api";
import { Field, LoadState, Pager, useAction, useResource } from "./shared";
import { useSession } from "./Session";
import GoogleConnections from "./GoogleConnections";

export function Today() {
  const resource = useResource<{
    date: string;
    timezone: string;
    activeWork: number;
    pendingApprovals: number;
    openCaptures: number;
    readyReminders: number;
    dueTasks: Task[];
    upcomingItems: EventRecord[];
  }>("/today", true);
  const { owner } = useSession();
  return (
    <>
      <h1>Today</h1>
      <p>
        Welcome, {owner?.displayName}. Your employees and records are saved to
        the server.
      </p>
      <LoadState {...resource}>
        {resource.data && (
          <>
            <p>
              {resource.data.date} · {resource.data.timezone}
            </p>
            <section className="workspace-panel">
              <h2>Your attention</h2>
              <div className="workspace-actions">
                <Link to="/work">{resource.data.activeWork} active jobs</Link>
                <Link to="/approvals">
                  {resource.data.pendingApprovals} approvals
                </Link>
                <Link to="/inbox">{resource.data.openCaptures} captures</Link>
                <Link to="/calendar">
                  {resource.data.readyReminders} ready reminders
                </Link>
              </div>
            </section>
            <section className="workspace-panel">
              <h2>Due and overdue tasks</h2>
              {resource.data.dueTasks.length === 0 && <p>No due tasks.</p>}
              {resource.data.dueTasks.map((task) => (
                <p key={task.id}>
                  <Link to="/tasks">{task.title}</Link> · {task.dueDate}
                </p>
              ))}
            </section>
            <section className="workspace-panel">
              <h2>Upcoming local calendar items</h2>
              {resource.data.upcomingItems.length === 0 && (
                <p>No upcoming items.</p>
              )}
              {resource.data.upcomingItems.map((item) => (
                <p key={item.id}>
                  <Link to="/calendar">{item.title}</Link> ·{" "}
                  {new Date(item.startsAt).toLocaleString()}
                </p>
              ))}
            </section>
          </>
        )}
      </LoadState>
    </>
  );
}

function taskInput(fields: FormData): TaskInput {
  return {
    title: String(fields.get("title")),
    priority: String(fields.get("priority")),
    dueDate: String(fields.get("dueDate")) || null,
    repeatRule: String(fields.get("repeatRule")) || null,
  };
}

function TaskFields({ task }: { task?: Task }) {
  return (
    <>
      <Field label="Title">
        <input
          name="title"
          required
          maxLength={300}
          defaultValue={task?.title}
        />
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue={task?.priority ?? "normal"}>
          <option>normal</option>
          <option>high</option>
          <option>low</option>
        </select>
      </Field>
      <Field label="Due date">
        <input type="date" name="dueDate" defaultValue={task?.dueDate ?? ""} />
      </Field>
      <Field label="Repeat">
        <select name="repeatRule" defaultValue={task?.repeatRule ?? ""}>
          <option value="">No repeat</option>
          <option>daily</option>
          <option>weekly</option>
        </select>
      </Field>
    </>
  );
}

export function Tasks() {
  const [page, setPage] = useState(0);
  const resource = useResource<Page<Task>>(`/tasks?page=${page}&size=20`);
  const action = useAction();
  return (
    <>
      <h1>Tasks and routines</h1>
      {action.feedback}
      <section className="workspace-panel">
        <h2>Add task</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const payload = taskInput(new FormData(form));
            void action.run(async () => {
              await api.mutate("/tasks", payload);
              form.reset();
              resource.reload();
            });
          }}
        >
          <TaskFields />
          <button className="button primary" disabled={action.busy}>
            Save task
          </button>
        </form>
      </section>
      <LoadState {...resource}>
        {resource.data?.content.length === 0 && <p>No tasks yet.</p>}
        {resource.data?.content.map((task) => (
          <TaskCard
            key={`${task.id}:${task.version}`}
            task={task}
            reload={resource.reload}
          />
        ))}
        <Pager page={page} setPage={setPage} data={resource.data} />
      </LoadState>
    </>
  );
}

function TaskCard({ task, reload }: { task: Task; reload: () => void }) {
  const action = useAction();
  const history = useResource<
    Page<{ occurrence: number; completedAt: string }>
  >(`/tasks/${task.id}/completions?page=0&size=20`);
  return (
    <article className="workspace-panel">
      <h2>{task.title}</h2>
      <p>
        {task.completed ? "Completed" : "Open"} ·{" "}
        {task.dueDate ?? "No due date"} · {task.priority}{" "}
        {task.repeatRule && `· ${task.repeatRule}`}
      </p>
      {action.feedback}
      <div className="workspace-actions">
        <button
          className="button secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await api.mutate(
                `/tasks/${task.id}/${task.completed ? "reopen" : "complete"}`,
                {
                  expectedVersion: task.version,
                  ...(task.completed ? {} : { occurrence: task.occurrence }),
                },
              );
              reload();
            })
          }
        >
          {task.completed ? "Reopen" : "Complete occurrence"}
        </button>
        <button
          className="text-button danger"
          disabled={action.busy}
          onClick={() => {
            if (window.confirm("Delete this task and its completion history?"))
              void action.run(async () => {
                await api.mutate(
                  `/tasks/${task.id}?expectedVersion=${task.version}`,
                  undefined,
                  "DELETE",
                );
                reload();
              }, "Task deleted.");
          }}
        >
          Delete
        </button>
      </div>
      <details>
        <summary>Edit task</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const payload = taskInput(new FormData(event.currentTarget));
            void action.run(async () => {
              await api.mutate(
                `/tasks/${task.id}`,
                { ...payload, expectedVersion: task.version },
                "PATCH",
              );
              reload();
            });
          }}
        >
          <TaskFields task={task} />
          <button className="button primary" disabled={action.busy}>
            Save changes
          </button>
          <button className="button secondary" type="button" onClick={reload}>
            Refresh
          </button>
        </form>
      </details>
      <details>
        <summary>Recent completion history</summary>
        <LoadState {...history}>
          {history.data?.content.map((entry, index) => (
            <p key={index}>
              Occurrence {entry.occurrence} · {entry.completedAt}
            </p>
          ))}
        </LoadState>
      </details>
    </article>
  );
}

export function Calendar() {
  const [page, setPage] = useState(0);
  const resource = useResource<Page<EventRecord>>(
    `/dated-items?page=${page}&size=20`,
  );
  const action = useAction();
  const { owner } = useSession();
  return (
    <>
      <h1>Local calendar</h1>
      <p>
        These records belong to AIOps. They are separate from Google Calendar.
        Times below display in your browser's timezone; records keep{" "}
        {owner?.timezone}.
      </p>
      {action.feedback}
      <section className="workspace-panel">
        <h2>Add calendar item</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fields = new FormData(form);
            void action.run(async () => {
              await api.mutate("/dated-items", {
                title: String(fields.get("title")),
                startsAt: new Date(
                  String(fields.get("startsAt")),
                ).toISOString(),
                endsAt: null,
                reminderAt: fields.get("reminderAt")
                  ? new Date(String(fields.get("reminderAt"))).toISOString()
                  : null,
                timezone: owner!.timezone,
              });
              form.reset();
              resource.reload();
            });
          }}
        >
          <Field label="Title">
            <input name="title" required maxLength={300} />
          </Field>
          <Field label="Start (browser local time)">
            <input type="datetime-local" name="startsAt" required />
          </Field>
          <Field label="Reminder (optional, browser local time)">
            <input type="datetime-local" name="reminderAt" />
          </Field>
          <button className="button primary" disabled={action.busy}>
            Save calendar item
          </button>
        </form>
      </section>
      <LoadState {...resource}>
        {resource.data?.content.length === 0 && <p>No calendar items.</p>}
        {resource.data?.content.map((item) => (
          <article className="workspace-panel" key={item.id}>
            <h2>{item.title}</h2>
            <p>
              {new Date(item.startsAt).toLocaleString()} · {item.timezone}
            </p>
            {item.reminderAt && (
              <p>Reminder: {new Date(item.reminderAt).toLocaleString()}</p>
            )}
            <button
              className="text-button danger"
              disabled={action.busy}
              onClick={() => {
                if (window.confirm("Delete this local calendar item?"))
                  void action.run(async () => {
                    await api.mutate(
                      `/dated-items/${item.id}?expectedVersion=${item.version}`,
                      undefined,
                      "DELETE",
                    );
                    resource.reload();
                  }, "Calendar item deleted.");
              }}
            >
              Delete
            </button>
          </article>
        ))}
        <Pager page={page} setPage={setPage} data={resource.data} />
      </LoadState>
      <Reminders />
    </>
  );
}

function Reminders() {
  const [page, setPage] = useState(0);
  const resource = useResource<
    Page<{ id: string; status: string; dueAt: string; version: number }>
  >(`/reminders?page=${page}&size=20`, true);
  const action = useAction();
  return (
    <section className="workspace-panel">
      <h2>Saved reminders</h2>
      <p>
        The scheduler marks reminders ready while the app is closed. They do not
        send email or push notifications.
      </p>
      {action.feedback}
      <LoadState {...resource}>
        {resource.data?.content.length === 0 && <p>No reminders.</p>}
        {resource.data?.content.map((reminder) => (
          <p key={reminder.id}>
            {new Date(reminder.dueAt).toLocaleString()} · {reminder.status}{" "}
            {reminder.status === "ready" && (
              <button
                className="button secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api.mutate(`/reminders/${reminder.id}/acknowledge`, {
                      expectedVersion: reminder.version,
                    });
                    resource.reload();
                  })
                }
              >
                Acknowledge
              </button>
            )}
          </p>
        ))}
        <Pager page={page} setPage={setPage} data={resource.data} />
      </LoadState>
    </section>
  );
}

export function Inbox() {
  const [page, setPage] = useState(0);
  const resource = useResource<Page<Capture>>(`/captures?page=${page}&size=20`);
  const action = useAction();
  return (
    <>
      <h1>Capture inbox</h1>
      {action.feedback}
      <section className="workspace-panel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const text = String(new FormData(form).get("text"));
            void action.run(async () => {
              await api.mutate("/captures", { text, status: "open" });
              form.reset();
              resource.reload();
            });
          }}
        >
          <Field label="Capture a thought">
            <textarea name="text" required maxLength={12000} />
          </Field>
          <button className="button primary" disabled={action.busy}>
            Save capture
          </button>
        </form>
      </section>
      <LoadState {...resource}>
        {resource.data?.content.length === 0 && <p>No captures yet.</p>}
        {resource.data?.content.map((capture) => (
          <article className="workspace-panel" key={capture.id}>
            <p className="saved-text">{capture.text}</p>
            <p>{capture.status}</p>
            <div className="workspace-actions">
              {capture.workItemId ? (
                <Link to={`/work?id=${capture.workItemId}`}>
                  View routed work
                </Link>
              ) : (
                capture.status === "open" && (
                  <Link to={`/work?capture=${capture.id}`}>
                    Assign to employee
                  </Link>
                )
              )}
              <button
                className="button secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api.mutate(
                      `/captures/${capture.id}`,
                      {
                        status:
                          capture.status === "archived" ? "open" : "archived",
                        expectedVersion: capture.version,
                      },
                      "PATCH",
                    );
                    resource.reload();
                  })
                }
              >
                {capture.status === "archived" ? "Reopen" : "Archive"}
              </button>
            </div>
          </article>
        ))}
        <Pager page={page} setPage={setPage} data={resource.data} />
      </LoadState>
    </>
  );
}

export function Connections() {
  const catalog =
    useResource<
      { id: string; status: string; capabilities: string[]; reason: string }[]
    >("/connectors");
  const connections = useResource<{
    content: {
      senderAddress: string;
      connected: boolean;
      available: boolean;
    }[];
  }>("/connections");
  return (
    <>
      <h1>Connections</h1>
      <p>
        Connecting an account does not grant employee access. Choose the
        permissions for each employee below.
      </p>
      <GoogleConnections />
      <LoadState {...catalog}>
        {catalog.data?.map((provider) => (
          <section className="workspace-panel" key={provider.id}>
            <h2>{provider.id}</h2>
            <p>{provider.status}</p>
            <p>{provider.reason || provider.capabilities.join(", ")}</p>
          </section>
        ))}
      </LoadState>
      <section className="workspace-panel">
        <h2>Connected account metadata</h2>
        <LoadState {...connections}>
          {connections.data?.content.length === 0 && (
            <p>No connected accounts.</p>
          )}
          {connections.data?.content.map((connection, index) => (
            <p key={index}>
              {connection.senderAddress} ·{" "}
              {connection.connected ? "Connected" : "Disconnected"}
              {!connection.available && " · Unavailable"}
            </p>
          ))}
        </LoadState>
        <p>
          Existing Gmail consent covers task check-ins only. It does not
          authorize employee mailbox reads or general sends.
        </p>
      </section>
    </>
  );
}
