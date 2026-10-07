import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type Employee, type Page, type Source } from "../api";
import { Field, LoadState, Pager, useAction, useResource } from "./shared";

export default function Employees() {
  const [page, setPage] = useState(0);
  const resource = useResource<Page<Employee>>(`/agents?page=${page}&size=20`);
  const action = useAction();
  return (
    <>
      <h1>Your employees</h1>
      <p>
        Configure responsibilities and selected knowledge. Changes are saved to
        your workspace.
      </p>
      {action.feedback}
      <section className="workspace-panel">
        <h2>Create employee</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fields = new FormData(form);
            void action.run(async () => {
              await api.mutate("/agents", profile(fields));
              form.reset();
              resource.reload();
            });
          }}
        >
          <ProfileFields />
          <button className="button primary" disabled={action.busy}>
            Create employee
          </button>
        </form>
      </section>
      <LoadState {...resource}>
        <div className="workspace-list">
          {resource.data?.content.length === 0 && <p>No employees yet.</p>}
          {resource.data?.content.map((employee) => (
            <EmployeeCard
              key={`${employee.id}:${employee.version}`}
              employee={employee}
              reload={resource.reload}
            />
          ))}
        </div>
        <Pager page={page} setPage={setPage} data={resource.data} />
      </LoadState>
    </>
  );
}

function profile(fields: FormData) {
  return {
    name: String(fields.get("name")),
    role: String(fields.get("role")),
    focus: String(fields.get("focus")),
    instructions: String(fields.get("instructions")),
  };
}

function ProfileFields({ employee }: { employee?: Employee }) {
  return (
    <>
      <Field label="Name">
        <input
          name="name"
          defaultValue={employee?.name}
          required
          maxLength={100}
        />
      </Field>
      <Field label="Role">
        <select name="role" defaultValue={employee?.role ?? "custom"}>
          {["school", "email", "study", "projects", "custom"].map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </Field>
      <Field label="Focus">
        <textarea
          name="focus"
          defaultValue={employee?.focus}
          maxLength={2000}
        />
      </Field>
      <Field label="Instructions">
        <textarea
          name="instructions"
          defaultValue={employee?.instructions}
          maxLength={12000}
          rows={3}
        />
      </Field>
    </>
  );
}

function EmployeeCard({
  employee,
  reload,
}: {
  employee: Employee;
  reload: () => void;
}) {
  const action = useAction();
  const sources = useResource<Source[]>(`/agents/${employee.id}/sources`);
  const [uploaded, setUploaded] = useState<{ id: string; name: string } | null>(
    null,
  );
  return (
    <article className="workspace-panel">
      <h2>
        {employee.name}
        {employee.archived ? " · Archived" : ""}
      </h2>
      <p>{employee.focus}</p>
      {action.feedback}
      <div className="workspace-actions">
        <Link to={`/work?agent=${employee.id}`}>Assign work</Link>
        <Link to={`/assistant?agent=${employee.id}`}>Open chat</Link>
        <button
          className="button secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await api.mutate(
                `/agents/${employee.id}/${employee.archived ? "restore" : "archive"}`,
                { expectedVersion: employee.version },
              );
              reload();
            })
          }
        >
          {employee.archived ? "Restore" : "Archive"}
        </button>
      </div>
      <details>
        <summary>Edit profile</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            void action.run(async () => {
              await api.mutate(
                `/agents/${employee.id}`,
                { ...profile(fields), expectedVersion: employee.version },
                "PATCH",
              );
              reload();
            });
          }}
        >
          <ProfileFields employee={employee} />
          <button className="button primary" disabled={action.busy}>
            Save profile
          </button>
          <button className="button secondary" type="button" onClick={reload}>
            Refresh profile
          </button>
        </form>
      </details>
      <h3>Selected knowledge</h3>
      <LoadState {...sources}>
        {sources.data?.length === 0 && <p>No attached sources.</p>}
        <ul>
          {sources.data?.map((source) => (
            <li key={source.id}>
              {source.name} · {source.sizeBytes} bytes{" "}
              <button
                className="text-button danger"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api.mutate(
                      `/agents/${employee.id}/sources/${source.id}`,
                      undefined,
                      "DELETE",
                    );
                    sources.reload();
                  })
                }
              >
                Detach
              </button>
            </li>
          ))}
        </ul>
      </LoadState>
      {!employee.archived && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const file = new FormData(form).get("file");
            if (!(file instanceof File)) return;
            void action.run(async () => {
              if (!file.name.toLowerCase().endsWith(".md") || file.size > 51200)
                throw new Error(
                  "Choose a UTF-8 Markdown (.md) file up to 50 KiB.",
                );
              const body = new FormData();
              body.set("file", file);
              const source =
                uploaded ??
                (await api.request<{ id: string; name: string }>(
                  "/source-uploads",
                  { method: "POST", body },
                ));
              setUploaded(source);
              await api.mutate(`/agents/${employee.id}/sources`, {
                uploadId: source.id,
              });
              setUploaded(null);
              form.reset();
              sources.reload();
            }, "Source attached. Select it when assigning work.");
          }}
        >
          <Field label="Upload Markdown (maximum 50 KiB)">
            <input
              type="file"
              name="file"
              accept=".md"
              required
              onChange={() => setUploaded(null)}
            />
          </Field>
          <button className="button secondary" disabled={action.busy}>
            Upload and attach
          </button>
        </form>
      )}
    </article>
  );
}
