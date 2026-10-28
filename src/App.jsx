
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { supabase } from "./lib/supabaseClient";

import LoginPage from "./pages/LoginPage";
import ManagerHome from "./pages/ManagerHome";
import Categories from "./pages/Categories";
import Dashboard from "./pages/Dashboard";
import CustomerHome from "./pages/CustomerHome";
import MyOrders from "./pages/MyOrders";
import Orders from "./pages/Orders";
import CustomerTickets from "./pages/CustomerTickets";
import ManagerTickets from "./pages/ManagerTickets";

function LoadingScreen() {
  return (
    <div
      style={{
        padding: "30px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      Loading Cravely...
    </div>
  );
}

function AppRoutes() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [role, setRole] = useState(null);
  const [checkingRole, setCheckingRole] = useState(false);
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      setSession(error ? null : data.session);
      setCheckingSession(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      if (!session?.user?.id) {
        setRole(null);
        setRoleError("");
        setCheckingRole(false);
        return;
      }

      setCheckingRole(true);
      setRoleError("");
      setRole(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setRoleError(error.message);
        setRole(null);
      } else if (
        data?.role === "customer" ||
        data?.role === "manager"
      ) {
        setRole(data.role);
      } else {
        setRoleError(
          "Your account does not have a valid profile role. Please contact the project owner."
        );
      }

      setCheckingRole(false);
    }

    loadRole();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  if (checkingSession || (session && checkingRole)) {
    return <LoadingScreen />;
  }

  if (session && roleError) {
    return (
      <main
        style={{
          padding: "30px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h2>Unable to load your account role</h2>
        <p>{roleError}</p>

        <button
          onClick={async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
              console.error("Logout failed:", error.message);
            }
          }}
        >
          Log out
        </button>
      </main>
    );
  }

  // Managers now land on the Manager Home page.
  const managerHome = "/manager";

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={
          !session ? (
            <LoginPage />
          ) : role === "manager" ? (
            <Navigate to={managerHome} replace />
          ) : (
            <Navigate to="/customer" replace />
          )
        }
      />

      {/* Manager Home: central navigation page */}
      <Route
        path="/manager"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : role === "manager" ? (
            <ManagerHome />
          ) : (
            <Navigate to="/customer" replace />
          )
        }
      />

      {/* Manager Dashboard */}
      <Route
        path="/dashboard"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : role === "manager" ? (
            <Dashboard />
          ) : (
            <Navigate to="/customer" replace />
          )
        }
      />

      {/* Manager Categories */}
      <Route
        path="/categories"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : role === "manager" ? (
            <Categories />
          ) : (
            <Navigate to="/customer" replace />
          )
        }
      />

      {/* Manager Orders */}
      <Route
        path="/orders"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : role === "manager" ? (
            <Orders />
          ) : (
            <Navigate to="/customer" replace />
          )
        }
      />

      {/* Manager Tickets */}
      <Route
        path="/tickets"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : role === "manager" ? (
            <ManagerTickets />
          ) : (
            <Navigate to="/customer" replace />
          )
        }
      />

      {/* Customer Home */}
      <Route
        path="/customer"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : role === "customer" ? (
            <CustomerHome />
          ) : (
            <Navigate to={managerHome} replace />
          )
        }
      />

      {/* Customer Order History */}
      <Route
        path="/my-orders"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : role === "customer" ? (
            <MyOrders />
          ) : (
            <Navigate to={managerHome} replace />
          )
        }
      />

      {/* Customer Tickets */}
      <Route
        path="/my-tickets"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : role === "customer" ? (
            <CustomerTickets />
          ) : (
            <Navigate to={managerHome} replace />
          )
        }
      />

      {/* Default Home */}
      <Route
        path="/"
        element={
          <Navigate
            to={
              !session
                ? "/login"
                : role === "manager"
                  ? managerHome
                  : "/customer"
            }
            replace
          />
        }
      />

      {/* Unknown Routes */}
      <Route
        path="*"
        element={
          <Navigate
            to={
              !session
                ? "/login"
                : role === "manager"
                  ? managerHome
                  : "/customer"
            }
            replace
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
