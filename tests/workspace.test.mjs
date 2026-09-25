import test from "node:test";
import assert from "node:assert/strict";
import { seedDemoData, toggleTaskCompletion } from "../src/demo.ts";
import {
  applyLocalProposal,
  makeWorkItem,
  readWorkspaceData,
  seedWorkspaceData,
  validProjectUrl,
  writeWorkspaceData,
  WORKSPACE_STORAGE_KEY,
} from "../src/workspace.ts";

test("workspace starts with the four requested named agents and no fake connection", () => {
  const data = seedWorkspaceData();
  assert.deepEqual(data.agents.map((agent) => agent.name), [
    "School Agent", "My Email", "Study Coach", "Projects Partner",
  ]);
  assert.equal(data.agents[0].sources[0].value, "https://dlsu.instructure.com/");
  assert.equal(data.workItems.length, 0);
});

test("agent workspace and captured items survive refresh", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const data = seedWorkspaceData();
  data.agents[0].name = "My School Helper";
  data.captures.push({ id: "note-1", text: "Check the assignment", createdAt: "2026-09-25T09:00:00Z", status: "open" });
  writeWorkspaceData(storage, data);
  assert.equal(readWorkspaceData(storage).agents[0].name, "My School Helper");
  assert.equal(readWorkspaceData(storage).captures[0].text, "Check the assignment");
  assert.ok(values.has(WORKSPACE_STORAGE_KEY));
  values.set(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: 1, agents: [{ name: "broken" }], workItems: [], captures: [] }));
  assert.throws(() => readWorkspaceData(storage), /Saved workspace data is unavailable/);
});

test("a reviewed local task is saved once even if approval is retried", () => {
  const job = makeWorkItem(
    "school-agent",
    "Add a task to review the chapter",
    { kind: "task", title: "Review chapter", dueDate: "2026-09-26", priority: "high" },
    null,
    "job-1",
    "2026-09-25T09:00:00Z",
  );
  assert.equal(job.status, "needs_review");
  const first = applyLocalProposal(seedDemoData(), job);
  const retry = applyLocalProposal(first, job);
  assert.equal(first.tasks.filter((task) => task.id === "work-job-1").length, 1);
  assert.equal(retry.tasks.filter((task) => task.id === "work-job-1").length, 1);
  const email = makeWorkItem("email-agent", "Send a reply", { kind: "email", to: "example@example.com", subject: "Hello", body: "Hi" });
  assert.throws(() => applyLocalProposal(first, email), /External actions need a connected backend/);

  const event = makeWorkItem(
    "school-agent",
    "Add the review session",
    { kind: "event", title: "Review session", startsAt: "2026-09-26T09:00:00Z", reminderAt: null },
    null,
    "job-2",
  );
  const withEvent = applyLocalProposal(first, event);
  assert.equal(applyLocalProposal(withEvent, event).events.filter((item) => item.id === "work-job-2").length, 1);
  const externalEvent = makeWorkItem(
    "school-agent",
    "Add to Google Calendar",
    { kind: "event", title: "Review session", startsAt: "2026-09-26T09:00:00Z", reminderAt: null, destination: "google-calendar" },
  );
  assert.throws(() => applyLocalProposal(withEvent, externalEvent), /External actions need a connected backend/);
});

test("repeating tasks advance beyond today when completed", () => {
  const daily = { id: "daily", title: "Read", dueDate: "2026-09-20", priority: "normal", completed: false, repeat: "daily" };
  const weekly = { ...daily, id: "weekly", repeat: "weekly" };
  assert.equal(toggleTaskCompletion(daily, "2026-09-25").dueDate, "2026-09-26");
  assert.equal(toggleTaskCompletion(weekly, "2026-09-25").dueDate, "2026-09-27");
  assert.equal(toggleTaskCompletion(daily, "2026-09-25").completed, false);
});

test("project repository links require a GitHub repository URL", () => {
  assert.equal(validProjectUrl("https://github.com/owner/repo"), true);
  assert.equal(validProjectUrl("https://github.com/users/owner/projects/1"), true);
  assert.equal(validProjectUrl("https://user:secret@github.com/owner/repo"), false);
  assert.equal(validProjectUrl("javascript:alert(1)"), false);
  assert.equal(validProjectUrl("https://github.com/owner"), false);
  assert.equal(validProjectUrl("https://github.com/settings/profile"), false);
});
