export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
};
export type Owner = { id: string; displayName: string; timezone: string };
export type Employee = {
  id: string;
  name: string;
  role: string;
  focus: string;
  instructions: string;
  archived: boolean;
  version: number;
};
export type Source = {
  id: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
};
export type Repair = {
  code: string;
  message: string;
  action: string;
  configurationVariable: string | null;
};
export type Run = {
  id: string;
  status: string;
  attempt: number;
  output: string | null;
  errorCode: string | null;
  errorDetails: Repair | null;
  sourceReferences?: { id: string; name: string }[];
};
export type Work = {
  id: string;
  agentId: string;
  instruction: string;
  desiredOutcome: string;
  status: string;
  version: number;
  runId: string;
  result: string | null;
  errorDetails: Repair | null;
  createdAt: string;
  notes?: { id: string; text: string; createdAt: string }[];
  attempts?: Run[];
};
export type Proposal = {
  id: string;
  kind: "task" | "event";
  origin: string;
  payload: TaskInput | EventInput;
  status: string;
  version: number;
  expired: boolean;
  resultId: string | null;
  expiresAt: string;
};
export type TaskInput = {
  title: string;
  priority: string;
  dueDate: string | null;
  repeatRule: string | null;
};
export type Task = TaskInput & {
  id: string;
  completed: boolean;
  occurrence: number;
  version: number;
};
export type EventInput = {
  title: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  reminderAt: string | null;
};
export type EventRecord = EventInput & { id: string; version: number };
export type Capture = {
  id: string;
  text: string;
  status: string;
  version: number;
  workItemId: string | null;
};
export type Conversation = { id: string; agentId: string; title: string };
export type Message = {
  id: string;
  runId: string;
  role: string;
  content: string;
  sequence: number;
};

export class ApiError extends Error {
  status: number;
  code: string;
  requestId: string | null;
  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

// API traffic stays same-origin. Production must proxy /api to the backend.
// Credentials and provider keys never belong in Vite configuration.
export function createApi(
  fetcher: typeof fetch = (...args) => fetch(...args),
  onExpired: () => void = () => {},
) {
  let csrf: { headerName: string; token: string } | null = null;
  let csrfPending: Promise<void> | null = null;
  let generation = 0;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const requestGeneration = generation;
    const method = init.method ?? "GET";
    if (!["GET", "HEAD"].includes(method) && !csrf) await refreshCsrf();
    const headers = new Headers(init.headers);
    if (!["GET", "HEAD"].includes(method) && csrf)
      headers.set(csrf.headerName, csrf.token);
    let response: Response;
    try {
      response = await fetcher(`/api${path}`, {
        ...init,
        headers,
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      throw new ApiError(
        0,
        "connection_failed",
        "Cannot reach the AIOps backend. Check that it is running and /api is routed to it. Retry the same submission when connected.",
      );
    }
    if (!response.ok) {
      let error: { code?: string; message?: string; requestId?: string } = {};
      try {
        error = await response.json();
      } catch {
        /* Proxies may return non-JSON errors. */
      }
      if (
        response.status === 401 &&
        path !== "/auth/login" &&
        requestGeneration === generation
      ) {
        csrf = null;
        onExpired();
      }
      if (response.status === 403 && requestGeneration === generation)
        csrf = null;
      throw new ApiError(
        response.status,
        error.code ?? "request_failed",
        response.status === 409
          ? `${error.message ?? "This record changed."} Refresh before trying again.`
          : (error.message ??
              `The backend returned HTTP ${response.status}. Check the server configuration and retry.`),
        error.requestId ?? response.headers.get("X-Request-ID"),
      );
    }
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(
        502,
        "invalid_response",
        "The backend response was not valid JSON. Check the /api proxy configuration.",
      );
    }
  }

  async function refreshCsrf() {
    if (!csrfPending) {
      csrfPending = request<{ headerName: string; token: string }>("/auth/csrf")
        .then((value) => {
          csrf = value;
        })
        .finally(() => {
          csrfPending = null;
        });
    }
    await csrfPending;
  }

  function mutate<T>(
    path: string,
    body?: unknown,
    method = "POST",
  ): Promise<T> {
    return request<T>(path, {
      method,
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function login(username: string, password: string) {
    await refreshCsrf();
    await request<void>("/auth/login", {
      method: "POST",
      body: new URLSearchParams({ username, password }),
    });
    generation++;
    csrf = null;
    await refreshCsrf();
    return request<Owner>("/me");
  }

  return {
    request,
    mutate,
    login,
    refreshCsrf,
    async logout() {
      await mutate("/auth/logout");
      csrf = null;
    },
    async page<T>(path: string, page = 0) {
      const result = await request<Page<T>>(
        `${path}${path.includes("?") ? "&" : "?"}page=${page}&size=20`,
      );
      if (
        !Array.isArray(result.content) ||
        typeof result.totalElements !== "number"
      )
        throw new ApiError(
          502,
          "invalid_response",
          "The backend returned an invalid list response.",
        );
      return result;
    },
  };
}

export const api = createApi(undefined, () =>
  window.dispatchEvent(new Event("aiops-session-expired")),
);

// Reuse only while the payload is identical. No request is automatically resent.
export function submissionIdentity(
  previous: { payload: string; id: string } | null,
  value: unknown,
) {
  const payload = JSON.stringify(value);
  return previous?.payload === payload
    ? previous
    : { payload, id: crypto.randomUUID() };
}
