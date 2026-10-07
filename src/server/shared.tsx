import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { api, ApiError, type Page, type Repair } from "../api";

// eslint-disable-next-line react-refresh/only-export-components
export function useResource<T>(path: string | null, poll = false) {
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    error: string | null;
  }>({ path: null, data: null, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const data = await api.request<T>(path!);
        if (active) setState({ path, data, error: null });
      } catch (error) {
        if (active)
          setState((previous) => ({
            path,
            data: previous.path === path ? previous.data : null,
            error:
              error instanceof Error
                ? error.message
                : "Could not load this record.",
          }));
        if (error instanceof ApiError && error.status === 401) return;
      }
      if (active && poll) timer = setTimeout(load, 3000);
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [path, revision, poll]);
  return {
    data: state.path === path ? state.data : null,
    error: state.path === path ? state.error : null,
    reload: useCallback(() => setRevision((value) => value + 1), []),
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const locked = useRef(false);
  async function run(action: () => Promise<void>, message = "Saved.") {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(message);
    } catch (ex) {
      setError(
        ex instanceof Error ? ex.message : "The change could not be saved.",
      );
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return {
    busy,
    run,
    feedback: (
      <>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="workspace-success" role="status">
            {success}
          </p>
        )}
      </>
    ),
  };
}

export function LoadState({
  data,
  error,
  reload,
  children,
}: {
  data: unknown;
  error: string | null;
  reload: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {error && (
        <div className="error-banner" role="alert">
          {error} <button onClick={reload}>Refresh</button>
        </div>
      )}
      {data ? children : !error && <p role="status">Loading…</p>}
    </>
  );
}

export function Pager({
  page,
  setPage,
  data,
}: {
  page: number;
  setPage: (page: number) => void;
  data: Page<unknown> | null;
}) {
  return (
    <div className="workspace-actions">
      <button
        className="button secondary"
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page + 1}
        {data ? ` · ${data.totalElements} records` : ""}
      </span>
      <button
        className="button secondary"
        disabled={!data || (page + 1) * data.size >= data.totalElements}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

export function RepairMessage({ error }: { error: Repair | null | undefined }) {
  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      <strong>{error.message}</strong>
      <p>{error.action}</p>
      <small>Error: {error.code}</small>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      {isValidElement<{ id?: string; "aria-labelledby"?: string }>(children)
        ? cloneElement(children, { id, "aria-labelledby": `${id}-label` })
        : children}
    </label>
  );
}
