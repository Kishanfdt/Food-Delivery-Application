import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  LifeBuoy,
  Home,
  LogOut,
  Menu,
  X,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Zap,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  subscribeToHappyHours,
  isHappyHourActive,
  DEFAULT_HAPPY_HOURS,
} from "../lib/happyHourService";
import HappyHourControlModal from "./HappyHourControlModal";

export default function ManagerLayout({
  children,
  title,
  subtitle,
  actions,
  breadcrumbs = [],
  onRefresh,
  refreshing = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [happyHourModalOpen, setHappyHourModalOpen] = useState(false);
  const [happyHour, setHappyHour] = useState(DEFAULT_HAPPY_HOURS);
  const [counts, setCounts] = useState({
    pendingOrders: 0,
    openTickets: 0,
    lowStock: 0,
  });
  const [userProfile, setUserProfile] = useState({
    email: "manager@cravely.com",
    role: "Manager",
  });

  // Subscribe to live Happy Hours
  useEffect(() => {
    const unsubscribe = subscribeToHappyHours((settings) => {
      setHappyHour(settings);
    });
    return () => unsubscribe();
  }, []);

  // Fetch quick badge counters for sidebar
  useEffect(() => {
    let active = true;

    async function loadSidebarBadges() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && active) {
          setUserProfile({
            email: user.email || "manager@cravely.com",
            role: "Store Manager",
          });
        }

        const [ordersRes, ticketsRes, foodsRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, status")
            .not("status", "in", '("completed","cancelled","rejected")'),
          supabase
            .from("tickets")
            .select("id, status")
            .in("status", ["open", "in_progress"]),
          supabase
            .from("food_items")
            .select("id, available_quantity, low_stock_threshold"),
        ]);

        if (!active) return;

        const pendingOrders = ordersRes.data?.length || 0;
        const openTickets = ticketsRes.data?.length || 0;
        const lowStock = (foodsRes.data || []).filter((food) => {
          const qty = Number(food.available_quantity ?? 0);
          const threshold = Number(food.low_stock_threshold ?? 5);
          return qty <= threshold;
        }).length;

        setCounts({
          pendingOrders,
          openTickets,
          lowStock,
        });
      } catch (err) {
        console.error("Sidebar badge load error:", err);
      }
    }

    loadSidebarBadges();
    const interval = setInterval(loadSidebarBadges, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    if (window.confirm("Are you sure you want to log out of Cravely Manager?")) {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }
  }

  const isHHActive = isHappyHourActive(happyHour);

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      badge: null,
      description: "Live stats & sales",
    },
    {
      name: "Menu & Categories",
      path: "/categories",
      icon: UtensilsCrossed,
      badge: counts.lowStock > 0 ? `${counts.lowStock} low` : null,
      badgeType: "warning",
      description: "Dishes, prices & stock",
    },
    {
      name: "Orders",
      path: "/orders",
      icon: ShoppingBag,
      badge: counts.pendingOrders > 0 ? counts.pendingOrders : null,
      badgeType: "accent",
      description: "Active customer orders",
    },
    {
      name: "Tickets",
      path: "/tickets",
      icon: LifeBuoy,
      badge: counts.openTickets > 0 ? counts.openTickets : null,
      badgeType: "info",
      description: "Customer service requests",
    },
    {
      name: "Overview Hub",
      path: "/manager",
      icon: Home,
      badge: null,
      description: "Quick section index",
    },
  ];

  return (
    <div className="manager-shell">
      {/* Happy Hours Control Modal */}
      <HappyHourControlModal
        isOpen={happyHourModalOpen}
        onClose={() => setHappyHourModalOpen(false)}
        onUpdated={(updated) => setHappyHour(updated)}
      />

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="manager-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Modern Sidebar */}
      <aside className={`manager-sidebar ${mobileMenuOpen ? "drawer-open" : ""}`}>
        {/* Brand Header */}
        <div className="manager-sidebar-brand">
          <Link to="/dashboard" className="manager-brand-link">
            <span className="manager-brand-mark">
              <Sparkles size={20} strokeWidth={2.5} />
            </span>
            <div className="manager-brand-text">
              <span className="manager-brand-title">
                Crave<span>ly</span>
              </span>
              <span className="manager-brand-badge">MANAGER</span>
            </div>
          </Link>
          <button
            type="button"
            className="manager-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Operational Pill */}
        <div className="manager-status-indicator">
          <span className="manager-live-dot" />
          <div className="manager-status-text">
            <strong>Kitchen Online</strong>
            <small>Accepting Orders</small>
          </div>
        </div>

        {/* Happy Hours Quick Status Card in Sidebar */}
        <div
          onClick={() => setHappyHourModalOpen(true)}
          style={{
            margin: "0 14px 14px",
            padding: "10px 14px",
            borderRadius: "12px",
            background: isHHActive ? "rgba(217, 119, 6, 0.18)" : "rgba(255, 255, 255, 0.05)",
            border: isHHActive
              ? "1px solid rgba(245, 158, 11, 0.4)"
              : "1px solid rgba(255, 255, 255, 0.08)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.18s ease",
          }}
          title="Click to toggle or configure Happy Hours"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={16} color={isHHActive ? "#FBBF24" : "#9CB497"} />
            <div>
              <strong
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: isHHActive ? "#FDE68A" : "#FFFFFF",
                }}
              >
                {isHHActive
                  ? `Happy Hours (${happyHour.discountPercent}%)`
                  : "Happy Hours: Off"}
              </strong>
              <small style={{ fontSize: "10.5px", color: "#A8BCA5" }}>
                {isHHActive ? "Broadcasting live" : "Click to activate"}
              </small>
            </div>
          </div>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "999px",
              fontSize: "10px",
              fontWeight: 800,
              background: isHHActive ? "#D97706" : "rgba(255, 255, 255, 0.1)",
              color: "#FFFFFF",
            }}
          >
            {isHHActive ? "ON" : "OFF"}
          </span>
        </div>

        {/* Main Navigation */}
        <nav className="manager-nav">
          <p className="manager-nav-heading">MAIN MENU</p>
          <ul className="manager-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/manager" && location.pathname.startsWith(item.path));

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`manager-nav-item ${isActive ? "active" : ""}`}
                  >
                    <Icon className="manager-nav-icon" size={19} />
                    <div className="manager-nav-content">
                      <span className="manager-nav-label">{item.name}</span>
                    </div>
                    {item.badge !== null && (
                      <span
                        className={`manager-nav-pill ${
                          item.badgeType ? `pill-${item.badgeType}` : ""
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="manager-nav-heading" style={{ marginTop: "24px" }}>
            SHORTCUTS
          </p>
          <div className="manager-sidebar-shortcuts">
            <button
              type="button"
              className="manager-quick-action"
              onClick={() => setHappyHourModalOpen(true)}
              style={{
                border: 0,
                textAlign: "left",
                width: "100%",
                cursor: "pointer",
              }}
            >
              <span>⚡ Set Happy Hours</span>
              <ExternalLink size={14} />
            </button>
            <Link to="/categories" className="manager-quick-action">
              <span>+ Add Dish / Category</span>
              <ExternalLink size={14} />
            </Link>
            <Link to="/orders" className="manager-quick-action">
              <span>View Kitchen Orders</span>
              <ExternalLink size={14} />
            </Link>
          </div>
        </nav>

        {/* Sidebar Footer with Manager Profile & Logout */}
        <div className="manager-sidebar-footer">
          <div className="manager-user-card">
            <div className="manager-user-avatar">
              {userProfile.email.charAt(0).toUpperCase()}
            </div>
            <div className="manager-user-info">
              <strong className="manager-user-name" title={userProfile.email}>
                {userProfile.email.split("@")[0]}
              </strong>
              <span className="manager-user-role">{userProfile.role}</span>
            </div>
          </div>
          <button
            type="button"
            className="manager-logout-btn"
            onClick={handleLogout}
            title="Log out of Manager"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="manager-main-wrap">
        {/* Top Header Bar */}
        <header className="manager-topbar">
          <div className="manager-topbar-left">
            <button
              type="button"
              className="manager-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <Menu size={22} />
            </button>

            <div className="manager-breadcrumbs">
              <Link to="/dashboard">Cravely</Link>
              <span>/</span>
              {breadcrumbs.length > 0 ? (
                breadcrumbs.map((crumb, idx) => (
                  <span key={idx} className="crumb-segment">
                    {crumb.path ? (
                      <Link to={crumb.path}>{crumb.label}</Link>
                    ) : (
                      <span className="current">{crumb.label}</span>
                    )}
                    {idx < breadcrumbs.length - 1 && <span>/</span>}
                  </span>
                ))
              ) : (
                <span className="current">{title || "Workspace"}</span>
              )}
            </div>
          </div>

          <div className="manager-topbar-right">
            {/* Happy Hours Toggle Pill */}
            <button
              type="button"
              onClick={() => setHappyHourModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "7px 13px",
                borderRadius: "999px",
                border: isHHActive ? "1px solid #FCD34D" : "1px solid #E5E4DA",
                background: isHHActive ? "#FFFBEB" : "#ffffff",
                color: isHHActive ? "#92400E" : "#4A5244",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: isHHActive ? "0 2px 8px rgba(217, 119, 6, 0.15)" : "none",
                transition: "all 0.18s ease",
              }}
              title="Click to manage Happy Hours discounts"
            >
              <Zap size={14} color={isHHActive ? "#D97706" : "#697064"} />
              <span>
                {isHHActive
                  ? `Happy Hours: ${happyHour.discountPercent}% OFF`
                  : "Happy Hours: Off"}
              </span>
            </button>

            {onRefresh && (
              <button
                type="button"
                className="manager-topbar-btn"
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh page data"
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "spin-animation" : ""}
                />
                <span className="btn-text">
                  {refreshing ? "Refreshing..." : "Refresh"}
                </span>
              </button>
            )}

            <div className="manager-topbar-pill">
              <span className="pulse-dot" />
              <span>Manager Session</span>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="manager-content">
          {(title || actions) && (
            <div className="manager-page-header">
              <div className="manager-page-header-text">
                <span className="manager-section-tag">RESTAURANT MANAGEMENT</span>
                <h1 className="manager-page-title">{title}</h1>
                {subtitle && (
                  <p className="manager-page-subtitle">{subtitle}</p>
                )}
              </div>
              {actions && (
                <div className="manager-page-actions">{actions}</div>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
