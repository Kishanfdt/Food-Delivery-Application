
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const colors = {
    background: "#F4F5F0",
    card: "#FFFFFF",
    text: "#252820",
    muted: "#697064",
    border: "#E5E4DA",
    primary: "#263C2E",
    primaryLight: "#E3EBE1",
    green: "#387A55",
    orange: "#B97832",
    red: "#B94B42",
};

const styles = {
    page: {
        minHeight: "100vh",
        background: colors.background,
        padding: "32px",
        color: colors.text,
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: "border-box",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "20px",
        flexWrap: "wrap",
        marginBottom: "28px",
    },
    eyebrow: {
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "1.8px",
        textTransform: "uppercase",
        color: colors.green,
        marginBottom: "8px",
    },
    title: {
        fontSize: "clamp(26px, 4vw, 36px)",
        fontWeight: 800,
        letterSpacing: "-1.2px",
        margin: 0,
        color: colors.primary,
    },
    subtitle: {
        color: colors.muted,
        marginTop: "8px",
        fontSize: "14px",
    },
    button: {
        background: colors.primary,
        color: "#FFFFFF",
        border: "none",
        borderRadius: "10px",
        padding: "12px 18px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "16px",
        marginBottom: "24px",
    },
    card: {
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: "16px",
        padding: "22px",
        minWidth: 0,
        boxSizing: "border-box",
    },
    statLabel: {
        color: colors.muted,
        fontSize: "13px",
        fontWeight: 600,
        marginBottom: "14px",
    },
    statValue: {
        fontSize: "30px",
        lineHeight: 1.2,
        fontWeight: 800,
        letterSpacing: "-0.8px",
        color: colors.primary,
        overflowWrap: "anywhere",
    },
    statNote: {
        marginTop: "10px",
        fontSize: "12px",
        color: colors.muted,
    },
    sectionGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
        gap: "20px",
        marginBottom: "24px",
    },
    sectionTitle: {
        fontSize: "17px",
        fontWeight: 800,
        color: colors.primary,
        margin: 0,
    },
    sectionSubtitle: {
        fontSize: "12px",
        color: colors.muted,
        marginTop: "6px",
        marginBottom: "22px",
    },
    barRow: {
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr) 28px",
        alignItems: "center",
        gap: "12px",
        marginBottom: "17px",
        fontSize: "12px",
    },
    barTrack: {
        height: "10px",
        background: "#EAEDE6",
        borderRadius: "20px",
        overflow: "hidden",
    },
    tableWrap: {
        overflowX: "auto",
        width: "100%",
    },
    table: {
        width: "100%",
        minWidth: "480px",
        borderCollapse: "collapse",
        textAlign: "left",
        fontSize: "13px",
    },
    th: {
        padding: "12px 10px",
        color: colors.muted,
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "0.7px",
        borderBottom: `1px solid ${colors.border}`,
        whiteSpace: "nowrap",
    },
    td: {
        padding: "15px 10px",
        borderBottom: `1px solid ${colors.border}`,
        verticalAlign: "middle",
    },
    status: {
        display: "inline-block",
        padding: "6px 9px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 700,
        whiteSpace: "nowrap",
        textTransform: "capitalize",
    },
    error: {
        background: "#FCEDEA",
        color: colors.red,
        padding: "14px 16px",
        borderRadius: "10px",
        marginBottom: "18px",
        fontSize: "13px",
    },
    loading: {
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        color: colors.muted,
        fontSize: "14px",
    },
};

function isCancelled(order) {
    return String(order.status || "").toLowerCase() === "cancelled";
}

function isCompleted(order) {
    return ["completed", "delivered", "served"].includes(
        String(order.status || "").toLowerCase()
    );
}

function isPending(order) {
    return !isCancelled(order) && !isCompleted(order);
}

function isPaid(order) {
    const paymentStatus = String(
        order.payment_status || order.paymentStatus || ""
    ).toLowerCase();

    return (
        paymentStatus === "paid" ||
        paymentStatus === "completed" ||
        paymentStatus === "success"
    );
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);
}

function getOrderAmount(order) {
    return Number(
        order.total_amount ?? order.total_price ?? order.total ?? 0
    );
}

function getStatusColors(status) {
    const normalized = String(status || "").toLowerCase();

    if (["completed", "delivered", "served", "available"].includes(normalized)) {
        return { background: "#E5F2E8", color: "#286642" };
    }

    if (["cancelled", "unavailable", "rejected"].includes(normalized)) {
        return { background: "#FCEDEA", color: colors.red };
    }

    if (["pending", "preparing", "confirmed", "out_for_delivery"].includes(normalized)) {
        return { background: "#F8EFDF", color: "#95601F" };
    }

    return { background: "#ECEFE9", color: colors.muted };
}

function StatusBadge({ status }) {
    const statusColors = getStatusColors(status);

    return (
        <span
            style={{
                ...styles.status,
                background: statusColors.background,
                color: statusColors.color,
            }}
        >
            {String(status || "Unknown").replaceAll("_", " ")}
        </span>
    );
}

function StatCard({ label, value, note, accent }) {
    return (
        <section style={styles.card}>
            <div style={styles.statLabel}>{label}</div>
            <div style={{ ...styles.statValue, color: accent || colors.primary }}>
                {value}
            </div>
            <div style={styles.statNote}>{note}</div>
        </section>
    );
}

function EmptyState({ children }) {
    return (
        <div
            style={{
                textAlign: "center",
                color: colors.muted,
                padding: "30px 12px",
                fontSize: "13px",
            }}
        >
            {children}
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [categories, setCategories] = useState([]);
    const [foods, setFoods] = useState([]);
    const [orders, setOrders] = useState([]);

    const loadDashboard = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        try {
            const [categoriesResult, foodsResult, ordersResult] =
                await Promise.all([
                    supabase.from("food_categories").select("*"),
                    supabase.from("food_items").select("*"),
                    supabase.from("orders").select("*").order("created_at", {
                        ascending: false,
                    }),
                ]);

            const queryError =
                categoriesResult.error || foodsResult.error || ordersResult.error;

            if (queryError) throw queryError;

            setCategories(categoriesResult.data || []);
            setFoods(foodsResult.data || []);
            setOrders(ordersResult.data || []);
        } catch (err) {
            console.error("Dashboard loading error:", err);
            setError(
                err?.message ||
                "Unable to load dashboard data. Please try again."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const totalOrders = orders.length;
    const pendingOrders = orders.filter(isPending).length;
    const completedOrders = orders.filter(isCompleted).length;
    const cancelledOrders = orders.filter(isCancelled).length;

    const paidSales = orders
        .filter((order) => isPaid(order) && !isCancelled(order))
        .reduce((sum, order) => sum + getOrderAmount(order), 0);

    const availableFoods = foods.filter((food) => {
        const available = food.is_available ?? food.available ?? true;
        const quantity = Number(
            food.available_quantity ?? food.stock_quantity ?? food.quantity ?? 0
        );

        return available && quantity > 0;
    }).length;

    const recentOrders = orders.slice(0, 6);
    const recentFoods = foods.slice(0, 6);

    const now = new Date();

    const dailySales = Array.from({ length: 7 }, (_, index) => {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - (6 - index));

        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        const amount = orders
            .filter((order) => {
                if (!isPaid(order) || isCancelled(order) || !order.created_at) {
                    return false;
                }

                const createdAt = new Date(order.created_at);

                return createdAt >= day && createdAt < nextDay;
            })
            .reduce((sum, order) => sum + getOrderAmount(order), 0);

        return {
            label: day.toLocaleDateString("en-IN", { weekday: "short" }),
            amount,
        };
    });

    const maxDailySales = Math.max(...dailySales.map((day) => day.amount), 1);

    const categoryCounts = categories.map((category) => {
        const count = foods.filter(
            (food) =>
                food.category_id === category.id ||
                food.category_id === category.category_id
        ).length;

        return {
            name: category.name || category.category_name || "Category",
            count,
        };
    });

    const maxCategoryCount = Math.max(
        ...categoryCounts.map((category) => category.count),
        1
    );

    if (loading) {
        return <div style={styles.loading}>Loading your dashboard…</div>;
    }

    return (
        <main style={styles.page}>
            <header style={styles.header}>
                <div>
                    <div style={styles.eyebrow}>Cravely · Manager workspace</div>
                    <h1 style={styles.title}>Dashboard</h1>
                    <p style={styles.subtitle}>
                        An overview of your restaurant’s performance and operations.
                    </p>
                </div>

                <button
                    type="button"
                    style={{
                        ...styles.button,
                        opacity: refreshing ? 0.7 : 1,
                    }}
                    onClick={() => loadDashboard(true)}
                    disabled={refreshing}
                >
                    {refreshing ? "Refreshing…" : "↻ Refresh data"}
                </button>
            </header>

            {error && (
                <div style={styles.error} role="alert">
                    <strong>Something went wrong.</strong> {error}
                    <button
                        type="button"
                        onClick={() => loadDashboard(true)}
                        style={{
                            display: "block",
                            marginTop: "10px",
                            padding: 0,
                            border: 0,
                            background: "transparent",
                            color: colors.red,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Try again
                    </button>
                </div>
            )}

            <div style={styles.grid}>
                <StatCard
                    label="Total orders"
                    value={totalOrders}
                    note="All recorded orders"
                />
                <StatCard
                    label="Awaiting completion"
                    value={pendingOrders}
                    note="Orders still in progress"
                    accent={colors.orange}
                />
                <StatCard
                    label="Completed orders"
                    value={completedOrders}
                    note="Served or delivered"
                    accent={colors.green}
                />
                <StatCard
                    label="Paid sales"
                    value={formatCurrency(paidSales)}
                    note="Paid orders, excluding cancellations"
                />
            </div>

            <div style={styles.grid}>
                <StatCard
                    label="Menu items"
                    value={foods.length}
                    note="Items in your menu"
                />
                <StatCard
                    label="Available items"
                    value={availableFoods}
                    note="Marked available and in stock"
                    accent={colors.green}
                />
                <StatCard
                    label="Categories"
                    value={categories.length}
                    note="Menu categories"
                />
                <StatCard
                    label="Cancelled orders"
                    value={cancelledOrders}
                    note="Cancelled order records"
                    accent={colors.red}
                />
            </div>

            <div style={styles.sectionGrid}>
                <section style={styles.card}>
                    <h2 style={styles.sectionTitle}>Sales overview</h2>
                    <p style={styles.sectionSubtitle}>
                        Paid sales across the last seven calendar days
                    </p>

                    {dailySales.every((day) => day.amount === 0) ? (
                        <EmptyState>No paid sales recorded for this period.</EmptyState>
                    ) : (
                        dailySales.map((day) => (
                            <div key={day.label} style={styles.barRow}>
                                <span style={{ color: colors.muted }}>{day.label}</span>
                                <div style={styles.barTrack}>
                                    <div
                                        style={{
                                            width: `${(day.amount / maxDailySales) * 100}%`,
                                            minWidth: day.amount > 0 ? "4px" : 0,
                                            height: "100%",
                                            background: colors.primary,
                                            borderRadius: "20px",
                                            transition: "width 0.3s ease",
                                        }}
                                    />
                                </div>
                                <strong style={{ textAlign: "right", fontSize: "11px" }}>
                                    {day.amount > 0 ? formatCurrency(day.amount) : "—"}
                                </strong>
                            </div>
                        ))
                    )}
                </section>

                <section style={styles.card}>
                    <h2 style={styles.sectionTitle}>Menu by category</h2>
                    <p style={styles.sectionSubtitle}>
                        Number of menu items in each category
                    </p>

                    {categoryCounts.length === 0 ? (
                        <EmptyState>No categories have been added yet.</EmptyState>
                    ) : (
                        categoryCounts.slice(0, 7).map((category) => (
                            <div key={category.name} style={styles.barRow}>
                                <span
                                    title={category.name}
                                    style={{
                                        color: colors.muted,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {category.name}
                                </span>
                                <div style={styles.barTrack}>
                                    <div
                                        style={{
                                            width: `${(category.count / maxCategoryCount) * 100}%`,
                                            minWidth: category.count > 0 ? "4px" : 0,
                                            height: "100%",
                                            background: colors.green,
                                            borderRadius: "20px",
                                        }}
                                    />
                                </div>
                                <strong style={{ textAlign: "right" }}>
                                    {category.count}
                                </strong>
                            </div>
                        ))
                    )}

                    <button
                        type="button"
                        onClick={() => navigate("/categories")}
                        style={{
                            ...styles.button,
                            width: "100%",
                            marginTop: "10px",
                        }}
                    >
                        Manage categories →
                    </button>
                </section>
            </div>

            <section style={{ ...styles.card, marginBottom: "24px" }}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                    }}
                >
                    <h2 style={styles.sectionTitle}>Recent orders</h2>
                    <button
                        type="button"
                        onClick={() => navigate("/orders")}
                        style={{
                            border: 0,
                            background: "transparent",
                            color: colors.green,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        View all →
                    </button>
                </div>

                <p style={styles.sectionSubtitle}>
                    The latest orders received by your restaurant
                </p>

                {recentOrders.length === 0 ? (
                    <EmptyState>No orders to display yet.</EmptyState>
                ) : (
                    <div style={styles.tableWrap}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Order</th>
                                    <th style={styles.th}>Date</th>
                                    <th style={styles.th}>Amount</th>
                                    <th style={styles.th}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td style={styles.td}>
                                            <strong>
                                                #{String(order.id).slice(0, 8).toUpperCase()}
                                            </strong>
                                        </td>
                                        <td style={styles.td}>{formatDate(order.created_at)}</td>
                                        <td style={styles.td}>
                                            {formatCurrency(getOrderAmount(order))}
                                        </td>
                                        <td style={styles.td}>
                                            <StatusBadge status={order.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section style={styles.card}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                    }}
                >
                    <h2 style={styles.sectionTitle}>Recently added dishes</h2>
                    <button
                        type="button"
                        onClick={() => navigate("/categories")}
                        style={{
                            border: 0,
                            background: "transparent",
                            color: colors.green,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Manage menu →
                    </button>
                </div>

                <p style={styles.sectionSubtitle}>
                    Menu items currently stored in Cravely
                </p>

                {recentFoods.length === 0 ? (
                    <EmptyState>No menu items have been added yet.</EmptyState>
                ) : (
                    <div style={styles.tableWrap}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Dish</th>
                                    <th style={styles.th}>Price</th>
                                    <th style={styles.th}>Availability</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentFoods.map((food) => {
                                    const available = food.is_available ?? food.available ?? true;

                                    return (
                                        <tr key={food.id}>
                                            <td style={styles.td}>
                                                <strong>
                                                    {food.name || food.food_name || "Unnamed dish"}
                                                </strong>
                                            </td>
                                            <td style={styles.td}>
                                                {formatCurrency(food.price)}
                                            </td>
                                            <td style={styles.td}>
                                                <StatusBadge
                                                    status={available ? "available" : "unavailable"}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
