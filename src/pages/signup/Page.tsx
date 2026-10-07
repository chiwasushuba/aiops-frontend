import { Link } from "react-router-dom";

const SignupPage = () => (
  <main className="auth-placeholder">
    <h1>This workspace has one private owner.</h1>
    <p>
      Public account creation is unavailable. Use the owner credentials
      configured on the backend.
    </p>
    <Link to="/login">Sign in</Link>
  </main>
);

export default SignupPage;
