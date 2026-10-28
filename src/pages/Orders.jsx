
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
    "rejected",
];

const FINAL_STATUSES = ["completed", "cancelled", "rejected"];

const C = {
    bg: "#F4F5F0",
    surface: "#FFFFFF",
    forest: "#263C2E",
    forestHover: "#1D3024",
    text: "#252820",
    muted: "#697064",
    line: "#E5E4DA",
    green: "#387A55",
    greenLight: "#E5F2E8",
    amber: "#95601F",
    amberLight: "#F8EFDF",
    blue: "#315E86",
    blueLight: "#E8EFF7",
    purple: "#76519B",
    purpleLight: "#F0EAF7",
    red: "#B94B42",
    redLight: "#FCEDEA",
};

const styles = {
    page: {
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        padding: "32px 24px",
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: "border-box",
    },
    container: {
        maxWidth: 1240,
        margin: "0 auto",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 20,
        marginBottom: 28,
    },
    eyebrow: {
        margin: "0 0 8px",
        fontSize: 12,
        fontWeight: 800,
        color: C.green,
        letterSpacing: 1.6,
        textTransform: "uppercase",
    },
    title: {
        margin: "0 0 8px",
        fontFamily: "Manrope, sans-serif",
        fontSize: "clamp(28px, 4vw, 36px)",
        fontWeight: 800,
        letterSpacing: "-1px",
        color: C.forest,
    },
    subtitle: {
        margin: 0,
        color: C.muted,
        fontSize: 14,
        lineHeight: 1.6,
    },
    primaryButton: {
        padding: "12px 18px",
        border: `1px solid ${C.forest}`,
        borderRadius: 10,
        background: C.forest,
        color: "#FFFFFF",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        transition: "background 0.2s ease",
    },
    secondaryButton: {
        padding: "10px 14px",
        border: `1px solid ${C.line}`,
        borderRadius: 9,
        background: C.surface,
        color: C.forest,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
    },
    summaryGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
        gap: 14,
        marginBottom: 22,
    },
    summaryCard: {
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: "20px",
        minWidth: 0,
        boxSizing: "border-box",
    },
    summaryLabel: {
        fontSize: 12,
        color: C.muted,
        fontWeight: 700,
        marginBottom: 12,
    },
    summaryValue: {
        fontSize: 28,
        fontWeight: 800,
        color: C.forest,
        letterSpacing: "-0.7px",
    },
    summaryNote: {
        fontSize: 11,
        color: C.muted,
        marginTop: 8,
    },
    filterPanel: {
        display: "flex",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: 14,
        background: C.surface,
        padding: "18px",
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        marginBottom: 22,
    },
    fieldLabel: {
        display: "block",
        marginBottom: 8,
        fontSize: 12,
        fontWeight: 700,
        color: C.muted,
    },
    select: {
        padding: "11px 12px",
        border: `1px solid ${C.line}`,
        borderRadius: 9,
        background: "#FFFFFF",
        color: C.text,
        fontSize: 13,
        fontFamily: "inherit",
        outlineColor: C.green,
        minHeight: 42,
    },
    countPill: {
        background: "#E8EEE4",
        color: C.forest,
        padding: "11px 14px",
        borderRadius: 9,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
    },
    card: {
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: 24,
        marginBottom: 18,
        boxShadow: "0 4px 18px rgba(38, 60, 46, 0.035)",
        minWidth: 0,
        boxSizing: "border-box",
    },
    cardHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 20,
        paddingBottom: 20,
        borderBottom: `1px solid ${C.line}`,
    },
    orderTitle: {
        margin: "0 0 10px",
        fontSize: 20,
        fontWeight: 800,
        color: C.forest,
        overflowWrap: "anywhere",
    },
    metadata: {
        display: "grid",
        gap: 9,
        marginTop: 16,
        fontSize: 13,
        color: C.muted,
        lineHeight: 1.5,
        overflowWrap: "anywhere",
    },
    statusControl: {
        width: 240,
        maxWidth: "100%",
    },
    sectionTitle: {
        margin: "0 0 14px",
        fontSize: 15,
        fontWeight: 800,
        color: C.forest,
    },
    itemsSection: {
        paddingTop: 22,
    },
    itemRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        padding: "15px 0",
        borderBottom: `1px solid ${C.line}`,
        fontSize: 13,
    },
    itemName: {
        fontWeight: 700,
        color: C.text,
        marginBottom: 6,
    },
    muted: {
        color: C.muted,
        fontSize: 12,
        lineHeight: 1.6,
    },
    total: {
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        paddingTop: 20,
        fontSize: 16,
        fontWeight: 800,
        color: C.forest,
    },
    alert: {
        padding: "14px 16px",
        borderRadius: 11,
        marginBottom: 18,
        fontSize: 13,
        lineHeight: 1.6,
    },
    empty: {
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: "48px 20px",
        textAlign: "center",
        color: C.muted,
    },
};

function label(value) {
    if (!value) return "Unknown";

    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function formatPrice(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);
}

function getStatusStyle(status) {
    const normalized = String(status || "pending").toLowerCase();

    const palette = {
        pending: [C.amberLight, C.amber],
        confirmed: [C.blueLight, C.blue],
        preparing: [C.purpleLight, C.purple],
        ready: [C.greenLight, C.green],
        completed: [C.greenLight, C.green],
        cancelled: [C.redLight, C.red],
        rejected: [C.redLight, C.red],
    };

    const [background, color] = palette[normalized] || [
        "#ECEFE9",
        C.muted,
    ];

    return {
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 11px",
        borderRadius: 30,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
        background,
        color,
    };
}

function SummaryCard({ title, value, note, color }) {
    return (
        <section style={styles.summaryCard}>
            <div style={styles.summaryLabel}>{title}</div>
            <div style={{ ...styles.summaryValue, color: color || C.forest }}>
                {value}
            </div>
            <div style={styles.summaryNote}>{note}</div>
        </section>
    );
}

function StatusBadge({ status }) {
    return (
        <span style={getStatusStyle(status)}>
            {label(status)}
        </span>
    );
}

export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [filter, setFilter] = useState("all");

    const loadOrders = useCallback(async (silent = false) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        try {
            const { data, error: ordersError } = await supabase
                .from("orders")
                .select(`
          id,
          order_type,
          status,
          payment_status,
          subtotal,
          created_at,
          customer_id,
          order_items (
            id,
            item_name,
            quantity,
            unit_price,
            line_total
          )
        `)
                .order("created_at", { ascending: false });

            if (ordersError) throw ordersError;

            setOrders(data || []);
        } catch (err) {
            setError(err.message || "Unable to load orders.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    async function updateStatus(orderId, nextStatus) {
        const order = orders.find(
            (item) => String(item.id) === String(orderId)
        );

        if (!order || order.status === nextStatus || updatingId !== null) {
            return;
        }

        if (FINAL_STATUSES.includes(String(order.status).toLowerCase())) {
            setError("This order is already in a final status.");
            return;
        }

        const isTerminalUpdate = ["cancelled", "rejected"].includes(nextStatus);

        const confirmed = window.confirm(
            isTerminalUpdate
                ? `Are you sure you want to ${nextStatus} order #${orderId}? Stock restoration will be handled by the database.`
                : `Change order #${orderId} to ${label(nextStatus)}?`
        );

        if (!confirmed) return;

        setUpdatingId(orderId);
        setError("");
        setNotice("");

        try {
            const { data, error: updateError } = await supabase.rpc(
                "manage_order_status",
                {
                    p_order_id: orderId,
                    p_next_status: nextStatus,
                }
            );

            if (updateError) throw updateError;

            if (!data || data.order_id == null || !data.status) {
                throw new Error(
                    "The database did not confirm the order status update."
                );
            }

            await loadOrders(true);

            setNotice(
                `Order #${orderId} updated to ${label(data.status)}.${isTerminalUpdate
                    ? " Stock restoration was handled by the database."
                    : ""
                }`
            );
        } catch (err) {
            setError(err.message || "Unable to update order status.");
        } finally {
            setUpdatingId(null);
        }
    }

    const visibleOrders = useMemo(
        () =>
            filter === "all"
                ? orders
                : orders.filter(
                    (order) =>
                        String(order.status || "").toLowerCase() === filter
                ),
        [orders, filter]
    );

    const summary = useMemo(
        () => ({
            total: orders.length,
            pending: orders.filter(
                (order) =>
                    !FINAL_STATUSES.includes(
                        String(order.status || "").toLowerCase()
                    )
            ).length,
            completed: orders.filter(
                (order) =>
                    String(order.status || "").toLowerCase() === "completed"
            ).length,
            cancelled: orders.filter((order) =>
                ["cancelled", "rejected"].includes(
                    String(order.status || "").toLowerCase()
                )
            ).length,
        }),
        [orders]
    );

    if (loading) {
        return (
            <main style={styles.page}>
                <div style={styles.container}>
                    <div style={styles.empty}>
                        <p style={{ fontSize: 17, fontWeight: 800, color: C.forest }}>
                            Loading orders…
                        </p>
                        <p style={styles.muted}>
                            Fetching the latest restaurant orders.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main style={styles.page}>
            <div style={styles.container}>
                <header style={styles.header}>
                    <div>
                        <p style={styles.eyebrow}>Cravely · Manager workspace</p>
                        <h1 style={styles.title}>Order management</h1>
                        <p style={styles.subtitle}>
                            Review customer orders and manage their progress.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadOrders(true)}
                        disabled={refreshing}
                        style={{
                            ...styles.primaryButton,
                            opacity: refreshing ? 0.65 : 1,
                            cursor: refreshing ? "wait" : "pointer",
                        }}
                    >
                        {refreshing ? "Refreshing…" : "↻ Refresh orders"}
                    </button>
                </header>

                {error && (
                    <div
                        role="alert"
                        style={{
                            ...styles.alert,
                            border: "1px solid #F0C9C4",
                            background: C.redLight,
                            color: C.red,
                        }}
                    >
                        <strong>Something went wrong</strong>
                        <div>{error}</div>
                        <button
                            type="button"
                            onClick={() => loadOrders(true)}
                            style={{
                                ...styles.secondaryButton,
                                marginTop: 10,
                            }}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {notice && (
                    <div
                        role="status"
                        style={{
                            ...styles.alert,
                            border: "1px solid #C8E0CC",
                            background: C.greenLight,
                            color: C.green,
                        }}
                    >
                        {notice}
                        <button
                            type="button"
                            onClick={() => setNotice("")}
                            aria-label="Dismiss notification"
                            style={{
                                float: "right",
                                border: 0,
                                background: "transparent",
                                color: "inherit",
                                cursor: "pointer",
                                fontSize: 18,
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}

                <div style={styles.summaryGrid}>
                    <SummaryCard
                        title="All orders"
                        value={summary.total}
                        note="Total recorded orders"
                    />
                    <SummaryCard
                        title="In progress"
                        value={summary.pending}
                        note="Not yet in a final status"
                        color={C.amber}
                    />
                    <SummaryCard
                        title="Completed"
                        value={summary.completed}
                        note="Successfully completed"
                        color={C.green}
                    />
                    <SummaryCard
                        title="Cancelled / rejected"
                        value={summary.cancelled}
                        note="Orders not proceeding"
                        color={C.red}
                    />
                </div>

                <section style={styles.filterPanel}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <label htmlFor="order-status-filter" style={styles.fieldLabel}>
                            Filter by status
                        </label>

                        <select
                            id="order-status-filter"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            style={{ ...styles.select, width: "100%" }}
                        >
                            <option value="all">All orders</option>
                            {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {label(status)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={styles.countPill}>
                        {visibleOrders.length}{" "}
                        {visibleOrders.length === 1 ? "order" : "orders"}
                    </div>
                </section>

                {visibleOrders.length === 0 ? (
                    <div style={styles.empty}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>▤</div>
                        <h2
                            style={{
                                color: C.forest,
                                margin: "0 0 8px",
                                fontSize: 20,
                            }}
                        >
                            No orders found
                        </h2>
                        <p style={styles.muted}>
                            {filter === "all"
                                ? "Customer orders will appear here when they are placed."
                                : `There are currently no ${label(filter).toLowerCase()} orders.`}
                        </p>

                        {filter !== "all" && (
                            <button
                                type="button"
                                onClick={() => setFilter("all")}
                                style={{ ...styles.primaryButton, marginTop: 12 }}
                            >
                                View all orders
                            </button>
                        )}
                    </div>
                ) : (
                    visibleOrders.map((order) => {
                        const normalizedStatus = String(
                            order.status || "pending"
                        ).toLowerCase();

                        const isFinal = FINAL_STATUSES.includes(normalizedStatus);
                        const isUpdating = String(updatingId) === String(order.id);

                        return (
                            <article key={order.id} style={styles.card}>
                                <div style={styles.cardHeader}>
                                    <div style={{ flex: 1, minWidth: 220 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                flexWrap: "wrap",
                                                gap: 10,
                                                marginBottom: 8,
                                            }}
                                        >
                                            <h2 style={styles.orderTitle}>
                                                Order #{order.id}
                                            </h2>
                                            <StatusBadge status={order.status} />
                                        </div>

                                        <p style={styles.subtitle}>
                                            Placed on {formatDate(order.created_at)}
                                        </p>

                                        <div style={styles.metadata}>
                                            <p style={{ margin: 0 }}>
                                                <strong>Order type:</strong>{" "}
                                                {label(order.order_type)}
                                            </p>
                                            <p style={{ margin: 0 }}>
                                                <strong>Payment:</strong>{" "}
                                                {label(order.payment_status)}
                                            </p>
                                            <p style={{ margin: 0 }}>
                                                <strong>Customer ID:</strong>{" "}
                                                {order.customer_id || "—"}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={styles.statusControl}>
                                        <label
                                            htmlFor={`status-${order.id}`}
                                            style={styles.fieldLabel}
                                        >
                                            Update order status
                                        </label>

                                        <select
                                            id={`status-${order.id}`}
                                            value={normalizedStatus}
                                            onChange={(event) =>
                                                updateStatus(order.id, event.target.value)
                                            }
                                            disabled={isUpdating || isFinal}
                                            style={{
                                                ...styles.select,
                                                width: "100%",
                                                boxSizing: "border-box",
                                                background: isFinal ? "#F1F3EF" : "#FFFFFF",
                                                cursor: isFinal ? "not-allowed" : "pointer",
                                            }}
                                        >
                                            {ORDER_STATUSES.map((status) => (
                                                <option key={status} value={status}>
                                                    {label(status)}
                                                </option>
                                            ))}
                                        </select>

                                        {isUpdating && (
                                            <p style={{ ...styles.muted, marginTop: 8 }}>
                                                Updating order…
                                            </p>
                                        )}

                                        {isFinal && (
                                            <p style={{ ...styles.muted, marginTop: 8 }}>
                                                This order has reached a final status.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div style={styles.itemsSection}>
                                    <h3 style={styles.sectionTitle}>Ordered items</h3>

                                    {order.order_items?.length ? (
                                        order.order_items.map((item) => (
                                            <div key={item.id} style={styles.itemRow}>
                                                <div
                                                    style={{
                                                        minWidth: 0,
                                                        overflowWrap: "anywhere",
                                                    }}
                                                >
                                                    <div style={styles.itemName}>
                                                        {item.item_name || "Food item"}
                                                    </div>
                                                    <div style={styles.muted}>
                                                        {formatPrice(item.unit_price)} × {item.quantity}
                                                    </div>
                                                </div>

                                                <div
                                                    style={{
                                                        fontWeight: 800,
                                                        color: C.forest,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {formatPrice(item.line_total)}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={styles.muted}>
                                            No item details are available for this order.
                                        </p>
                                    )}

                                    <div style={styles.total}>
                                        <span>Order total</span>
                                        <span>{formatPrice(order.subtotal)}</span>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}

                <footer
                    style={{
                        padding: "22px 0 8px",
                        textAlign: "center",
                        color: "#92998F",
                        fontSize: 11,
                    }}
                >
                    Cravely · Manager workspace
                </footer>
            </div>
        </main>
    );
}
