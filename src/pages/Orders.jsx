import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  Utensils,
  CreditCard,
  User,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ManagerLayout from "../components/ManagerLayout";

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

function getStatusBadgeStyle(status) {
  const norm = String(status || "pending").toLowerCase();
  if (["completed", "delivered", "served"].includes(norm)) {
    return { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" };
  }
  if (["cancelled", "rejected"].includes(norm)) {
    return { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" };
  }
  if (["preparing"].includes(norm)) {
    return { bg: "#F3E8FF", color: "#6B21A8", border: "#E9D5FF" };
  }
  if (["ready"].includes(norm)) {
    return { bg: "#DBEAFE", color: "#1E40AF", border: "#BFDBFE" };
  }
  if (["confirmed"].includes(norm)) {
    return { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" };
  }
  return { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" };
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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
    const order = orders.find((item) => String(item.id) === String(orderId));
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
        ? `Are you sure you want to ${nextStatus} order #${orderId}? Portions will be restored to inventory automatically.`
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
        `Order #${orderId} updated to ${label(data.status)}.${
          isTerminalUpdate
            ? " Inventory portions were restored automatically."
            : ""
        }`
      );
    } catch (err) {
      setError(err.message || "Unable to update order status.");
    } finally {
      setUpdatingId(null);
    }
  }

  const summary = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(
        (o) => !FINAL_STATUSES.includes(String(o.status || "").toLowerCase())
      ).length,
      completed: orders.filter(
        (o) => String(o.status || "").toLowerCase() === "completed"
      ).length,
      cancelled: orders.filter((o) =>
        ["cancelled", "rejected"].includes(String(o.status || "").toLowerCase())
      ).length,
    };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    let result = orders;

    if (filter !== "all") {
      result = result.filter(
        (order) => String(order.status || "").toLowerCase() === filter
      );
    }

    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (order) =>
          String(order.id).toLowerCase().includes(term) ||
          String(order.customer_id || "").toLowerCase().includes(term) ||
          (order.order_items || []).some((item) =>
            String(item.item_name || "").toLowerCase().includes(term)
          )
      );
    }

    return result;
  }, [orders, filter, search]);

  const filterTabs = [
    { id: "all", label: "All Orders", count: summary.total },
    {
      id: "pending",
      label: "Pending",
      count: orders.filter((o) => o.status === "pending").length,
    },
    {
      id: "preparing",
      label: "Preparing",
      count: orders.filter((o) => o.status === "preparing").length,
    },
    {
      id: "ready",
      label: "Ready",
      count: orders.filter((o) => o.status === "ready").length,
    },
    { id: "completed", label: "Completed", count: summary.completed },
    { id: "cancelled", label: "Cancelled", count: summary.cancelled },
  ];

  return (
    <ManagerLayout
      title="Kitchen Orders & Fulfillment"
      subtitle="Track customer orders in real-time, adjust kitchen preparation stages, and monitor payments."
      onRefresh={() => loadOrders(true)}
      refreshing={refreshing}
      actions={
        <button
          type="button"
          className="manager-btn-primary"
          onClick={() => loadOrders(true)}
          disabled={refreshing}
        >
          <RefreshCw size={15} className={refreshing ? "spin-animation" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh Orders"}</span>
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

      {/* KPI Stats Grid */}
      <div className="manager-kpi-grid">
        <div className="manager-kpi-card">
          <div className="manager-kpi-header">
            <span className="manager-kpi-title">Total Orders</span>
            <span className="manager-kpi-icon icon-forest">
              <ShoppingBag size={18} />
            </span>
          </div>
          <div className="manager-kpi-value">{summary.total}</div>
          <div className="manager-kpi-footer">
            <span>All recorded customer requests</span>
          </div>
        </div>

        <div className="manager-kpi-card">
          <div className="manager-kpi-header">
            <span className="manager-kpi-title">Active Orders</span>
            <span className="manager-kpi-icon icon-amber">
              <Clock size={18} />
            </span>
          </div>
          <div className="manager-kpi-value" style={{ color: "#B45309" }}>
            {summary.pending}
          </div>
          <div className="manager-kpi-footer">
            <span style={{ color: "#B45309", fontWeight: 700 }}>
              Needs kitchen fulfillment
            </span>
          </div>
        </div>

        <div className="manager-kpi-card">
          <div className="manager-kpi-header">
            <span className="manager-kpi-title">Fulfilled</span>
            <span className="manager-kpi-icon icon-green">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <div className="manager-kpi-value" style={{ color: "#15803D" }}>
            {summary.completed}
          </div>
          <div className="manager-kpi-footer">
            <span>Successfully served or delivered</span>
          </div>
        </div>

        <div className="manager-kpi-card">
          <div className="manager-kpi-header">
            <span className="manager-kpi-title">Cancelled</span>
            <span className="manager-kpi-icon icon-red">
              <XCircle size={18} />
            </span>
          </div>
          <div className="manager-kpi-value" style={{ color: "#B91C1C" }}>
            {summary.cancelled}
          </div>
          <div className="manager-kpi-footer">
            <span>Restored to kitchen inventory</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="manager-card"
        style={{
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          {/* Quick status pill tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {filterTabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "999px",
                    border: active ? "1px solid #263C2E" : "1px solid #E5E4DA",
                    background: active ? "#263C2E" : "#ffffff",
                    color: active ? "#ffffff" : "#4A5244",
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
                      background: active
                        ? "rgba(255, 255, 255, 0.25)"
                        : "#F0F2EB",
                      color: active ? "#ffffff" : "#697064",
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

          {/* Search box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#F4F5F0",
              border: "1px solid #E5E4DA",
              borderRadius: "10px",
              padding: "7px 12px",
              minWidth: "220px",
            }}
          >
            <Search size={16} color="#697064" />
            <input
              placeholder="Search by ID, customer, item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "transparent",
                border: 0,
                outline: "none",
                fontSize: "12.5px",
                width: "100%",
                color: "#263C2E",
              }}
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div
          className="manager-card"
          style={{ textAlign: "center", padding: "48px 20px", color: "#697064" }}
        >
          Loading orders...
        </div>
      ) : visibleOrders.length === 0 ? (
        <div
          className="manager-card"
          style={{
            textAlign: "center",
            padding: "54px 20px",
            color: "#697064",
          }}
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
              fontSize: "17px",
              fontWeight: 800,
              color: "#263C2E",
            }}
          >
            No orders found
          </h3>
          <p style={{ margin: 0, fontSize: "13px" }}>
            {filter !== "all" || search
              ? "Try adjusting your filter or search query."
              : "Customer orders will appear here automatically when placed."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {visibleOrders.map((order) => {
            const normalizedStatus = String(order.status || "pending").toLowerCase();
            const isFinal = FINAL_STATUSES.includes(normalizedStatus);
            const isUpdating = String(updatingId) === String(order.id);
            const statusStyle = getStatusBadgeStyle(order.status);

            return (
              <article key={order.id} className="manager-card">
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "16px",
                    paddingBottom: "18px",
                    borderBottom: "1px solid #F0F2EB",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "240px" }}>
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
                          fontSize: "19px",
                          fontWeight: 800,
                          color: "#263C2E",
                        }}
                      >
                        Order #{String(order.id).slice(0, 8).toUpperCase()}
                      </h2>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`,
                          textTransform: "capitalize",
                        }}
                      >
                        {label(order.status)}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "#697064" }}>
                      Placed on {formatDate(order.created_at)}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        flexWrap: "wrap",
                        fontSize: "12px",
                        color: "#4A5244",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Utensils size={13} color="#687B4D" />
                        <strong>Type:</strong> {label(order.order_type)}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <CreditCard size={13} color="#687B4D" />
                        <strong>Payment:</strong> {label(order.payment_status)}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <User size={13} color="#687B4D" />
                        <strong>Customer:</strong> {order.customer_id ? String(order.customer_id).slice(0, 8) : "Guest"}
                      </span>
                    </div>
                  </div>

                  {/* Status changer */}
                  <div style={{ width: "220px", maxWidth: "100%" }}>
                    <label
                      htmlFor={`status-${order.id}`}
                      style={{
                        display: "block",
                        marginBottom: "6px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#697064",
                        textTransform: "uppercase",
                      }}
                    >
                      Kitchen Status
                    </label>

                    <select
                      id={`status-${order.id}`}
                      value={normalizedStatus}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      disabled={isUpdating || isFinal}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "9px",
                        border: "1px solid #D5DCD0",
                        background: isFinal ? "#F4F5F0" : "#ffffff",
                        color: "#263C2E",
                        fontSize: "13px",
                        fontWeight: 600,
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
                      <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#387A55" }}>
                        Updating status...
                      </p>
                    )}

                    {isFinal && (
                      <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#697064" }}>
                        This order has reached its final state.
                      </p>
                    )}
                  </div>
                </div>

                {/* Items Breakdown */}
                <div style={{ paddingTop: "16px" }}>
                  <h4
                    style={{
                      margin: "0 0 10px",
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "#263C2E",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Items Ordered
                  </h4>

                  {order.order_items?.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {order.order_items.map((item) => (
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
                            <span style={{ fontWeight: 700, color: "#263C2E" }}>
                              {item.item_name || "Food Item"}
                            </span>
                            <span style={{ color: "#697064", marginLeft: "8px", fontSize: "12px" }}>
                              × {item.quantity} ({formatPrice(item.unit_price)})
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, color: "#263C2E" }}>
                            {formatPrice(item.line_total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12.5px", color: "#697064" }}>
                      No item details available.
                    </p>
                  )}

                  {/* Subtotal */}
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
                      Order Total
                    </span>
                    <span
                      style={{
                        fontSize: "17px",
                        fontWeight: 800,
                        color: "#263C2E",
                      }}
                    >
                      {formatPrice(order.subtotal)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </ManagerLayout>
  );
}
