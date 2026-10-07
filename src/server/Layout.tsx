import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../api";
import { RequireSession, useSession } from "./Session";
import { useAction } from "./shared";
import "../App.css";
import "../Workspace.css";
import "./Server.css";

const links = [
  ["/", "Today"],
  ["/agents", "Employees"],
  ["/assistant", "Chat"],
  ["/work", "Work queue"],
  ["/approvals", "Approvals"],
  ["/connections", "Connections"],
  ["/tasks", "Tasks"],
  ["/calendar", "Calendar"],
  ["/inbox", "Capture inbox"],
];

export default function Layout() {
  return (
    <RequireSession>
      <Shell />
    </RequireSession>
  );
}

function Shell() {
  const session = useSession();
  const action = useAction();
  return (
    <div className="app-layout server-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">a.</span>
          <div>
            <strong>AIOps</strong>
            <small>PRIVATE WORKSPACE</small>
          </div>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span>{session.owner?.displayName}</span>
          <small>Saved to your private server</small>
          <button
            className="text-button"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api.logout();
                session.reload();
              }, "Signed out.")
            }
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="server-mobile">
          <Link to="/">AIOps</Link>
          <nav aria-label="Mobile navigation">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"}>
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        {action.feedback}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
