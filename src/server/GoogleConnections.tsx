import { useState } from "react";
import { api, type Employee, type Page } from "../api";
import { Field, LoadState, Pager, useAction, useResource } from "./shared";

type Connection = {
  available: boolean;
  connected: boolean;
  status: string;
  email: string | null;
  version: number;
  generation: number;
  capabilities: string[];
};
type Grant = {
  capability: string;
  enabled: boolean;
  version: number;
  resources: { mailScope?: string; threadIds?: string[]; labelIds?: string[] };
};

export default function GoogleConnections() {
  const connection = useResource<Connection>("/connections/google");
  const [employeeId, setEmployeeId] = useState("");
  const [page, setPage] = useState(0);
  const employees = useResource<Page<Employee>>(`/agents?page=${page}&size=20`);
  const action = useAction();
  return (
    <section className="workspace-panel">
      <h2>Google account and employee access</h2>
      <p>
        Connect your account, then choose access separately for each employee.
      </p>
      {action.feedback}
      <LoadState {...connection}>
        {connection.data && (
          <>
            <p>
              {connection.data.email ?? "No connected account"} ·{" "}
              {connection.data.status}
            </p>
            {!connection.data.available && (
              <p>
                Google is unavailable. Configure the Google OAuth client,
                callback URL, and token encryption key in the backend
                environment.
              </p>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                void action.run(async () => {
                  const capabilities = fields
                    .getAll("capabilities")
                    .map(String);
                  if (!capabilities.length)
                    throw new Error(
                      "Choose at least one capability to connect.",
                    );
                  const response = await api.mutate<{
                    authorizationUrl: string;
                  }>("/connections/google/authorize", {
                    capabilities,
                    expectedVersion: connection.data!.version,
                    replaceAccount: fields.get("replaceAccount") === "on",
                  });
                  const url = new URL(response.authorizationUrl);
                  if (
                    url.protocol !== "https:" ||
                    url.hostname !== "accounts.google.com"
                  )
                    throw new Error(
                      "The backend returned an invalid Google authorization URL.",
                    );
                  window.location.assign(url.href);
                });
              }}
            >
              <fieldset>
                <legend>Account capabilities to connect</legend>
                <label className="source-choice">
                  <input
                    type="checkbox"
                    name="capabilities"
                    value="mail.read"
                  />
                  Read email
                </label>
                <label className="source-choice">
                  <input
                    type="checkbox"
                    name="capabilities"
                    value="mail.send"
                  />
                  Send reviewed email
                </label>
              </fieldset>
              <p>
                Google consent gives the backend access. The employee settings
                below decide which mail an employee may read.
              </p>
              {connection.data.email && (
                <label className="source-choice">
                  <input type="checkbox" name="replaceAccount" />
                  Replace this Google account and revoke existing employee
                  access
                </label>
              )}
              <div className="workspace-actions">
                <button
                  className="button primary"
                  disabled={action.busy || !connection.data.available}
                >
                  Authorize Google
                </button>
                {connection.data.connected && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        await api.mutate(
                          `/connections/google?expectedVersion=${connection.data!.version}`,
                          undefined,
                          "DELETE",
                        );
                        connection.reload();
                      }, "Google disconnected and employee access revoked.")
                    }
                  >
                    Disconnect Google
                  </button>
                )}
              </div>
            </form>
            <h3>Choose an employee</h3>
            <Field label="Employee access settings">
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
              >
                <option value="">Choose an employee</option>
                {employees.data?.content
                  .filter((e) => !e.archived)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </Field>
            <LoadState {...employees}>
              <Pager page={page} setPage={setPage} data={employees.data} />
            </LoadState>
            {employeeId && (
              <MailAccess
                key={`${employeeId}:${connection.data.generation}:${connection.data.version}`}
                employeeId={employeeId}
                connection={connection.data}
              />
            )}
          </>
        )}
      </LoadState>
    </section>
  );
}

function MailAccess({
  employeeId,
  connection,
}: {
  employeeId: string;
  connection: Connection;
}) {
  const grants = useResource<Grant[]>(`/agents/${employeeId}/grants`);
  const action = useAction();
  const [scope, setScope] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const read = grants.data?.find((grant) => grant.capability === "mail.read");
  const send = grants.data?.find((grant) => grant.capability === "mail.send");
  return (
    <section>
      <h3>Mailbox reading</h3>
      {action.feedback}
      <LoadState {...grants}>
        <p>
          Current access:{" "}
          {read?.enabled
            ? ({
                threads: "Selected threads",
                labels: "Selected labels",
                mailbox: "Entire mailbox",
              }[read.resources.mailScope ?? ""] ?? "Unknown scope")
            : "No mailbox access"}
          .
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            void action.run(async () => {
              if (!scope)
                throw new Error(
                  "Choose how much of the mailbox this employee may read.",
                );
              if (fields.get("consent") !== "on")
                throw new Error(
                  "Explicitly grant the selected access before saving.",
                );
              const ids = selectedIds;
              const resources =
                scope === "mailbox"
                  ? { mailScope: scope }
                  : scope === "threads"
                    ? { mailScope: scope, threadIds: ids }
                    : { mailScope: scope, labelIds: ids };
              await api.mutate(
                `/agents/${employeeId}/grants`,
                {
                  capability: "mail.read",
                  enabled: true,
                  resources,
                  expectedVersion: read?.version ?? 0,
                },
                "PUT",
              );
              grants.reload();
            }, "Mailbox access saved for this employee.");
          }}
        >
          <Field label="Mail this employee may read">
            <select
              required
              value={scope}
              onChange={(event) => {
                setScope(event.target.value);
                setSelectedIds([]);
              }}
            >
              <option value="">Choose an access scope</option>
              <option value="threads">Selected threads only</option>
              <option value="labels">Selected labels only</option>
              <option value="mailbox">Entire mailbox</option>
            </select>
          </Field>
          {scope === "mailbox" && (
            <p>
              This grants reading access to all mail in this account. Sending
              requires a separate grant and approval.
            </p>
          )}
          {["threads", "labels"].includes(scope) && (
            <MailResourcePicker
              key={scope}
              kind={scope}
              selected={selectedIds}
              setSelected={setSelectedIds}
              connected={
                connection.connected &&
                connection.capabilities.includes("mail.read")
              }
            />
          )}
          <label className="source-choice">
            <input type="checkbox" name="consent" required />
            Grant this employee the mailbox access selected above
          </label>
          <div className="workspace-actions">
            <button
              className="button primary"
              disabled={
                action.busy ||
                !connection.connected ||
                !connection.capabilities.includes("mail.read")
              }
            >
              Save mailbox access
            </button>
            {read?.enabled && (
              <button
                type="button"
                className="button secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api.mutate(
                      `/agents/${employeeId}/grants`,
                      {
                        capability: "mail.read",
                        enabled: false,
                        resources: read.resources,
                        expectedVersion: read.version,
                      },
                      "PUT",
                    );
                    grants.reload();
                  }, "Mailbox access revoked.")
                }
              >
                Revoke mailbox access
              </button>
            )}
          </div>
        </form>
        <h3>Reviewed email sending</h3>
        <p>
          {send?.enabled
            ? "Sending grant enabled. Each email still needs review of its exact recipients and body."
            : "This employee has no sending grant."}
        </p>
        <button
          className="button secondary"
          disabled={
            action.busy ||
            (!send?.enabled &&
              (!connection.connected ||
                !connection.capabilities.includes("mail.send")))
          }
          onClick={() =>
            void action.run(async () => {
              await api.mutate(
                `/agents/${employeeId}/grants`,
                {
                  capability: "mail.send",
                  enabled: !send?.enabled,
                  resources: {},
                  expectedVersion: send?.version ?? 0,
                },
                "PUT",
              );
              grants.reload();
            })
          }
        >
          {send?.enabled
            ? "Revoke sending grant"
            : "Grant reviewed email sending"}
        </button>
        <p>
          Revoking or changing existing access cancels this employee’s active
          jobs.
        </p>
      </LoadState>
    </section>
  );
}

function MailResourcePicker({
  kind,
  selected,
  setSelected,
  connected,
}: {
  kind: string;
  selected: string[];
  setSelected: (ids: string[]) => void;
  connected: boolean;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [tokens, setTokens] = useState<string[]>([""]);
  const [page, setPage] = useState(0);
  const resources = useResource<{
    content: { id: string; name: string }[];
    nextPageToken: string;
  }>(
    connected
      ? `/connections/google/mail/${kind}?pageToken=${encodeURIComponent(tokens[page])}&query=${encodeURIComponent(search)}`
      : null,
  );
  const content = resources.data?.content.filter(
    (item) =>
      kind !== "labels" ||
      item.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <fieldset>
      <legend>
        {kind === "threads" ? "Choose threads" : "Choose labels"} (maximum 50)
      </legend>
      {!connected ? (
        <p>Connect Google with email reading before choosing mail.</p>
      ) : (
        <>
          <Field
            label={kind === "threads" ? "Search Gmail threads" : "Find a label"}
          >
            <input
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setSearch(query);
              setPage(0);
              setTokens([""]);
            }}
          >
            Search
          </button>
          <LoadState {...resources}>
            <p>
              {selected.length} selected. Selections are retained across pages.
            </p>
            {content?.length === 0 && <p>No matching resources.</p>}
            {content?.slice(0, 100).map((item) => (
              <label className="source-choice" key={item.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  disabled={
                    !selected.includes(item.id) && selected.length >= 50
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, item.id]
                        : selected.filter((id) => id !== item.id),
                    )
                  }
                />
                {item.name || `Thread ${item.id}`}
              </label>
            ))}
            {content && content.length > 100 && (
              <p>Showing 100 labels. Use search to narrow the list.</p>
            )}
            {kind === "threads" && (
              <div className="workspace-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous threads
                </button>
                <span>Page {page + 1}</span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={!resources.data?.nextPageToken}
                  onClick={() => {
                    setTokens([
                      ...tokens.slice(0, page + 1),
                      resources.data!.nextPageToken,
                    ]);
                    setPage(page + 1);
                  }}
                >
                  Next threads
                </button>
              </div>
            )}
          </LoadState>
        </>
      )}
    </fieldset>
  );
}
