import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  UtensilsCrossed,
  ShoppingBag,
  LifeBuoy,
  LogOut,
  Menu,
  X,
  Sparkles,
  RefreshCw,
  Clock,
  ShoppingCart,
  ChevronRight,
  Zap,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  subscribeToHappyHours,
  isHappyHourActive,
  DEFAULT_HAPPY_HOURS,
} from "../lib/happyHourService";

export default function CustomerLayout({
  children,
  title,
  subtitle,
  actions,
  breadcrumbs = [],
  onRefresh,
  refreshing = false,
  cartCount = 0,
  cartTotal = 0,
  activeMealInfo = null,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [happyHour, setHappyHour] = useState(DEFAULT_HAPPY_HOURS);
  const [userProfile, setUserProfile] = useState({
    email: "customer@cravely.com",
    role: "Customer",
  });
  const [counts, setCounts] = useState({
    activeOrders: 0,
    openTickets: 0,
  });

  useEffect(() => {
    const unsub = subscribeToHappyHours((data) => {
      setHappyHour(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCustomerBadges() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !active) return;

        setUserProfile({
          email: user.email || "customer@cravely.com",
          role: "Customer",
        });

        const [ordersRes, ticketsRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, status")
            .eq("customer_id", user.id)
            .not("status", "in", '("completed","cancelled","rejected")'),
          supabase
            .from("tickets")
            .select("id, status")
            .eq("customer_id", user.id)
            .in("status", ["open", "in_progress"]),
        ]);

        if (!active) return;

        setCounts({
          activeOrders: ordersRes.data?.length || 0,
          openTickets: ticketsRes.data?.length || 0,
        });
      } catch (err) {
        console.error("Customer badge load error:", err);
      }
    }

    loadCustomerBadges();
    const interval = setInterval(loadCustomerBadges, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    if (window.confirm("Are you sure you want to log out of Cravely?")) {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }
  }

  const isHHActive = isHappyHourActive(happyHour);

  const navItems = [
    {
      name: "Browse Menu",
      path: "/customer",
      icon: UtensilsCrossed,
      badge: cartCount > 0 ? `${cartCount} in cart` : null,
      badgeType: "accent",
    },
    {
      name: "My Orders",
      path: "/my-orders",
      icon: ShoppingBag,
      badge: counts.activeOrders > 0 ? `${counts.activeOrders} active` : null,
      badgeType: "warning",
    },
    {
      name: "Support & Help",
      path: "/my-tickets",
      icon: LifeBuoy,
      badge: counts.openTickets > 0 ? counts.openTickets : null,
      badgeType: "info",
    },
  ];

  return (
    <div className="customer-shell">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="customer-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Customer Sidebar */}
      <aside
        className={`customer-sidebar ${mobileMenuOpen ? "drawer-open" : ""}`}
      >
        {/* Brand Header */}
        <div className="customer-sidebar-brand">
          <Link to="/customer" className="customer-brand-link">
            <span className="customer-brand-mark">
              <Sparkles size={20} strokeWidth={2.5} />
            </span>
            <div className="customer-brand-text">
              <span className="customer-brand-title">
                Crave<span>ly</span>
              </span>
              <span className="customer-brand-badge">FOOD ORDERING</span>
            </div>
          </Link>
          <button
            type="button"
            className="customer-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Meal Period / Kitchen Status Indicator */}
        <div className="customer-status-indicator">
          <span className="customer-live-dot" />
          <div className="customer-status-text">
            <strong>
              {activeMealInfo?.label
                ? `${activeMealInfo.label} Menu Open`
                : "Kitchen Open"}
            </strong>
            <small>
              {activeMealInfo?.subtext || "Freshly cooked food available"}
            </small>
          </div>
        </div>

        {/* Happy Hours Live Notice in Sidebar */}
        {isHHActive && (
          <div
            style={{
              margin: "0 14px 14px",
              padding: "10px 14px",
              borderRadius: "12px",
              background:
                "linear-gradient(135deg, rgba(198, 94, 56, 0.28) 0%, rgba(217, 119, 6, 0.22) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Zap size={18} color="#FBBF24" />
            <div>
              <strong
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "#FDE68A",
                }}
              >
                Happy Hours: {happyHour.discountPercent}% OFF!
              </strong>
              <small style={{ fontSize: "10.5px", color: "#EAD6CC" }}>
                Discount applied across menu
              </small>
            </div>
          </div>
        )}

        {/* Navigation List */}
        <nav className="customer-nav">
          <p className="customer-nav-heading">EXPLORE</p>
          <ul className="customer-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`customer-nav-item ${isActive ? "active" : ""}`}
                  >
                    <Icon className="customer-nav-icon" size={19} />
                    <span className="customer-nav-label">{item.name}</span>
                    {item.badge !== null && (
                      <span
                        className={`customer-nav-pill ${
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

          {/* Quick Cart Box in Sidebar if items in cart */}
          {cartCount > 0 && location.pathname !== "/customer" && (
            <div className="customer-sidebar-cart-box">
              <div className="cart-box-header">
                <ShoppingCart size={16} />
                <strong>Your Current Cart</strong>
              </div>
              <p>
                {cartCount} {cartCount === 1 ? "item" : "items"} selected (₹
                {Number(cartTotal).toLocaleString("en-IN")})
              </p>
              <Link to="/customer" className="cart-box-btn">
                <span>View Cart & Checkout</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          )}
        </nav>

        {/* Sidebar Footer with Profile & Logout */}
        <div className="customer-sidebar-footer">
          <div className="customer-user-card">
            <div className="customer-user-avatar">
              {userProfile.email.charAt(0).toUpperCase()}
            </div>
            <div className="customer-user-info">
              <strong className="customer-user-name" title={userProfile.email}>
                {userProfile.email.split("@")[0]}
              </strong>
              <span className="customer-user-role">Customer Account</span>
            </div>
          </div>
          <button
            type="button"
            className="customer-logout-btn"
            onClick={handleLogout}
            title="Log out of Cravely"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrap */}
      <div className="customer-main-wrap">
        {/* Top Header Bar */}
        <header className="customer-topbar">
          <div className="customer-topbar-left">
            <button
              type="button"
              className="customer-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <Menu size={22} />
            </button>

            <div className="customer-breadcrumbs">
              <Link to="/customer">Cravely</Link>
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
                <span className="current">{title || "Food Delivery"}</span>
              )}
            </div>
          </div>

          <div className="customer-topbar-right">
            {/* Happy Hours Live Topbar Pill */}
            {isHHActive && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                  border: "1px solid #FCD34D",
                  color: "#92400E",
                  fontSize: "12px",
                  fontWeight: 800,
                  boxShadow: "0 2px 8px rgba(217, 119, 6, 0.15)",
                }}
              >
                <Zap size={14} color="#D97706" />
                <span>⚡ {happyHour.discountPercent}% OFF HAPPY HOURS ACTIVE</span>
              </div>
            )}

            {activeMealInfo && (
              <div className="customer-meal-pill">
                <Clock size={13} />
                <span>{activeMealInfo.badgeText}</span>
              </div>
            )}

            {onRefresh && (
              <button
                type="button"
                className="customer-topbar-btn"
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh menu or orders"
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "spin-animation" : ""}
                />
                <span className="btn-text">
                  {refreshing ? "Updating..." : "Refresh"}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Page Content Container */}
        <main className="customer-content">
          {(title || actions) && (
            <div className="customer-page-header">
              <div className="customer-page-header-text">
                <span className="customer-section-tag">CRAVELY DINING</span>
                <h1 className="customer-page-title">{title}</h1>
                {subtitle && (
                  <p className="customer-page-subtitle">{subtitle}</p>
                )}
              </div>
              {actions && (
                <div className="customer-page-actions">{actions}</div>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
