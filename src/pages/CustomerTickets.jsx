
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const categories = [
    { value: "general", label: "General request" },
    { value: "order_issue", label: "Order issue" },
    { value: "food_quality", label: "Food quality" },
    { value: "payment", label: "Payment issue" },
    { value: "other", label: "Other" },
];

const statusLabels = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    rejected: "Rejected",
};

const statusColors = {
    open: "#d97706",
    in_progress: "#2563eb",
    resolved: "#15803d",
    rejected: "#dc2626",
};

const styles = {
    page: {
        minHeight: "100vh",
        padding: "32px 20px",
        background: "#f8fafc",
        color: "#172033",
        fontFamily: "Arial, sans-serif",
    },
    container: { maxWidth: "1100px", margin: "0 auto" },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "24px",
    },
    button: {
        padding: "10px 16px",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        background: "#fff",
        cursor: "pointer",
        fontWeight: 600,
    },
    primary: {
        padding: "12px 18px",
        borderRadius: "8px",
        border: "none",
        background: "#ea580c",
        color: "#fff",
        cursor: "pointer",
        fontWeight: 700,
    },
    panel: {
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "24px",
        marginBottom: "24px",
    },
    field: {
        width: "100%",
        padding: "11px 12px",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        boxSizing: "border-box",
        fontSize: "14px",
        background: "#fff",
    },
    label: {
        display: "block",
        fontWeight: 600,
        fontSize: "14px",
        marginBottom: "7px",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: "16px",
    },
    card: {
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "18px",
        background: "#fff",
    },
};

function StatusBadge({ status }) {
    return (
        <span
            style={{
                display: "inline-block",
                padding: "5px 10px",
                borderRadius: "20px",
                color: statusColors[status] || "#475569",
                background: `${statusColors[status] || "#475569"}18`,
                fontSize: "12px",
                fontWeight: 700,
            }}
        >
            {statusLabels[status] || status}
        </span>
    );
}

export default function CustomerTickets() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("general");
    const [orderId, setOrderId] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const {
                data: { user: currentUser },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!currentUser) {
                navigate("/login", { replace: true });
                return;
            }

            setUser(currentUser);

            const [ticketResult, orderResult] = await Promise.all([
                supabase
                    .from("tickets")
                    .select("*")
                    .eq("customer_id", currentUser.id)
                    .order("created_at", { ascending: false }),

                supabase
                    .from("orders")
                    .select("id, status, subtotal, created_at")
                    .eq("customer_id", currentUser.id)
                    .order("created_at", { ascending: false }),
            ]);

            if (ticketResult.error) throw ticketResult.error;
            if (orderResult.error) throw orderResult.error;

            setTickets(ticketResult.data || []);
            setOrders(orderResult.data || []);
        } catch (err) {
            setError(err.message || "Unable to load tickets.");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setNotice("");

        if (!user) {
            setError("Please log in before creating a ticket.");
            return;
        }

        if (subject.trim().length < 3) {
            setError("Subject must contain at least 3 characters.");
            return;
        }

        if (description.trim().length < 5) {
            setError("Description must contain at least 5 characters.");
            return;
        }

        setSubmitting(true);

        try {
            const { error: insertError } = await supabase
                .from("tickets")
                .insert({
                    customer_id: user.id,
                    order_id: orderId ? Number(orderId) : null,
                    subject: subject.trim(),
                    description: description.trim(),
                    category,
                });

            if (insertError) throw insertError;

            setSubject("");
            setDescription("");
            setCategory("general");
            setOrderId("");
            setNotice("Your ticket was submitted successfully.");

            await loadData();
        } catch (err) {
            setError(err.message || "Unable to submit your ticket.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleLogout() {
        const { error: logoutError } = await supabase.auth.signOut();

        if (logoutError) {
            setError(logoutError.message);
            return;
        }

        navigate("/login", { replace: true });
    }

    return (
        <main style={styles.page}>
            <div style={styles.container}>
                <header style={styles.header}>
                    <div>
                        <p style={{ color: "#ea580c", fontWeight: 700, marginBottom: 6 }}>
                            CRAVELY SUPPORT
                        </p>
                        <h1 style={{ margin: "0 0 8px" }}>My Tickets</h1>
                        <p style={{ margin: 0, color: "#64748b" }}>
                            Send requests and track updates from our team.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={styles.button} onClick={() => navigate("/customer")}>
                            Back to Menu
                        </button>
                        <button style={styles.button} onClick={loadData}>
                            Refresh
                        </button>
                        <button style={styles.button} onClick={handleLogout}>
                            Log out
                        </button>
                    </div>
                </header>

                {error && (
                    <div
                        role="alert"
                        style={{
                            padding: 12,
                            marginBottom: 16,
                            borderRadius: 8,
                            background: "#fee2e2",
                            color: "#991b1b",
                        }}
                    >
                        {error}
                    </div>
                )}

                {notice && (
                    <div
                        role="status"
                        style={{
                            padding: 12,
                            marginBottom: 16,
                            borderRadius: 8,
                            background: "#dcfce7",
                            color: "#166534",
                        }}
                    >
                        {notice}
                    </div>
                )}

                <section style={styles.panel}>
                    <h2 style={{ marginTop: 0 }}>Create a ticket</h2>
                    <p style={{ color: "#64748b", fontSize: 14 }}>
                        Describe your request or issue. Our team will review it.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div style={styles.grid}>
                            <div>
                                <label style={styles.label} htmlFor="ticket-subject">
                                    Subject
                                </label>
                                <input
                                    id="ticket-subject"
                                    style={styles.field}
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Briefly describe your request"
                                    minLength={3}
                                    maxLength={150}
                                    required
                                />
                            </div>

                            <div>
                                <label style={styles.label} htmlFor="ticket-category">
                                    Category
                                </label>
                                <select
                                    id="ticket-category"
                                    style={styles.field}
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                >
                                    {categories.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={styles.label} htmlFor="ticket-order">
                                    Related order (optional)
                                </label>
                                <select
                                    id="ticket-order"
                                    style={styles.field}
                                    value={orderId}
                                    onChange={(e) => setOrderId(e.target.value)}
                                >
                                    <option value="">No order selected</option>
                                    {orders.map((order) => (
                                        <option key={order.id} value={order.id}>
                                            Order #{order.id} — {order.status || "Submitted"}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <label style={styles.label} htmlFor="ticket-description">
                                Description
                            </label>
                            <textarea
                                id="ticket-description"
                                style={{ ...styles.field, minHeight: 120, resize: "vertical" }}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Explain your request or issue..."
                                minLength={5}
                                maxLength={3000}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            style={{ ...styles.primary, marginTop: 16 }}
                            disabled={submitting}
                        >
                            {submitting ? "Submitting..." : "Submit Ticket"}
                        </button>
                    </form>
                </section>

                <section>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                            gap: 12,
                        }}
                    >
                        <h2 style={{ margin: 0 }}>Ticket History</h2>
                        <span style={{ color: "#64748b", fontSize: 14 }}>
                            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
                        </span>
                    </div>

                    {loading ? (
                        <p>Loading your tickets...</p>
                    ) : tickets.length === 0 ? (
                        <div style={styles.panel}>
                            <h3>No tickets yet</h3>
                            <p style={{ color: "#64748b" }}>
                                Submit a ticket above if you need help.
                            </p>
                        </div>
                    ) : (
                        <div style={styles.grid}>
                            {tickets.map((ticket) => (
                                <article key={ticket.id} style={styles.card}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 10,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <span style={{ color: "#64748b", fontSize: 13 }}>
                                            Ticket #{ticket.id}
                                        </span>
                                        <StatusBadge status={ticket.status} />
                                    </div>

                                    <h3 style={{ marginBottom: 8 }}>{ticket.subject}</h3>

                                    <p style={{ color: "#475569", whiteSpace: "pre-wrap" }}>
                                        {ticket.description}
                                    </p>

                                    <p style={{ fontSize: 13, color: "#64748b" }}>
                                        Category:{" "}
                                        {categories.find((item) => item.value === ticket.category)
                                            ?.label || ticket.category}
                                    </p>

                                    <p style={{ fontSize: 13, color: "#64748b" }}>
                                        Priority: {ticket.priority}
                                        {ticket.order_id ? ` · Order #${ticket.order_id}` : ""}
                                    </p>

                                    {ticket.manager_notes && (
                                        <div
                                            style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                background: "#f1f5f9",
                                                marginTop: 12,
                                            }}
                                        >
                                            <strong>Team response</strong>
                                            <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                                                {ticket.manager_notes}
                                            </p>
                                        </div>
                                    )}

                                    <p
                                        style={{
                                            color: "#94a3b8",
                                            fontSize: 12,
                                            marginBottom: 0,
                                        }}
                                    >
                                        Created: {new Date(ticket.created_at).toLocaleString()}
                                    </p>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
