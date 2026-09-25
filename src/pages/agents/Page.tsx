import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../useWorkspace";
import {
  validProjectUrl,
  type AgentProfile,
  type AgentRole,
  type AgentSource,
} from "../../workspace";

const roleNames: Record<AgentRole, string> = {
  school: "School",
  email: "Email",
  study: "Study coach",
  projects: "Projects",
  custom: "Custom",
};

function AgentEditor({
  agent,
  done,
}: {
  agent: AgentProfile | null;
  done: (id: string) => void;
}) {
  const { commit } = useWorkspace();
  const [name, setName] = useState(agent?.name ?? "");
  const [role, setRole] = useState<AgentRole>(agent?.role ?? "custom");
  const [focus, setFocus] = useState(agent?.focus ?? "");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [url, setUrl] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [saved, setSaved] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = agent?.id ?? crypto.randomUUID();
    const profile: AgentProfile = {
      id,
      name: name.trim(),
      role,
      focus: focus.trim(),
      instructions: instructions.trim(),
      sources: agent?.sources ?? [],
      plannedAccess: agent?.plannedAccess ?? [],
      archived: agent?.archived ?? false,
    };
    if (!profile.name || !profile.focus) return;
    if (
      commit((current) => ({
        ...current,
        agents: agent
          ? current.agents.map((item) => (item.id === id ? profile : item))
          : [...current.agents, profile],
      }))
    ) {
      setSaved(true);
      done(id);
    }
  }

  function addUrl() {
    if (!agent) return;
    let valid: boolean;
    try {
      const parsed = new URL(url.trim());
      valid =
        parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        (agent.role === "projects"
          ? validProjectUrl(url.trim())
          : agent.role === "school"
            ? parsed.hostname === "dlsu.instructure.com"
            : true);
    } catch {
      valid = false;
    }
    if (!valid) {
      setSourceError(
        agent.role === "projects"
          ? "Enter a GitHub repository or Projects board URL."
          : agent.role === "school"
            ? "Enter an https://dlsu.instructure.com/ URL."
            : "Enter an HTTPS URL.",
      );
      return;
    }
    const source: AgentSource = {
      id: crypto.randomUUID(),
      name: new URL(url.trim()).pathname.split("/").filter(Boolean).at(-1) ?? "Source",
      kind: "url",
      value: new URL(url.trim()).origin + new URL(url.trim()).pathname,
    };
    if (
      commit((current) => ({
        ...current,
        agents: current.agents.map((item) =>
          item.id === agent.id ? { ...item, sources: [...item.sources, source] } : item,
        ),
      }))
    ) {
      setUrl("");
      setSourceError("");
    }
  }

  async function addMarkdown(file: File | undefined) {
    if (!agent || !file) return;
    if (!file.name.toLowerCase().endsWith(".md") || file.size > 50_000) {
      setSourceError("Choose a .md file no larger than 50 KB.");
      return;
    }
    try {
      const source: AgentSource = {
        id: crypto.randomUUID(),
        name: file.name,
        kind: "markdown",
        value: await file.text(),
      };
      if (
        commit((current) => ({
          ...current,
          agents: current.agents.map((item) =>
            item.id === agent.id ? { ...item, sources: [...item.sources, source] } : item,
          ),
        }))
      )
        setSourceError("");
    } catch {
      setSourceError("Could not read that Markdown file.");
    }
  }

  function removeSource(id: string) {
    if (!agent) return;
    commit((current) => ({
      ...current,
      agents: current.agents.map((item) =>
        item.id === agent.id
          ? { ...item, sources: item.sources.filter((source) => source.id !== id) }
          : item,
      ),
    }));
  }

  return (
    <div className="workspace-panel">
      <h2>{agent ? "Agent settings" : "Create an agent"}</h2>
      <p className="workspace-muted">
        Profiles and source previews stay in this browser. No agent or service reads them yet.
      </p>
      <form className="entry-form workspace-form" onSubmit={save}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        </label>
        <label className="field">
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as AgentRole)}>
            {Object.entries(roleNames).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>What should this agent focus on?</span>
          <textarea value={focus} onChange={(event) => setFocus(event.target.value)} maxLength={500} rows={3} required />
        </label>
        <label className="field">
          <span>Working instructions</span>
          <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1000} rows={3} />
        </label>
        <button className="button primary" type="submit">{agent ? "Save agent" : "Create agent"}</button>
        {saved && <p className="workspace-success" role="status">Saved in this browser.</p>}
      </form>
      {agent && (
        <section className="workspace-sources" aria-label="Agent sources">
          <h3>Reference sources</h3>
          <p className="workspace-muted">Links are saved as references only. Markdown content is stored in this browser for preview.</p>
          {agent.sources.length ? (
            <ul className="workspace-source-list">
              {agent.sources.map((source) => (
                <li key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <small>{source.kind === "url" ? source.value : "Local Markdown preview"}</small>
                    {source.kind === "markdown" && (
                      <details><summary>Preview file</summary><pre>{source.value}</pre></details>
                    )}
                  </div>
                  <button className="text-button danger" type="button" onClick={() => removeSource(source.id)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : <p className="workspace-muted">No sources added.</p>}
          <label className="field">
            <span>{agent.role === "projects" ? "GitHub repository or Projects board URL" : "Source URL"}</span>
            <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={agent.role === "projects" ? "https://github.com/owner/repo" : "https://..."} />
          </label>
          <button className="button secondary" type="button" onClick={addUrl} disabled={!url.trim()}>Add link</button>
          <label className="field workspace-file">
            <span>Add a Markdown file (.md, 50 KB max)</span>
            <input type="file" accept=".md,text/markdown" onChange={(event) => { void addMarkdown(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {sourceError && <p className="field-error" role="alert">{sourceError}</p>}
        </section>
      )}
      {agent && (
        <div className="workspace-actions">
          <Link className="button secondary" to={`/assistant?agent=${agent.id}`}>Open conversation</Link>
          <Link className="button secondary" to={`/work?agent=${agent.id}`}>Give work</Link>
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const { data } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>("school-agent");
  if (!data) return null;
  const selected = data.agents.find((agent) => agent.id === selectedId) ?? null;
  return (
    <div className="detail-page">
      <div className="page-top">
        <div>
          <span className="eyebrow">YOUR OWN AGENTS</span>
          <h1>Agents<span className="period">.</span></h1>
          <p className="page-subtitle">Give each area of life its own name, focus, and references.</p>
        </div>
        <button className="button primary" type="button" onClick={() => setSelectedId(null)}>Create agent</button>
      </div>
      <div className="workspace-grid">
        <section className="workspace-list" aria-label="Agents">
          {data.agents.map((agent) => (
            <button key={agent.id} type="button" className={`workspace-list-item ${selectedId === agent.id ? "selected" : ""}`} onClick={() => setSelectedId(agent.id)}>
              <span className="workspace-item-top"><strong>{agent.name}</strong><span className="status-pill">{roleNames[agent.role]}</span></span>
              <span>{agent.focus}</span>
              <small>{agent.sources.length} sources · {agent.plannedAccess.length} planned connections</small>
            </button>
          ))}
        </section>
        <AgentEditor key={selected?.id ?? "new"} agent={selected} done={setSelectedId} />
      </div>
    </div>
  );
}
