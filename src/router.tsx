import { createBrowserRouter } from "react-router-dom";
import Layout from "./server/Layout";
import { Today, Tasks, Calendar, Connections, Inbox } from "./server/Records";
import Chat from "./server/Chat";
import LoginPage from "./pages/login/Page";
import SignupPage from "./pages/signup/Page";
import AgentsPage from "./server/Employees";
import WorkPage from "./server/Work";
import ApprovalsPage from "./server/Approvals";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Today /> },
      { path: "tasks", element: <Tasks /> },
      { path: "calendar", element: <Calendar /> },
      { path: "assistant", element: <Chat /> },
      { path: "agents", element: <AgentsPage /> },
      { path: "work", element: <WorkPage /> },
      { path: "approvals", element: <ApprovalsPage /> },
      { path: "connections", element: <Connections /> },
      { path: "inbox", element: <Inbox /> },
    ],
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
]);

export default router;
