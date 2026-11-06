import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
  Send,
  MessageSquare,
  HelpCircle,
  Utensils,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerLayout from "../components/CustomerLayout";

const categories = [
  { value: "general", label: "General Inquiry" },
  { value: "order_issue", label: "Order Issue" },
  { value: "food_quality", label: "Food Quality" },
  { value: "payment", label: "Payment / Refund" },
  { value: "other", label: "Other" },
];

function getStatusStyle(status) {
  switch (status) {
    case "open":
      return { bg: "#FEF3C7", color: "#92400E", label: "Under Review" };
    case "in_progress":
      return { bg: "#DBEAFE", color: "#1E40AF", label: "Staff Working on it" };
    case "resolved":
      return { bg: "#DCFCE7", color: "#166534", label: "Resolved" };
    case "rejected":
      return { bg: "#FEE2E2", color: "#991B1B", label: "Closed" };
    default:
      return { bg: "#F4F5F0", color: "#697064", label: status || "Open" };
  }
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
      setError(err.message || "Unable to load support tickets.");
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
      const { error: insertError } = await supabase.from("tickets").insert({
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
      setNotice("Your support inquiry was received! We will look into it promptly.");
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to submit your ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerLayout
      title="Help & Customer Care"
      subtitle="Have an inquiry regarding food quality, payment, or orders? Send a ticket to our staff."
      onRefresh={loadData}
      refreshing={loading}
      actions={
        <button
          type="button"
          className="customer-btn-primary"
          onClick={() => navigate("/customer")}
        >
          <Utensils size={15} />
          <span>Browse Menu</span>
        </button>
      }
    >
      {/* Alert Notices */}
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

      {/* Ticket Creation Card */}
      <section className="customer-card" style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "#EAF1E7",
              color: "#263C2E",
              display: "grid",
              placeItems: "center",
            }}
          >
            <HelpCircle size={18} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 800,
                color: "#263C2E",
              }}
            >
              Submit Support Request
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#697064" }}>
              Our restaurant manager will review your submission and provide an update.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                htmlFor="ticket-subject"
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "#263C2E",
                }}
              >
                Subject
              </label>
              <input
                id="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your inquiry"
                minLength={3}
                maxLength={150}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: "9px",
                  border: "1px solid #D5DCD0",
                  fontSize: "13px",
                  background: "#ffffff",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="ticket-category"
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "#263C2E",
                }}
              >
                Inquiry Category
              </label>
              <select
                id="ticket-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "9px",
                  border: "1px solid #D5DCD0",
                  fontSize: "13px",
                  background: "#ffffff",
                }}
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ticket-order"
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "#263C2E",
                }}
              >
                Related Order (Optional)
              </label>
              <select
                id="ticket-order"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "9px",
                  border: "1px solid #D5DCD0",
                  fontSize: "13px",
                  background: "#ffffff",
                }}
              >
                <option value="">No order selected</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    Order #{String(order.id).slice(0, 8)} (
                    {order.status || "Submitted"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="ticket-description"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#263C2E",
              }}
            >
              Message / Details
            </label>
            <textarea
              id="ticket-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe how we can assist you..."
              minLength={5}
              maxLength={3000}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px",
                borderRadius: "9px",
                border: "1px solid #D5DCD0",
                fontSize: "13px",
                background: "#ffffff",
                resize: "vertical",
              }}
            />
          </div>

          <button
            type="submit"
            className="customer-btn-accent"
            disabled={submitting}
          >
            <Send size={15} />
            <span>{submitting ? "Sending..." : "Submit Inquiry"}</span>
          </button>
        </form>
      </section>

      {/* Ticket History Section */}
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "19px",
                fontWeight: 800,
                color: "#263C2E",
              }}
            >
              Inquiry History
            </h2>
            <span style={{ fontSize: "12.5px", color: "#697064" }}>
              {tickets.length} total request{tickets.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {loading ? (
          <div
            className="customer-card"
            style={{ textAlign: "center", padding: "40px", color: "#697064" }}
          >
            Loading your tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div
            className="customer-card"
            style={{ textAlign: "center", padding: "48px 20px", color: "#697064" }}
          >
            <MessageSquare size={32} style={{ margin: "0 auto 10px", opacity: 0.6 }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "17px", color: "#263C2E" }}>
              No inquiries yet
            </h3>
            <p style={{ margin: 0, fontSize: "13px" }}>
              If you have any questions or feedback, submit a ticket above.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {tickets.map((ticket) => {
              const statusStyle = getStatusStyle(ticket.status);

              return (
                <article key={ticket.id} className="customer-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: "0 0 4px",
                          fontSize: "17px",
                          fontWeight: 800,
                          color: "#263C2E",
                        }}
                      >
                        {ticket.subject}
                      </h3>
                      <span style={{ fontSize: "12px", color: "#697064" }}>
                        Ticket #{ticket.id} · Submitted{" "}
                        {new Date(ticket.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "999px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        background: statusStyle.bg,
                        color: statusStyle.color,
                      }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: "13.5px",
                      lineHeight: 1.6,
                      color: "#384033",
                      whiteSpace: "pre-wrap",
                      background: "#F9FAF7",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid #ECEEE5",
                    }}
                  >
                    {ticket.description}
                  </p>

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
                      <strong>Category:</strong>{" "}
                      {categories.find((c) => c.value === ticket.category)?.label ||
                        ticket.category}
                    </span>
                    {ticket.order_id && (
                      <span>
                        <strong>Order Ref:</strong> #{ticket.order_id}
                      </span>
                    )}
                  </div>

                  {ticket.manager_notes && (
                    <div
                      style={{
                        marginTop: "14px",
                        padding: "14px 16px",
                        borderRadius: "10px",
                        background: "#EAF1E7",
                        border: "1px solid #D5E2CE",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          fontSize: "12px",
                          color: "#263C2E",
                          marginBottom: "4px",
                        }}
                      >
                        Restaurant Staff Response:
                      </strong>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#252D26",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5,
                        }}
                      >
                        {ticket.manager_notes}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </CustomerLayout>
  );
}
