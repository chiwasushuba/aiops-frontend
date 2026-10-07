import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  api,
  submissionIdentity,
  type Conversation,
  type Employee,
  type Message,
  type Page,
  type Run,
} from "../api";
import { SourceChoices } from "./Work";
import {
  Field,
  LoadState,
  Pager,
  RepairMessage,
  useAction,
  useResource,
} from "./shared";

export default function Chat() {
  const [query] = useSearchParams();
  const [employeeId, setEmployeeId] = useState(query.get("agent") ?? "");
  const [page, setPage] = useState(0);
  const employees = useResource<Page<Employee>>(`/agents?page=${page}&size=20`);
  return (
    <>
      <h1>Employee conversations</h1>
      <Field label="Employee">
        <select
          required
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
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
        <Pager page={page} setPage={setPage} data={employees.data} />
      </LoadState>
      {employeeId && <EmployeeChat key={employeeId} employeeId={employeeId} />}
    </>
  );
}

function EmployeeChat({ employeeId }: { employeeId: string }) {
  const [page, setPage] = useState(0);
  const [conversationId, setConversationId] = useState("");
  const resource = useResource<Page<Conversation>>(
    `/agents/${employeeId}/conversations?page=${page}&size=20`,
  );
  const action = useAction();
  return (
    <section className="workspace-panel">
      {action.feedback}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const title = String(new FormData(event.currentTarget).get("title"));
          void action.run(async () => {
            const conversation = await api.mutate<Conversation>(
              `/agents/${employeeId}/conversations`,
              { title },
            );
            setConversationId(conversation.id);
            setPage(0);
            resource.reload();
          });
        }}
      >
        <Field label="New conversation title">
          <input name="title" required maxLength={200} />
        </Field>
        <button className="button secondary" disabled={action.busy}>
          Create conversation
        </button>
      </form>
      <LoadState {...resource}>
        <Field label="Conversation">
          <select
            value={conversationId}
            onChange={(event) => setConversationId(event.target.value)}
          >
            <option value="">Choose a conversation</option>
            {conversationId &&
              !resource.data?.content.some(
                (conversation) => conversation.id === conversationId,
              ) && (
                <option value={conversationId}>Selected conversation</option>
              )}
            {resource.data?.content.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))}
          </select>
        </Field>
        <Pager page={page} setPage={setPage} data={resource.data} />
      </LoadState>
      {conversationId && (
        <ConversationView
          key={conversationId}
          id={conversationId}
          employeeId={employeeId}
        />
      )}
    </section>
  );
}

function ConversationView({
  id,
  employeeId,
}: {
  id: string;
  employeeId: string;
}) {
  const [page, setPage] = useState(0);
  const [submittedRun, setSubmittedRun] = useState<string | null>(null);
  const messages = useResource<Page<Message>>(
    `/conversations/${id}/messages?page=${page}&size=20`,
    true,
  );
  const latest = useResource<Page<Run>>(
    `/conversations/${id}/runs?page=0&size=1`,
    true,
  );
  const latestRun = submittedRun ?? latest.data?.content[0]?.id;
  const run = useResource<Run>(latestRun ? `/runs/${latestRun}` : null, true);
  const action = useAction();
  const submission = useRef<{ payload: string; id: string } | null>(null);
  return (
    <>
      <h2>Saved conversation</h2>
      <LoadState {...messages}>
        {messages.data?.content.length === 0 && <p>No messages yet.</p>}
        {messages.data?.content.map((message) => (
          <article className="workspace-panel" key={message.id}>
            <strong>
              {message.role === "assistant" ? "Employee suggestion" : "You"}
            </strong>
            <p className="saved-text">{message.content}</p>
          </article>
        ))}
        <Pager page={page} setPage={setPage} data={messages.data} />
      </LoadState>
      <LoadState {...latest}>
        {run.error && <p role="alert">{run.error}</p>}
        {run.data && (
          <>
            <p>Reply: {run.data.status}</p>
            <RepairMessage error={run.data.errorDetails} />
            {run.data.output && (
              <details>
                <summary>Latest saved suggestion</summary>
                <p className="saved-text">{run.data.output}</p>
              </details>
            )}
            {["queued", "running"].includes(run.data.status) && (
              <button
                className="button secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api.mutate(`/runs/${run.data!.id}/cancel`);
                    run.reload();
                  })
                }
              >
                Cancel reply
              </button>
            )}
          </>
        )}
      </LoadState>
      {action.feedback}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          const payload = {
            content: String(fields.get("content")),
            sourceIds: fields.getAll("sourceIds").map(String),
          };
          void action.run(async () => {
            if (payload.sourceIds.length > 4)
              throw new Error("Select at most four sources.");
            submission.current = submissionIdentity(
              submission.current,
              payload,
            );
            const response = await api.mutate<{ messageId: string; run: Run }>(
              `/conversations/${id}/messages`,
              { ...payload, clientRequestId: submission.current.id },
            );
            submission.current = null;
            setSubmittedRun(response.run.id);
            form.reset();
            messages.reload();
          }, "Message saved. The reply status is tracked above.");
        }}
      >
        <Field label="Message">
          <textarea name="content" required maxLength={12000} rows={4} />
        </Field>
        <SourceChoices employeeId={employeeId} />
        <button
          className="button primary"
          disabled={
            action.busy ||
            Boolean(run.data && ["queued", "running"].includes(run.data.status))
          }
        >
          Send message
        </button>
      </form>
    </>
  );
}
