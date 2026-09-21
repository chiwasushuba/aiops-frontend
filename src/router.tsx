import Home from "./App"
import LoginPage from "./pages/login/Page"
import SignupPage from "./pages/signup/Page"
import { createBrowserRouter } from "react-router-dom"




const router = createBrowserRouter([
    {
        path: "/",
        element: <Home />,
    },
    {
        path: "/signup",
        element: <SignupPage />,
    },
    {
        path: "/login",
        element: <LoginPage />,
    }


])

export default router