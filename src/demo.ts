export type Priority = "low" | "normal" | "high";

export interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: Priority;
  completed: boolean;
  repeat?: "daily" | "weekly";
}

export interface DatedItem {
  id: string;
  title: string;
  startsAt: string;
  reminderAt: string | null;
}

export interface Suggestion {
  kind: "task" | "event";
  title: string;
  status: "pending" | "saved" | "dismissed";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  status?: "pending" | "failed" | "sent";
  suggestion?: Suggestion;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  agentId?: string;
}

export interface DemoData {
  version: 1;
  tasks: Task[];
  events: DatedItem[];
  conversations: Conversation[];
}

export const STORAGE_KEY = "aiops-frontend-demo-v1";

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateTimeValue(iso: string): string {
  const date = new Date(iso);
  return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function atOffset(days: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function seedDemoData(): DemoData {
  return {
    version: 1,
    tasks: [
      {
        id: "demo-task-1",
        title: "Review the week and choose three priorities",
        dueDate: dateOffset(0),
        priority: "high",
        completed: false,
      },
      {
        id: "demo-task-2",
        title: "Pick up groceries for dinner",
        dueDate: dateOffset(0),
        priority: "normal",
        completed: false,
      },
      {
        id: "demo-task-3",
        title: "Book a dentist appointment",
        dueDate: dateOffset(1),
        priority: "normal",
        completed: false,
      },
      {
        id: "demo-task-routine",
        title: "Weekly reset",
        dueDate: dateOffset(2),
        priority: "normal",
        completed: false,
        repeat: "weekly",
      },
      {
        id: "demo-task-4",
        title: "Organize notes from last week",
        dueDate: null,
        priority: "low",
        completed: true,
      },
    ],
    events: [
      {
        id: "demo-event-1",
        title: "Morning planning",
        startsAt: atOffset(0, 9),
        reminderAt: atOffset(0, 8, 45),
      },
      {
        id: "demo-event-2",
        title: "Catch up with Alex",
        startsAt: atOffset(0, 15, 30),
        reminderAt: atOffset(0, 15),
      },
      {
        id: "demo-event-3",
        title: "Weekly reset",
        startsAt: atOffset(2, 10),
        reminderAt: null,
      },
    ],
    conversations: [
      {
        id: "demo-conversation-1",
        title: "Planning the day",
        messages: [
          {
            id: "demo-message-1",
            role: "user",
            text: "Help me plan today.",
            createdAt: atOffset(0, 8),
            status: "sent",
          },
          {
            id: "demo-message-2",
            role: "assistant",
            text: "Demo reply: Start with one important task, then leave space around your next commitment. Here is a draft you can review.",
            createdAt: atOffset(0, 8, 1),
            suggestion: {
              kind: "task",
              title: "Choose today’s top priority",
              status: "pending",
            },
          },
        ],
      },
    ],
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
function validInstant(value: unknown): value is string {
  return (
    typeof value === "string" && Number.isFinite(new Date(value).getTime())
  );
}
function validDateKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    localDateKey(new Date(`${value}T12:00:00`)) === value
  );
}
function validTask(value: unknown): value is Task {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    (value.dueDate === null || validDateKey(value.dueDate)) &&
    (value.priority === "low" ||
      value.priority === "normal" ||
      value.priority === "high") &&
    typeof value.completed === "boolean" &&
    (value.repeat === undefined || value.repeat === "daily" || value.repeat === "weekly") &&
    (value.repeat === undefined || value.dueDate !== null)
  );
}
function validEvent(value: unknown): value is DatedItem {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    validInstant(value.startsAt) &&
    (value.reminderAt === null || validInstant(value.reminderAt))
  );
}
function validSuggestion(value: unknown): value is Suggestion {
  return (
    record(value) &&
    (value.kind === "task" || value.kind === "event") &&
    typeof value.title === "string" &&
    (value.status === "pending" ||
      value.status === "saved" ||
      value.status === "dismissed")
  );
}
function validMessage(value: unknown): value is ChatMessage {
  return (
    record(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.text === "string" &&
    validInstant(value.createdAt) &&
    (value.status === undefined ||
      value.status === "pending" ||
      value.status === "failed" ||
      value.status === "sent") &&
    (value.suggestion === undefined || validSuggestion(value.suggestion))
  );
}
function validConversation(value: unknown): value is Conversation {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.messages) &&
    value.messages.every(validMessage) &&
    (value.agentId === undefined || typeof value.agentId === "string")
  );
}
function isDemoData(value: unknown): value is DemoData {
  return (
    record(value) &&
    value.version === 1 &&
    Array.isArray(value.tasks) &&
    value.tasks.every(validTask) &&
    Array.isArray(value.events) &&
    value.events.every(validEvent) &&
    Array.isArray(value.conversations) &&
    value.conversations.every(validConversation)
  );
}

export function readDemoData(storage: Pick<Storage, "getItem">): DemoData {
  const saved = storage.getItem(STORAGE_KEY);
  if (saved === null) return seedDemoData();
  const parsed: unknown = JSON.parse(saved);
  if (!isDemoData(parsed))
    throw new Error(
      "Saved demo data is unavailable or uses a different format.",
    );
  return parsed;
}

export function writeDemoData(
  storage: Pick<Storage, "setItem">,
  data: DemoData,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function updateConversation(
  data: DemoData,
  conversationId: string,
  update: (conversation: Conversation) => Conversation,
): DemoData {
  return {
    ...data,
    conversations: data.conversations.map((conversation) =>
      conversation.id === conversationId ? update(conversation) : conversation,
    ),
  };
}

export type SuggestionDecision =
  | { status: "dismissed" }
  | {
      status: "saved";
      details:
        | {
            kind: "task";
            title: string;
            dueDate: string | null;
            priority: Priority;
          }
        | { kind: "event"; title: string; startsAt: string };
    };

export function resolveSuggestion(
  data: DemoData,
  conversationId: string,
  messageId: string,
  decision: SuggestionDecision,
): DemoData {
  const message = data.conversations
    .find((conversation) => conversation.id === conversationId)
    ?.messages.find((item) => item.id === messageId);
  if (!message?.suggestion || message.suggestion.status !== "pending")
    return data;
  if (
    decision.status === "saved" &&
    decision.details.kind !== message.suggestion.kind
  )
    throw new Error("Suggestion kind does not match reviewed details.");
  const updated = updateConversation(data, conversationId, (conversation) => ({
    ...conversation,
    messages: conversation.messages.map((item) =>
      item.id === messageId && item.suggestion
        ? {
            ...item,
            suggestion: { ...item.suggestion, status: decision.status },
          }
        : item,
    ),
  }));
  if (decision.status === "dismissed") return updated;
  return decision.details.kind === "task"
    ? {
        ...updated,
        tasks: [
          ...updated.tasks,
          {
            id: crypto.randomUUID(),
            title: decision.details.title,
            dueDate: decision.details.dueDate,
            priority: decision.details.priority,
            completed: false,
          },
        ],
      }
    : {
        ...updated,
        events: [
          ...updated.events,
          {
            id: crypto.randomUUID(),
            title: decision.details.title,
            startsAt: decision.details.startsAt,
            reminderAt: null,
          },
        ],
      };
}

export function finishDemoReply(
  data: DemoData,
  conversationId: string,
  messageId: string,
  fail: boolean,
): DemoData {
  return updateConversation(data, conversationId, (conversation) => {
    const message = conversation.messages.find((item) => item.id === messageId);
    if (!message || message.role !== "user" || message.status !== "pending")
      return conversation;
    if (fail)
      return {
        ...conversation,
        messages: conversation.messages.map((item) =>
          item.id === messageId ? { ...item, status: "failed" } : item,
        ),
      };

    const lower = message.text.toLowerCase();
    const kind = /calendar|schedule|event|meeting|remind/.test(lower)
      ? "event"
      : /task|plan|todo|to-do/.test(lower)
        ? "task"
        : null;
    const suggestion: Suggestion | undefined =
      kind === "event"
        ? { kind, title: "Set aside time for this", status: "pending" }
        : kind === "task"
          ? { kind, title: "Write down the next step", status: "pending" }
          : undefined;
    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      createdAt: new Date().toISOString(),
      text: suggestion
        ? "Demo reply: I made a sample suggestion. Review and edit it before saving."
        : "Demo reply: This is a scripted example. Try asking about a task or calendar item to see a reviewable suggestion.",
      suggestion,
    };
    return {
      ...conversation,
      messages: [
        ...conversation.messages.map((item) =>
          item.id === messageId ? { ...item, status: "sent" as const } : item,
        ),
        reply,
      ],
    };
  });
}

export function dueForToday(
  task: Task,
  today = localDateKey(new Date()),
): boolean {
  return !task.completed && task.dueDate !== null && task.dueDate <= today;
}

export function toggleTaskCompletion(task: Task, today = localDateKey(new Date())): Task {
  if (task.completed) return { ...task, completed: false };
  if (!task.repeat || !task.dueDate) return { ...task, completed: true };
  const next = new Date(`${task.dueDate}T12:00:00`);
  const step = task.repeat === "daily" ? 1 : 7;
  do {
    next.setDate(next.getDate() + step);
  } while (localDateKey(next) <= today);
  return { ...task, dueDate: localDateKey(next), completed: false };
}

export function reminderIsActive(event: DatedItem, now = new Date()): boolean {
  if (event.reminderAt === null) return false;
  const current = now.getTime();
  const reminder = new Date(event.reminderAt).getTime();
  const graceEnd = new Date(event.startsAt).getTime() + 30 * 60_000;
  return reminder <= current && current <= graceEnd;
}

export function reminderIsOverdue(event: DatedItem, now = new Date()): boolean {
  return (
    event.reminderAt !== null &&
    new Date(event.reminderAt).getTime() < now.getTime() &&
    new Date(event.startsAt).getTime() >= now.getTime()
  );
}
