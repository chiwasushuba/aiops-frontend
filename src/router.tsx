import { createBrowserRouter } from "react-router-dom";
import App, { AssistantPage, CalendarPage, Dashboard, TasksPage } from "./App";
import LoginPage from "./pages/login/Page";
import SignupPage from "./pages/signup/Page";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "assistant", element: <AssistantPage /> },
    ],
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
]);

export default router;
