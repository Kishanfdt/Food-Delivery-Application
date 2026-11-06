import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  LifeBuoy,
  ArrowRight,
} from "lucide-react";
import ManagerLayout from "../components/ManagerLayout";

const sections = [
  {
    title: "Executive Dashboard",
    description:
      "Monitor daily revenue trends, sales breakdown, active orders, and inventory health in real-time.",
    path: "/dashboard",
    icon: LayoutDashboard,
    badge: "Analytics",
    color: "#28734F",
    bg: "#EAF1E7",
  },
  {
    title: "Menu & Dish Inventory",
    description:
      "Add categories, configure meal periods (Breakfast, Lunch, Dinner), adjust prices, and toggle portions.",
    path: "/categories",
    icon: UtensilsCrossed,
    badge: "Catalog",
    color: "#C65E38",
    bg: "#FFF1EB",
  },
  {
    title: "Kitchen Order Management",
    description:
      "Review incoming customer tickets, update fulfillment stages (Preparing, Ready, Completed), and handle cancelations.",
    path: "/orders",
    icon: ShoppingBag,
    badge: "Fulfillment",
    color: "#92400E",
    bg: "#FEF3C7",
  },
  {
    title: "Customer Support Tickets",
    description:
      "Review customer queries, investigate order issues, adjust priority levels, and document staff resolutions.",
    path: "/tickets",
    icon: LifeBuoy,
    badge: "Support",
    color: "#1E40AF",
    bg: "#DBEAFE",
  },
];

export default function ManagerHome() {
  const navigate = useNavigate();

  return (
    <ManagerLayout
      title="Manager Workspace Hub"
      subtitle="Welcome to your Cravely restaurant control center. Choose an operational sector below or use the sidebar to navigate."
      actions={
        <button
          type="button"
          className="manager-btn-primary"
          onClick={() => navigate("/dashboard")}
        >
          <LayoutDashboard size={16} />
          <span>Go to Live Dashboard</span>
        </button>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: "20px",
          marginTop: "8px",
        }}
      >
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <button
              type="button"
              key={section.path}
              onClick={() => navigate(section.path)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "26px",
                border: "1px solid #E5E4DA",
                borderRadius: "18px",
                background: "#ffffff",
                color: "#252820",
                textAlign: "left",
                cursor: "pointer",
                boxShadow: "0 3px 14px rgba(38, 60, 46, 0.035)",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "#AAB8A0";
                e.currentTarget.style.boxShadow =
                  "0 12px 30px rgba(38, 60, 46, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.borderColor = "#E5E4DA";
                e.currentTarget.style.boxShadow =
                  "0 3px 14px rgba(38, 60, 46, 0.035)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: section.bg,
                    color: section.color,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon size={22} strokeWidth={2.2} />
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    background: "#F4F5F0",
                    color: "#697064",
                    padding: "4px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {section.badge}
                </span>
              </div>

              <h2
                style={{
                  margin: "0 0 8px",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: "19px",
                  fontWeight: 800,
                  color: "#263C2E",
                }}
              >
                {section.title}
              </h2>

              <p
                style={{
                  margin: "0 0 20px",
                  fontSize: "13.5px",
                  lineHeight: 1.6,
                  color: "#697064",
                  flex: 1,
                }}
              >
                {section.description}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  paddingTop: "14px",
                  borderTop: "1px solid #F0F2EB",
                  color: "#263C2E",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <span>Launch Department</span>
                <ArrowRight size={16} />
              </div>
            </button>
          );
        })}
      </div>
    </ManagerLayout>
  );
}
