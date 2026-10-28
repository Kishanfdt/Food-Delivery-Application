
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function usernameToEmail(username) {
    return `${username.trim().toLowerCase()}@users.foodapp.invalid`;
}

const styles = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        background: "linear-gradient(135deg, #fff8f0, #f4e4d4)",
        fontFamily: "Arial, sans-serif",
    },
    card: {
        width: "100%",
        maxWidth: "410px",
        padding: "34px",
        boxSizing: "border-box",
        background: "#fff",
        border: "1px solid #f0e3d6",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(72,42,20,0.12)",
    },
    logo: { fontSize: "38px", textAlign: "center" },
    brand: {
        textAlign: "center",
        color: "#d65b24",
        fontSize: "12px",
        fontWeight: "bold",
        letterSpacing: "4px",
        marginTop: "8px",
    },
    heading: {
        textAlign: "center",
        color: "#2c211a",
        fontSize: "27px",
        margin: "18px 0 8px",
    },
    subtitle: {
        textAlign: "center",
        color: "#81746b",
        fontSize: "14px",
        lineHeight: 1.6,
        marginBottom: "24px",
    },
    tabs: {
        display: "flex",
        gap: "5px",
        padding: "4px",
        background: "#f7f1eb",
        borderRadius: "10px",
        marginBottom: "22px",
    },
    label: {
        display: "block",
        margin: "16px 0 8px",
        color: "#44372f",
        fontSize: "13px",
        fontWeight: "bold",
    },
    input: {
        width: "100%",
        padding: "13px",
        boxSizing: "border-box",
        border: "1px solid #e4d9cf",
        borderRadius: "9px",
        fontSize: "14px",
        outlineColor: "#d65b24",
    },
    primary: {
        width: "100%",
        padding: "14px",
        marginTop: "22px",
        border: "none",
        borderRadius: "9px",
        background: "#d65b24",
        color: "#fff",
        fontSize: "15px",
        fontWeight: "bold",
        cursor: "pointer",
    },
    message: {
        color: "#a33e22",
        fontSize: "13px",
        lineHeight: 1.5,
        overflowWrap: "anywhere",
    },
    footer: {
        textAlign: "center",
        color: "#81746b",
        fontSize: "13px",
        marginTop: "22px",
    },
};

export default function AuthPanel({ onSessionChange }) {
    const [loginType, setLoginType] = useState("customer");
    const [mode, setMode] = useState("signin");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [session, setSession] = useState(null);

    useEffect(() => {
        let active = true;

        async function loadSession() {
            const { data, error } = await supabase.auth.getSession();

            if (!active) return;

            if (error) {
                setMessage(error.message);
                return;
            }

            setSession(data.session);
            onSessionChange?.(data.session);
        }

        loadSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
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
            setMessage(
                "Username must be 3–24 characters and contain only letters, numbers or underscores."
            );
            return;
        }

        if (password.length < 8) {
            setMessage("Password must contain at least 8 characters.");
            return;
        }

        if (loginType === "manager" && mode === "signup") {
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
                    setMessage(
                        "Account created. Check your Supabase email confirmation settings before logging in."
                    );
                    return;
                }

                setSession(data.session);
                onSessionChange?.(data.session);
                setMessage("Account created successfully!");
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

            const requiredRole =
                loginType === "manager" ? "manager" : "customer";

            if (profile?.role !== requiredRole) {
                await supabase.auth.signOut();
                setSession(null);
                setMessage(
                    loginType === "manager"
                        ? "This account is not registered as a manager."
                        : "This is a manager account. Please use Manager Login."
                );
                return;
            }

            setSession(data.session);
            onSessionChange?.(data.session);
            setMessage("Login successful!");
        } catch (error) {
            setMessage(error.message || "Authentication failed.");
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
            setMessage(error.message);
        } else {
            setSession(null);
            setUsername("");
            setPassword("");
            setMessage("Logged out successfully.");
        }
    }

    const tabStyle = (active) => ({
        flex: 1,
        padding: "11px 6px",
        border: "none",
        borderRadius: "8px",
        background: active ? "#fff" : "transparent",
        color: active ? "#d65b24" : "#75675e",
        fontWeight: "bold",
        cursor: "pointer",
    });

    if (session) {
        return (
            <main style={styles.page}>
                <section style={styles.card}>
                    <div style={styles.logo}>🍽️</div>
                    <p style={styles.brand}>CRAVELY</p>
                    <h1 style={styles.heading}>
                        Welcome, {session.user.user_metadata?.username || "User"}!
                    </h1>
                    <p style={styles.subtitle}>You are signed in successfully.</p>
                    <button
                        style={styles.primary}
                        onClick={handleLogout}
                        disabled={loading}
                    >
                        {loading ? "Please wait..." : "Log out"}
                    </button>
                    {message && (
                        <p role="status" style={styles.message}>{message}</p>
                    )}
                </section>
            </main>
        );
    }

    return (
        <main style={styles.page}>
            <section style={styles.card}>
                <div style={styles.logo}>🍽️</div>
                <p style={styles.brand}>CRAVELY</p>

                <h1 style={styles.heading}>
                    {loginType === "manager"
                        ? "Manager Login"
                        : mode === "signin"
                            ? "Welcome back!"
                            : "Create account"}
                </h1>

                <p style={styles.subtitle}>
                    {loginType === "manager"
                        ? "Sign in to manage your restaurant."
                        : mode === "signin"
                            ? "Login to continue to your favourite meals."
                            : "Sign up and get ready to order."}
                </p>

                <div style={styles.tabs}>
                    <button
                        type="button"
                        style={tabStyle(loginType === "customer")}
                        onClick={() => switchLoginType("customer")}
                    >
                        Customer Login
                    </button>
                    <button
                        type="button"
                        style={tabStyle(loginType === "manager")}
                        onClick={() => switchLoginType("manager")}
                    >
                        Manager Login
                    </button>
                </div>

                {loginType === "customer" && (
                    <div style={styles.tabs}>
                        <button
                            type="button"
                            style={tabStyle(mode === "signin")}
                            onClick={() => {
                                setMode("signin");
                                setMessage("");
                            }}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            style={tabStyle(mode === "signup")}
                            onClick={() => {
                                setMode("signup");
                                setMessage("");
                            }}
                        >
                            Sign Up
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <label style={styles.label} htmlFor="username">
                        Username
                    </label>
                    <input
                        id="username"
                        style={styles.input}
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder={
                            loginType === "manager"
                                ? "Enter manager username"
                                : "Enter username"
                        }
                        autoComplete="username"
                        minLength={3}
                        maxLength={24}
                        required
                    />

                    <label style={styles.label} htmlFor="password">
                        Password
                    </label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input
                            id="password"
                            style={styles.input}
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter password"
                            autoComplete={
                                mode === "signup" ? "new-password" : "current-password"
                            }
                            minLength={8}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#d65b24",
                                cursor: "pointer",
                                fontWeight: "bold",
                            }}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>

                    {message && (
                        <p role="status" style={styles.message}>{message}</p>
                    )}

                    <button
                        type="submit"
                        style={styles.primary}
                        disabled={loading}
                    >
                        {loading
                            ? "Please wait..."
                            : loginType === "manager"
                                ? "Login as Manager"
                                : mode === "signin"
                                    ? "Login"
                                    : "Create Account"}
                    </button>
                </form>

                {loginType === "customer" && (
                    <p style={styles.footer}>
                        {mode === "signin" ? "New here? " : "Already registered? "}
                        <button
                            type="button"
                            onClick={() => {
                                setMode(mode === "signin" ? "signup" : "signin");
                                setMessage("");
                            }}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#d65b24",
                                cursor: "pointer",
                                fontWeight: "bold",
                            }}
                        >
                            {mode === "signin" ? "Create an account" : "Login"}
                        </button>
                    </p>
                )}
            </section>
        </main>
    );
}
