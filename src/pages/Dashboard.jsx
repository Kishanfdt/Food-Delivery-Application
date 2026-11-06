import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UtensilsCrossed,
  LifeBuoy,
  ChevronRight,
  AlertCircle,
  Zap,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ManagerLayout from "../components/ManagerLayout";
import {
  subscribeToHappyHours,
  isHappyHourActive,
  saveHappyHourSettings,
  DEFAULT_HAPPY_HOURS,
} from "../lib/happyHourService";
import HappyHourControlModal from "../components/HappyHourControlModal";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isCancelled(order) {
  return ["cancelled", "rejected"].includes(
    String(order.status || "").toLowerCase()
  );
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

function getOrderAmount(order) {
  return Number(
    order.total_amount ?? order.total_price ?? order.total ?? order.subtotal ?? 0
  );
}

function getStatusBadge(status) {
  const norm = String(status || "").toLowerCase();
  if (["completed", "delivered", "served"].includes(norm)) {
    return { label: norm, bg: "#DCFCE7", color: "#166534" };
  }
  if (["cancelled", "rejected"].includes(norm)) {
    return { label: norm, bg: "#FEE2E2", color: "#991B1B" };
  }
  if (["preparing", "confirmed"].includes(norm)) {
    return { label: norm, bg: "#DBEAFE", color: "#1E40AF" };
  }
  if (["ready"].includes(norm)) {
    return { label: norm, bg: "#E0E7FF", color: "#3730A3" };
  }
  return { label: norm || "pending", bg: "#FEF3C7", color: "#92400E" };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [foods, setFoods] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [happyHour, setHappyHour] = useState(DEFAULT_HAPPY_HOURS);
  const [happyHourModalOpen, setHappyHourModalOpen] = useState(false);
  const [togglingHH, setTogglingHH] = useState(false);

  useEffect(() => {
    const unsub = subscribeToHappyHours((data) => {
      setHappyHour(data);
    });
    return () => unsub();
  }, []);

  async function handleToggleHappyHourDirect() {
    setTogglingHH(true);
    try {
      const updated = { ...happyHour, enabled: !happyHour.enabled };
      await saveHappyHourSettings(updated);
      setHappyHour(updated);
    } catch (err) {
      console.error("Toggle error:", err);
    } finally {
      setTogglingHH(false);
    }
  }

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const [categoriesRes, foodsRes, ordersRes, ticketsRes] = await Promise.all([
        supabase.from("food_categories").select("*").order("name"),
        supabase.from("food_items").select("*").order("name"),
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("tickets")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const queryError =
        categoriesRes.error || foodsRes.error || ordersRes.error;
      if (queryError) throw queryError;

      setCategories(categoriesRes.data || []);
      setFoods(foodsRes.data || []);
      setOrders(ordersRes.data || []);
      setTickets(ticketsRes.data || []);
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(err?.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Calculations
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(isPending).length;
  const completedOrders = orders.filter(isCompleted).length;
  const cancelledOrders = orders.filter(isCancelled).length;

  const paidSales = orders
    .filter((order) => isPaid(order) && !isCancelled(order))
    .reduce((sum, order) => sum + getOrderAmount(order), 0);

  const pendingSales = orders
    .filter((order) => isPending(order))
    .reduce((sum, order) => sum + getOrderAmount(order), 0);

  const lowStockItems = foods.filter((food) => {
    const qty = Number(food.available_quantity ?? 0);
    const threshold = Number(food.low_stock_threshold ?? 5);
    return qty <= threshold;
  });

  const availableFoodsCount = foods.filter(
    (f) =>
      (f.is_available ?? f.available ?? true) &&
      Number(f.available_quantity ?? 0) > 0
  ).length;

  const openTickets = tickets.filter(
    (t) => t.status === "open" || t.status === "in_progress"
  );

  // 7-day Sales Bar Chart data
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
      dateLabel: day.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      amount,
    };
  });

  const maxDailySales = Math.max(...dailySales.map((d) => d.amount), 1);

  // Category item counts
  const categoryCounts = categories.map((cat) => {
    const count = foods.filter(
      (food) =>
        Number(food.category_id) === Number(cat.id) ||
        food.category === cat.name
    ).length;
    return {
      name: cat.name,
      count,
      period: cat.meal_period || "All-day",
    };
  });
  const maxCategoryCount = Math.max(...categoryCounts.map((c) => c.count), 1);

  const recentOrders = orders.slice(0, 5);

  return (
    <ManagerLayout
      title="Overall Dashboard"
      subtitle="Real-time restaurant performance, sales analytics, and operational metrics."
      onRefresh={() => loadDashboard(true)}
      refreshing={refreshing}
      actions={
        <>
          <button
            type="button"
            className="manager-btn-secondary"
            onClick={() => navigate("/categories")}
          >
            <UtensilsCrossed size={16} />
            <span>Manage Menu</span>
          </button>
          <button
            type="button"
            className="manager-btn-primary"
            onClick={() => navigate("/orders")}
          >
            <ShoppingBag size={16} />
            <span>Kitchen Orders</span>
          </button>
        </>
      }
    >
      {error && (
        <div
          style={{
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadDashboard(true)}
            style={{
              background: "#991B1B",
              color: "#fff",
              border: 0,
              padding: "6px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && !refreshing ? (
        <div
          className="manager-card"
          style={{ textAlign: "center", padding: "48px 20px", color: "#697064" }}
        >
          Loading restaurant performance metrics...
        </div>
      ) : (
        <>
          {/* KPI Stat Cards Grid */}
          <div className="manager-kpi-grid">
            {/* Paid Revenue */}
            <div className="manager-kpi-card">
              <div className="manager-kpi-header">
                <span className="manager-kpi-title">Paid Revenue</span>
                <span className="manager-kpi-icon icon-forest">
                  <TrendingUp size={18} />
                </span>
              </div>
              <div className="manager-kpi-value">{formatCurrency(paidSales)}</div>
              <div className="manager-kpi-footer">
                <span className="manager-kpi-trend trend-up">● Settled</span>
                <span>· {formatCurrency(pendingSales)} in progress</span>
              </div>
            </div>

            {/* Active Orders */}
            <div
              className="manager-kpi-card"
              onClick={() => navigate("/orders")}
              style={{ cursor: "pointer" }}
            >
              <div className="manager-kpi-header">
                <span className="manager-kpi-title">Active Orders</span>
                <span className="manager-kpi-icon icon-amber">
                  <Clock size={18} />
                </span>
              </div>
              <div className="manager-kpi-value" style={{ color: "#B45309" }}>
                {pendingOrders}
              </div>
              <div className="manager-kpi-footer">
                <span className="manager-kpi-trend trend-amber">
                  Awaiting completion
                </span>
                <ChevronRight size={14} style={{ marginLeft: "auto" }} />
              </div>
            </div>

            {/* Completed Orders */}
            <div className="manager-kpi-card">
              <div className="manager-kpi-header">
                <span className="manager-kpi-title">Completed Orders</span>
                <span className="manager-kpi-icon icon-green">
                  <CheckCircle2 size={18} />
                </span>
              </div>
              <div className="manager-kpi-value">{completedOrders}</div>
              <div className="manager-kpi-footer">
                <span style={{ color: "#15803D", fontWeight: 700 }}>
                  {totalOrders > 0
                    ? Math.round((completedOrders / totalOrders) * 100)
                    : 0}
                  % success rate
                </span>
                <span>· {cancelledOrders} cancelled</span>
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div
              className="manager-kpi-card"
              onClick={() => navigate("/categories")}
              style={{ cursor: "pointer" }}
            >
              <div className="manager-kpi-header">
                <span className="manager-kpi-title">Inventory Health</span>
                <span
                  className={`manager-kpi-icon ${
                    lowStockItems.length > 0 ? "icon-red" : "icon-green"
                  }`}
                >
                  <AlertTriangle size={18} />
                </span>
              </div>
              <div
                className="manager-kpi-value"
                style={{
                  color: lowStockItems.length > 0 ? "#B91C1C" : "#263C2E",
                }}
              >
                {lowStockItems.length}
              </div>
              <div className="manager-kpi-footer">
                <span>
                  {lowStockItems.length > 0
                    ? "Dishes need immediate restock"
                    : `${availableFoodsCount} dishes ready & in stock`}
                </span>
                <ChevronRight size={14} style={{ marginLeft: "auto" }} />
              </div>
            </div>

            {/* Support Tickets */}
            <div
              className="manager-kpi-card"
              onClick={() => navigate("/tickets")}
              style={{ cursor: "pointer" }}
            >
              <div className="manager-kpi-header">
                <span className="manager-kpi-title">Customer Tickets</span>
                <span className="manager-kpi-icon icon-blue">
                  <LifeBuoy size={18} />
                </span>
              </div>
              <div className="manager-kpi-value" style={{ color: "#1D4ED8" }}>
                {openTickets.length}
              </div>
              <div className="manager-kpi-footer">
                <span>
                  {openTickets.length > 0
                    ? "Requires staff attention"
                    : "All issues resolved"}
                </span>
                <ChevronRight size={14} style={{ marginLeft: "auto" }} />
              </div>
            </div>
          </div>

          {/* Happy Hours Control Card */}
          <div
            className="manager-card"
            style={{
              marginBottom: "24px",
              background: isHappyHourActive(happyHour)
                ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)"
                : "#ffffff",
              border: isHappyHourActive(happyHour)
                ? "2px solid #FCD34D"
                : "1px solid #E5E4DA",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              boxShadow: isHappyHourActive(happyHour)
                ? "0 4px 18px rgba(217, 119, 6, 0.12)"
                : "0 3px 12px rgba(38, 60, 46, 0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: isHappyHourActive(happyHour)
                    ? "#F59E0B"
                    : "#F4F5F0",
                  color: isHappyHourActive(happyHour) ? "#ffffff" : "#697064",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Zap size={24} />
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "17px",
                      fontWeight: 800,
                      color: "#263C2E",
                    }}
                  >
                    Happy Hours Promotion
                  </h3>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 800,
                      background: isHappyHourActive(happyHour)
                        ? "#DCFCE7"
                        : "#FEE2E2",
                      color: isHappyHourActive(happyHour)
                        ? "#166534"
                        : "#991B1B",
                    }}
                  >
                    {isHappyHourActive(happyHour)
                      ? `● ACTIVE (${happyHour.discountPercent}% DISCOUNT)`
                      : "○ INACTIVE"}
                  </span>
                </div>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "12.5px",
                    color: "#697064",
                  }}
                >
                  {isHappyHourActive(happyHour)
                    ? `Customers receive ${happyHour.discountPercent}% OFF on all menu dishes. Schedule: ${happyHour.startTime || "16:00"} - ${happyHour.endTime || "19:00"} IST.`
                    : `Discount is currently paused. Activate to broadcast ${happyHour.discountPercent}% OFF to all users.`}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={handleToggleHappyHourDirect}
                disabled={togglingHH}
                style={{
                  padding: "9px 16px",
                  borderRadius: "10px",
                  border: isHappyHourActive(happyHour)
                    ? "1px solid #B45309"
                    : "1px solid #263C2E",
                  background: isHappyHourActive(happyHour)
                    ? "#D97706"
                    : "#263C2E",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Zap size={15} />
                <span>
                  {isHappyHourActive(happyHour)
                    ? "Turn Off Happy Hours"
                    : "Turn On Happy Hours"}
                </span>
              </button>

              <button
                type="button"
                className="manager-btn-secondary"
                onClick={() => setHappyHourModalOpen(true)}
              >
                Configure Settings →
              </button>
            </div>
          </div>

          <HappyHourControlModal
            isOpen={happyHourModalOpen}
            onClose={() => setHappyHourModalOpen(false)}
            onUpdated={(updated) => setHappyHour(updated)}
          />

          {/* Main Analytical Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 460px), 1fr))",
              gap: "24px",
              marginBottom: "28px",
            }}
          >
            {/* 7-Day Revenue Trend Chart */}
            <section className="manager-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "18px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "17px",
                      fontWeight: 800,
                      color: "#263C2E",
                    }}
                  >
                    7-Day Sales Volume
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "12px",
                      color: "#697064",
                    }}
                  >
                    Daily revenue from fulfilled and settled orders
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    background: "#EAF1E7",
                    color: "#263C2E",
                    padding: "4px 8px",
                    borderRadius: "6px",
                  }}
                >
                  Past Week
                </span>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                {dailySales.map((day) => {
                  const pct = (day.amount / maxDailySales) * 100;
                  const isPeak = day.amount === maxDailySales && day.amount > 0;

                  return (
                    <div
                      key={day.label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "55px 1fr 90px",
                        alignItems: "center",
                        gap: "14px",
                        fontSize: "12.5px",
                      }}
                    >
                      <span
                        style={{
                          color: isPeak ? "#263C2E" : "#697064",
                          fontWeight: isPeak ? 800 : 500,
                        }}
                      >
                        {day.label}
                      </span>
                      <div
                        style={{
                          height: "12px",
                          background: "#EAEDE6",
                          borderRadius: "20px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: isPeak
                              ? "linear-gradient(90deg, #387A55 0%, #263C2E 100%)"
                              : "#687B4D",
                            borderRadius: "20px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <strong
                        style={{
                          textAlign: "right",
                          color: isPeak ? "#263C2E" : "#384033",
                          fontWeight: 700,
                        }}
                      >
                        {day.amount > 0 ? formatCurrency(day.amount) : "₹0"}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Menu Breakdown by Category */}
            <section className="manager-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "18px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "17px",
                      fontWeight: 800,
                      color: "#263C2E",
                    }}
                  >
                    Menu by Category
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "12px",
                      color: "#697064",
                    }}
                  >
                    Distribution of available food items across meal periods
                  </p>
                </div>
                <Link
                  to="/categories"
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#387A55",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  Edit <ChevronRight size={14} />
                </Link>
              </div>

              {categoryCounts.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px 12px",
                    color: "#697064",
                    fontSize: "13px",
                  }}
                >
                  No categories configured yet.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  {categoryCounts.slice(0, 6).map((cat) => {
                    const pct = (cat.count / maxCategoryCount) * 100;
                    return (
                      <div
                        key={cat.name}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "110px 1fr 50px",
                          alignItems: "center",
                          gap: "12px",
                          fontSize: "12.5px",
                        }}
                      >
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: "#263C2E",
                            fontWeight: 600,
                          }}
                          title={cat.name}
                        >
                          {cat.name}
                        </span>
                        <div
                          style={{
                            height: "10px",
                            background: "#EAEDE6",
                            borderRadius: "20px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: "#28734F",
                              borderRadius: "20px",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#697064",
                          }}
                        >
                          {cat.count} items
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Low Stock Warning Alert Section (If Any) */}
          {lowStockItems.length > 0 && (
            <section
              className="manager-card"
              style={{
                borderColor: "#FCD34D",
                background: "#FFFDF5",
                marginBottom: "28px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#FEF3C7",
                      color: "#B45309",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#92400E",
                      }}
                    >
                      Low Stock Attention Required ({lowStockItems.length} items)
                    </h3>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: "12px",
                        color: "#B45309",
                      }}
                    >
                      Portions have reached or fallen below your configured
                      warning thresholds.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="manager-btn-secondary"
                  onClick={() => navigate("/categories")}
                  style={{
                    borderColor: "#FCD34D",
                    background: "#ffffff",
                    color: "#92400E",
                  }}
                >
                  Re-stock Items Now →
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                {lowStockItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #FDE68A",
                      borderRadius: "12px",
                      padding: "14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#263C2E",
                        }}
                      >
                        {item.name}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#697064" }}>
                        Threshold: {item.low_stock_threshold ?? 5} units
                      </span>
                    </div>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        background:
                          Number(item.available_quantity) === 0
                            ? "#FEE2E2"
                            : "#FEF3C7",
                        color:
                          Number(item.available_quantity) === 0
                            ? "#991B1B"
                            : "#B45309",
                        fontWeight: 800,
                        fontSize: "12px",
                      }}
                    >
                      {item.available_quantity ?? 0} left
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Orders Section */}
          <section className="manager-card" style={{ marginBottom: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#263C2E",
                  }}
                >
                  Recent Customer Orders
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "12.5px",
                    color: "#697064",
                  }}
                >
                  Latest orders placed through the Cravely customer portal
                </p>
              </div>

              <Link
                to="/orders"
                className="manager-btn-secondary"
                style={{ fontSize: "12.5px" }}
              >
                View All Orders ({orders.length}) →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 16px",
                  color: "#697064",
                  fontSize: "13px",
                }}
              >
                No orders placed yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    minWidth: "600px",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: "13px",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E5E4DA" }}>
                      <th
                        style={{
                          padding: "12px 14px",
                          color: "#697064",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.6px",
                        }}
                      >
                        Order Ref
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          color: "#697064",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.6px",
                        }}
                      >
                        Placed
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          color: "#697064",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.6px",
                        }}
                      >
                        Type
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          color: "#697064",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.6px",
                        }}
                      >
                        Amount
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          color: "#697064",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.6px",
                        }}
                      >
                        Status
                      </th>
                      <th
                        style={{
                          padding: "12px 14px",
                          color: "#697064",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.6px",
                          textAlign: "right",
                        }}
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => {
                      const badge = getStatusBadge(order.status);
                      return (
                        <tr
                          key={order.id}
                          style={{
                            borderBottom: "1px solid #F0F2EB",
                            transition: "background 0.15s ease",
                          }}
                        >
                          <td
                            style={{
                              padding: "14px 14px",
                              fontWeight: 700,
                              color: "#263C2E",
                            }}
                          >
                            #{String(order.id).slice(0, 8).toUpperCase()}
                          </td>
                          <td
                            style={{ padding: "14px 14px", color: "#697064" }}
                          >
                            {formatDate(order.created_at)}
                          </td>
                          <td
                            style={{
                              padding: "14px 14px",
                              color: "#384033",
                              textTransform: "capitalize",
                            }}
                          >
                            {order.order_type || "Dine-in"}
                          </td>
                          <td
                            style={{
                              padding: "14px 14px",
                              fontWeight: 700,
                              color: "#263C2E",
                            }}
                          >
                            {formatCurrency(getOrderAmount(order))}
                          </td>
                          <td style={{ padding: "14px 14px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 9px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: badge.bg,
                                color: badge.color,
                                textTransform: "capitalize",
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "14px 14px",
                              textAlign: "right",
                            }}
                          >
                            <Link
                              to="/orders"
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#387A55",
                                textDecoration: "none",
                              }}
                            >
                              Manage →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </ManagerLayout>
  );
}
