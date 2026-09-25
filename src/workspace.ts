import type { DemoData, Priority } from "./demo";

export type AgentRole = "school" | "email" | "study" | "projects" | "custom";
export type ProviderKey =
  | "canvas"
  | "gmail"
  | "outlook-mail"
  | "google-calendar"
  | "outlook-calendar"
  | "github";

export interface AgentSource {
  id: string;
  name: string;
  kind: "url" | "markdown";
  value: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  focus: string;
  instructions: string;
  sources: AgentSource[];
  plannedAccess: ProviderKey[];
  archived: boolean;
}

export const providers: {
  key: ProviderKey;
  name: string;
  purpose: string;
}[] = [
  { key: "canvas", name: "DLSU Canvas LMS", purpose: "Courses and assignments" },
  { key: "gmail", name: "Gmail", purpose: "Selected email and approved drafts" },
  { key: "outlook-mail", name: "Outlook Mail", purpose: "Selected email and approved drafts" },
  { key: "google-calendar", name: "Google Calendar", purpose: "Events and availability" },
  { key: "outlook-calendar", name: "Outlook Calendar", purpose: "Events and availability" },
  { key: "github", name: "GitHub", purpose: "Selected repositories or project boards" },
];

export type WorkProposal =
  | { kind: "task"; title: string; dueDate: string | null; priority: Priority }
  | { kind: "event"; title: string; startsAt: string; reminderAt: string | null; destination?: "local" | "google-calendar" | "outlook-calendar" }
  | { kind: "email"; to: string; subject: string; body: string; provider?: "gmail" | "outlook-mail" };

export type WorkStatus =
  | "queued"
  | "needs_review"
  | "completed"
  | "blocked"
  | "cancelled"
  | "declined";

export interface WorkNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface WorkItem {
  id: string;
  agentId: string;
  request: string;
  createdAt: string;
  status: WorkStatus;
  proposal: WorkProposal | null;
  result: string | null;
  notes: WorkNote[];
  captureId: string | null;
}

export interface CaptureItem {
  id: string;
  text: string;
  createdAt: string;
  status: "open" | "sent" | "archived";
}

export interface WorkspaceData {
  version: 1;
  agents: AgentProfile[];
  workItems: WorkItem[];
  captures: CaptureItem[];
}

export const WORKSPACE_STORAGE_KEY = "aiops-workspace-demo-v1";

export function seedWorkspaceData(): WorkspaceData {
  return {
    version: 1,
    agents: [
      {
        id: "school-agent",
        name: "School Agent",
        role: "school",
        focus: "Keep coursework, assignments, and school deadlines organized.",
        instructions: "Summarize course work and ask before changing or submitting anything.",
        sources: [
          {
            id: "school-canvas-url",
            name: "DLSU Canvas LMS",
            kind: "url",
            value: "https://dlsu.instructure.com/",
          },
        ],
        plannedAccess: ["canvas"],
        archived: false,
      },
      {
        id: "email-agent",
        name: "My Email",
        role: "email",
        focus: "Help review messages and keep track of replies and follow-ups.",
        instructions: "Show exact recipients and content before any email is sent.",
        sources: [],
        plannedAccess: [],
        archived: false,
      },
      {
        id: "study-agent",
        name: "Study Coach",
        role: "study",
        focus: "Break study goals into sessions and help me practice.",
        instructions: "Explain clearly, quiz me, and highlight what I still need to review.",
        sources: [],
        plannedAccess: [],
        archived: false,
      },
      {
        id: "projects-agent",
        name: "Projects Partner",
        role: "projects",
        focus: "Track project milestones, decisions, and next steps.",
        instructions: "Use only the project links or Markdown files I attach.",
        sources: [],
        plannedAccess: ["github"],
        archived: false,
      },
    ],
    workItems: [],
    captures: [],
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function validSource(value: unknown): value is AgentSource {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.kind === "url" || value.kind === "markdown") &&
    typeof value.value === "string"
  );
}

function validAgent(value: unknown): value is AgentProfile {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    ["school", "email", "study", "projects", "custom"].includes(String(value.role)) &&
    typeof value.focus === "string" &&
    typeof value.instructions === "string" &&
    Array.isArray(value.sources) &&
    value.sources.every(validSource) &&
    Array.isArray(value.plannedAccess) &&
    value.plannedAccess.every((key) => providers.some((provider) => provider.key === key)) &&
    typeof value.archived === "boolean"
  );
}

function validProposal(value: unknown): value is WorkProposal {
  if (!record(value)) return false;
  if (value.kind === "task")
    return (
      typeof value.title === "string" &&
      (value.dueDate === null || typeof value.dueDate === "string") &&
      ["low", "normal", "high"].includes(String(value.priority))
    );
  if (value.kind === "event")
    return (
      typeof value.title === "string" &&
      typeof value.startsAt === "string" &&
      (value.reminderAt === null || typeof value.reminderAt === "string") &&
      (value.destination === undefined || value.destination === "local" || value.destination === "google-calendar" || value.destination === "outlook-calendar")
    );
  return (
    value.kind === "email" &&
    typeof value.to === "string" &&
    typeof value.subject === "string" &&
    typeof value.body === "string" &&
    (value.provider === undefined || value.provider === "gmail" || value.provider === "outlook-mail")
  );
}

function validWorkItem(value: unknown): value is WorkItem {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.agentId === "string" &&
    typeof value.request === "string" &&
    typeof value.createdAt === "string" &&
    ["queued", "needs_review", "completed", "blocked", "cancelled", "declined"].includes(String(value.status)) &&
    (value.proposal === null || validProposal(value.proposal)) &&
    (value.result === null || typeof value.result === "string") &&
    Array.isArray(value.notes) &&
    value.notes.every(
      (note) =>
        record(note) &&
        typeof note.id === "string" &&
        typeof note.text === "string" &&
        typeof note.createdAt === "string",
    ) &&
    (value.captureId === null || typeof value.captureId === "string")
  );
}

function validCapture(value: unknown): value is CaptureItem {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.createdAt === "string" &&
    (value.status === "open" || value.status === "sent" || value.status === "archived")
  );
}

export function readWorkspaceData(storage: Pick<Storage, "getItem">): WorkspaceData {
  const saved = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (saved === null) return seedWorkspaceData();
  const data: unknown = JSON.parse(saved);
  if (
    !record(data) ||
    data.version !== 1 ||
    !Array.isArray(data.agents) ||
    !data.agents.every(validAgent) ||
    !Array.isArray(data.workItems) ||
    !data.workItems.every(validWorkItem) ||
    !Array.isArray(data.captures) ||
    !data.captures.every(validCapture)
  )
    throw new Error("Saved workspace data is unavailable or uses a different format.");
  return data as unknown as WorkspaceData;
}

export function writeWorkspaceData(
  storage: Pick<Storage, "setItem">,
  data: WorkspaceData,
): void {
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(data));
}

export function makeWorkItem(
  agentId: string,
  request: string,
  proposal: WorkProposal | null,
  captureId: string | null = null,
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): WorkItem {
  if (!agentId || !request.trim()) throw new Error("Choose an agent and enter a request.");
  return {
    id,
    agentId,
    request: request.trim(),
    createdAt,
    status: proposal ? "needs_review" : "queued",
    proposal,
    result: null,
    notes: [],
    captureId,
  };
}

export function applyLocalProposal(data: DemoData, work: WorkItem): DemoData {
  if (work.status !== "needs_review" || !work.proposal)
    throw new Error("There is no pending action to save.");
  const id = `work-${work.id}`;
  if (work.proposal.kind === "task") {
    if (data.tasks.some((task) => task.id === id)) return data;
    return {
      ...data,
      tasks: [
        ...data.tasks,
        { id, ...work.proposal, completed: false },
      ],
    };
  }
  if (work.proposal.kind === "event") {
    if (work.proposal.destination && work.proposal.destination !== "local")
      throw new Error("External actions need a connected backend.");
    if (data.events.some((event) => event.id === id)) return data;
    return { ...data, events: [...data.events, { id, title: work.proposal.title, startsAt: work.proposal.startsAt, reminderAt: work.proposal.reminderAt }] };
  }
  throw new Error("External actions need a connected backend.");
}

export function validProjectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const board = (parts[0] === "users" || parts[0] === "orgs") &&
      parts[2] === "projects" && /^\d+$/.test(parts[3] ?? "");
    const repo = parts.length >= 2 &&
      !["users", "orgs", "settings", "login", "signup", "features", "topics", "marketplace"].includes(parts[0]);
    return url.protocol === "https:" &&
      url.hostname === "github.com" &&
      !url.username &&
      !url.password &&
      (board || repo);
  } catch {
    return false;
  }
}
