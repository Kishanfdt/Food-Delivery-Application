import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  Truck,
  Loader2,
  Utensils,
  LogOut,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@users.foodapp.invalid`;
}

export default function AuthPanel({ onSessionChange }) {
  const navigate = useNavigate();

  const [loginType, setLoginType] = useState("customer"); // "customer" | "manager"
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error"); // "error" | "success"
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        setMessage(error.message);
        setMessageType("error");
        return;
      }

      setSession(data.session);
      if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .maybeSingle();

        if (active && profile?.role) {
          setUserRole(profile.role);
        }
      }
      onSessionChange?.(data.session);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", nextSession.user.id)
          .maybeSingle();
        setUserRole(profile?.role || null);
      } else {
        setUserRole(null);
      }
      onSessionChange?.(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [onSessionChange]);

  function switchLoginType(type) {
    setLoginType(type);
    setMode("signin");
    setUsername("");
    setPassword("");
    setMessage("");
    setShowPassword(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      setMessageType("error");
      setMessage(
        "Username must be 3–24 characters and contain only letters, numbers, or underscores."
      );
      return;
    }

    if (password.length < 8) {
      setMessageType("error");
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    if (loginType === "manager" && mode === "signup") {
      setMessageType("error");
      setMessage("Manager accounts cannot be created here.");
      return;
    }

    setLoading(true);

    try {
      const email = usernameToEmail(normalizedUsername);

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: normalizedUsername },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessageType("success");
          setMessage(
            "Account created! Please check your email configuration before signing in."
          );
          return;
        }

        setSession(data.session);
        onSessionChange?.(data.session);
        setMessageType("success");
        setMessage("Account created successfully! Redirecting...");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }

      const requiredRole = loginType === "manager" ? "manager" : "customer";

      if (profile?.role !== requiredRole) {
        await supabase.auth.signOut();
        setSession(null);
        setMessageType("error");
        setMessage(
          loginType === "manager"
            ? "This account is not registered as a manager. Please switch to Customer Login."
            : "This is a manager account. Please switch to Manager Portal."
        );
        return;
      }

      setSession(data.session);
      setUserRole(profile.role);
      setMessageType("success");
      setMessage("Login successful! Redirecting to your dashboard...");
      onSessionChange?.(data.session);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signOut();
    setLoading(false);

    if (error) {
      setMessageType("error");
      setMessage(error.message);
    } else {
      setSession(null);
      setUserRole(null);
      setUsername("");
      setPassword("");
      setMessageType("success");
      setMessage("Logged out successfully.");
    }
  }

  // Quick fill helper for testing
  function handleQuickFill(fillUsername, fillPassword, fillType) {
    setLoginType(fillType);
    setMode("signin");
    setUsername(fillUsername);
    setPassword(fillPassword);
    setMessage("");
  }

  // Authenticated State View
  if (session) {
    const isManager = userRole === "manager";
    const displayName =
      session.user.user_metadata?.username ||
      session.user.email?.split("@")[0] ||
      "User";

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "radial-gradient(circle at 10% 20%, rgba(38, 60, 46, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(198, 94, 56, 0.06) 0%, transparent 40%), #F7F5EF",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "460px",
            background: "#ffffff",
            border: "1px solid #E5E4DA",
            borderRadius: "24px",
            padding: "40px 32px",
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(38, 60, 46, 0.08)",
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #263C2E 0%, #1A2B20 100%)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px",
              boxShadow: "0 6px 18px rgba(38, 60, 46, 0.2)",
            }}
          >
            <Sparkles size={26} color="#ffffff" strokeWidth={2.4} />
          </div>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "1.8px",
              color: "#C65E38",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "8px",
            }}
          >
            CURRENT SESSION ACTIVE
          </span>

          <h1
            style={{
              margin: "0 0 6px",
              fontFamily: "'Manrope', sans-serif",
              fontSize: "26px",
              fontWeight: 800,
              color: "#263C2E",
            }}
          >
            Welcome, {displayName}!
          </h1>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "999px",
              background: isManager ? "#EAF0E6" : "#FFF1EB",
              color: isManager ? "#263C2E" : "#C65E38",
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "24px",
            }}
          >
            {isManager ? <ShieldCheck size={14} /> : <User size={14} />}
            <span>{isManager ? "Store Manager Account" : "Customer Dining Account"}</span>
          </div>

          <p
            style={{
              margin: "0 0 28px",
              fontSize: "14px",
              color: "#697064",
              lineHeight: 1.5,
            }}
          >
            You are securely authenticated. Proceed directly to your workspace below or switch accounts.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              onClick={() => navigate(isManager ? "/dashboard" : "/customer")}
              className="customer-btn-primary"
              style={{
                width: "100%",
                padding: "14px 20px",
                fontSize: "14.5px",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>{isManager ? "Open Manager Dashboard" : "Browse Dining Menu"}</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E4DA",
                background: "#ffffff",
                color: "#991B1B",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.18s ease",
              }}
            >
              <LogOut size={15} />
              <span>{loading ? "Signing out..." : "Sign Out"}</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  // Unauthenticated Split Login Screen
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "radial-gradient(circle at 10% 20%, rgba(38, 60, 46, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(198, 94, 56, 0.06) 0%, transparent 40%), #F7F5EF",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "960px",
          background: "#ffffff",
          borderRadius: "24px",
          border: "1px solid #E5E4DA",
          boxShadow: "0 24px 64px rgba(38, 60, 46, 0.09)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        {/* Left Side: Brand Showcase & Atmosphere */}
        <div
          style={{
            background: "linear-gradient(145deg, #1A2B20 0%, #263C2E 60%, #1F3326 100%)",
            color: "#ffffff",
            padding: "44px 38px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle decorative glow ring */}
          <div
            style={{
              position: "absolute",
              top: "-60px",
              right: "-60px",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(198, 94, 56, 0.22) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div>
            {/* Brand Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
              <span
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #C65E38 0%, #A84929 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 14px rgba(198, 94, 56, 0.3)",
                }}
              >
                <Sparkles size={22} strokeWidth={2.4} />
              </span>
              <div>
                <span
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: "22px",
                    fontWeight: 800,
                    letterSpacing: "-0.5px",
                    color: "#ffffff",
                    display: "block",
                    lineHeight: 1.1,
                  }}
                >
                  Crave<span style={{ color: "#E89A7D" }}>ly</span>
                </span>
                <span
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 800,
                    letterSpacing: "1.6px",
                    color: "#B5C7B2",
                    textTransform: "uppercase",
                  }}
                >
                  ARTISAN FOOD DELIVERY
                </span>
              </div>
            </div>

            <h2
              style={{
                margin: "0 0 12px",
                fontFamily: "'Manrope', sans-serif",
                fontSize: "clamp(24px, 3vw, 32px)",
                fontWeight: 800,
                lineHeight: 1.25,
                color: "#ffffff",
              }}
            >
              Fresh dining, crafted to order and delivered hot.
            </h2>

            <p
              style={{
                margin: "0 0 32px",
                fontSize: "14px",
                lineHeight: 1.65,
                color: "#C7D4C3",
              }}
            >
              Sign in to manage kitchen operations, order freshly curated chef meals, or track real-time delivery status.
            </p>

            {/* Feature Pills */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#C65E38",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Zap size={16} fill="#ffffff" color="#ffffff" />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: "#ffffff" }}>
                    Live Happy Hours Discounts
                  </strong>
                  <span style={{ fontSize: "12px", color: "#B5C7B2" }}>
                    Up to 50% automatic discounts on all dishes
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.14)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Clock size={16} color="#ffffff" />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: "#ffffff" }}>
                    3 Scheduled Meal Periods
                  </strong>
                  <span style={{ fontSize: "12px", color: "#B5C7B2" }}>
                    Breakfast (6-11 AM), Lunch (11-4 PM), Dinner (6-11 PM)
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.14)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Truck size={16} color="#ffffff" />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: "#ffffff" }}>
                    Takeaway & Doorstep Delivery
                  </strong>
                  <span style={{ fontSize: "12px", color: "#B5C7B2" }}>
                    Track live kitchen preparation and orders
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div
            style={{
              marginTop: "32px",
              paddingTop: "18px",
              borderTop: "1px solid rgba(255, 255, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#A2B49F",
            }}
          >
            <span>✦ Cravely Kitchen Operating System</span>
            <span>IST Time Zone</span>
          </div>
        </div>

        {/* Right Side: Authentication Form */}
        <div style={{ padding: "40px 36px", display: "flex", flexDirection: "column" }}>
          {/* Role Indicator Badge */}
          <div style={{ marginBottom: "16px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                background: loginType === "manager" ? "#EAF0E6" : "#FFF1EB",
                color: loginType === "manager" ? "#263C2E" : "#C65E38",
                border: loginType === "manager" ? "1px solid #CCE0C6" : "1px solid #FAD7CA",
              }}
            >
              {loginType === "manager" ? (
                <>
                  <ShieldCheck size={13} />
                  <span>Manager Portal</span>
                </>
              ) : (
                <>
                  <Utensils size={13} />
                  <span>Customer Ordering</span>
                </>
              )}
            </span>
          </div>

          <h1
            style={{
              margin: "0 0 6px",
              fontFamily: "'Manrope', sans-serif",
              fontSize: "26px",
              fontWeight: 800,
              color: "#263C2E",
              letterSpacing: "-0.4px",
            }}
          >
            {loginType === "manager"
              ? "Kitchen Manager Login"
              : mode === "signin"
              ? "Welcome back!"
              : "Create customer account"}
          </h1>

          <p
            style={{
              margin: "0 0 24px",
              fontSize: "13.5px",
              color: "#697064",
              lineHeight: 1.5,
            }}
          >
            {loginType === "manager"
              ? "Sign in to access menu control, orders, and Happy Hours discounts."
              : mode === "signin"
              ? "Sign in to order fresh chef dishes, manage cart, and track deliveries."
              : "Register a dining username to start placing fresh kitchen orders."}
          </p>

          {/* Login Type Segmented Tabs */}
          <div
            style={{
              display: "flex",
              padding: "4px",
              background: "#F2F4ED",
              borderRadius: "12px",
              marginBottom: "16px",
              gap: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => switchLoginType("customer")}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: 0,
                borderRadius: "9px",
                background: loginType === "customer" ? "#ffffff" : "transparent",
                color: loginType === "customer" ? "#263C2E" : "#697064",
                fontWeight: 800,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow:
                  loginType === "customer"
                    ? "0 2px 8px rgba(38, 60, 46, 0.08)"
                    : "none",
                transition: "all 0.18s ease",
              }}
            >
              <User size={15} />
              <span>Customer</span>
            </button>

            <button
              type="button"
              onClick={() => switchLoginType("manager")}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: 0,
                borderRadius: "9px",
                background: loginType === "manager" ? "#263C2E" : "transparent",
                color: loginType === "manager" ? "#ffffff" : "#697064",
                fontWeight: 800,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow:
                  loginType === "manager"
                    ? "0 2px 8px rgba(38, 60, 46, 0.15)"
                    : "none",
                transition: "all 0.18s ease",
              }}
            >
              <ShieldCheck size={15} />
              <span>Manager Portal</span>
            </button>
          </div>

          {/* Sub-mode Tabs (for Customer: Sign In vs Sign Up) */}
          {loginType === "customer" && (
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #ECEEE5",
                marginBottom: "20px",
                gap: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setMessage("");
                }}
                style={{
                  padding: "8px 4px 12px",
                  border: 0,
                  borderBottom:
                    mode === "signin"
                      ? "2px solid #C65E38"
                      : "2px solid transparent",
                  background: "transparent",
                  color: mode === "signin" ? "#C65E38" : "#697064",
                  fontWeight: 800,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
                style={{
                  padding: "8px 4px 12px",
                  border: 0,
                  borderBottom:
                    mode === "signup"
                      ? "2px solid #C65E38"
                      : "2px solid transparent",
                  background: "transparent",
                  color: mode === "signup" ? "#C65E38" : "#697064",
                  fontWeight: 800,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Status Alert Banner */}
          {message && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                marginBottom: "18px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                fontSize: "13px",
                lineHeight: 1.45,
                background: messageType === "error" ? "#FEE2E2" : "#DCFCE7",
                border:
                  messageType === "error"
                    ? "1px solid #FCA5A5"
                    : "1px solid #86EFAC",
                color: messageType === "error" ? "#991B1B" : "#166534",
              }}
            >
              {messageType === "error" ? (
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
              ) : (
                <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
              )}
              <span style={{ flex: 1 }}>{message}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label
                htmlFor="auth-username"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#263C2E",
                  marginBottom: "6px",
                }}
              >
                <User size={14} color="#697064" />
                <span>Username</span>
              </label>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={
                  loginType === "manager"
                    ? "Enter manager username (e.g. manager)"
                    : "Enter customer username"
                }
                autoComplete="username"
                minLength={3}
                maxLength={24}
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #D9DDD2",
                  background: "#FAFBF8",
                  fontSize: "14px",
                  color: "#263C2E",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.18s ease, box-shadow 0.18s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#263C2E";
                  e.target.style.boxShadow = "0 0 0 3px rgba(38, 60, 46, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#D9DDD2";
                  e.target.style.boxShadow = "none";
                }}
              />
              <span style={{ fontSize: "11px", color: "#778070", marginTop: "4px", display: "block" }}>
                3–24 characters (letters, numbers, underscore)
              </span>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#263C2E",
                  marginBottom: "6px",
                }}
              >
                <Lock size={14} color="#697064" />
                <span>Password</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (minimum 8 characters)"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={8}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 42px 12px 14px",
                    borderRadius: "10px",
                    border: "1px solid #D9DDD2",
                    background: "#FAFBF8",
                    fontSize: "14px",
                    color: "#263C2E",
                    boxSizing: "border-box",
                    outline: "none",
                    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#263C2E";
                    e.target.style.boxShadow = "0 0 0 3px rgba(38, 60, 46, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#D9DDD2";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: 0,
                    background: "transparent",
                    color: "#697064",
                    padding: "4px",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="customer-btn-accent"
              style={{
                width: "100%",
                padding: "14px",
                marginTop: "6px",
                fontSize: "14.5px",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>
                    {loginType === "manager"
                      ? "Access Manager Console"
                      : mode === "signin"
                      ? "Sign In to Dining"
                      : "Create My Account"}
                  </span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill / Demo Credentials Helper */}
          <div
            style={{
              marginTop: "24px",
              padding: "14px",
              borderRadius: "12px",
              background: "#F7F8F4",
              border: "1px dashed #D5DCD0",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.8px",
                color: "#697064",
                textTransform: "uppercase",
                display: "block",
                marginBottom: "8px",
              }}
            >
              ⚡ Quick Demo Login Shortcuts
            </span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleQuickFill("manager", "manager123", "manager")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #D0D8CB",
                  background: "#ffffff",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#263C2E",
                  cursor: "pointer",
                }}
              >
                Manager: <code>manager</code>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("customer", "customer123", "customer")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #D0D8CB",
                  background: "#ffffff",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#C65E38",
                  cursor: "pointer",
                }}
              >
                Customer: <code>customer</code>
              </button>
            </div>
          </div>

          {/* Toggle between Sign In & Sign Up in customer mode */}
          {loginType === "customer" && (
            <p
              style={{
                marginTop: "20px",
                marginBottom: 0,
                textAlign: "center",
                fontSize: "13px",
                color: "#697064",
              }}
            >
              {mode === "signin" ? "New to Cravely? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setMessage("");
                }}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#C65E38",
                  fontWeight: 800,
                  cursor: "pointer",
                  padding: 0,
                  fontSize: "13px",
                }}
              >
                {mode === "signin" ? "Create an account" : "Sign In"}
              </button>
            </p>
          )}

          {/* Direct Menu Browse Link */}
          <div
            style={{
              marginTop: "16px",
              textAlign: "center",
            }}
          >
            <Link
              to="/customer"
              style={{
                fontSize: "12.5px",
                color: "#697064",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Continue to view menu as guest →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
