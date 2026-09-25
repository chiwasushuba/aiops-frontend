import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../useWorkspace";
import { makeWorkItem, type WorkItem, type WorkProposal } from "../../workspace";
import type { Priority } from "../../demo";

const statusLabels: Record<WorkItem["status"], string> = {
  queued: "Waiting for backend",
  needs_review: "Needs review",
  completed: "Completed locally",
  blocked: "Blocked",
  cancelled: "Cancelled",
  declined: "Declined",
};

function WorkDetail({ work }: { work: WorkItem }) {
  const { data, commit } = useWorkspace();
  const [note, setNote] = useState("");
  const agent = data?.agents.find((item) => item.id === work.agentId);

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = note.trim();
    if (!text) return;
    if (
      commit((current) => ({
        ...current,
        workItems: current.workItems.map((item) =>
          item.id === work.id
            ? { ...item, notes: [...item.notes, { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }] }
            : item,
        ),
      }))
    )
      setNote("");
  }

  return (
    <section className="workspace-panel" aria-label="Selected work request">
      <span className="eyebrow">WORK REQUEST</span>
      <h2>{agent?.name ?? "Archived agent"}</h2>
      <span className={`status-pill status-${work.status}`}>{statusLabels[work.status]}</span>
      <p className="workspace-request">{work.request}</p>
      {work.result && <div className="workspace-result" role="status"><strong>Result</strong><p>{work.result}</p></div>}
      {work.status === "queued" && (
        <p className="workspace-notice">This request is saved in the queue. No agent is running it until the backend is connected.</p>
      )}
      {work.status === "needs_review" && (
        <p><Link className="button primary" to={`/approvals?work=${work.id}`}>Review proposed action</Link></p>
      )}
      <div className="workspace-actions">
        {agent && <Link className="button secondary" to={`/assistant?agent=${agent.id}`}>Talk with {agent.name}</Link>}
        {(work.status === "queued" || work.status === "needs_review") && (
          <button className="button secondary" type="button" onClick={() => commit((current) => ({
            ...current,
            workItems: current.workItems.map((item) => item.id === work.id ? { ...item, status: "cancelled", result: "Cancelled in the local prototype." } : item),
          }))}>Cancel request</button>
        )}
      </div>
      <section className="workspace-notes" aria-label="Instructions and discussion">
        <h3>Instructions and discussion</h3>
        <p className="workspace-muted">Add clarification for this request. These notes are not sent to an agent yet.</p>
        {work.notes.length ? (
          <ul>{work.notes.map((item) => <li key={item.id}><p>{item.text}</p><small>{new Date(item.createdAt).toLocaleString()}</small></li>)}</ul>
        ) : <p className="workspace-muted">No follow-up instructions.</p>}
        <form onSubmit={addNote}>
          <label className="field"><span>Add an instruction</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} /></label>
          <button className="button secondary" type="submit" disabled={!note.trim()}>Save instruction</button>
        </form>
      </section>
    </section>
  );
}

export default function WorkPage() {
  const { data, commit } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const captured = data?.captures.find((item) => item.id === params.get("capture") && item.status === "open");
  const [agentId, setAgentId] = useState(params.get("agent") ?? "school-agent");
  const [request, setRequest] = useState(captured?.text ?? "");
  const [kind, setKind] = useState<"plan" | "task" | "event" | "email">("plan");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [startsAt, setStartsAt] = useState("");
  const [eventDestination, setEventDestination] = useState<"local" | "google-calendar" | "outlook-calendar">("local");
  const [emailProvider, setEmailProvider] = useState<"gmail" | "outlook-mail">("gmail");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [validation, setValidation] = useState("");
  if (!data) return null;
  const activeAgents = data.agents.filter((agent) => !agent.archived);
  const selected = data.workItems.find((item) => item.id === params.get("work")) ?? data.workItems[0];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.agents.some((agent) => agent.id === agentId && !agent.archived)) {
      setValidation("Choose an available agent.");
      return;
    }
    let proposal: WorkProposal | null = null;
    if (kind === "task") {
      if (!title.trim()) { setValidation("Enter the task title to review."); return; }
      proposal = { kind, title: title.trim(), dueDate: dueDate || null, priority };
    } else if (kind === "event") {
      if (!title.trim() || !startsAt) { setValidation("Enter the dated item's title and time."); return; }
      proposal = { kind, title: title.trim(), startsAt: new Date(startsAt).toISOString(), reminderAt: null, destination: eventDestination };
    } else if (kind === "email") {
      if (!to.trim() || !subject.trim() || !body.trim()) { setValidation("Enter recipient, subject, and body."); return; }
      proposal = { kind, to: to.trim(), subject: subject.trim(), body: body.trim(), provider: emailProvider };
    }
    if (!request.trim()) { setValidation("Describe what the agent should do."); return; }
    const work = makeWorkItem(agentId, request, proposal, captured?.id ?? null);
    if (
      commit((current) => ({
        ...current,
        workItems: [work, ...current.workItems],
        captures: current.captures.map((item) => item.id === captured?.id ? { ...item, status: "sent" } : item),
      }))
    ) {
      setParams({ work: work.id });
      setRequest("");
      setTitle("");
      setDueDate("");
      setStartsAt("");
      setEventDestination("local");
      setEmailProvider("gmail");
      setTo("");
      setSubject("");
      setBody("");
      setValidation("");
    }
  }

  return (
    <div className="detail-page">
      <div className="page-top">
        <div><span className="eyebrow">AGENT WORK</span><h1>Work queue<span className="period">.</span></h1><p className="page-subtitle">Assign work, see review requests, and check what actually happened.</p></div>
        <Link className="button secondary" to="/approvals">Open approvals</Link>
      </div>
      <div className="workspace-grid">
        <div className="workspace-stack">
          <section className="workspace-panel">
            <h2>Give an agent work</h2>
            <p className="workspace-muted">Internal task and date proposals can be saved locally after review. Other requests wait for a backend agent.</p>
            <form className="workspace-form" onSubmit={submit}>
              <label className="field"><span>Agent</span><select value={agentId} onChange={(event) => setAgentId(event.target.value)}>{activeAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
              <label className="field"><span>What should this agent do?</span><textarea value={request} onChange={(event) => setRequest(event.target.value)} maxLength={1000} rows={3} required /></label>
              <label className="field"><span>Proposed outcome</span><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="plan">Plan or research</option><option value="task">Create a task</option><option value="event">Add a dated item</option><option value="email">Draft an email</option></select></label>
              {(kind === "task" || kind === "event") && <label className="field"><span>{kind === "task" ? "Task title" : "Dated item title"}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>}
              {kind === "task" && <div className="form-grid"><label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label></div>}
              {kind === "event" && <><label className="field"><span>Date and time</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label className="field"><span>Destination</span><select value={eventDestination} onChange={(event) => setEventDestination(event.target.value as typeof eventDestination)}><option value="local">This app</option><option value="google-calendar">Google Calendar (preview)</option><option value="outlook-calendar">Outlook Calendar (preview)</option></select></label></>}
              {kind === "email" && <><label className="field"><span>Planned email provider</span><select value={emailProvider} onChange={(event) => setEmailProvider(event.target.value as typeof emailProvider)}><option value="gmail">Gmail</option><option value="outlook-mail">Outlook Mail</option></select></label><label className="field"><span>Recipient</span><input type="email" value={to} onChange={(event) => setTo(event.target.value)} required /></label><label className="field"><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} required /></label><label className="field"><span>Body</span><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} rows={5} required /></label><p className="workspace-muted">This draft remains in your browser. It cannot send email.</p></>}
              {validation && <p className="field-error" role="alert">{validation}</p>}
              <button className="button primary" type="submit" disabled={!activeAgents.length}>Add to work queue</button>
            </form>
          </section>
          <section className="workspace-panel" aria-label="Work items">
            <h2>Requests</h2>
            {data.workItems.length ? <div className="workspace-list">{data.workItems.map((work) => <button key={work.id} className={`workspace-list-item ${selected?.id === work.id ? "selected" : ""}`} type="button" onClick={() => setParams({ work: work.id })}><span className="workspace-item-top"><strong>{data.agents.find((agent) => agent.id === work.agentId)?.name ?? "Agent"}</strong><span className={`status-pill status-${work.status}`}>{statusLabels[work.status]}</span></span><span>{work.request}</span><small>{new Date(work.createdAt).toLocaleString()}</small></button>)}</div> : <p className="workspace-muted">No work requests yet. Give an agent a small task to start.</p>}
          </section>
        </div>
        {selected ? <WorkDetail key={selected.id} work={selected} /> : <div className="workspace-panel"><h2>No result yet</h2><p className="workspace-muted">Select a request to see its status and result.</p></div>}
      </div>
    </div>
  );
}
