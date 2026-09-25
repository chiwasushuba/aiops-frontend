import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useSearchParams } from "react-router-dom";
import { DemoProvider } from "./DemoContext";
import { WorkspaceProvider } from "./WorkspaceContext";
import { useWorkspace } from "./useWorkspace";
import { useDemo } from "./useDemo";
import {
  dueForToday,
  localDateKey,
  localDateTimeValue,
  reminderIsOverdue,
  reminderIsActive,
  resolveSuggestion,
  toggleTaskCompletion,
  type SuggestionDecision,
  type ChatMessage,
  type DatedItem,
  type Priority,
  type Suggestion,
  type Task,
} from "./demo";
import "./App.css";
import "./Workspace.css";

type IconName =
  | "home"
  | "check"
  | "calendar"
  | "chat"
  | "plus"
  | "arrow"
  | "spark"
  | "clock"
  | "menu";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    check: <path d="M4 12.5 9 17l11-11" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 10h18" />
      </>
    ),
    chat: (
      <path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.4-.7L3 21l1.7-5.1A8.5 8.5 0 1 1 20 11.5Z" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    spark: (
      <>
        <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
        <path d="M19 17v4m-2-2h4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const shortDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const time = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dateAtNoon = (key: string) => new Date(`${key}T12:00:00`);
function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
const eventWhen = (item: DatedItem) =>
  `${shortDate.format(new Date(item.startsAt))} · ${time.format(new Date(item.startsAt))}`;
function taskWhen(task: Task) {
  if (!task.dueDate) return "No due date";
  const today = localDateKey(new Date());
  return task.dueDate < today
    ? `Overdue · ${shortDate.format(dateAtNoon(task.dueDate))}`
    : task.dueDate === today
      ? "Due today"
      : `Due ${shortDate.format(dateAtNoon(task.dueDate))}`;
}

function ActiveReminders() {
  const { data } = useDemo();
  const now = useCurrentTime();
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    if (!data || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    data.events.forEach((item) => {
      if (!reminderIsActive(item, new Date(now))) return;
      const key = `aiops-reminder:${item.id}:${item.reminderAt}`;
      try {
        if (window.sessionStorage.getItem(key) !== "1") {
          new Notification("AIOps reminder", { body: item.title });
          window.sessionStorage.setItem(key, "1");
        }
      } catch {
        // The in-app reminder remains visible when browser notifications are blocked.
      }
    });
  }, [data, now]);
  if (!data) return null;
  const due = data.events.filter((item) =>
    reminderIsActive(item, new Date(now)) &&
    !dismissed.includes(`${item.id}:${item.reminderAt}`),
  );
  if (!due.length) return null;
  return (
    <section className="active-reminders" role="status" aria-label="Due reminders">
      <strong>Reminder due</strong>
      {due.map((item) => (
        <div key={item.id}>
          <span>{item.title} at {time.format(new Date(item.startsAt))}</span>
          <button type="button" onClick={() => setDismissed((current) => [...current, `${item.id}:${item.reminderAt}`])}>Dismiss</button>
        </div>
      ))}
    </section>
  );
}

function Shell() {
  const { data, error, reload, reset } = useDemo();
  const { data: workspace, error: workspaceError, reload: reloadWorkspace, reset: resetWorkspace } = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);
  const nav: { to: string; label: string; icon: IconName; end?: boolean }[] = [
    { to: "/", label: "Today", icon: "home", end: true },
    { to: "/tasks", label: "Tasks", icon: "check" },
    { to: "/calendar", label: "Calendar", icon: "calendar" },
    { to: "/assistant", label: "Assistant", icon: "chat" },
    { to: "/agents", label: "Agents", icon: "spark" },
    { to: "/work", label: "Work queue", icon: "check" },
    { to: "/approvals", label: "Approvals", icon: "clock" },
    { to: "/connections", label: "Connections", icon: "calendar" },
    { to: "/inbox", label: "Capture inbox", icon: "plus" },
  ];
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            a<span>.</span>
          </span>
          <div>
            <strong>AIOps</strong>
            <small>PERSONAL SPACE</small>
          </div>
        </div>
        <span className="side-label">WORKSPACE</span>
        <nav className="side-nav" aria-label="Main navigation">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" /> Local prototype{" "}
          <small>Stored only in this browser</small>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="mobile-header">
          <div className="brand">
            <span className="brand-mark">
              a<span>.</span>
            </span>
            <strong>AIOps</strong>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navOpen}
            onClick={() => setNavOpen(!navOpen)}
          >
            <Icon name="menu" />
          </button>
        </header>
        {navOpen && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setNavOpen(false)}
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="prototype-banner">
          <span className="banner-pill">DEMO MODE</span>
          <span>
            Sample data and scripted assistant replies. Changes stay in this
            browser.
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (
                window.confirm(
                  "Replace your local demo changes with the original sample data?",
                )
              )
                { reset(); resetWorkspace(); }
            }}
          >
            Reset sample
          </button>
        </div>
        {(error || workspaceError) && (
          <div className="error-banner" role="alert">
            {error || workspaceError}{" "}
            <button type="button" onClick={() => { reload(); reloadWorkspace(); }}>Retry</button>
          </div>
        )}
        <ActiveReminders />
        <main className="page-content">
          {data && workspace ? (
            <Outlet />
          ) : (
            <div className="empty-state">
              <h1>Demo data is unavailable</h1>
              <p>Check browser storage settings, or reset the sample data.</p>
              <button className="button primary" type="button" onClick={() => { reset(); resetWorkspace(); }}>
                Reset sample data
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DemoProvider>
      <WorkspaceProvider>
        <Shell />
      </WorkspaceProvider>
    </DemoProvider>
  );
}

function Heading({
  eyebrow,
  title,
  to,
  link,
}: {
  eyebrow?: string;
  title: string;
  to?: string;
  link?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {to && (
        <Link className="section-link" to={to}>
          {link ?? "View all"} <Icon name="arrow" size={16} />
        </Link>
      )}
    </div>
  );
}

function TaskRow({
  task,
  toggle,
  edit,
  remove,
}: {
  task: Task;
  toggle: (id: string) => void;
  edit?: (task: Task) => void;
  remove?: (id: string) => void;
}) {
  return (
    <div className={`task-row ${task.completed ? "is-complete" : ""}`}>
      <button
        type="button"
        className="task-check"
        aria-label={
          task.completed
            ? `Mark ${task.title} incomplete`
            : `Complete ${task.title}`
        }
        aria-pressed={task.completed}
        onClick={() => toggle(task.id)}
      >
        {task.completed && <Icon name="check" size={16} />}
      </button>
      <div className="row-main">
        <strong className="row-title">{task.title}</strong>
        <div className="row-meta">
          <span
            className={
              task.dueDate &&
              task.dueDate < localDateKey(new Date()) &&
              !task.completed
                ? "overdue"
                : ""
            }
          >
            {taskWhen(task)}
          </span>
          <span className={`priority-dot ${task.priority}`} />
          {task.priority} priority
          {task.repeat && <span>Repeats {task.repeat}</span>}
        </div>
      </div>
      {(edit || remove) && (
        <div className="row-actions">
          {edit && (
            <button
              type="button"
              className="text-button"
              onClick={() => edit(task)}
            >
              Edit
            </button>
          )}
          {remove && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => {
                if (window.confirm(`Remove “${task.title}”?`)) remove(task.id);
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({
  item,
  edit,
  remove,
}: {
  item: DatedItem;
  edit?: (item: DatedItem) => void;
  remove?: (id: string) => void;
}) {
  const overdue = reminderIsOverdue(item);
  return (
    <div className="event-row">
      <div className="event-date">
        <strong>{new Date(item.startsAt).getDate()}</strong>
        <span>
          {new Intl.DateTimeFormat(undefined, { month: "short" }).format(
            new Date(item.startsAt),
          )}
        </span>
      </div>
      <div className="row-main">
        <strong className="row-title">{item.title}</strong>
        <div className="row-meta">
          <Icon name="clock" size={15} />
          {time.format(new Date(item.startsAt))}
          {item.reminderAt && (
            <span className={overdue ? "overdue" : ""}>
              ·{" "}
              {overdue
                ? "Reminder overdue"
                : `Reminder ${time.format(new Date(item.reminderAt))}`}
            </span>
          )}
        </div>
      </div>
      {(edit || remove) && (
        <div className="row-actions">
          {edit && (
            <button
              type="button"
              className="text-button"
              onClick={() => edit(item)}
            >
              Edit
            </button>
          )}
          {remove && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => {
                if (window.confirm(`Remove “${item.title}”?`)) remove(item.id);
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { data, commit } = useDemo();
  const { data: workspace } = useWorkspace();
  const now = useCurrentTime();
  if (!data) return null;
  const todayTasks = data.tasks
    .filter((task) => dueForToday(task))
    .sort(
      (a, b) =>
        ({ high: 0, normal: 1, low: 2 })[a.priority] -
        { high: 0, normal: 1, low: 2 }[b.priority],
    );
  const upcoming = data.events
    .filter((item) => new Date(item.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const suggestion = data.conversations
    .flatMap((conversation) =>
      conversation.messages.map((message) => ({ conversation, message })),
    )
    .find((item) => item.message.suggestion?.status === "pending");
  const toggle = (id: string) =>
    commit((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? toggleTaskCompletion(task) : task,
      ),
    }));
  return (
    <div className="dashboard">
      <div className="page-top">
        <div>
          <span className="eyebrow">YOUR DAILY OVERVIEW</span>
          <h1>
            Today, in focus<span className="period">.</span>
          </h1>
          <p className="page-subtitle">
            {longDate.format(new Date())}{" "}
            <span className="subtitle-separator">/</span> A clear view of what
            matters next.
          </p>
        </div>
        <Link className="button primary" to="/tasks">
          <Icon name="plus" size={17} /> Add a task
        </Link>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="next-card">
            <div className="next-icon">
              <Icon name="calendar" size={22} />
            </div>
            <div>
              <span className="eyebrow">
                {upcoming[0] && reminderIsOverdue(upcoming[0], new Date(now))
                  ? "REMINDER OVERDUE"
                  : "UP NEXT"}
              </span>
              <h2>{upcoming[0]?.title ?? "Your schedule is clear"}</h2>
              <p>
                {upcoming[0]
                  ? eventWhen(upcoming[0])
                  : "Add a dated item to see your next commitment here."}
              </p>
            </div>
            <Link
              to="/calendar"
              className="circle-link"
              aria-label="Open calendar"
            >
              <Icon name="arrow" size={19} />
            </Link>
          </section>
          <section className="content-section">
            <Heading
              eyebrow="YOUR PRIORITIES"
              title="Tasks for today"
              to="/tasks"
              link="All tasks"
            />
            <div className="list-surface">
              {todayTasks.length ? (
                todayTasks
                  .slice(0, 5)
                  .map((task) => (
                    <TaskRow key={task.id} task={task} toggle={toggle} />
                  ))
              ) : (
                <div className="inline-empty">
                  <strong>Nothing due today.</strong>
                  <span>
                    Enjoy the breathing room, or add a task for today.
                  </span>
                </div>
              )}
            </div>
            {todayTasks.length > 5 && (
              <Link className="more-link" to="/tasks">
                + {todayTasks.length - 5} more tasks
              </Link>
            )}
          </section>
        </div>
        <div className="dashboard-side">
          <section className="content-section">
            <Heading eyebrow="LOOKING AHEAD" title="Upcoming" to="/calendar" />
            <div className="upcoming-list">
              {upcoming.length ? (
                upcoming.slice(0, 3).map((item) => (
                  <div className="upcoming-item" key={item.id}>
                    <span className="upcoming-line" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{eventWhen(item)}</span>
                      {reminderIsOverdue(item, new Date(now)) && (
                        <span className="overdue-label">Reminder overdue</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="inline-empty compact">
                  No upcoming items yet.
                </div>
              )}
            </div>
          </section>
          <section className="assistant-teaser">
            <div className="teaser-icon">
              <Icon name="spark" size={21} />
            </div>
            <span className="eyebrow">ASSISTANT · DEMO</span>
            <h2>
              A little help
              <br />
              with the day.
            </h2>
            <p>
              {suggestion
                ? `A ${suggestion.message.suggestion?.kind} suggestion is waiting for your review.`
                : "Open a conversation to explore sample suggestions."}
            </p>
            <Link
              to={
                suggestion
                  ? `/assistant?agent=${suggestion.conversation.agentId ?? "general"}&conversation=${suggestion.conversation.id}`
                  : "/assistant"
              }
              className="teaser-link"
            >
              {suggestion ? "Review suggestion" : "Open assistant"}{" "}
              <Icon name="arrow" size={17} />
            </Link>
          </section>
          <section className="content-section workspace-summary">
            <h2>Needs your attention</h2>
            <Link to="/approvals">{workspace?.workItems.filter((item) => item.status === "needs_review").length ?? 0} approvals</Link>
            <Link to="/work">{workspace?.workItems.filter((item) => item.status === "queued").length ?? 0} queued requests</Link>
            <Link to="/inbox">{workspace?.captures.filter((item) => item.status === "open").length ?? 0} inbox items</Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function TaskForm({
  initial,
  save,
  cancel,
}: {
  initial?: Task;
  save: (title: string, dueDate: string | null, priority: Priority, repeat: Task["repeat"]) => boolean;
  cancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [priority, setPriority] = useState<Priority>(
    initial?.priority ?? "normal",
  );
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly">(initial?.repeat ?? "none");
  const [validation, setValidation] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (repeat !== "none" && !dueDate) {
      setValidation("Choose a due date for a repeating routine.");
      return;
    }
    setValidation("");
    if (title.trim() && save(title.trim(), dueDate || null, priority, repeat === "none" ? undefined : repeat)) {
      setTitle("");
      setDueDate("");
      setPriority("normal");
      setRepeat("none");
    }
  }
  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="form-heading">
        <h2>{initial ? "Edit task" : "Add a task"}</h2>
        <p>Keep it simple. You can always edit it later.</p>
      </div>
      <label className="field">
        <span>Task name</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs to get done?"
          maxLength={120}
          required
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>
            Due date <small>{repeat === "none" ? "optional" : "required for a routine"}</small>
          </span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required={repeat !== "none"}
          />
        </label>
        <label className="field">
          <span>Priority</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Repeat</span>
        <select value={repeat} onChange={(event) => setRepeat(event.target.value as typeof repeat)}>
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>
      {validation && <p className="field-error" role="alert">{validation}</p>}
      <div className="form-actions">
        <button className="button primary" type="submit">
          {initial ? "Save changes" : "Add task"}
        </button>
        {cancel && (
          <button className="button secondary" type="button" onClick={cancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function TasksPage() {
  const { data, commit } = useDemo();
  const [filter, setFilter] = useState<"open" | "today" | "completed" | "all">(
    "open",
  );
  const [editing, setEditing] = useState<Task | null>(null);
  if (!data) return null;
  const tasks = data.tasks
    .filter(
      (task) =>
        filter === "all" ||
        (filter === "open" && !task.completed) ||
        (filter === "today" && dueForToday(task)) ||
        (filter === "completed" && task.completed),
    )
    .sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    );
  return (
    <div className="detail-page">
      <div className="page-top">
        <div>
          <span className="eyebrow">STAY ON TOP OF IT</span>
          <h1>
            Tasks<span className="period">.</span>
          </h1>
          <p className="page-subtitle">
            A place for the small steps and the big ones.
          </p>
        </div>
        <div className="page-count">
          {data.tasks.filter((task) => !task.completed).length}
          <span>OPEN TASKS</span>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <div className="tabs" role="group" aria-label="Filter tasks">
            {(["open", "today", "completed", "all"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? "selected" : ""}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item === "today"
                  ? "Due today"
                  : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <div className="list-surface detail-list">
            {tasks.length ? (
              tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  toggle={(id) =>
                    commit((current) => ({
                      ...current,
                      tasks: current.tasks.map((item) =>
                        item.id === id
                          ? toggleTaskCompletion(item)
                          : item,
                      ),
                    }))
                  }
                  edit={setEditing}
                  remove={(id) => {
                    if (editing?.id === id) setEditing(null);
                    commit((current) => ({
                      ...current,
                      tasks: current.tasks.filter((item) => item.id !== id),
                    }));
                  }}
                />
              ))
            ) : (
              <div className="inline-empty">
                <strong>No tasks in this view.</strong>
                <span>
                  {filter === "today"
                    ? "Nothing is due today."
                    : "Add a task or choose another filter."}
                </span>
              </div>
            )}
          </div>
        </div>
        <aside>
          <TaskForm
            key={editing?.id ?? "new"}
            initial={editing ?? undefined}
            cancel={editing ? () => setEditing(null) : undefined}
            save={(title, dueDate, priority, repeat) => {
              const saved = commit((current) => ({
                ...current,
                tasks: editing
                  ? current.tasks.map((task) =>
                      task.id === editing.id
                        ? { ...task, title, dueDate, priority, repeat }
                        : task,
                    )
                  : [
                      ...current.tasks,
                      {
                        id: crypto.randomUUID(),
                        title,
                        dueDate,
                        priority,
                        completed: false,
                        repeat,
                      },
                    ],
              }));
              if (saved) setEditing(null);
              return saved;
            }}
          />
          <p className="aside-note">
            Tasks are saved in this browser only. Dates use your device’s local
            time.
          </p>
        </aside>
      </div>
    </div>
  );
}

function EventForm({
  initial,
  save,
  cancel,
}: {
  initial?: DatedItem;
  save: (title: string, startsAt: string, reminderAt: string | null) => boolean;
  cancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [startsAt, setStartsAt] = useState(
    initial ? localDateTimeValue(initial.startsAt) : "",
  );
  const [reminderAt, setReminderAt] = useState(
    initial?.reminderAt ? localDateTimeValue(initial.reminderAt) : "",
  );
  const [validation, setValidation] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !startsAt) return;
    if (
      reminderAt &&
      new Date(reminderAt).getTime() > new Date(startsAt).getTime()
    ) {
      setValidation("The reminder must be before or at the start time.");
      return;
    }
    setValidation("");
    if (
      save(
        title.trim(),
        new Date(startsAt).toISOString(),
        reminderAt ? new Date(reminderAt).toISOString() : null,
      )
    ) {
      setTitle("");
      setStartsAt("");
      setReminderAt("");
    }
  }
  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="form-heading">
        <h2>{initial ? "Edit dated item" : "Add a dated item"}</h2>
        <p>Events and reminders appear on your daily overview.</p>
      </div>
      <label className="field">
        <span>Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What is happening?"
          maxLength={120}
          required
        />
      </label>
      <label className="field">
        <span>Date and time</span>
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>
          Remind me <small>optional, in-app only</small>
        </span>
        <input
          type="datetime-local"
          value={reminderAt}
          onChange={(event) => setReminderAt(event.target.value)}
        />
      </label>
      {validation && (
        <p className="field-error" role="alert">
          {validation}
        </p>
      )}
      <div className="form-actions">
        <button className="button primary" type="submit">
          {initial ? "Save changes" : "Add item"}
        </button>
        {cancel && (
          <button className="button secondary" type="button" onClick={cancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function CalendarPage() {
  const { data, commit } = useDemo();
  const [editing, setEditing] = useState<DatedItem | null>(null);
  const [showPast, setShowPast] = useState(false);
  const now = useCurrentTime();
  const [alertPermission, setAlertPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  async function enableAlerts() {
    if (typeof Notification === "undefined") return;
    try {
      setAlertPermission(await Notification.requestPermission());
    } catch {
      setAlertPermission("denied");
    }
  }
  if (!data) return null;
  const items = data.events
    .filter(
      (item) =>
        showPast ||
        new Date(item.startsAt).getTime() >= now ||
        reminderIsOverdue(item, new Date(now)),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="detail-page">
      <div className="page-top">
        <div>
          <span className="eyebrow">TIME WELL SPENT</span>
          <h1>
            Calendar<span className="period">.</span>
          </h1>
          <p className="page-subtitle">
            Your upcoming commitments and in-app reminders.
          </p>
        </div>
        <div className="page-count">
          {
            data.events.filter(
              (item) => new Date(item.startsAt).getTime() >= now,
            ).length
          }
          <span>UPCOMING</span>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <div className="tabs" role="group" aria-label="Filter dated items">
            <button
              type="button"
              className={!showPast ? "selected" : ""}
              aria-pressed={!showPast}
              onClick={() => setShowPast(false)}
            >
              Upcoming
            </button>
            <button
              type="button"
              className={showPast ? "selected" : ""}
              aria-pressed={showPast}
              onClick={() => setShowPast(true)}
            >
              All items
            </button>
          </div>
          <div className="list-surface detail-list">
            {items.length ? (
              items.map((item) => (
                <EventRow
                  key={item.id}
                  item={item}
                  edit={setEditing}
                  remove={(id) => {
                    if (editing?.id === id) setEditing(null);
                    commit((current) => ({
                      ...current,
                      events: current.events.filter((event) => event.id !== id),
                    }));
                  }}
                />
              ))
            ) : (
              <div className="inline-empty">
                <strong>No dated items here.</strong>
                <span>
                  Add an event or reminder to see it on your calendar.
                </span>
              </div>
            )}
          </div>
        </div>
        <aside>
          <EventForm
            key={editing?.id ?? "new"}
            initial={editing ?? undefined}
            cancel={editing ? () => setEditing(null) : undefined}
            save={(title, startsAt, reminderAt) => {
              const saved = commit((current) => ({
                ...current,
                events: editing
                  ? current.events.map((item) =>
                      item.id === editing.id
                        ? { ...item, title, startsAt, reminderAt }
                        : item,
                    )
                  : [
                      ...current.events,
                      { id: crypto.randomUUID(), title, startsAt, reminderAt },
                    ],
              }));
              if (saved) setEditing(null);
              return saved;
            }}
          />
          <div className="workspace-notice">
            <strong>Active reminders while AIOps is open</strong>
            <p>Due reminders appear at the top of the app. Browser alerts also work while this page is open if you enable them. Closed-tab or phone delivery needs a backend.</p>
            {alertPermission === "default" && <button className="button secondary" type="button" onClick={() => { void enableAlerts(); }}>Enable browser alerts</button>}
            {alertPermission === "granted" && <p>Browser alerts enabled.</p>}
            {alertPermission === "denied" && <p>Browser alerts are blocked in your browser settings.</p>}
            {alertPermission === "unsupported" && <p>This browser does not support page alerts.</p>}
          </div>
          <p className="aside-note">Times use your local timezone.</p>
        </aside>
      </div>
    </div>
  );
}

function Review({
  suggestion,
  conversationId,
  messageId,
  close,
}: {
  suggestion: Suggestion;
  conversationId: string;
  messageId: string;
  close: () => void;
}) {
  const { commit } = useDemo();
  const [title, setTitle] = useState(suggestion.title);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [startsAt, setStartsAt] = useState("");
  function mark(
    status: "saved" | "dismissed",
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();
    if (
      status === "saved" &&
      (!title.trim() || (suggestion.kind === "event" && !startsAt))
    )
      return;
    const decision: SuggestionDecision =
      status === "dismissed"
        ? { status }
        : suggestion.kind === "task"
          ? {
              status,
              details: {
                kind: "task",
                title: title.trim(),
                dueDate: dueDate || null,
                priority,
              },
            }
          : {
              status,
              details: {
                kind: "event",
                title: title.trim(),
                startsAt: new Date(startsAt).toISOString(),
              },
            };
    const saved = commit((data) =>
      resolveSuggestion(data, conversationId, messageId, decision),
    );
    if (saved) close();
  }
  return (
    <form
      className="suggestion-review"
      onSubmit={(event) => mark("saved", event)}
    >
      <strong>
        Review {suggestion.kind === "task" ? "task" : "dated item"} before
        saving
      </strong>
      <p>This is a demo suggestion. Edit the exact details first.</p>
      <label className="field">
        <span>Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
        />
      </label>
      {suggestion.kind === "task" ? (
        <div className="form-grid">
          <label className="field">
            <span>
              Due date <small>optional</small>
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
      ) : (
        <label className="field">
          <span>Date and time</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </label>
      )}
      <div className="form-actions">
        <button className="button primary" type="submit">
          Confirm and save
        </button>
        <button className="button secondary" type="button" onClick={close}>
          Keep for later
        </button>
        <button
          className="text-button danger"
          type="button"
          onClick={() => mark("dismissed")}
        >
          Dismiss
        </button>
      </div>
    </form>
  );
}

function Message({
  message,
  conversationId,
  retry,
}: {
  message: ChatMessage;
  conversationId: string;
  retry: (id: string) => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  return (
    <div className={`message ${message.role}`}>
      <div className="message-label">
        {message.role === "user" ? "YOU" : "SCRIPTED DEMO REPLY"}{" "}
        <span>· {time.format(new Date(message.createdAt))}</span>
      </div>
      <p>{message.text}</p>
      {message.role === "user" && message.status === "pending" && (
        <span className="message-state" role="status">
          Sending demo reply…
        </span>
      )}
      {message.role === "user" && message.status === "failed" && (
        <div className="message-failure" role="alert">
          Demo reply failed.{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => retry(message.id)}
          >
            Retry reply
          </button>
        </div>
      )}
      {message.suggestion && (
        <div className="suggestion-card">
          <span className="eyebrow">
            SUGGESTED{" "}
            {message.suggestion.kind === "task" ? "TASK" : "DATED ITEM"}
          </span>
          <strong>{message.suggestion.title}</strong>
          {message.suggestion.status === "pending" ? (
            reviewing ? (
              <Review
                suggestion={message.suggestion}
                conversationId={conversationId}
                messageId={message.id}
                close={() => setReviewing(false)}
              />
            ) : (
              <button
                className="section-link"
                type="button"
                onClick={() => setReviewing(true)}
              >
                Review before saving <Icon name="arrow" size={16} />
              </button>
            )
          ) : (
            <span className="suggestion-status">
              {message.suggestion.status === "saved"
                ? "Saved after your confirmation"
                : "Dismissed"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AssistantPage() {
  const { data, commit, send, retry } = useDemo();
  const { data: workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState("");
  const [failNext, setFailNext] = useState(false);
  if (!data || !workspace) return null;
  const requestedAgent = params.get("agent");
  const activeAgent = requestedAgent === "general"
    ? null
    : workspace.agents.find((item) => item.id === requestedAgent) ?? workspace.agents[0] ?? null;
  const conversations = data.conversations.filter((item) =>
    (item.agentId ?? null) === (activeAgent?.id ?? null),
  );
  const conversation =
    conversations.find((item) => item.id === params.get("conversation")) ??
    conversations[0];
  const sending =
    conversation?.messages.some((message) => message.status === "pending") ??
    false;
  function create() {
    const id = crypto.randomUUID();
    if (
      commit((current) => ({
        ...current,
        conversations: [
          { id, title: "New conversation", messages: [], agentId: activeAgent?.id },
          ...current.conversations,
        ],
      }))
    ) {
      setParams({ agent: activeAgent?.id ?? "general", conversation: id });
      setDraft("");
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (
      conversation &&
      text &&
      !sending &&
      send(conversation.id, text, failNext)
    ) {
      setDraft("");
      setFailNext(false);
    }
  }
  return (
    <div className="assistant-page">
      <div className="page-top">
        <div>
          <span className="eyebrow">A SPACE TO THINK</span>
          <h1>
            Assistant<span className="period">.</span>
          </h1>
          <p className="page-subtitle">
            Talk within one agent's workspace. Replies are scripted examples until the backend assistant is connected.
          </p>
          <label className="field chat-agent-picker">
            <span>Conversation with</span>
            <select value={activeAgent?.id ?? "general"} onChange={(event) => { setParams({ agent: event.target.value }); setDraft(""); }}>
              {workspace.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              <option value="general">General demo</option>
            </select>
          </label>
        </div>
        <button className="button primary" type="button" onClick={create}>
          <Icon name="plus" size={17} /> New conversation
        </button>
      </div>
      <div className="chat-layout">
        <aside className="conversation-list">
          <div className="conversation-heading">CONVERSATIONS</div>
          {conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`conversation-item ${item.id === conversation?.id ? "selected" : ""}`}
              onClick={() => {
                setParams({ agent: activeAgent?.id ?? "general", conversation: item.id });
                setDraft("");
              }}
            >
              <Icon name="chat" size={18} />
              <span>{item.title}</span>
            </button>
          ))}
        </aside>
        <section className="chat-panel" aria-label="Conversation">
          {conversation ? (
            <>
              <div className="chat-panel-heading">
                <div>
                  <span className="eyebrow">LOCAL DEMO ? {activeAgent?.name ?? "GENERAL"}</span>
                  <h2>{conversation.title}</h2>
                </div>
                <span className="chat-count">
                  {conversation.messages.length} messages
                </span>
              </div>
              <div className="message-list">
                {conversation.messages.length ? (
                  conversation.messages.map((message) => (
                    <Message
                      key={message.id}
                      message={message}
                      conversationId={conversation.id}
                      retry={(id) => retry(conversation.id, id, failNext)}
                    />
                  ))
                ) : (
                  <div className="chat-empty">
                    <div className="teaser-icon">
                      <Icon name="spark" />
                    </div>
                    <h2>Start with a thought.</h2>
                    <p>
                      Ask about a task or calendar item to see a reviewable
                      suggestion.
                    </p>
                  </div>
                )}
              </div>
              <form className="composer" onSubmit={submit}>
                <label htmlFor="chat-draft">Your message</label>
                <textarea
                  id="chat-draft"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about a task or calendar item…"
                  maxLength={1000}
                  rows={3}
                />
                <div className="composer-bottom">
                  <label className="simulate">
                    <input
                      type="checkbox"
                      checked={failNext}
                      onChange={(event) => setFailNext(event.target.checked)}
                    />{" "}
                    Simulate failed reply
                  </label>
                  <button
                    className="button primary"
                    type="submit"
                    disabled={sending || !draft.trim()}
                  >
                    Send <Icon name="arrow" size={17} />
                  </button>
                </div>
                <p className="composer-note">
                  Scripted replies only. No agent reads connected accounts or completes work here.
                </p>
              </form>
            </>
          ) : (
            <div className="chat-empty">
              <h2>No conversation selected</h2>
              <button className="button primary" type="button" onClick={create}>
                Start a conversation
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
