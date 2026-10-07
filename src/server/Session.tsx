import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, ApiError, type Owner } from "../api";

type Session = {
  owner: Owner | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  signedIn: (owner: Owner) => void;
};
const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    owner: null as Owner | null,
    loading: true,
    error: null as string | null,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .request<Owner>("/me")
      .then((owner) => {
        if (active) setState({ owner, loading: false, error: null });
      })
      .catch((error) => {
        if (active)
          setState({
            owner: null,
            loading: false,
            error:
              error instanceof ApiError && error.status === 401
                ? null
                : String(error.message),
          });
      });
    const expired = () =>
      setState({ owner: null, loading: false, error: null });
    window.addEventListener("aiops-session-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("aiops-session-expired", expired);
    };
  }, [revision]);
  return (
    <Context.Provider
      value={{
        ...state,
        reload: () => {
          setState({ owner: null, loading: true, error: null });
          setRevision((value) => value + 1);
        },
        signedIn: (owner) => setState({ owner, loading: false, error: null }),
      }}
    >
      {children}
    </Context.Provider>
  );
}

// Context hooks share this module with their provider intentionally.
// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("SessionProvider is required");
  return context;
}

export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.loading)
    return (
      <main className="auth-placeholder" role="status">
        Loading your workspace…
      </main>
    );
  if (session.error)
    return (
      <main className="auth-placeholder">
        <p role="alert">{session.error}</p>
        <button onClick={session.reload}>Retry connection</button>
      </main>
    );
  if (!session.owner)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  return children;
}
