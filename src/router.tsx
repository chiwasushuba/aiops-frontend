import { createBrowserRouter } from "react-router-dom";
import App, { AssistantPage, CalendarPage, Dashboard, TasksPage } from "./App";
import LoginPage from "./pages/login/Page";
import SignupPage from "./pages/signup/Page";
import AgentsPage from "./pages/agents/Page";
import WorkPage from "./pages/work/Page";
import ApprovalsPage from "./pages/approvals/Page";
import ConnectionsPage from "./pages/connections/Page";
import InboxPage from "./pages/inbox/Page";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "assistant", element: <AssistantPage /> },
      { path: "agents", element: <AgentsPage /> },
      { path: "work", element: <WorkPage /> },
      { path: "approvals", element: <ApprovalsPage /> },
      { path: "connections", element: <ConnectionsPage /> },
      { path: "inbox", element: <InboxPage /> },
    ],
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
]);

export default router;
