import { Link } from "react-router-dom";

const LoginPage = () => (
  <main className="auth-placeholder">
    <h1>Sign in is not available in this demo.</h1>
    <p>
      This is a browser-local prototype with sample data. There is no account or
      remote data access yet.
    </p>
    <Link to="/">Open the demo dashboard</Link>
  </main>
);

export default LoginPage;
