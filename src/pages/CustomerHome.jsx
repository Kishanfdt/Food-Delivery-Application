import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  Utensils,
  Zap,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerLayout from "../components/CustomerLayout";
import {
  subscribeToHappyHours,
  isHappyHourActive,
  getDiscountedPrice,
  DEFAULT_HAPPY_HOURS,
} from "../lib/happyHourService";
import "../App.css";

const MEAL_SCHEDULE = [
  { meal: "breakfast", start: 6 * 60, end: 11 * 60, label: "Breakfast", hours: "6:00 AM – 11:00 AM" },
  { meal: "lunch", start: 11 * 60, end: 16 * 60, label: "Lunch", hours: "11:00 AM – 4:00 PM" },
  { meal: "dinner", start: 18 * 60, end: 23 * 60, label: "Dinner", hours: "6:00 PM – 11:00 PM" },
];

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

function getIndiaTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour").value);
  const minute = Number(parts.find((part) => part.type === "minute").value);

  return {
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  };
}

function getActiveMeal() {
  const { totalMinutes } = getIndiaTime();
  return (
    MEAL_SCHEDULE.find(
      (period) => totalMinutes >= period.start && totalMinutes < period.end
    )?.meal || null
  );
}

function getNextMealMessage() {
  const { totalMinutes } = getIndiaTime();

  if (totalMinutes >= 0 && totalMinutes < 6 * 60) {
    return "Kitchen is currently closed. Breakfast service begins at 6:00 AM.";
  }
  if (totalMinutes >= 16 * 60 && totalMinutes < 18 * 60) {
    return "Afternoon prep interval. Dinner service starts promptly at 6:00 PM.";
  }
  if (totalMinutes >= 23 * 60) {
    return "Kitchen is closed for the night. Breakfast service begins tomorrow at 6:00 AM.";
  }
  return "The menu is currently between services.";
}

function getNextMealStart() {
  const { totalMinutes } = getIndiaTime();
  if (totalMinutes < 6 * 60 || totalMinutes >= 23 * 60) {
    return "6:00 AM";
  }
  if (totalMinutes >= 16 * 60 && totalMinutes < 18 * 60) {
    return "6:00 PM";
  }
  return "";
}

export default function CustomerHome() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState({});
  const [orderType, setOrderType] = useState("takeaway");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);
  const [activeMeal, setActiveMeal] = useState(() => getActiveMeal());
  const [indiaTime, setIndiaTime] = useState(() => getIndiaTime());
  const [lastMenuRefresh, setLastMenuRefresh] = useState(null);
  const [happyHour, setHappyHour] = useState(DEFAULT_HAPPY_HOURS);

  // Subscribe to live Happy Hours settings
  useEffect(() => {
    const unsub = subscribeToHappyHours((settings) => {
      setHappyHour(settings);
    });
    return () => unsub();
  }, []);

  const isHappyActive = useMemo(() => {
    if (!indiaTime) return false;
    return isHappyHourActive(happyHour);
  }, [happyHour, indiaTime]);
  const discountPercent = isHappyActive ? Number(happyHour.discountPercent || 0) : 0;

  useEffect(() => {
    let active = true;

    async function loadMenu(showLoading = false) {
      if (showLoading && active) {
        setLoading(true);
      }

      try {
        const [categoryResult, dishResult] = await Promise.all([
          supabase
            .from("food_categories")
            .select("id, name, description, image_url, meal_period")
            .order("name"),
          supabase
            .from("food_items")
            .select(
              "id, name, category, category_id, description, price, image_url, is_available, preparation_time, available_quantity, low_stock_threshold"
            )
            .order("name"),
        ]);

        if (!active) return;
        if (categoryResult.error) throw categoryResult.error;
        if (dishResult.error) throw dishResult.error;

        setCategories(categoryResult.data || []);
        setDishes(dishResult.data || []);
        setLastMenuRefresh(new Date());
      } catch (err) {
        if (active) setError(err.message || "Unable to load menu.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMenu(true);

    const refreshInterval = setInterval(() => {
      if (active) {
        setIndiaTime(getIndiaTime());
        setActiveMeal(getActiveMeal());
        loadMenu(false);
      }
    }, 30000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && active) {
        setIndiaTime(getIndiaTime());
        setActiveMeal(getActiveMeal());
        loadMenu(false);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const menuChannel = supabase
      .channel("customer-menu-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "food_categories" },
        () => {
          if (active) loadMenu(false);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "food_items" },
        () => {
          if (active) loadMenu(false);
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(refreshInterval);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      supabase.removeChannel(menuChannel);
    };
  }, []);

  const mealCategories = useMemo(() => {
    if (!activeMeal) return [];
    return categories.filter((category) => category.meal_period === activeMeal);
  }, [categories, activeMeal]);

  const availableDishes = useMemo(() => {
    const mealCategoryIds = new Set(
      mealCategories.map((category) => String(category.id))
    );

    return dishes.filter((dish) => {
      const belongsToMeal =
        dish.category_id != null
          ? mealCategoryIds.has(String(dish.category_id))
          : mealCategories.some(
              (category) =>
                category.name.trim().toLowerCase() ===
                (dish.category || "").trim().toLowerCase()
            );

      return (
        belongsToMeal &&
        dish.is_available !== false &&
        Number(dish.available_quantity ?? 0) > 0
      );
    });
  }, [dishes, mealCategories]);

  useEffect(() => {
    if (
      selectedCategory !== "All" &&
      !mealCategories.some(
        (category) => String(category.id) === String(selectedCategory)
      )
    ) {
      setSelectedCategory("All");
    }

    setCart((current) => {
      const updated = { ...current };
      let changed = false;

      for (const [dishId, quantity] of Object.entries(updated)) {
        const dish = availableDishes.find(
          (item) => String(item.id) === String(dishId)
        );

        if (!dish) {
          delete updated[dishId];
          changed = true;
          continue;
        }

        if (quantity > Number(dish.available_quantity)) {
          updated[dishId] = Number(dish.available_quantity);
          changed = true;
        }

        if (updated[dishId] <= 0) {
          delete updated[dishId];
          changed = true;
        }
      }

      return changed ? updated : current;
    });
  }, [mealCategories, availableDishes, selectedCategory]);

  const visibleDishes = useMemo(() => {
    if (selectedCategory === "All") {
      return availableDishes;
    }
    return availableDishes.filter(
      (dish) => String(dish.category_id) === String(selectedCategory)
    );
  }, [availableDishes, selectedCategory]);

  const cartItems = useMemo(
    () =>
      availableDishes
        .filter((dish) => (cart[dish.id] || 0) > 0)
        .map((dish) => ({
          ...dish,
          quantity: cart[dish.id],
        })),
    [availableDishes, cart]
  );

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const rawSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + Number(item.price) * item.quantity,
        0
      ),
    [cartItems]
  );

  const happyHourSavings = useMemo(() => {
    if (!isHappyActive || discountPercent <= 0) return 0;
    return cartItems.reduce((sum, item) => {
      const orig = Number(item.price);
      const discounted = getDiscountedPrice(orig, discountPercent);
      return sum + (orig - discounted) * item.quantity;
    }, 0);
  }, [cartItems, isHappyActive, discountPercent]);

  const subtotal = Math.max(0, rawSubtotal - happyHourSavings);

  function changeQuantity(dish, change) {
    setCart((current) => {
      const nextQuantity = (current[dish.id] || 0) + change;
      const availableQuantity = Number(dish.available_quantity ?? 0);
      const updated = { ...current };

      if (nextQuantity <= 0) {
        delete updated[dish.id];
      } else if (nextQuantity > availableQuantity) {
        setNotice(
          `Only ${availableQuantity} portion(s) of ${dish.name} are currently available.`
        );
        return current;
      } else {
        updated[dish.id] = nextQuantity;
      }

      return updated;
    });

    setPlacedOrder(null);
    setError("");
  }

  async function handlePlaceOrder() {
    setError("");
    setNotice("");
    setPlacedOrder(null);

    if (placingOrder) return;

    if (!activeMeal) {
      setError("The restaurant is currently between meal periods or closed.");
      return;
    }

    if (cartItems.length === 0) {
      setError("Please add at least one available dish to your cart.");
      return;
    }

    if (!["takeaway", "delivery"].includes(orderType)) {
      setError("Please select takeaway or delivery.");
      return;
    }

    try {
      const { data: latestDishes, error: stockError } = await supabase
        .from("food_items")
        .select("id, is_available, available_quantity")
        .in(
          "id",
          cartItems.map((item) => item.id)
        );

      if (stockError) throw stockError;

      const latestById = new Map(
        (latestDishes || []).map((item) => [String(item.id), item])
      );

      for (const item of cartItems) {
        const latest = latestById.get(String(item.id));
        if (
          !latest ||
          latest.is_available === false ||
          Number(latest.available_quantity) < item.quantity
        ) {
          setError(
            `${item.name} no longer has enough stock. Please review your cart.`
          );
          await refreshMenuNow();
          return;
        }
      }
    } catch (err) {
      setError(
        err?.message || "Unable to verify stock right now. Please try again."
      );
      return;
    }

    setPlacingOrder(true);

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

      const items = cartItems.map((item) => ({
        food_item_id: Number(item.id),
        quantity: item.quantity,
      }));

      const { data, error: orderError } = await supabase.rpc("create_order", {
        p_order_type: orderType,
        p_items: items,
      });

      if (orderError) throw orderError;
      if (!data || !data.order_id) {
        throw new Error(
          "The order response did not contain an order ID. Check Supabase before trying again."
        );
      }

      const finalCalculatedSubtotal =
        happyHourSavings > 0
          ? Math.max(0, Number(data.subtotal) - happyHourSavings)
          : Number(data.subtotal);

      // If Happy Hours was active and savings were calculated, update order subtotal
      if (happyHourSavings > 0) {
        try {
          await supabase
            .from("orders")
            .update({ subtotal: finalCalculatedSubtotal })
            .eq("id", data.order_id);
        } catch (updateErr) {
          console.warn("Could not adjust order subtotal with happy hour discount:", updateErr);
        }
      }

      setPlacedOrder({
        id: data.order_id,
        subtotal: finalCalculatedSubtotal,
        status: data.status,
        paymentStatus: data.payment_status,
        type: data.order_type,
      });

      setCart({});
      setNotice(
        `Order #${data.order_id} placed successfully!${
          isHappyActive ? ` (Saved ₹${happyHourSavings.toFixed(2)} with Happy Hours)` : ""
        }`
      );
      await refreshMenuNow();
    } catch (err) {
      setError(
        err?.message || "We couldn't place your order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  async function refreshMenuNow() {
    const [categoryResult, dishResult] = await Promise.all([
      supabase
        .from("food_categories")
        .select("id, name, description, image_url, meal_period")
        .order("name"),
      supabase
        .from("food_items")
        .select(
          "id, name, category, category_id, description, price, image_url, is_available, preparation_time, available_quantity, low_stock_threshold"
        )
        .order("name"),
    ]);

    if (categoryResult.error) throw categoryResult.error;
    if (dishResult.error) throw dishResult.error;

    setCategories(categoryResult.data || []);
    setDishes(dishResult.data || []);
    setLastMenuRefresh(new Date());
  }

  const timeLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  const mealMessage = activeMeal
    ? `${MEAL_LABELS[activeMeal]} menu is now open for ordering.`
    : getNextMealMessage();

  const nextMealStart = getNextMealStart();

  const currentMealConfig = MEAL_SCHEDULE.find((m) => m.meal === activeMeal);

  return (
    <CustomerLayout
      title="Fresh Dining Menu"
      subtitle="Discover chef-curated selections freshly cooked to order. Choose your dishes and proceed to checkout."
      cartCount={cartCount}
      cartTotal={subtotal}
      activeMealInfo={
        activeMeal
          ? {
              label: MEAL_LABELS[activeMeal],
              badgeText: `${MEAL_LABELS[activeMeal]} Open · ${currentMealConfig?.hours || "Active"}`,
              subtext: "Accepting takeaway & delivery orders",
            }
          : {
              label: "Closed",
              badgeText: "Between Meal Services",
              subtext: getNextMealMessage(),
            }
      }
      onRefresh={refreshMenuNow}
      refreshing={loading}
      actions={
        cartCount > 0 && (
          <a href="#cart-section" className="customer-btn-accent">
            <ShoppingBag size={16} />
            <span>
              View Cart ({cartCount}) · ₹
              {Number(subtotal).toFixed(2)}
            </span>
          </a>
        )
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
            <div>
              <strong>{notice}</strong>
              {placedOrder && (
                <div style={{ marginTop: "6px", fontSize: "12.5px" }}>
                  <span>Order Reference: #{placedOrder.id} · </span>
                  <span>Amount: ₹{Number(placedOrder.subtotal).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
          {placedOrder ? (
            <button
              type="button"
              className="customer-btn-primary"
              onClick={() => navigate("/my-orders")}
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Track Order →
            </button>
          ) : (
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
          )}
        </div>
      )}

      {/* Hero Welcome Banner */}
      <section
        style={{
          background: "linear-gradient(135deg, #263C2E 0%, #1A2B20 100%)",
          color: "#ffffff",
          borderRadius: "20px",
          padding: "32px 36px",
          marginBottom: "24px",
          boxShadow: "0 8px 24px rgba(38, 60, 46, 0.12)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "1.6px",
            color: "#C5D6B7",
            textTransform: "uppercase",
            display: "block",
            marginBottom: "8px",
          }}
        >
          {activeMeal ? `ACTIVE SERVICE: ${MEAL_LABELS[activeMeal]}` : "SERVICE NOTICE"}
        </span>

        <h2
          style={{
            margin: "0 0 10px",
            fontFamily: "'Manrope', sans-serif",
            fontSize: "clamp(24px, 3.4vw, 36px)",
            fontWeight: 800,
            lineHeight: 1.25,
            color: "#ffffff",
          }}
        >
          {activeMeal
            ? `Delicious ${MEAL_LABELS[activeMeal]} options freshly cooked.`
            : "Between scheduled meal services."}
        </h2>

        <p
          style={{
            margin: "0 0 18px",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#D4DFD0",
            maxWidth: "600px",
          }}
        >
          {mealMessage}
        </p>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.12)",
              fontSize: "12px",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Clock size={13} />
            <span>IST Time: {timeLabel}</span>
          </span>
          {activeMeal && currentMealConfig && (
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "999px",
                background: "rgba(198, 94, 56, 0.35)",
                border: "1px solid rgba(198, 94, 56, 0.5)",
                fontSize: "12px",
                color: "#FFD0C0",
                fontWeight: 700,
              }}
            >
              Hours: {currentMealConfig.hours}
            </span>
          )}
        </div>
      </section>

      {/* Live Happy Hours Promotional Banner */}
      {isHappyActive && (
        <section
          style={{
            background: "linear-gradient(135deg, #C65E38 0%, #A44622 100%)",
            color: "#ffffff",
            borderRadius: "18px",
            padding: "22px 28px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            boxShadow: "0 8px 24px rgba(198, 94, 56, 0.22)",
            border: "1px solid rgba(255, 255, 255, 0.22)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "260px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "rgba(255, 255, 255, 0.2)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Zap size={26} fill="#ffffff" color="#ffffff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "19px", fontWeight: 800, color: "#ffffff" }}>
                  {happyHour.title || "⚡ Cravely Happy Hours Active!"}
                </h3>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background: "#ffffff",
                    color: "#C65E38",
                    fontSize: "12px",
                    fontWeight: 800,
                    letterSpacing: "0.4px",
                  }}
                >
                  {discountPercent}% OFF ALL DISHES
                </span>
              </div>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "13.5px",
                  color: "#FFE8E0",
                  lineHeight: 1.45,
                }}
              >
                {happyHour.bannerText ||
                  "Special limited-time discount applied directly to all fresh dishes in our kitchen!"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {happyHour.autoSchedule && happyHour.endTime && (
              <span
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  background: "rgba(0, 0, 0, 0.22)",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Clock size={13} />
                <span>Valid until {happyHour.endTime} IST</span>
              </span>
            )}
            <span
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.2)",
                fontSize: "12px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              ⚡ Applied automatically at checkout
            </span>
          </div>
        </section>
      )}

      {/* Closed State Banner */}
      {!activeMeal ? (
        <div
          className="customer-card"
          style={{ textAlign: "center", padding: "48px 24px", marginBottom: "32px" }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 16px",
              borderRadius: "16px",
              background: "#F0F2EB",
              color: "#263C2E",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Utensils size={28} />
          </div>
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: "20px",
              fontWeight: 800,
              color: "#263C2E",
            }}
          >
            {indiaTime.totalMinutes >= 16 * 60 && indiaTime.totalMinutes < 18 * 60
              ? "Kitchen Prep Interval"
              : "We Are Currently Closed"}
          </h3>
          <p style={{ margin: "0 0 16px", color: "#697064", fontSize: "14px", lineHeight: 1.6 }}>
            {mealMessage}
          </p>
          {nextMealStart && (
            <p style={{ margin: 0, fontSize: "14px", color: "#263C2E", fontWeight: 700 }}>
              Next service opens at {nextMealStart} IST.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Category Filter Pills */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedCategory("All")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border:
                    selectedCategory === "All"
                      ? "1px solid #263C2E"
                      : "1px solid #E5E4DA",
                  background: selectedCategory === "All" ? "#263C2E" : "#ffffff",
                  color: selectedCategory === "All" ? "#ffffff" : "#384033",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                All {MEAL_LABELS[activeMeal]} Dishes
              </button>

              {mealCategories.map((cat) => {
                const isSelected = String(selectedCategory) === String(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(String(cat.id))}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "999px",
                      border: isSelected
                        ? "1px solid #263C2E"
                        : "1px solid #E5E4DA",
                      background: isSelected ? "#263C2E" : "#ffffff",
                      color: isSelected ? "#ffffff" : "#384033",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.18s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dishes Grid */}
          {loading ? (
            <div
              className="customer-card"
              style={{ textAlign: "center", padding: "48px 20px", color: "#697064" }}
            >
              Loading current menu...
            </div>
          ) : visibleDishes.length === 0 ? (
            <div
              className="customer-card"
              style={{ textAlign: "center", padding: "48px 20px", color: "#697064" }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: "17px", color: "#263C2E" }}>
                No dishes in this category
              </h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                Please choose another category or check back shortly.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "20px",
                marginBottom: "36px",
              }}
            >
              {visibleDishes.map((dish) => {
                const quantityInCart = cart[dish.id] || 0;
                const availableQuantity = Number(dish.available_quantity ?? 0);
                const threshold = Number(dish.low_stock_threshold ?? 5);
                const isLowStock = availableQuantity <= threshold;
                const origPrice = Number(dish.price);
                const discountedPrice = isHappyActive
                  ? getDiscountedPrice(origPrice, discountPercent)
                  : origPrice;

                return (
                  <article
                    key={dish.id}
                    className="customer-card"
                    style={{
                      padding: 0,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      transition: "transform 0.18s ease, box-shadow 0.18s ease",
                    }}
                  >
                    {/* Dish Image */}
                    <div
                      style={{
                        height: "170px",
                        position: "relative",
                        background: "#EBEFE8",
                        overflow: "hidden",
                      }}
                    >
                      {dish.image_url ? (
                        <img
                          src={dish.image_url}
                          alt={dish.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "36px",
                            color: "#697064",
                          }}
                        >
                          🍲
                        </div>
                      )}

                      {/* Happy Hours Tag on Image */}
                      {isHappyActive && (
                        <span
                          style={{
                            position: "absolute",
                            top: "10px",
                            right: "10px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "#C65E38",
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: 800,
                            boxShadow: "0 2px 6px rgba(198, 94, 56, 0.4)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            zIndex: 2,
                          }}
                        >
                          <Zap size={11} fill="#ffffff" color="#ffffff" />
                          <span>{discountPercent}% OFF</span>
                        </span>
                      )}

                      {/* Low Stock Badge */}
                      {isLowStock && (
                        <span
                          style={{
                            position: "absolute",
                            top: "10px",
                            left: "10px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "rgba(185, 28, 28, 0.9)",
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: 800,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                            zIndex: 2,
                          }}
                        >
                          Only {availableQuantity} left
                        </span>
                      )}

                      {dish.preparation_time != null && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: "10px",
                            right: "10px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "rgba(38, 60, 46, 0.85)",
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: 700,
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          ⏱ {dish.preparation_time} min
                        </span>
                      )}
                    </div>

                    {/* Dish Body */}
                    <div
                      style={{
                        padding: "18px",
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                      }}
                    >
                      <h3
                        style={{
                          margin: "0 0 6px",
                          fontSize: "16px",
                          fontWeight: 800,
                          color: "#263C2E",
                          lineHeight: 1.3,
                        }}
                      >
                        {dish.name}
                      </h3>

                      <p
                        style={{
                          margin: "0 0 14px",
                          fontSize: "12.5px",
                          color: "#697064",
                          lineHeight: 1.5,
                          flex: 1,
                        }}
                      >
                        {dish.description || "Prepared fresh using finest kitchen ingredients."}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: "14px",
                          borderTop: "1px solid #F0F2EB",
                        }}
                      >
                        <div>
                          {isHappyActive ? (
                            <div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                <strong
                                  style={{
                                    fontSize: "19px",
                                    fontWeight: 800,
                                    color: "#C65E38",
                                  }}
                                >
                                  ₹{discountedPrice.toFixed(2)}
                                </strong>
                                <span
                                  style={{
                                    fontSize: "12.5px",
                                    color: "#8A9485",
                                    textDecoration: "line-through",
                                    fontWeight: 500,
                                  }}
                                >
                                  ₹{origPrice.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <strong
                              style={{
                                fontSize: "18px",
                                fontWeight: 800,
                                color: "#263C2E",
                              }}
                            >
                              ₹{origPrice.toLocaleString("en-IN")}
                            </strong>
                          )}
                        </div>

                        {quantityInCart === 0 ? (
                          <button
                            type="button"
                            className="customer-btn-primary"
                            style={{ padding: "8px 14px", fontSize: "12.5px" }}
                            onClick={() => changeQuantity(dish, 1)}
                          >
                            <Plus size={14} />
                            <span>Add</span>
                          </button>
                        ) : (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              background: "#F4F5F0",
                              border: "1px solid #E5E4DA",
                              borderRadius: "8px",
                              overflow: "hidden",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => changeQuantity(dish, -1)}
                              style={{
                                border: 0,
                                background: "transparent",
                                padding: "6px 9px",
                                cursor: "pointer",
                                color: "#263C2E",
                              }}
                            >
                              <Minus size={14} />
                            </button>
                            <span
                              style={{
                                padding: "0 8px",
                                fontWeight: 800,
                                fontSize: "13px",
                                color: "#263C2E",
                              }}
                            >
                              {quantityInCart}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeQuantity(dish, 1)}
                              disabled={quantityInCart >= availableQuantity}
                              style={{
                                border: 0,
                                background: "transparent",
                                padding: "6px 9px",
                                cursor:
                                  quantityInCart >= availableQuantity
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  quantityInCart >= availableQuantity ? 0.4 : 1,
                                color: "#263C2E",
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Order Cart Checkout Panel */}
      <section
        id="cart-section"
        className="customer-card"
        style={{
          border: isHappyActive ? "2px solid #F5D3C4" : "2px solid #E5E4DA",
          boxShadow: isHappyActive
            ? "0 8px 30px rgba(198, 94, 56, 0.08)"
            : "0 6px 24px rgba(38, 60, 46, 0.05)",
          marginTop: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
            borderBottom: "1px solid #F0F2EB",
            paddingBottom: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: isHappyActive ? "#FFF1EB" : "#EAF0E6",
                color: isHappyActive ? "#C65E38" : "#263C2E",
                display: "grid",
                placeItems: "center",
              }}
            >
              <ShoppingBag size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "19px",
                    fontWeight: 800,
                    color: "#263C2E",
                  }}
                >
                  Review Your Cart
                </h2>
                {isHappyActive && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "#FFF1EB",
                      border: "1px solid #F8BEAA",
                      color: "#C65E38",
                      fontSize: "11px",
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <Zap size={11} fill="#C65E38" />
                    {discountPercent}% OFF
                  </span>
                )}
              </div>
              <span style={{ fontSize: "12px", color: "#697064" }}>
                {cartCount} {cartCount === 1 ? "dish" : "dishes"} selected
              </span>
            </div>
          </div>

          {cartCount > 0 && (
            <button
              type="button"
              onClick={() => setCart({})}
              style={{
                border: 0,
                background: "transparent",
                color: "#B94B42",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear Cart
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              color: "#697064",
              fontSize: "13.5px",
            }}
          >
            Your cart is empty. Click "+ Add" on any menu item above to build your order!
          </div>
        ) : (
          <div>
            {/* Cart item rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {cartItems.map((item) => {
                const itemOrigPrice = Number(item.price);
                const itemUnitPrice = isHappyActive
                  ? getDiscountedPrice(itemOrigPrice, discountPercent)
                  : itemOrigPrice;
                const itemLineTotal = itemUnitPrice * item.quantity;
                const originalLineTotal = itemOrigPrice * item.quantity;

                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: "1px dashed #ECEFE8",
                      fontSize: "13.5px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ color: "#263C2E" }}>{item.name}</strong>
                        {isHappyActive && (
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 800,
                              color: "#C65E38",
                              background: "#FFF1EB",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            }}
                          >
                            -{discountPercent}%
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "#697064" }}>
                        {isHappyActive ? (
                          <>
                            <span style={{ textDecoration: "line-through", marginRight: "5px" }}>
                              ₹{itemOrigPrice.toFixed(2)}
                            </span>
                            <strong style={{ color: "#C65E38" }}>
                              ₹{itemUnitPrice.toFixed(2)}
                            </strong>
                          </>
                        ) : (
                          <span>₹{itemOrigPrice.toFixed(2)}</span>
                        )}{" "}
                        × {item.quantity} portions
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ textAlign: "right" }}>
                        <strong
                          style={{
                            color: isHappyActive ? "#C65E38" : "#263C2E",
                            fontSize: "14px",
                          }}
                        >
                          ₹{itemLineTotal.toFixed(2)}
                        </strong>
                        {isHappyActive && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#8A9485",
                              textDecoration: "line-through",
                            }}
                          >
                            ₹{originalLineTotal.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item, -item.quantity)}
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#B94B42",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        title="Remove from cart"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Delivery or Takeaway Selector */}
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                background: "#F7F5EF",
                borderRadius: "12px",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#263C2E",
                  marginBottom: "8px",
                }}
              >
                Fulfillment Type
              </label>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setOrderType("takeaway")}
                  style={{
                    flex: 1,
                    minWidth: "120px",
                    padding: "10px",
                    borderRadius: "8px",
                    border:
                      orderType === "takeaway"
                        ? "2px solid #263C2E"
                        : "1px solid #D5DCD0",
                    background: orderType === "takeaway" ? "#ffffff" : "#F4F5F0",
                    color: "#263C2E",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Package size={16} />
                  <span>Takeaway</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType("delivery")}
                  style={{
                    flex: 1,
                    minWidth: "120px",
                    padding: "10px",
                    borderRadius: "8px",
                    border:
                      orderType === "delivery"
                        ? "2px solid #263C2E"
                        : "1px solid #D5DCD0",
                    background: orderType === "delivery" ? "#ffffff" : "#F4F5F0",
                    color: "#263C2E",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Truck size={16} />
                  <span>Delivery</span>
                </button>
              </div>
            </div>

            {/* Subtotal & Breakdown */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginTop: "20px",
                paddingTop: "14px",
                borderTop: "1px solid #E5E4DA",
              }}
            >
              {isHappyActive && happyHourSavings > 0 && (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "13px",
                      color: "#697064",
                    }}
                  >
                    <span>Regular Subtotal</span>
                    <span>₹{rawSubtotal.toFixed(2)}</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "13px",
                      color: "#C65E38",
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Zap size={14} fill="#C65E38" />
                      Happy Hours Discount ({discountPercent}%)
                    </span>
                    <span>-₹{happyHourSavings.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "6px",
                }}
              >
                <div>
                  <span style={{ fontSize: "13px", color: "#697064" }}>Order Total</span>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      color: isHappyActive ? "#C65E38" : "#263C2E",
                      fontFamily: "'Manrope', sans-serif",
                    }}
                  >
                    ₹{Number(subtotal).toFixed(2)}
                  </div>
                </div>

                <button
                  type="button"
                  className="customer-btn-accent"
                  onClick={handlePlaceOrder}
                  disabled={placingOrder || loading || !activeMeal}
                  style={{
                    padding: "12px 28px",
                    fontSize: "14px",
                    fontWeight: 800,
                  }}
                >
                  {placingOrder ? "Placing Order..." : "Confirm & Place Order →"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Last Refreshed Notice */}
      <div
        style={{
          marginTop: "20px",
          textAlign: "center",
          fontSize: "11.5px",
          color: "#77776F",
        }}
      >
        {lastMenuRefresh
          ? `Menu automatically synchronized at ${new Intl.DateTimeFormat(
              "en-IN",
              {
                timeZone: "Asia/Kolkata",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              }
            ).format(lastMenuRefresh)} IST.`
          : "Real-time kitchen updates active."}
      </div>
    </CustomerLayout>
  );
}
