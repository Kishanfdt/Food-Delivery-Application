
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const statusOptions = [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "resolved", label: "Resolved" },
    { value: "rejected", label: "Rejected" },
];

const priorityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
];

const categoryLabels = {
    general: "General request",
    order_issue: "Order issue",
    food_quality: "Food quality",
    payment: "Payment issue",
    other: "Other",
};

const statusColors = {
    open: "#d97706",
    in_progress: "#2563eb",
    resolved: "#15803d",
    rejected: "#dc2626",
};

const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    fontSize: 14,
};

const buttonStyle = {
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
};

export default function ManagerTickets() {
    const navigate = useNavigate();

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [savingId, setSavingId] = useState(null);

    const [edits, setEdits] = useState({});

    const loadTickets = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                navigate("/login", { replace: true });
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();

            if (profileError) throw profileError;

            if (profile.role !== "manager") {
                navigate("/customer", { replace: true });
                return;
            }

            const { data, error: ticketError } = await supabase
                .from("tickets")
                .select("*")
                .order("created_at", { ascending: false });

            if (ticketError) throw ticketError;

            const rows = data || [];
            setTickets(rows);

            setEdits((previous) => {
                const next = { ...previous };

                rows.forEach((ticket) => {
                    if (!next[ticket.id]) {
                        next[ticket.id] = {
                            status: ticket.status,
                            priority: ticket.priority,
                            manager_notes: ticket.manager_notes || "",
                        };
                    }
                });

                return next;
            });
        } catch (err) {
            setError(err.message || "Unable to load tickets.");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    function updateEdit(id, field, value) {
        setEdits((previous) => ({
            ...previous,
            [id]: {
                ...previous[id],
                [field]: value,
            },
        }));
    }

    async function saveTicket(ticket) {
        const edit = edits[ticket.id];

        if (!edit) return;

        setSavingId(ticket.id);
        setError("");
        setNotice("");

        try {
            const { data, error: updateError } = await supabase
                .from("tickets")
                .update({
                    status: edit.status,
                    priority: edit.priority,
                    manager_notes: edit.manager_notes.trim() || null,
                })
                .eq("id", ticket.id)
                .select("*")
                .single();

            if (updateError) throw updateError;

            setTickets((previous) =>
                previous.map((item) => (item.id === ticket.id ? data : item))
            );

            setEdits((previous) => ({
                ...previous,
                [ticket.id]: {
                    status: data.status,
                    priority: data.priority,
                    manager_notes: data.manager_notes || "",
                },
            }));

            setNotice(`Ticket #${ticket.id} updated successfully.`);
        } catch (err) {
            setError(
                err.message ||
                "Unable to update this ticket. Check the manager UPDATE policy."
            );
        } finally {
            setSavingId(null);
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

    const filteredTickets = tickets.filter((ticket) => {
        const matchesStatus =
            statusFilter === "all" || ticket.status === statusFilter;

        const term = search.trim().toLowerCase();

        const matchesSearch =
            !term ||
            String(ticket.id).includes(term) ||
            ticket.subject.toLowerCase().includes(term) ||
            ticket.description.toLowerCase().includes(term) ||
            (ticket.category || "").toLowerCase().includes(term) ||
            (ticket.order_id && String(ticket.order_id).includes(term));

        return matchesStatus && matchesSearch;
    });

    const openCount = tickets.filter((ticket) => ticket.status === "open").length;
    const progressCount = tickets.filter(
        (ticket) => ticket.status === "in_progress"
    ).length;
    const resolvedCount = tickets.filter(
        (ticket) => ticket.status === "resolved"
    ).length;

    return (
        <main
            style={{
                minHeight: "100vh",
                background: "#f8fafc",
                color: "#172033",
                padding: "32px 20px",
                fontFamily: "Arial, sans-serif",
            }}
        >
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <header
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                        marginBottom: 24,
                    }}
                >
                    <div>
                        <p style={{ color: "#ea580c", fontWeight: 700, marginBottom: 6 }}>
                            CRAVELY ADMIN
                        </p>
                        <h1 style={{ margin: "0 0 8px" }}>Ticket Management</h1>
                        <p style={{ color: "#64748b", margin: 0 }}>
                            Review customer requests and manage their resolution.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                            style={buttonStyle}
                            onClick={() => navigate("/dashboard")}
                        >
                            Dashboard
                        </button>
                        <button style={buttonStyle} onClick={loadTickets}>
                            Refresh
                        </button>
                        <button style={buttonStyle} onClick={handleLogout}>
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

                <section
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: 16,
                        marginBottom: 24,
                    }}
                >
                    {[
                        { label: "Total Tickets", value: tickets.length },
                        { label: "Open", value: openCount },
                        { label: "In Progress", value: progressCount },
                        { label: "Resolved", value: resolvedCount },
                    ].map((item) => (
                        <div
                            key={item.label}
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 12,
                                padding: 20,
                            }}
                        >
                            <p style={{ margin: "0 0 8px", color: "#64748b" }}>
                                {item.label}
                            </p>
                            <strong style={{ fontSize: 28 }}>{item.value}</strong>
                        </div>
                    ))}
                </section>

                <section
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                        marginBottom: 24,
                    }}
                >
                    <input
                        style={fieldStyle}
                        placeholder="Search ticket, subject or order..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <select
                        style={fieldStyle}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All statuses</option>
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </section>

                {loading ? (
                    <p>Loading tickets...</p>
                ) : filteredTickets.length === 0 ? (
                    <section
                        style={{
                            background: "#fff",
                            padding: 24,
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                        }}
                    >
                        No tickets match your filters.
                    </section>
                ) : (
                    <section style={{ display: "grid", gap: 18 }}>
                        {filteredTickets.map((ticket) => {
                            const edit = edits[ticket.id] || {
                                status: ticket.status,
                                priority: ticket.priority,
                                manager_notes: ticket.manager_notes || "",
                            };

                            return (
                                <article
                                    key={ticket.id}
                                    style={{
                                        background: "#fff",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 14,
                                        padding: 22,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 16,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <div>
                                            <p
                                                style={{
                                                    margin: "0 0 8px",
                                                    color: "#64748b",
                                                    fontSize: 13,
                                                }}
                                            >
                                                Ticket #{ticket.id}
                                                {ticket.order_id
                                                    ? ` · Order #${ticket.order_id}`
                                                    : ""}
                                            </p>

                                            <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>
                                                {ticket.subject}
                                            </h2>
                                        </div>

                                        <span
                                            style={{
                                                alignSelf: "flex-start",
                                                padding: "6px 10px",
                                                borderRadius: 20,
                                                color: statusColors[ticket.status] || "#475569",
                                                background: `${statusColors[ticket.status] || "#475569"
                                                    }18`,
                                                fontSize: 12,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {statusOptions.find(
                                                (option) => option.value === ticket.status
                                            )?.label || ticket.status}
                                        </span>
                                    </div>

                                    <p
                                        style={{
                                            whiteSpace: "pre-wrap",
                                            lineHeight: 1.6,
                                            color: "#475569",
                                        }}
                                    >
                                        {ticket.description}
                                    </p>

                                    <p style={{ color: "#64748b", fontSize: 13 }}>
                                        Category: {categoryLabels[ticket.category] || ticket.category}
                                        {" · "}Created:{" "}
                                        {new Date(ticket.created_at).toLocaleString()}
                                    </p>

                                    <p style={{ color: "#64748b", fontSize: 12 }}>
                                        Customer ID: {ticket.customer_id}
                                    </p>

                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns:
                                                "repeat(auto-fit, minmax(180px, 1fr))",
                                            gap: 14,
                                            marginTop: 20,
                                        }}
                                    >
                                        <div>
                                            <label
                                                htmlFor={`status-${ticket.id}`}
                                                style={{
                                                    display: "block",
                                                    marginBottom: 7,
                                                    fontWeight: 600,
                                                    fontSize: 14,
                                                }}
                                            >
                                                Status
                                            </label>
                                            <select
                                                id={`status-${ticket.id}`}
                                                style={fieldStyle}
                                                value={edit.status}
                                                onChange={(e) =>
                                                    updateEdit(ticket.id, "status", e.target.value)
                                                }
                                            >
                                                {statusOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label
                                                htmlFor={`priority-${ticket.id}`}
                                                style={{
                                                    display: "block",
                                                    marginBottom: 7,
                                                    fontWeight: 600,
                                                    fontSize: 14,
                                                }}
                                            >
                                                Priority
                                            </label>
                                            <select
                                                id={`priority-${ticket.id}`}
                                                style={fieldStyle}
                                                value={edit.priority}
                                                onChange={(e) =>
                                                    updateEdit(ticket.id, "priority", e.target.value)
                                                }
                                            >
                                                {priorityOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 16 }}>
                                        <label
                                            htmlFor={`notes-${ticket.id}`}
                                            style={{
                                                display: "block",
                                                marginBottom: 7,
                                                fontWeight: 600,
                                                fontSize: 14,
                                            }}
                                        >
                                            Manager notes / response
                                        </label>
                                        <textarea
                                            id={`notes-${ticket.id}`}
                                            style={{ ...fieldStyle, minHeight: 95, resize: "vertical" }}
                                            value={edit.manager_notes}
                                            maxLength={3000}
                                            placeholder="Add an update for the customer..."
                                            onChange={(e) =>
                                                updateEdit(
                                                    ticket.id,
                                                    "manager_notes",
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 12,
                                            flexWrap: "wrap",
                                            marginTop: 16,
                                        }}
                                    >
                                        <span style={{ color: "#94a3b8", fontSize: 12 }}>
                                            Last updated:{" "}
                                            {new Date(ticket.updated_at).toLocaleString()}
                                        </span>

                                        <button
                                            style={{
                                                ...buttonStyle,
                                                border: "none",
                                                background: "#ea580c",
                                                color: "#fff",
                                                opacity: savingId === ticket.id ? 0.65 : 1,
                                            }}
                                            disabled={savingId === ticket.id}
                                            onClick={() => saveTicket(ticket)}
                                        >
                                            {savingId === ticket.id ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
