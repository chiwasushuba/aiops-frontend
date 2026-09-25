import test from "node:test";
import assert from "node:assert/strict";
import {
  dueForToday,
  finishDemoReply,
  localDateKey,
  readDemoData,
  reminderIsOverdue,
  reminderIsActive,
  resolveSuggestion,
  seedDemoData,
  STORAGE_KEY,
  writeDemoData,
} from "../src/demo.ts";

test("demo changes survive a storage round trip, including an empty state", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  const data = seedDemoData();
  writeDemoData(storage, { ...data, tasks: [], events: [], conversations: [] });
  const reloaded = readDemoData(storage);
  assert.deepEqual(reloaded.tasks, []);
  assert.deepEqual(reloaded.events, []);
  assert.deepEqual(reloaded.conversations, []);
  assert.ok(values.has(STORAGE_KEY));
});

test("malformed stored records fail visibly instead of entering app state", () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        version: 1,
        tasks: [{ title: "Missing fields" }],
        events: [],
        conversations: [],
      }),
  };
  assert.throws(() => readDemoData(storage), /Saved demo data is unavailable/);
});

test("today includes unfinished overdue work and excludes completed work", () => {
  const today = localDateKey(new Date(2026, 8, 25));
  assert.equal(
    dueForToday(
      {
        id: "1",
        title: "Late",
        dueDate: "2026-09-24",
        priority: "high",
        completed: false,
      },
      today,
    ),
    true,
  );
  assert.equal(
    dueForToday(
      {
        id: "2",
        title: "Done",
        dueDate: today,
        priority: "normal",
        completed: true,
      },
      today,
    ),
    false,
  );
  assert.equal(
    dueForToday(
      {
        id: "3",
        title: "Later",
        dueDate: "2026-09-26",
        priority: "low",
        completed: false,
      },
      today,
    ),
    false,
  );
});

test("an overdue reminder only applies while its event is upcoming", () => {
  const now = new Date("2026-09-25T09:00:00Z");
  assert.equal(
    reminderIsOverdue(
      {
        id: "1",
        title: "Call",
        startsAt: "2026-09-25T10:00:00Z",
        reminderAt: "2026-09-25T08:30:00Z",
      },
      now,
    ),
    true,
  );
  assert.equal(
    reminderIsOverdue(
      {
        id: "2",
        title: "Past",
        startsAt: "2026-09-25T08:00:00Z",
        reminderAt: "2026-09-25T07:00:00Z",
      },
      now,
    ),
    false,
  );
});

test("active reminder still appears when the start-time check runs seconds late", () => {
  const item = {
    id: "start-reminder",
    title: "Meeting",
    startsAt: "2026-09-25T10:00:00Z",
    reminderAt: "2026-09-25T10:00:00Z",
  };
  assert.equal(reminderIsActive(item, new Date("2026-09-25T10:00:30Z")), true);
  assert.equal(reminderIsActive(item, new Date("2026-09-25T10:31:00Z")), false);
});

test("failed demo reply can retry without adding another user message", () => {
  const data = seedDemoData();
  const id = data.conversations[0].id;
  const pending = {
    ...data,
    conversations: [
      {
        ...data.conversations[0],
        messages: [
          ...data.conversations[0].messages,
          {
            id: "request-1",
            role: "user",
            text: "Help plan a task",
            createdAt: new Date().toISOString(),
            status: "pending",
          },
        ],
      },
    ],
  };
  const failed = finishDemoReply(pending, id, "request-1", true);
  assert.equal(failed.conversations[0].messages.at(-1)?.status, "failed");
  const retrying = {
    ...failed,
    conversations: [
      {
        ...failed.conversations[0],
        messages: failed.conversations[0].messages.map((message) =>
          message.id === "request-1"
            ? { ...message, status: "pending" }
            : message,
        ),
      },
    ],
  };
  const answered = finishDemoReply(retrying, id, "request-1", false);
  const repeated = finishDemoReply(answered, id, "request-1", false);
  assert.equal(
    repeated.conversations[0].messages.filter(
      (message) => message.id === "request-1",
    ).length,
    1,
  );
  assert.equal(
    repeated.conversations[0].messages.length,
    pending.conversations[0].messages.length + 1,
  );
  assert.equal(
    repeated.conversations[0].messages.at(-1)?.suggestion?.status,
    "pending",
  );
});

test("review saves a suggestion once and records the confirmation", () => {
  const data = seedDemoData();
  const conversationId = data.conversations[0].id;
  const messageId = data.conversations[0].messages.at(-1).id;
  const decision = {
    status: "saved",
    details: {
      kind: "task",
      title: "My reviewed task",
      dueDate: null,
      priority: "normal",
    },
  };
  const saved = resolveSuggestion(data, conversationId, messageId, decision);
  const repeated = resolveSuggestion(
    saved,
    conversationId,
    messageId,
    decision,
  );
  assert.equal(saved.tasks.length, data.tasks.length + 1);
  assert.equal(repeated.tasks.length, saved.tasks.length);
  assert.equal(
    saved.conversations[0].messages.at(-1).suggestion.status,
    "saved",
  );
  assert.equal(
    data.conversations[0].messages.at(-1).suggestion.status,
    "pending",
  );
});
