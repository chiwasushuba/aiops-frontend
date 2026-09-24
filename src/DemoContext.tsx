import { useRef, useState, type ReactNode } from "react";
import {
  finishDemoReply,
  readDemoData,
  seedDemoData,
  updateConversation,
  writeDemoData,
  type DemoData,
} from "./demo";
import { DemoContext } from "./useDemo";

function load(): { data: DemoData | null; error: string | null } {
  try {
    const data = readDemoData(window.localStorage);
    return {
      data: {
        ...data,
        conversations: data.conversations.map((conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.status === "pending"
              ? { ...message, status: "failed" as const }
              : message,
          ),
        })),
      },
      error: null,
    };
  } catch {
    return {
      data: null,
      error:
        "Could not read this browser’s demo data. Check storage settings or reset the demo.",
    };
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(load);
  const current = useRef(snapshot.data);

  function commit(update: (data: DemoData) => DemoData): boolean {
    if (!current.current) return false;
    try {
      const next = update(current.current);
      writeDemoData(window.localStorage, next);
      current.current = next;
      setSnapshot({ data: next, error: null });
      return true;
    } catch {
      setSnapshot((previous) => ({
        ...previous,
        error:
          "Could not save in this browser. Your last change was not saved.",
      }));
      return false;
    }
  }

  function reload() {
    const next = load();
    current.current = next.data;
    setSnapshot(next);
  }

  function reset() {
    try {
      const next = seedDemoData();
      writeDemoData(window.localStorage, next);
      current.current = next;
      setSnapshot({ data: next, error: null });
    } catch {
      setSnapshot((previous) => ({
        ...previous,
        error:
          "Could not reset the demo because browser storage is unavailable.",
      }));
    }
  }

  function finish(conversationId: string, messageId: string, fail: boolean) {
    window.setTimeout(() => {
      const saved = commit((data) =>
        finishDemoReply(data, conversationId, messageId, fail),
      );
      if (!saved && current.current) {
        const failed = finishDemoReply(
          current.current,
          conversationId,
          messageId,
          true,
        );
        current.current = failed;
        setSnapshot((previous) => ({ ...previous, data: failed }));
      }
    }, 700);
  }

  function send(conversationId: string, text: string, fail: boolean): boolean {
    const messageId = crypto.randomUUID();
    const saved = commit((data) =>
      updateConversation(data, conversationId, (conversation) => ({
        ...conversation,
        title:
          conversation.messages.length === 0
            ? text.slice(0, 40)
            : conversation.title,
        messages: [
          ...conversation.messages,
          {
            id: messageId,
            role: "user",
            text,
            createdAt: new Date().toISOString(),
            status: "pending",
          },
        ],
      })),
    );
    if (saved) finish(conversationId, messageId, fail);
    return saved;
  }

  function retry(conversationId: string, messageId: string, fail: boolean) {
    const saved = commit((data) =>
      updateConversation(data, conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId && message.status === "failed"
            ? { ...message, status: "pending" }
            : message,
        ),
      })),
    );
    if (saved) finish(conversationId, messageId, fail);
  }

  return (
    <DemoContext.Provider
      value={{
        data: snapshot.data,
        error: snapshot.error,
        commit,
        reload,
        reset,
        send,
        retry,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
