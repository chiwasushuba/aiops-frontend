import { useWorkspace } from "../../useWorkspace";
import { providers, type ProviderKey } from "../../workspace";

export default function ConnectionsPage() {
  const { data, commit } = useWorkspace();
  if (!data) return null;

  function toggle(agentId: string, provider: ProviderKey) {
    commit((current) => ({
      ...current,
      agents: current.agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              plannedAccess: agent.plannedAccess.includes(provider)
                ? agent.plannedAccess.filter((key) => key !== provider)
                : [...agent.plannedAccess, provider],
            }
          : agent,
      ),
    }));
  }

  return (
    <div className="detail-page">
      <div className="page-top"><div><span className="eyebrow">CONNECTED SOURCES</span><h1>Connections<span className="period">.</span></h1><p className="page-subtitle">Plan what each agent may use when the backend connections are ready.</p></div></div>
      <div className="workspace-notice"><strong>No accounts are connected.</strong><p>These checkboxes record intended access in this browser only. They do not authorize an agent, read any account, or grant provider permission.</p></div>
      <div className="connection-grid">
        {providers.map((provider) => (
          <section className="workspace-panel connection-card" key={provider.key} aria-labelledby={`connection-${provider.key}`}>
            <div className="workspace-item-top"><h2 id={`connection-${provider.key}`}>{provider.name}</h2><span className="status-pill">Not connected</span></div>
            <p className="workspace-muted">{provider.purpose}</p>
            {provider.key === "canvas" && <p className="workspace-muted">School site: <a href="https://dlsu.instructure.com/" target="_blank" rel="noreferrer">dlsu.instructure.com</a>. Access depends on school approval and a backend integration.</p>}
            {provider.key === "github" && <p className="workspace-muted">Repository or Projects board links and local .md previews can be attached to Projects Partner now. Private repositories need a future GitHub connection.</p>}
            <fieldset className="connection-grants">
              <legend>Agents to request access for</legend>
              {data.agents.filter((agent) => !agent.archived).map((agent) => (
                <label key={agent.id}>
                  <input type="checkbox" checked={agent.plannedAccess.includes(provider.key)} onChange={() => toggle(agent.id, provider.key)} />
                  <span>{agent.name}</span>
                </label>
              ))}
            </fieldset>
            <button className="button secondary" type="button" disabled>Connect account — backend required</button>
          </section>
        ))}
      </div>
    </div>
  );
}
