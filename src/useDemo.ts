import { createContext, useContext } from "react";
import type { DemoData } from "./demo";

export interface DemoContextValue {
  data: DemoData | null;
  error: string | null;
  commit: (update: (current: DemoData) => DemoData) => boolean;
  reload: () => void;
  reset: () => void;
  send: (conversationId: string, text: string, fail: boolean) => boolean;
  retry: (conversationId: string, messageId: string, fail: boolean) => void;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider is missing");
  return context;
}
