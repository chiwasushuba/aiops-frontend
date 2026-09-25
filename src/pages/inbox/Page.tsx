import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../useWorkspace";

export default function InboxPage() {
  const { data, commit } = useWorkspace();
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;
  const items = data.captures.filter((item) => showAll || item.status === "open");

  function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (
      commit((current) => ({
        ...current,
        captures: [
          { id: crypto.randomUUID(), text: value, createdAt: new Date().toISOString(), status: "open" },
          ...current.captures,
        ],
      }))
    )
      setText("");
  }

  function setStatus(id: string, status: "open" | "archived") {
    commit((current) => ({
      ...current,
      captures: current.captures.map((item) => item.id === id ? { ...item, status } : item),
    }));
  }

  return (
    <div className="detail-page">
      <div className="page-top"><div><span className="eyebrow">CLEAR YOUR HEAD</span><h1>Capture inbox<span className="period">.</span></h1><p className="page-subtitle">Put it here now; decide which agent should handle it later.</p></div><span className="page-count">{data.captures.filter((item) => item.status === "open").length}<span>OPEN ITEMS</span></span></div>
      <div className="workspace-grid">
        <section className="workspace-panel">
          <h2>Quick capture</h2>
          <form className="workspace-form" onSubmit={capture}>
            <label className="field"><span>What is on your mind?</span><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} rows={5} placeholder="A task, deadline, idea, or thing to follow up…" required /></label>
            <button className="button primary" type="submit">Save to inbox</button>
          </form>
          <p className="workspace-muted">Saved only in this browser until a backend inbox exists.</p>
        </section>
        <section className="workspace-panel">
          <div className="workspace-item-top"><h2>Captured items</h2><label className="workspace-toggle"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} /> Show handled</label></div>
          {items.length ? <ul className="capture-list">{items.map((item) => <li key={item.id}><p>{item.text}</p><small>{new Date(item.createdAt).toLocaleString()} · {item.status === "open" ? "Open" : item.status === "sent" ? "Sent to work queue" : "Archived"}</small><div className="workspace-actions">{item.status === "open" ? <><Link className="button secondary" to={`/work?capture=${item.id}`}>Give to an agent</Link><button className="text-button" type="button" onClick={() => setStatus(item.id, "archived")}>Archive</button></> : <button className="text-button" type="button" onClick={() => setStatus(item.id, "open")}>Reopen</button>}</div></li>)}</ul> : <p className="workspace-muted">Your inbox is clear. New thoughts will appear here.</p>}
        </section>
      </div>
    </div>
  );
}
