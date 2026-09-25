import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDemo } from "../../useDemo";
import { useWorkspace } from "../../useWorkspace";
import { applyLocalProposal, type WorkItem } from "../../workspace";

function isExternal(work: WorkItem): boolean {
  return work.proposal?.kind === "email" ||
    (work.proposal?.kind === "event" && work.proposal.destination !== undefined && work.proposal.destination !== "local");
}

function ProposalDetails({ work }: { work: WorkItem }) {
  const proposal = work.proposal;
  if (!proposal) return null;
  if (proposal.kind === "task") return <dl className="proposal-details"><dt>Task</dt><dd>{proposal.title}</dd><dt>Due</dt><dd>{proposal.dueDate ?? "No due date"}</dd><dt>Priority</dt><dd>{proposal.priority}</dd></dl>;
  if (proposal.kind === "event") return <dl className="proposal-details"><dt>Dated item</dt><dd>{proposal.title}</dd><dt>When</dt><dd>{new Date(proposal.startsAt).toLocaleString()}</dd><dt>Destination</dt><dd>{proposal.destination === "google-calendar" ? "Google Calendar (not connected)" : proposal.destination === "outlook-calendar" ? "Outlook Calendar (not connected)" : "This app"}</dd><dt>Reminder</dt><dd>{proposal.reminderAt ? new Date(proposal.reminderAt).toLocaleString() : "None"}</dd></dl>;
  return <dl className="proposal-details"><dt>Provider</dt><dd>{proposal.provider === "outlook-mail" ? "Outlook Mail" : "Gmail"} (not connected)</dd><dt>To</dt><dd>{proposal.to}</dd><dt>Subject</dt><dd>{proposal.subject}</dd><dt>Body</dt><dd className="proposal-body">{proposal.body}</dd></dl>;
}

export default function ApprovalsPage() {
  const { data: workspace, commit: commitWorkspace } = useWorkspace();
  const { commit: commitDemo } = useDemo();
  const [params, setParams] = useSearchParams();
  const [changes, setChanges] = useState("");
  const [feedback, setFeedback] = useState("");
  if (!workspace) return null;
  const pending = workspace.workItems.filter((item) => item.status === "needs_review");
  const selected = pending.find((item) => item.id === params.get("work")) ?? pending[0];
  const agent = workspace.agents.find((item) => item.id === selected?.agentId);
  const external = selected ? isExternal(selected) : false;

  function approveLocal() {
    if (!selected?.proposal || isExternal(selected)) return;
    const saved = commitDemo((current) => applyLocalProposal(current, selected));
    if (!saved) {
      setFeedback("Could not save the item. The proposal is still waiting for review.");
      return;
    }
    if (
      commitWorkspace((current) => ({
        ...current,
        workItems: current.workItems.map((item) =>
          item.id === selected.id
            ? { ...item, status: "completed", result: selected.proposal?.kind === "task" ? "Task saved in this browser." : "Dated item saved in this browser." }
            : item,
        ),
      }))
    )
      setFeedback("Saved locally. The work queue now shows the result.");
    else setFeedback("The item was saved, but the queue status could not update. Retry this approval; it will not create a duplicate.");
  }

  function decline() {
    if (!selected) return;
    if (
      commitWorkspace((current) => ({
        ...current,
        workItems: current.workItems.map((item) => item.id === selected.id ? { ...item, status: "declined", result: "Proposal declined in the local prototype." } : item),
      }))
    )
      setFeedback("Proposal declined.");
  }

  function requestChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !changes.trim()) return;
    if (
      commitWorkspace((current) => ({
        ...current,
        workItems: current.workItems.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                status: "queued",
                proposal: null,
                notes: [...item.notes, { id: crypto.randomUUID(), text: changes.trim(), createdAt: new Date().toISOString() }],
                result: "Changes requested. A backend agent must prepare a new proposal.",
              }
            : item,
        ),
      }))
    ) {
      setChanges("");
      setFeedback("Changes saved with the work request.");
    }
  }

  return (
    <div className="detail-page">
      <div className="page-top"><div><span className="eyebrow">YOUR DECISION</span><h1>Approvals<span className="period">.</span></h1><p className="page-subtitle">Review the exact action before anything is saved or sent.</p></div><Link className="button secondary" to="/work">Work queue</Link></div>
      {feedback && <p className="workspace-feedback" role="status">{feedback}</p>}
      <div className="workspace-grid">
        <section className="workspace-panel" aria-label="Pending proposals">
          <h2>Waiting for review <span className="workspace-count">{pending.length}</span></h2>
          {pending.length ? <div className="workspace-list">{pending.map((item) => <button key={item.id} type="button" className={`workspace-list-item ${selected?.id === item.id ? "selected" : ""}`} onClick={() => { setParams({ work: item.id }); setFeedback(""); }}><strong>{workspace.agents.find((entry) => entry.id === item.agentId)?.name ?? "Agent"}</strong><span>{item.request}</span><small>{isExternal(item) ? "Outside action preview" : "Local action proposal"}</small></button>)}</div> : <p className="workspace-muted">Nothing is waiting for review. New proposals will appear here.</p>}
        </section>
        {selected ? <section className="workspace-panel approval-panel" aria-label="Selected proposal">
          <span className="eyebrow">{agent?.name ?? "Agent"} PROPOSES</span>
          <h2>{selected.proposal?.kind === "email" ? "Email draft" : selected.proposal?.kind === "task" ? "Create task" : "Add dated item"}</h2>
          <p className="workspace-muted">Requested: {selected.request}</p>
          <ProposalDetails work={selected} />
          {external ? <div className="workspace-notice"><strong>No outside action will run from this prototype.</strong><p>Connecting the selected account and confirming a fresh server-side proposal are required before sending email or writing an external calendar event.</p></div> : <p className="workspace-muted">Confirmation saves this item in the browser-local Tasks or Calendar view.</p>}
          <div className="workspace-actions">
            {external ? <button className="button primary" type="button" disabled>Confirm outside action - backend required</button> : <button className="button primary" type="button" onClick={approveLocal}>Confirm and save locally</button>}
            <button className="button secondary" type="button" onClick={decline}>Decline</button>
          </div>
          <form className="workspace-form" onSubmit={requestChanges}>
            <label className="field"><span>Discuss a change with {agent?.name ?? "the agent"}</span><textarea value={changes} onChange={(event) => setChanges(event.target.value)} maxLength={1000} rows={3} placeholder="What should be different?" /></label>
            <button className="button secondary" type="submit" disabled={!changes.trim()}>Request changes</button>
          </form>
          <p className="workspace-muted">This records your instruction in the work queue. A backend agent is needed to reply and make a revised proposal.</p>
        </section> : <div className="workspace-panel"><h2>All clear</h2><p className="workspace-muted">You have no proposals to review.</p></div>}
      </div>
    </div>
  );
}
