import { useRef, useState, type ReactNode } from "react";
import {
  readWorkspaceData,
  seedWorkspaceData,
  writeWorkspaceData,
  type WorkspaceData,
} from "./workspace";

import { WorkspaceContext } from "./useWorkspace";

function load(): { data: WorkspaceData | null; error: string | null } {
  try {
    return { data: readWorkspaceData(window.localStorage), error: null };
  } catch {
    return {
      data: null,
      error: "Could not read this browser's agent workspace. Check storage settings or reset the sample workspace.",
    };
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(load);
  const current = useRef(snapshot.data);

  function commit(update: (data: WorkspaceData) => WorkspaceData): boolean {
    if (!current.current) return false;
    try {
      const next = update(current.current);
      writeWorkspaceData(window.localStorage, next);
      current.current = next;
      setSnapshot({ data: next, error: null });
      return true;
    } catch {
      setSnapshot((previous) => ({
        ...previous,
        error: "Could not save in this browser. Your last workspace change was not saved.",
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
      const next = seedWorkspaceData();
      writeWorkspaceData(window.localStorage, next);
      current.current = next;
      setSnapshot({ data: next, error: null });
    } catch {
      setSnapshot((previous) => ({
        ...previous,
        error: "Could not reset the agent workspace because browser storage is unavailable.",
      }));
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{ data: snapshot.data, error: snapshot.error, commit, reload, reset }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
