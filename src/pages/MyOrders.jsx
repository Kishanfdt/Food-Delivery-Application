
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const styles = {
    page: {
        minHeight: "100vh",
        background: "#f8f8f6",
        padding: "32px 20px",
        fontFamily: "Arial, sans-serif",
        color: "#242424",
    },
    container: {
        maxWidth: "1000px",
        margin: "0 auto",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "28px",
    },
    button: {
        padding: "10px 16px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        background: "#fff",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 600,
    },
    card: {
        background: "#fff",
        border: "1px solid #e9e9e9",
        borderRadius: "14px",
        padding: "22px",
        marginBottom: "18px",
        boxShadow: "0 3px 12px rgba(0,0,0,0.03)",
    },
    muted: {
        color: "#777",
        fontSize: "14px",
        lineHeight: 1.5,
    },
    itemRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 0",
        borderBottom: "1px solid #eee",
    },
};

function money(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
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

function normaliseStatus(value) {
    return String(value || "pending").trim().toLowerCase();
}

function StatusBadge({ value }) {
    const status = normaliseStatus(value);

    const colors = {
        pending: { background: "#fff3cd", color: "#805b00" },
        confirmed: { background: "#dbeafe", color: "#1d4ed8" },
        preparing: { background: "#f3e8ff", color: "#7e22ce" },
        ready: { background: "#dcfce7", color: "#166534" },
        completed: { background: "#dcfce7", color: "#166534" },
        cancelled: { background: "#fee2e2", color: "#b42318" },
        rejected: { background: "#fee2e2", color: "#b42318" },
        paid: { background: "#dcfce7", color: "#166534" },
        unpaid: { background: "#f3f4f6", color: "#555" },
        failed: { background: "#fee2e2", color: "#b42318" },
        refunded: { background: "#e0e7ff", color: "#3730a3" },
    };

    const badgeLabel = status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

    return (
        <span
            style={{
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 700,
                ...(colors[status] || {
                    background: "#f0f0f0",
                    color: "#444",
                }),
            }}
        >
            {badgeLabel}
        </span>
    );
}

const progressSteps = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
];

function OrderProgress({ status }) {
    const current = normaliseStatus(status);

    if (["cancelled", "rejected"].includes(current)) {
        return (
            <div
                style={{
                    marginTop: 18,
                    padding: 14,
                    borderRadius: 10,
                    background: "#fff0ee",
                    color: "#b42318",
                    fontWeight: 600,
                }}
            >
                {current === "rejected"
                    ? "This order was rejected by the restaurant."
                    : "This order has been cancelled."}
            </div>
        );
    }

    const currentIndex = progressSteps.indexOf(current);

    return (
        <div style={{ marginTop: 22, marginBottom: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 14 }}>
                Order progress
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${progressSteps.length}, minmax(0, 1fr))`,
                    gap: 5,
                }}
            >
                {progressSteps.map((step, index) => {
                    const complete =
                        currentIndex >= 0 && index <= currentIndex;

                    return (
                        <div key={step} style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    height: 6,
                                    borderRadius: 6,
                                    marginBottom: 8,
                                    background: complete
                                        ? "#66845b"
                                        : "#e8e8e4",
                                }}
                            />

                            <span
                                style={{
                                    fontSize: 11,
                                    color: complete ? "#263c2e" : "#888",
                                    fontWeight: complete ? 700 : 400,
                                    overflowWrap: "anywhere",
                                }}
                            >
                                {step.charAt(0).toUpperCase() + step.slice(1)}
                            </span>
                        </div>
                    );
                })}
            </div>

            {currentIndex === -1 && (
                <p style={styles.muted}>
                    Current status: {current.replaceAll("_", " ")}
                </p>
            )}
        </div>
    );
}

export default function MyOrders() {
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cancellingId, setCancellingId] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [filter, setFilter] = useState("all");
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadOrders = useCallback(
        async ({ silent = false } = {}) => {
            if (silent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            try {
                const {
                    data: sessionData,
                    error: sessionError,
                } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                const user = sessionData.session?.user;

                if (!user) {
                    navigate("/login", { replace: true });
                    return;
                }

                const { data: orderData, error: orderError } =
                    await supabase
                        .from("orders")
                        .select(
                            "id, order_type, status, payment_status, subtotal, created_at"
                        )
                        .eq("customer_id", user.id)
                        .order("created_at", { ascending: false });

                if (orderError) throw orderError;

                const orderList = orderData || [];

                if (orderList.length === 0) {
                    setOrders([]);
                    setLastUpdated(new Date());
                    return;
                }

                const orderIds = orderList.map((order) => order.id);

                const { data: itemData, error: itemError } =
                    await supabase
                        .from("order_items")
                        .select(
                            "id, order_id, item_name, quantity, unit_price, line_total"
                        )
                        .in("order_id", orderIds)
                        .order("id", { ascending: true });

                if (itemError) throw itemError;

                const itemsByOrder = {};

                for (const item of itemData || []) {
                    if (!itemsByOrder[item.order_id]) {
                        itemsByOrder[item.order_id] = [];
                    }

                    itemsByOrder[item.order_id].push(item);
                }

                setOrders(
                    orderList.map((order) => ({
                        ...order,
                        items: itemsByOrder[order.id] || [],
                    }))
                );

                setLastUpdated(new Date());
            } catch (err) {
                setError(err?.message || "Unable to load your orders.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [navigate]
    );

    async function cancelOrder(orderId) {
        const order = orders.find(
            (item) => String(item.id) === String(orderId)
        );

        if (!order) return;

        if (normaliseStatus(order.status) !== "pending") {
            setError("Only pending orders can be cancelled.");
            return;
        }

        if (cancellingId !== null) return;

        const confirmed = window.confirm(
            `Are you sure you want to cancel order #${orderId}?`
        );

        if (!confirmed) return;

        setCancellingId(orderId);
        setError("");
        setNotice("");

        try {
            const { data, error: cancelError } = await supabase.rpc(
                "manage_order_status",
                {
                    p_order_id: orderId,
                    p_next_status: "cancelled",
                }
            );

            if (cancelError) throw cancelError;

            if (
                !data ||
                String(data.order_id) !== String(orderId) ||
                normaliseStatus(data.status) !== "cancelled"
            ) {
                throw new Error(
                    "The database did not confirm order cancellation."
                );
            }

            setNotice(
                `Order #${orderId} was cancelled successfully. Stock restoration is handled by the database.`
            );

            await loadOrders({ silent: true });
        } catch (err) {
            setError(
                err?.message || "Unable to cancel this order. Please try again."
            );
        } finally {
            setCancellingId(null);
        }
    }

    useEffect(() => {
        loadOrders();

        function handleVisibilityChange() {
            if (document.visibilityState === "visible") {
                loadOrders({ silent: true });
            }
        }

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        const channel = supabase
            .channel("customer-orders-status")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                },
                () => {
                    loadOrders({ silent: true });
                }
            )
            .subscribe();

        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );

            supabase.removeChannel(channel);
        };
    }, [loadOrders]);

    const filteredOrders = orders.filter((order) => {
        if (filter === "all") return true;

        if (filter === "active") {
            return [
                "pending",
                "confirmed",
                "preparing",
                "ready",
            ].includes(normaliseStatus(order.status));
        }

        return normaliseStatus(order.status) === filter;
    });

    const totalSpent = orders
        .filter(
            (order) =>
                !["cancelled", "rejected"].includes(
                    normaliseStatus(order.status)
                )
        )
        .reduce(
            (total, order) => total + Number(order.subtotal || 0),
            0
        );

    const activeOrders = orders.filter((order) =>
        ["pending", "confirmed", "preparing", "ready"].includes(
            normaliseStatus(order.status)
        )
    ).length;

    const filterOptions = [
        { label: "All orders", value: "all" },
        { label: "Active", value: "active" },
        { label: "Pending", value: "pending" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Preparing", value: "preparing" },
        { label: "Ready", value: "ready" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Rejected", value: "rejected" },
    ];

    return (
        <main style={styles.page}>
            <div style={styles.container}>
                <header style={styles.header}>
                    <div>
                        <h1 style={{ margin: "0 0 8px" }}>My Orders</h1>

                        <p style={styles.muted}>
                            Track your orders and explore your order history.
                        </p>

                        {lastUpdated && (
                            <p style={{ ...styles.muted, fontSize: 12 }}>
                                Last updated:{" "}
                                {lastUpdated.toLocaleTimeString("en-IN")}
                                {refreshing ? " · Updating..." : ""}
                            </p>
                        )}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            type="button"
                            style={styles.button}
                            onClick={() => navigate("/customer")}
                        >
                            Back to Menu
                        </button>

                        <button
                            type="button"
                            style={{
                                ...styles.button,
                                background: "#263c2e",
                                color: "#fff",
                                opacity: refreshing ? 0.7 : 1,
                            }}
                            disabled={refreshing}
                            onClick={() => loadOrders({ silent: true })}
                        >
                            {refreshing ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>
                </header>

                {notice && (
                    <div
                        role="status"
                        style={{
                            ...styles.card,
                            color: "#166534",
                            background: "#f0fdf4",
                        }}
                    >
                        {notice}
                    </div>
                )}

                {error && (
                    <div
                        role="alert"
                        style={{
                            ...styles.card,
                            color: "#b42318",
                            background: "#fff7f6",
                        }}
                    >
                        <p>{error}</p>

                        <button
                            type="button"
                            style={styles.button}
                            onClick={() => setError("")}
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {!loading && !error && orders.length > 0 && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 14,
                            marginBottom: 24,
                        }}
                    >
                        <div style={styles.card}>
                            <p style={styles.muted}>Total orders</p>
                            <h2 style={{ margin: 0 }}>{orders.length}</h2>
                        </div>

                        <div style={styles.card}>
                            <p style={styles.muted}>Active orders</p>
                            <h2 style={{ margin: 0 }}>{activeOrders}</h2>
                        </div>

                        <div style={styles.card}>
                            <p style={styles.muted}>
                                Order value (excluding cancelled/rejected)
                            </p>
                            <h2 style={{ margin: 0 }}>{money(totalSpent)}</h2>
                        </div>
                    </div>
                )}

                {!loading && !error && orders.length > 0 && (
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginBottom: 22,
                        }}
                    >
                        {filterOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                style={{
                                    ...styles.button,
                                    background:
                                        filter === option.value
                                            ? "#263c2e"
                                            : "#fff",
                                    color:
                                        filter === option.value
                                            ? "#fff"
                                            : "#242424",
                                }}
                                onClick={() => setFilter(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}

                {loading && <p>Loading your orders...</p>}

                {!loading && !error && orders.length === 0 && (
                    <section style={styles.card}>
                        <h2>No orders yet</h2>

                        <p style={styles.muted}>
                            Your checkout orders will appear here.
                        </p>

                        <button
                            type="button"
                            style={{
                                ...styles.button,
                                background: "#263c2e",
                                color: "#fff",
                            }}
                            onClick={() => navigate("/customer")}
                        >
                            Browse Menu
                        </button>
                    </section>
                )}

                {!loading &&
                    !error &&
                    orders.length > 0 &&
                    filteredOrders.length === 0 && (
                        <section style={styles.card}>
                            <h2>No matching orders</h2>

                            <p style={styles.muted}>
                                There are no orders with this status.
                            </p>

                            <button
                                type="button"
                                style={styles.button}
                                onClick={() => setFilter("all")}
                            >
                                Show all orders
                            </button>
                        </section>
                    )}

                {!loading &&
                    !error &&
                    filteredOrders.map((order) => {
                        const status = normaliseStatus(order.status);
                        const canCancel = status === "pending";
                        const isCancelling =
                            String(cancellingId) === String(order.id);

                        return (
                            <section key={order.id} style={styles.card}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        gap: 16,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <div>
                                        <h2 style={{ margin: "0 0 8px" }}>
                                            Order #{order.id}
                                        </h2>

                                        <p style={styles.muted}>
                                            {formatDate(order.created_at)}
                                        </p>
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 8,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <StatusBadge value={order.status} />
                                        <StatusBadge
                                            value={order.payment_status}
                                        />
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        gap: 24,
                                        flexWrap: "wrap",
                                        marginTop: 12,
                                    }}
                                >
                                    <p>
                                        <strong>Order type:</strong>{" "}
                                        {String(order.order_type || "takeaway")
                                            .replaceAll("_", " ")
                                            .replace(/\b\w/g, (letter) =>
                                                letter.toUpperCase()
                                            )}
                                    </p>

                                    <p>
                                        <strong>Items:</strong>{" "}
                                        {order.items.reduce(
                                            (count, item) =>
                                                count +
                                                Number(item.quantity || 0),
                                            0
                                        )}
                                    </p>
                                </div>

                                <OrderProgress status={order.status} />

                                {canCancel && (
                                    <div style={{ margin: "16px 0 22px" }}>
                                        <button
                                            type="button"
                                            disabled={
                                                cancellingId !== null ||
                                                refreshing
                                            }
                                            onClick={() =>
                                                cancelOrder(order.id)
                                            }
                                            style={{
                                                ...styles.button,
                                                background: "#fff0ee",
                                                color: "#b42318",
                                                borderColor: "#fecaca",
                                                opacity: isCancelling ? 0.6 : 1,
                                                cursor:
                                                    cancellingId !== null ||
                                                        refreshing
                                                        ? "not-allowed"
                                                        : "pointer",
                                            }}
                                        >
                                            {isCancelling
                                                ? "Cancelling..."
                                                : "Cancel Order"}
                                        </button>

                                        <p
                                            style={{
                                                ...styles.muted,
                                                marginTop: 8,
                                                fontSize: 12,
                                            }}
                                        >
                                            Cancellation is available while
                                            your order is pending.
                                        </p>
                                    </div>
                                )}

                                <h3>Items ordered</h3>

                                {order.items.length === 0 && (
                                    <p style={styles.muted}>
                                        No item details found for this order.
                                    </p>
                                )}

                                {order.items.map((item) => (
                                    <div
                                        key={item.id}
                                        style={styles.itemRow}
                                    >
                                        <div>
                                            <strong>{item.item_name}</strong>

                                            <div style={styles.muted}>
                                                {money(item.unit_price)} ×{" "}
                                                {item.quantity}
                                            </div>
                                        </div>

                                        <strong>
                                            {money(
                                                item.line_total ??
                                                Number(item.unit_price) *
                                                Number(item.quantity)
                                            )}
                                        </strong>
                                    </div>
                                ))}

                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 12,
                                        marginTop: 20,
                                        fontSize: 18,
                                    }}
                                >
                                    <strong>Subtotal</strong>
                                    <strong>{money(order.subtotal)}</strong>
                                </div>
                            </section>
                        );
                    })}
            </div>
        </main>
    );
}
