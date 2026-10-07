import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  submissionIdentity,
  type Capture,
  type Employee,
  type Page,
  type Run,
  type Source,
  type Work as WorkRecord,
} from "../api";
import {
  Field,
  LoadState,
  Pager,
  RepairMessage,
  useAction,
  useResource,
} from "./shared";

export function SourceChoices({ employeeId }: { employeeId: string }) {
  const resource = useResource<Source[]>(
    employeeId ? `/agents/${employeeId}/sources` : null,
  );
  return (
    <fieldset>
      <legend>Evidence for this job (choose up to four)</legend>
      <LoadState {...resource}>
        {resource.data?.length === 0 && (
          <p>No attached Markdown sources. You can submit without evidence.</p>
        )}
        {resource.data?.map((source) => (
          <label className="source-choice" key={source.id}>
            <input type="checkbox" name="sourceIds" value={source.id} />
            {source.name}
          </label>
        ))}
      </LoadState>
    </fieldset>
  );
}

export default function Work() {
  const [query] = useSearchParams();
  const [employeePage, setEmployeePage] = useState(0);
  const employees = useResource<Page<Employee>>(
    `/agents?page=${employeePage}&size=20`,
  );
  const [employeeId, setEmployeeId] = useState(query.get("agent") ?? "");
  const [page, setPage] = useState(0);
  const resource = useResource<Page<WorkRecord>>(
    `/work-items?page=${page}&size=20`,
    true,
  );
  const [selected, setSelected] = useState<string | null>(query.get("id"));
  const action = useAction();
  const submission = useRef<{ payload: string; id: string } | null>(null);
  const captureId = query.get("capture");
  const capture = useResource<Capture>(
    captureId ? `/captures/${captureId}` : null,
  );
  return (
    <>
      <h1>Work queue</h1>
      <p>
        Assign a bounded job and inspect its persisted result. Model output is a
        suggestion.
      </p>
      {action.feedback}
      <section className="workspace-panel">
        <h2>Assign work</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const value = {
              agentId: employeeId,
              instruction: String(fields.get("instruction")),
              desiredOutcome: String(fields.get("desiredOutcome")),
              sourceIds: fields.getAll("sourceIds").map(String),
              captureId: query.get("capture"),
            };
            void action.run(async () => {
              if (value.sourceIds.length > 4)
                throw new Error("Select at most four sources.");
              submission.current = submissionIdentity(
                submission.current,
                value,
              );
              const saved = await api.mutate<WorkRecord>("/work-items", {
                ...value,
                clientRequestId: submission.current.id,
              });
              submission.current = null;
              setSelected(saved.id);
              setPage(0);
              resource.reload();
            }, "Job submitted. Its status and result are saved to your workspace.");
          }}
        >
          <Field label="Employee">
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
            >
              <option value="">Choose an employee</option>
              {employeeId &&
                !employees.data?.content.some(
                  (employee) => employee.id === employeeId,
                ) && <option value={employeeId}>Selected employee</option>}
              {employees.data?.content
                .filter((employee) => !employee.archived)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
            </select>
          </Field>
          <LoadState {...employees}>
            <Pager
              page={employeePage}
              setPage={setEmployeePage}
              data={employees.data}
            />
          </LoadState>
          {captureId && (
            <LoadState {...capture}>
              <p>Captured thought: {capture.data?.text}</p>
            </LoadState>
          )}
          <Field label="Job">
            <textarea
              key={capture.data?.id ?? "new"}
              name="instruction"
              required
              maxLength={12000}
              rows={4}
              defaultValue={capture.data?.text ?? ""}
            />
          </Field>
          <Field label="Desired outcome">
            <textarea name="desiredOutcome" maxLength={2000} rows={2} />
          </Field>
          {employeeId && (
            <SourceChoices key={employeeId} employeeId={employeeId} />
          )}
          {query.get("capture") && (
            <p>
              This job will route the selected capture, retaining its history.
            </p>
          )}
          <button
            className="button primary"
            disabled={action.busy || !employees.data}
          >
            Submit job
          </button>
        </form>
      </section>
      <div className="workspace-grid">
        <section className="workspace-panel">
          <h2>Saved work</h2>
          <LoadState {...resource}>
            <div className="workspace-list">
              {resource.data?.content.length === 0 && (
                <p>No assigned work yet.</p>
              )}
              {resource.data?.content.map((work) => (
                <button
                  className={`workspace-list-item ${selected === work.id ? "selected" : ""}`}
                  key={work.id}
                  onClick={() => setSelected(work.id)}
                >
                  <span>{work.instruction}</span>
                  <span className="work-status">
                    {work.status.replaceAll("_", " ")}
                  </span>
                  <small>{new Date(work.createdAt).toLocaleString()}</small>
                </button>
              ))}
            </div>
            <Pager page={page} setPage={setPage} data={resource.data} />
          </LoadState>
        </section>
        {selected && (
          <WorkDetail key={selected} id={selected} onChange={resource.reload} />
        )}
      </div>
    </>
  );
}

function WorkDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const resource = useResource<WorkRecord>(`/work-items/${id}`, true);
  const action = useAction();
  const work = resource.data;
  const employee = useResource<Employee>(
    work ? `/agents/${work.agentId}` : null,
  );
  const run = useResource<Run>(
    work ? `/runs/${work.runId}` : null,
    Boolean(work && ["queued", "running"].includes(work.status)),
  );
  return (
    <section className="workspace-panel">
      <h2>Job details</h2>
      {action.feedback}
      <LoadState {...resource}>
        {work && (
          <>
            <p className="work-status">{work.status.replaceAll("_", " ")}</p>
            <p className="saved-text">{work.instruction}</p>
            <p>{work.desiredOutcome}</p>
            <p>
              Employee:{" "}
              <Link to="/agents">
                {employee.data?.name ?? "Assigned employee"}
              </Link>
            </p>
            <RepairMessage error={work.errorDetails} />
            <div className="workspace-actions">
              {["queued", "running"].includes(work.status) && (
                <button
                  className="button secondary"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await api.mutate(`/work-items/${id}/cancel`, {
                        expectedVersion: work.version,
                      });
                      resource.reload();
                      onChange();
                    }, "Cancellation requested.")
                  }
                >
                  Cancel
                </button>
              )}
              {["failed", "cancelled"].includes(work.status) && (
                <button
                  className="button primary"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await api.mutate(`/work-items/${id}/retry`, {
                        expectedVersion: work.version,
                      });
                      resource.reload();
                      onChange();
                    }, "A new attempt was queued. This may use model credits.")
                  }
                >
                  Retry job
                </button>
              )}
              <button className="button secondary" onClick={resource.reload}>
                Refresh
              </button>
            </div>
            {work.result && (
              <>
                <h3>Saved suggestion</h3>
                <div className="saved-text">{work.result}</div>
                <p>Suggestions do not execute actions.</p>
                {work.status === "completed" && (
                  <Link to={`/approvals?work=${id}`}>
                    Create an internal draft for review
                  </Link>
                )}
              </>
            )}
            <h3>Evidence used in this attempt</h3>
            <LoadState {...run}>
              <ul>
                {run.data?.sourceReferences?.map((source) => (
                  <li key={source.id}>
                    {source.name} · {source.id}
                  </li>
                ))}
              </ul>
              {run.data?.sourceReferences?.length === 0 && (
                <p>No selected sources.</p>
              )}
            </LoadState>
            <h3>Notes</h3>
            {work.notes?.map((note) => (
              <p className="saved-text" key={note.id}>
                {note.text}
              </p>
            ))}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const text = String(new FormData(form).get("text"));
                void action.run(async () => {
                  await api.mutate(`/work-items/${id}/notes`, { text });
                  form.reset();
                  resource.reload();
                }, "Note saved for a later retry. The current attempt is unchanged.");
              }}
            >
              <Field label="Clarification for the next attempt">
                <textarea name="text" required maxLength={12000} />
              </Field>
              <button className="button secondary" disabled={action.busy}>
                Save note
              </button>
            </form>
            <h3>Attempt history</h3>
            {work.attempts?.map((attempt) => (
              <details key={attempt.id}>
                <summary>
                  Attempt {attempt.attempt}: {attempt.status}
                </summary>
                <RepairMessage error={attempt.errorDetails} />
                {attempt.output && (
                  <p className="saved-text">{attempt.output}</p>
                )}
                <small>{attempt.id}</small>
              </details>
            ))}
          </>
        )}
      </LoadState>
    </section>
  );
}
