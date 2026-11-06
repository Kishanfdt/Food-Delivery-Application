import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Utensils,
  ChefHat,
  Package,
  LifeBuoy,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerLayout from "../components/CustomerLayout";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function getStatusBadge(status) {
  const norm = normaliseStatus(status);
  if (["completed", "delivered", "served"].includes(norm)) {
    return { label: "Completed", bg: "#DCFCE7", color: "#166534" };
  }
  if (["cancelled", "rejected"].includes(norm)) {
    return { label: norm === "rejected" ? "Rejected" : "Cancelled", bg: "#FEE2E2", color: "#991B1B" };
  }
  if (["ready"].includes(norm)) {
    return { label: "Ready for Pickup", bg: "#DBEAFE", color: "#1E40AF" };
  }
  if (["preparing"].includes(norm)) {
    return { label: "Kitchen Preparing", bg: "#F3E8FF", color: "#6B21A8" };
  }
  if (["confirmed"].includes(norm)) {
    return { label: "Order Confirmed", bg: "#E0F2FE", color: "#0369A1" };
  }
  return { label: "Order Pending", bg: "#FEF3C7", color: "#92400E" };
}

const progressSteps = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "preparing", label: "Cooking", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Package },
  { key: "completed", label: "Served", icon: CheckCircle2 },
];

function OrderProgressTimeline({ status }) {
  const current = normaliseStatus(status);

  if (["cancelled", "rejected"].includes(current)) {
    return (
      <div
        style={{
          marginTop: "16px",
          padding: "12px 16px",
          borderRadius: "10px",
          background: "#FEE2E2",
          color: "#991B1B",
          fontSize: "13px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <XCircle size={18} />
        <span>
          {current === "rejected"
            ? "This order was declined by the restaurant."
            : "This order has been cancelled."}
        </span>
      </div>
    );
  }

  const stepKeys = progressSteps.map((s) => s.key);
  const currentIndex = stepKeys.indexOf(current);

  return (
    <div style={{ marginTop: "18px", marginBottom: "18px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        {progressSteps.map((step, idx) => {
          const Icon = step.icon;
          const isPassed = idx <= currentIndex && currentIndex !== -1;
          const isCurrent = idx === currentIndex;

          return (
            <div
              key={step.key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 2,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: isCurrent
                    ? "#C65E38"
                    : isPassed
                    ? "#263C2E"
                    : "#EBEFE8",
                  color: isPassed ? "#ffffff" : "#697064",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: isCurrent ? "0 0 0 4px rgba(198, 94, 56, 0.2)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={16} />
              </div>
              <span
                style={{
                  marginTop: "6px",
                  fontSize: "11px",
                  fontWeight: isCurrent ? 800 : 600,
                  color: isCurrent ? "#C65E38" : isPassed ? "#263C2E" : "#8A9486",
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MyOrders() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      const { data, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          order_type,
          status,
          payment_status,
          subtotal,
          created_at,
          order_items (
            id,
            item_name,
            quantity,
            unit_price,
            line_total
          )
        `)
        .eq("customer_id", session.user.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const normalized = (data || []).map((order) => ({
        ...order,
        items: order.order_items || [],
      }));

      setOrders(normalized);
    } catch (err) {
      setError(err?.message || "Unable to load your orders right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadOrders();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadOrders({ silent: true });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel("customer-orders-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadOrders({ silent: true });
        }
      )
      .subscribe();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function cancelOrder(orderId) {
    if (
      !window.confirm(
        `Are you sure you want to cancel order #${orderId}? Reserved portions will be restored to the kitchen.`
      )
    ) {
      return;
    }

    setCancellingId(orderId);
    setError("");
    setNotice("");

    try {
      const { error: rpcError } = await supabase.rpc("customer_cancel_order", {
        p_order_id: orderId,
      });

      if (rpcError) throw rpcError;

      setNotice(`Order #${orderId} has been successfully cancelled.`);
      await loadOrders({ silent: true });
    } catch (err) {
      setError(err?.message || "Unable to cancel this order. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  const activeOrdersCount = orders.filter((o) =>
    ["pending", "confirmed", "preparing", "ready"].includes(
      normaliseStatus(o.status)
    )
  ).length;

  const totalSpent = orders
    .filter((o) => !["cancelled", "rejected"].includes(normaliseStatus(o.status)))
    .reduce((sum, o) => sum + Number(o.subtotal || 0), 0);

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "active") {
      return ["pending", "confirmed", "preparing", "ready"].includes(
        normaliseStatus(order.status)
      );
    }
    return normaliseStatus(order.status) === filter;
  });

  const filterTabs = [
    { id: "all", label: "All Orders", count: orders.length },
    { id: "active", label: "Active", count: activeOrdersCount },
    {
      id: "completed",
      label: "Completed",
      count: orders.filter((o) => normaliseStatus(o.status) === "completed").length,
    },
    {
      id: "cancelled",
      label: "Cancelled",
      count: orders.filter((o) => ["cancelled", "rejected"].includes(normaliseStatus(o.status))).length,
    },
  ];

  return (
    <CustomerLayout
      title="My Orders & Tracking"
      subtitle="Track your cooking and preparation progress in real-time, view receipts, and review order history."
      onRefresh={() => loadOrders({ silent: true })}
      refreshing={refreshing}
      actions={
        <button
          type="button"
          className="customer-btn-primary"
          onClick={() => navigate("/customer")}
        >
          <Utensils size={15} />
          <span>Order More Food</span>
        </button>
      }
    >
      {/* Notifications */}
      {error && (
        <div
          style={{
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
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
            onClick={() => setError("")}
            style={{
              background: "transparent",
              border: 0,
              color: "#991B1B",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      {notice && (
        <div
          style={{
            background: "#DCFCE7",
            border: "1px solid #86EFAC",
            color: "#166534",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={20} />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice("")}
            style={{
              background: "transparent",
              border: 0,
              color: "#166534",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Order Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="customer-card">
          <span style={{ fontSize: "12px", color: "#697064", fontWeight: 700 }}>
            TOTAL ORDERS
          </span>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#263C2E",
              fontFamily: "'Manrope', sans-serif",
              marginTop: "4px",
            }}
          >
            {orders.length}
          </div>
        </div>

        <div className="customer-card">
          <span style={{ fontSize: "12px", color: "#697064", fontWeight: 700 }}>
            CURRENTLY ACTIVE
          </span>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#C65E38",
              fontFamily: "'Manrope', sans-serif",
              marginTop: "4px",
            }}
          >
            {activeOrdersCount}
          </div>
        </div>

        <div className="customer-card">
          <span style={{ fontSize: "12px", color: "#697064", fontWeight: 700 }}>
            TOTAL SPENT
          </span>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#28734F",
              fontFamily: "'Manrope', sans-serif",
              marginTop: "4px",
            }}
          >
            {money(totalSpent)}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        className="customer-card"
        style={{
          padding: "14px 18px",
          marginBottom: "22px",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {filterTabs.map((tab) => {
          const isSelected = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              style={{
                padding: "7px 14px",
                borderRadius: "999px",
                border: isSelected ? "1px solid #263C2E" : "1px solid #E5E4DA",
                background: isSelected ? "#263C2E" : "#ffffff",
                color: isSelected ? "#ffffff" : "#384033",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  background: isSelected
                    ? "rgba(255, 255, 255, 0.25)"
                    : "#F0F2EB",
                  color: isSelected ? "#ffffff" : "#697064",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "10.5px",
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {loading ? (
        <div
          className="customer-card"
          style={{ textAlign: "center", padding: "48px 20px", color: "#697064" }}
        >
          Loading your order history...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div
          className="customer-card"
          style={{ textAlign: "center", padding: "54px 20px", color: "#697064" }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 12px",
              borderRadius: "12px",
              background: "#EAF1E7",
              color: "#263C2E",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ShoppingBag size={24} />
          </div>
          <h3
            style={{
              margin: "0 0 6px",
              fontSize: "18px",
              fontWeight: 800,
              color: "#263C2E",
            }}
          >
            {orders.length === 0 ? "You have no orders yet" : "No matching orders found"}
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: "13.5px" }}>
            {orders.length === 0
              ? "When you order food, you can track fulfillment right here!"
              : "Try switching to another filter tab above."}
          </p>
          <button
            type="button"
            className="customer-btn-primary"
            onClick={() => navigate("/customer")}
          >
            Browse Today's Menu
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {filteredOrders.map((order) => {
            const status = normaliseStatus(order.status);
            const canCancel = status === "pending";
            const isCancelling = String(cancellingId) === String(order.id);
            const badge = getStatusBadge(order.status);

            return (
              <article key={order.id} className="customer-card">
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "12px",
                    paddingBottom: "16px",
                    borderBottom: "1px solid #F0F2EB",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginBottom: "6px",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "18px",
                          fontWeight: 800,
                          color: "#263C2E",
                        }}
                      >
                        Order #{String(order.id).slice(0, 8).toUpperCase()}
                      </h2>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: "12.5px", color: "#697064" }}>
                      Placed on {formatDate(order.created_at)} ·{" "}
                      <span style={{ textTransform: "capitalize", fontWeight: 700 }}>
                        {order.order_type || "Takeaway"}
                      </span>
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Link
                      to="/my-tickets"
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
                      <LifeBuoy size={14} />
                      <span>Need Help?</span>
                    </Link>
                  </div>
                </div>

                {/* Progress Stepper */}
                <OrderProgressTimeline status={order.status} />

                {/* Cancellation Button if pending */}
                {canCancel && (
                  <div
                    style={{
                      background: "#FFF8F6",
                      border: "1px solid #FCD9D0",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "12.5px", color: "#991B1B" }}>
                      Need to make changes? You can cancel while the order is pending.
                    </span>
                    <button
                      type="button"
                      disabled={cancellingId !== null}
                      onClick={() => cancelOrder(order.id)}
                      style={{
                        padding: "6px 12px",
                        background: "#991B1B",
                        color: "#ffffff",
                        border: 0,
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isCancelling ? "Cancelling..." : "Cancel Order"}
                    </button>
                  </div>
                )}

                {/* Order Item Details */}
                <div style={{ paddingTop: "10px" }}>
                  <h4
                    style={{
                      margin: "0 0 10px",
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#697064",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Dishes in this Order
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "13px",
                          padding: "6px 0",
                          borderBottom: "1px dashed #F0F2EB",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#263C2E" }}>{item.item_name}</strong>
                          <span style={{ color: "#697064", marginLeft: "8px", fontSize: "12px" }}>
                            × {item.quantity} ({money(item.unit_price)})
                          </span>
                        </div>
                        <strong style={{ color: "#263C2E" }}>
                          {money(item.line_total ?? Number(item.unit_price) * Number(item.quantity))}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "14px",
                      paddingTop: "12px",
                      borderTop: "1px solid #E5E4DA",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#263C2E" }}>
                      Total Amount
                    </span>
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#263C2E",
                        fontFamily: "'Manrope', sans-serif",
                      }}
                    >
                      {money(order.subtotal)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </CustomerLayout>
  );
}
