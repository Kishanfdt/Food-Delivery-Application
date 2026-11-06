import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LifeBuoy,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
  Send,
  MessageSquare,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ManagerLayout from "../components/ManagerLayout";

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

const priorityOptions = [
  { value: "low", label: "Low Priority" },
  { value: "medium", label: "Medium Priority" },
  { value: "high", label: "High Priority" },
  { value: "urgent", label: "Urgent Attention" },
];

const categoryLabels = {
  general: "General Inquiry",
  order_issue: "Order Issue",
  food_quality: "Food Quality",
  payment: "Payment / Refund",
  other: "Other Inquiries",
};

function getStatusStyle(status) {
  switch (status) {
    case "open":
      return { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" };
    case "in_progress":
      return { bg: "#DBEAFE", color: "#1E40AF", border: "#BFDBFE" };
    case "resolved":
      return { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" };
    case "rejected":
      return { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" };
    default:
      return { bg: "#F4F5F0", color: "#697064", border: "#E5E4DA" };
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case "urgent":
      return { bg: "#FEE2E2", color: "#991B1B" };
    case "high":
      return { bg: "#FFEDD5", color: "#C2410C" };
    case "medium":
      return { bg: "#FEF3C7", color: "#B45309" };
    default:
      return { bg: "#EAF1E7", color: "#28734F" };
  }
}

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
          "Unable to update this ticket. Please check permissions."
      );
    } finally {
      setSavingId(null);
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;

    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      String(ticket.id).includes(term) ||
      (ticket.subject || "").toLowerCase().includes(term) ||
      (ticket.description || "").toLowerCase().includes(term) ||
      (ticket.category || "").toLowerCase().includes(term) ||
      (ticket.order_id && String(ticket.order_id).includes(term));

    return matchesStatus && matchesSearch;
  });

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  const filterTabs = [
    { id: "all", label: "All Tickets", count: tickets.length },
    { id: "open", label: "Open", count: openCount },
    { id: "in_progress", label: "In Progress", count: inProgressCount },
    { id: "resolved", label: "Resolved", count: resolvedCount },
  ];

  return (
    <ManagerLayout
      title="Support Tickets & Inquiries"
      subtitle="Review customer inquiries, investigate order issues, and send staff resolution notes."
      onRefresh={loadTickets}
      refreshing={loading}
      actions={
        <button
          type="button"
          className="manager-btn-primary"
          onClick={loadTickets}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "spin-animation" : ""} />
          <span>{loading ? "Refreshing..." : "Refresh Tickets"}</span>
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

      {/* KPI Cards */}
      <div className="manager-kpi-grid">
        <div className="manager-kpi-card">
          <div className="manager-kpi-header">
            <span className="manager-kpi-title">Total Inquiries</span>
            <span className="manager-kpi-icon icon-forest">
              <LifeBuoy size={18} />
            </span>
          </div>
          <div className="manager-kpi-value">{tickets.length}</div>
          <div className="manager-kpi-footer">
            <span>Customer service submissions</span>
          </div>
        </div>

        <div className="manager-kpi-card">
          <div className="manager-kpi-header">
            <span className="manager-kpi-title">Awaiting Response</span>
            <span className="manager-kpi-icon icon-amber">
              <Clock size={18} />
            </span>
          </div>
          <div className="manager-kpi-value" style={{ color: "#B45309" }}>
            {openCount}
          </div>
          <div className="manager-kpi-footer">
            <span style={{ color: "#B45309", fontWeight: 700 }}>
              Action needed
            </span>
          </div>
        </div>

        <div className="manager-kpi-card">
          <div className="manager-kpi-header">
            <span className="manager-kpi-title">In Progress</span>
            <span className="manager-kpi-icon icon-blue">
              <MessageSquare size={18} />
            </span>
          </div>
          <div className="manager-kpi-value" style={{ color: "#1D4ED8" }}>
            {inProgressCount}
          </div>
          <div className="manager-kpi-footer">
            <span>Staff actively handling</span>
          </div>
        </div>

        <div className="manager-kpi-card">
          <div className="manager-kpi-header">
            <span className="manager-kpi-title">Resolved</span>
            <span className="manager-kpi-icon icon-green">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <div className="manager-kpi-value" style={{ color: "#15803D" }}>
            {resolvedCount}
          </div>
          <div className="manager-kpi-footer">
            <span>Closed customer issues</span>
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
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {filterTabs.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#F4F5F0",
            border: "1px solid #E5E4DA",
            borderRadius: "10px",
            padding: "7px 12px",
            minWidth: "240px",
          }}
        >
          <Search size={16} color="#697064" />
          <input
            placeholder="Search ticket, order, keywords..."
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

      {/* Tickets List */}
      {loading ? (
        <div
          className="manager-card"
          style={{ textAlign: "center", padding: "48px 20px", color: "#697064" }}
        >
          Loading tickets...
        </div>
      ) : filteredTickets.length === 0 ? (
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
            <LifeBuoy size={24} />
          </div>
          <h3
            style={{
              margin: "0 0 6px",
              fontSize: "17px",
              fontWeight: 800,
              color: "#263C2E",
            }}
          >
            No tickets found
          </h3>
          <p style={{ margin: 0, fontSize: "13px" }}>
            {statusFilter !== "all" || search
              ? "No tickets match your active filter or search."
              : "Great job! There are currently no customer inquiries pending."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {filteredTickets.map((ticket) => {
            const edit = edits[ticket.id] || {
              status: ticket.status,
              priority: ticket.priority,
              manager_notes: ticket.manager_notes || "",
            };
            const statusStyle = getStatusStyle(ticket.status);
            const priorityBadge = getPriorityBadge(ticket.priority);

            return (
              <article key={ticket.id} className="manager-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "14px",
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
                        {ticket.subject}
                      </h2>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`,
                          textTransform: "capitalize",
                        }}
                      >
                        {statusOptions.find((o) => o.value === ticket.status)?.label ||
                          ticket.status}
                      </span>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: priorityBadge.bg,
                          color: priorityBadge.color,
                          textTransform: "capitalize",
                        }}
                      >
                        {ticket.priority || "Normal"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        flexWrap: "wrap",
                        fontSize: "12px",
                        color: "#697064",
                      }}
                    >
                      <span>
                        <strong>Ticket #{ticket.id}</strong>
                        {ticket.order_id ? ` · Order #${ticket.order_id}` : ""}
                      </span>
                      <span>· Category: {categoryLabels[ticket.category] || ticket.category}</span>
                      <span>
                        · Submitted: {new Date(ticket.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ticket Message Body */}
                <div style={{ padding: "16px 0" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13.5px",
                      lineHeight: 1.6,
                      color: "#384033",
                      whiteSpace: "pre-wrap",
                      background: "#F9FAF7",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "1px solid #ECEEE5",
                    }}
                  >
                    {ticket.description}
                  </p>

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "11.5px",
                      color: "#697064",
                    }}
                  >
                    Customer Reference ID:{" "}
                    <code style={{ background: "#EAECE4", padding: "1px 4px", borderRadius: "4px" }}>
                      {ticket.customer_id}
                    </code>
                  </p>
                </div>

                {/* Manager Controls: Status, Priority, Staff Notes */}
                <div
                  style={{
                    background: "#F4F5F0",
                    border: "1px solid #E5E4DA",
                    borderRadius: "12px",
                    padding: "16px",
                    marginTop: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "14px",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <label
                        htmlFor={`ticket-status-${ticket.id}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#263C2E",
                        }}
                      >
                        Status
                      </label>
                      <select
                        id={`ticket-status-${ticket.id}`}
                        value={edit.status}
                        onChange={(e) => updateEdit(ticket.id, "status", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #D5DCD0",
                          background: "#ffffff",
                          fontSize: "13px",
                          color: "#263C2E",
                          fontWeight: 600,
                        }}
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`ticket-priority-${ticket.id}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#263C2E",
                        }}
                      >
                        Priority Level
                      </label>
                      <select
                        id={`ticket-priority-${ticket.id}`}
                        value={edit.priority}
                        onChange={(e) => updateEdit(ticket.id, "priority", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #D5DCD0",
                          background: "#ffffff",
                          fontSize: "13px",
                          color: "#263C2E",
                          fontWeight: 600,
                        }}
                      >
                        {priorityOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`ticket-notes-${ticket.id}`}
                      style={{
                        display: "block",
                        marginBottom: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#263C2E",
                      }}
                    >
                      Manager Resolution Notes / Customer Response
                    </label>
                    <textarea
                      id={`ticket-notes-${ticket.id}`}
                      rows={3}
                      value={edit.manager_notes}
                      onChange={(e) => updateEdit(ticket.id, "manager_notes", e.target.value)}
                      placeholder="Add internal resolution comments or response notes for customer..."
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #D5DCD0",
                        background: "#ffffff",
                        fontSize: "13px",
                        color: "#263C2E",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "12px",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "11.5px", color: "#697064" }}>
                      Last updated:{" "}
                      {new Date(ticket.updated_at || ticket.created_at).toLocaleString("en-IN")}
                    </span>

                    <button
                      type="button"
                      className="manager-btn-primary"
                      onClick={() => saveTicket(ticket)}
                      disabled={savingId === ticket.id}
                      style={{ padding: "8px 16px", fontSize: "12.5px" }}
                    >
                      <Send size={14} />
                      <span>{savingId === ticket.id ? "Saving..." : "Save Updates"}</span>
                    </button>
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
