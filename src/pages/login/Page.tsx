import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useSession } from "../../server/Session";
import { Field, useAction } from "../../server/shared";
import "../../App.css";
import "../../server/Server.css";

export default function LoginPage() {
  const session = useSession();
  const action = useAction();
  const navigate = useNavigate();
  const location = useLocation();
  const requested = (location.state as { from?: string } | null)?.from;
  const destination =
    requested?.startsWith("/") &&
    !requested.startsWith("//") &&
    requested !== "/login"
      ? requested
      : "/";
  if (session.owner) return <Navigate to={destination} replace />;
  if (session.loading)
    return (
      <main className="server-auth" role="status">
        Checking your session…
      </main>
    );
  return (
    <main className="server-auth">
      <h1>Sign in to AIOps</h1>
      <p>
        Your private employee workspace. Use the owner credentials configured on
        your backend.
      </p>
      {action.feedback}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void action.run(async () => {
            const owner = await api.login(
              String(fields.get("username")),
              String(fields.get("password")),
            );
            session.signedIn(owner);
            navigate(destination, { replace: true });
          });
        }}
      >
        <Field label="Username">
          <input name="username" required autoComplete="username" />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>
        <button className="button primary" disabled={action.busy}>
          {action.busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p>
        There is no public signup. Owner access is configured on the server.
      </p>
    </main>
  );
}
