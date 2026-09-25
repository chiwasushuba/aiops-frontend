import { createContext, useContext } from "react";
import type { WorkspaceData } from "./workspace";

export interface WorkspaceContextValue {
  data: WorkspaceData | null;
  error: string | null;
  commit: (update: (current: WorkspaceData) => WorkspaceData) => boolean;
  reload: () => void;
  reset: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceProvider is missing");
  return context;
}
