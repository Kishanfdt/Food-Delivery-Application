
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const styles = {
    page: {
        minHeight: "100vh",
        background: "#faf8f4",
        color: "#24251f",
        fontFamily: "Arial, sans-serif",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "20px 5%",
        background: "#fff",
        borderBottom: "1px solid #e9e5dc",
        flexWrap: "wrap",
    },
    brand: {
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "-1px",
    },
    button: {
        border: "none",
        borderRadius: 10,
        padding: "11px 16px",
        cursor: "pointer",
        fontWeight: 700,
    },
    main: {
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 5%",
    },
    hero: {
        background: "#263c2e",
        color: "#fff",
        padding: "35px 30px",
        borderRadius: 20,
        marginBottom: 30,
    },
    categories: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        margin: "18px 0 28px",
    },
    categoryButton: {
        border: "1px solid #ded9ce",
        borderRadius: 24,
        padding: "10px 17px",
        cursor: "pointer",
        fontWeight: 600,
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
        gap: 20,
    },
    card: {
        background: "#fff",
        border: "1px solid #eee9e0",
        borderRadius: 16,
        overflow: "hidden",
    },
    image: {
        width: "100%",
        height: 170,
        objectFit: "cover",
        background: "#eee9e0",
        display: "block",
    },
    cardBody: {
        padding: 16,
    },
    muted: {
        color: "#77776f",
        lineHeight: 1.5,
    },
    cart: {
        background: "#fff",
        border: "1px solid #e9e5dc",
        borderRadius: 16,
        padding: 22,
        marginTop: 35,
    },
};

const MEAL_SCHEDULE = [
    { meal: "breakfast", start: 6 * 60, end: 11 * 60 },
    { meal: "lunch", start: 11 * 60, end: 16 * 60 },
    { meal: "dinner", start: 18 * 60, end: 23 * 60 },
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
            (period) =>
                totalMinutes >= period.start &&
                totalMinutes < period.end
        )?.meal || null
    );
}

function getNextMealMessage() {
    const { totalMinutes } = getIndiaTime();

    if (totalMinutes >= 0 && totalMinutes < 6 * 60) {
        return "We are currently closed. Breakfast starts at 6:00 AM.";
    }

    if (totalMinutes >= 16 * 60 && totalMinutes < 18 * 60) {
        return "Our next menu is dinner, starting at 6:00 PM.";
    }

    if (totalMinutes >= 23 * 60) {
        return "We are currently closed. Breakfast starts at 6:00 AM.";
    }

    return "The menu is currently unavailable.";
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

                if (categoryResult.error) {
                    throw categoryResult.error;
                }

                if (dishResult.error) {
                    throw dishResult.error;
                }

                setCategories(categoryResult.data || []);
                setDishes(dishResult.data || []);
                setLastMenuRefresh(new Date());
            } catch (err) {
                if (active) {
                    setError(err.message || "Unable to load the menu.");
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadMenu(true);

        // Recheck the menu periodically so updated stock is reflected.
        const refreshInterval = setInterval(() => {
            if (active) {
                setIndiaTime(getIndiaTime());
                setActiveMeal(getActiveMeal());
                loadMenu(false);
            }
        }, 30000);

        // Refresh when a customer returns to this browser tab.
        function handleVisibilityChange() {
            if (document.visibilityState === "visible" && active) {
                setIndiaTime(getIndiaTime());
                setActiveMeal(getActiveMeal());
                loadMenu(false);
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Realtime updates are an extra convenience; periodic refresh remains
        // as a fallback if Realtime is not enabled for these tables.
        const menuChannel = supabase
            .channel("customer-menu-live")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "food_categories",
                },
                () => {
                    if (active) loadMenu(false);
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "food_items",
                },
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

        return categories.filter(
            (category) => category.meal_period === activeMeal
        );
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
        // Clear the selected category if it is not part of the new meal.
        if (
            selectedCategory !== "All" &&
            !mealCategories.some(
                (category) => String(category.id) === String(selectedCategory)
            )
        ) {
            setSelectedCategory("All");
        }

        // Remove items from the cart when the meal changes or stock becomes
        // insufficient. This is a UI safeguard, not the final stock guarantee.
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

    const cartCount = cartItems.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    const subtotal = cartItems.reduce(
        (total, item) => total + Number(item.price) * item.quantity,
        0
    );

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

    async function handleLogout() {
        const { error: logoutError } = await supabase.auth.signOut();

        if (logoutError) {
            setError(`Logout failed: ${logoutError.message}`);
            return;
        }

        navigate("/login", { replace: true });
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

        // Refresh stock immediately before submitting the order.
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
                (latestDishes || []).map((item) => [
                    String(item.id),
                    item,
                ])
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
                err?.message ||
                "Unable to verify stock right now. Please try again."
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

            const { data, error: orderError } = await supabase.rpc(
                "create_order",
                {
                    p_order_type: orderType,
                    p_items: items,
                }
            );

            if (orderError) throw orderError;

            if (!data || !data.order_id) {
                throw new Error(
                    "The order response did not contain an order ID. Check Supabase before trying again."
                );
            }

            setPlacedOrder({
                id: data.order_id,
                subtotal: data.subtotal,
                status: data.status,
                paymentStatus: data.payment_status,
                type: data.order_type,
            });

            setCart({});
            setNotice(`Order #${data.order_id} placed successfully!`);

            await refreshMenuNow();
        } catch (err) {
            setError(
                err?.message ||
                "We couldn't place your order. Please try again."
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
        ? `${MEAL_LABELS[activeMeal]} menu is now available`
        : getNextMealMessage();

    const nextMealStart = getNextMealStart();

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div>
                    <div style={styles.brand}>
                        Cravely<span style={{ color: "#66845b" }}>.</span>
                    </div>

                    <div style={{ ...styles.muted, fontSize: 12 }}>
                        GOOD FOOD, GOOD MOOD
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        style={{
                            ...styles.button,
                            background: "#eeeae1",
                            color: "#24251f",
                        }}
                        onClick={() => navigate("/my-orders")}
                    >
                        My Orders
                    </button>

                    <button
                        style={{
                            ...styles.button,
                            background: "#eeeae1",
                            color: "#24251f",
                        }}
                        onClick={() => navigate("/my-tickets")}
                    >
                        My Tickets
                    </button>

                    <a
                        href="#cart"
                        style={{
                            ...styles.button,
                            background: "#263c2e",
                            color: "#fff",
                            textDecoration: "none",
                        }}
                    >
                        Cart ({cartCount})
                    </a>

                    <button
                        style={{
                            ...styles.button,
                            background: "#eeeae1",
                            color: "#24251f",
                        }}
                        onClick={handleLogout}
                    >
                        Log out
                    </button>
                </div>
            </header>

            <main style={styles.main}>
                <section style={styles.hero}>
                    <p style={{ color: "#d7e4ce", marginTop: 0 }}>
                        FRESHLY PREPARED FOR YOU
                    </p>

                    <h1
                        style={{
                            fontSize: "clamp(28px, 4vw, 44px)",
                            margin: "10px 0",
                        }}
                    >
                        {activeMeal
                            ? `It's time for ${MEAL_LABELS[activeMeal]}.`
                            : "A little pause between meals."}
                    </h1>

                    <p
                        style={{
                            color: "#e3e9df",
                            lineHeight: 1.6,
                            maxWidth: 550,
                        }}
                    >
                        {activeMeal
                            ? "Explore the current menu and add your favourites to your cart."
                            : mealMessage}
                    </p>

                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 10,
                            marginTop: 18,
                        }}
                    >
                        <span
                            style={{
                                background: "rgba(255,255,255,0.12)",
                                borderRadius: 20,
                                padding: "8px 12px",
                                fontSize: 13,
                            }}
                        >
                            India time: {timeLabel}
                        </span>

                        {activeMeal && (
                            <span
                                style={{
                                    background: "rgba(255,255,255,0.12)",
                                    borderRadius: 20,
                                    padding: "8px 12px",
                                    fontSize: 13,
                                }}
                            >
                                {MEAL_LABELS[activeMeal]} service
                            </span>
                        )}
                    </div>
                </section>

                {!activeMeal ? (
                    <section
                        style={{
                            background: "#fff",
                            border: "1px solid #e9e5dc",
                            borderRadius: 16,
                            padding: 28,
                            textAlign: "center",
                        }}
                    >
                        <div style={{ fontSize: 38, marginBottom: 12 }}>
                            🍽️
                        </div>
                        <h2 style={{ margin: "0 0 10px" }}>
                            {indiaTime.totalMinutes >= 16 * 60 &&
                                indiaTime.totalMinutes < 18 * 60
                                ? "Between meal services"
                                : "We're currently closed"}
                        </h2>
                        <p style={styles.muted}>{mealMessage}</p>
                        {nextMealStart && (
                            <p>
                                Next service starts at{" "}
                                <strong>{nextMealStart} IST</strong>.
                            </p>
                        )}
                    </section>
                ) : (
                    <>
                        <section>
                            <h2 style={{ marginBottom: 5 }}>
                                {MEAL_LABELS[activeMeal]} menu
                            </h2>

                            <p style={styles.muted}>
                                Only dishes for the current meal period are
                                shown. Menus switch automatically using India
                                Standard Time.
                            </p>

                            <div style={styles.categories}>
                                <button
                                    style={{
                                        ...styles.categoryButton,
                                        background:
                                            selectedCategory === "All"
                                                ? "#263c2e"
                                                : "#fff",
                                        color:
                                            selectedCategory === "All"
                                                ? "#fff"
                                                : "#24251f",
                                    }}
                                    onClick={() =>
                                        setSelectedCategory("All")
                                    }
                                >
                                    All {MEAL_LABELS[activeMeal]} dishes
                                </button>

                                {mealCategories.map((category) => (
                                    <button
                                        key={category.id}
                                        style={{
                                            ...styles.categoryButton,
                                            background:
                                                String(selectedCategory) ===
                                                    String(category.id)
                                                    ? "#263c2e"
                                                    : "#fff",
                                            color:
                                                String(selectedCategory) ===
                                                    String(category.id)
                                                    ? "#fff"
                                                    : "#24251f",
                                        }}
                                        onClick={() =>
                                            setSelectedCategory(
                                                String(category.id)
                                            )
                                        }
                                    >
                                        {category.name}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {loading && (
                            <p>Loading delicious options...</p>
                        )}

                        {error && (
                            <div
                                role="alert"
                                style={{
                                    background: "#fff0ee",
                                    color: "#9c3025",
                                    padding: 16,
                                    borderRadius: 10,
                                    marginBottom: 20,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        {!loading &&
                            !error &&
                            mealCategories.length === 0 && (
                                <p style={styles.muted}>
                                    No categories have been assigned to the{" "}
                                    {MEAL_LABELS[activeMeal].toLowerCase()} menu
                                    yet.
                                </p>
                            )}

                        {!loading &&
                            !error &&
                            mealCategories.length > 0 &&
                            visibleDishes.length === 0 && (
                                <p style={styles.muted}>
                                    No in-stock dishes are currently available
                                    in this category.
                                </p>
                            )}

                        <div style={styles.grid}>
                            {visibleDishes.map((dish) => (
                                <article key={dish.id} style={styles.card}>
                                    {dish.image_url ? (
                                        <img
                                            src={dish.image_url}
                                            alt={dish.name}
                                            style={styles.image}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                ...styles.image,
                                                display: "grid",
                                                placeItems: "center",
                                                fontSize: 42,
                                            }}
                                            aria-label="No dish image available"
                                        >
                                            🍽️
                                        </div>
                                    )}

                                    <div style={styles.cardBody}>
                                        <h3 style={{ margin: "0 0 8px" }}>
                                            {dish.name}
                                        </h3>

                                        <p
                                            style={{
                                                ...styles.muted,
                                                fontSize: 14,
                                                minHeight: 42,
                                            }}
                                        >
                                            {dish.description ||
                                                "Prepared fresh for you."}
                                        </p>

                                        {dish.preparation_time != null && (
                                            <p
                                                style={{
                                                    ...styles.muted,
                                                    fontSize: 12,
                                                }}
                                            >
                                                Approx.{" "}
                                                {dish.preparation_time} min
                                            </p>
                                        )}

                                        <p
                                            style={{
                                                ...styles.muted,
                                                fontSize: 12,
                                                marginBottom: 0,
                                            }}
                                        >
                                            {dish.available_quantity} portion(s)
                                            remaining
                                        </p>

                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                gap: 10,
                                                marginTop: 15,
                                            }}
                                        >
                                            <strong style={{ fontSize: 19 }}>
                                                ₹
                                                {Number(dish.price).toFixed(2)}
                                            </strong>

                                            {(cart[dish.id] || 0) === 0 ? (
                                                <button
                                                    style={{
                                                        ...styles.button,
                                                        background: "#263c2e",
                                                        color: "#fff",
                                                    }}
                                                    onClick={() =>
                                                        changeQuantity(dish, 1)
                                                    }
                                                >
                                                    + Add
                                                </button>
                                            ) : (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 12,
                                                    }}
                                                >
                                                    <button
                                                        aria-label={`Remove one ${dish.name}`}
                                                        style={styles.button}
                                                        onClick={() =>
                                                            changeQuantity(
                                                                dish,
                                                                -1
                                                            )
                                                        }
                                                    >
                                                        −
                                                    </button>

                                                    <strong>
                                                        {cart[dish.id]}
                                                    </strong>

                                                    <button
                                                        aria-label={`Add one ${dish.name}`}
                                                        style={{
                                                            ...styles.button,
                                                            background:
                                                                "#263c2e",
                                                            color: "#fff",
                                                            opacity:
                                                                (cart[dish.id] ||
                                                                    0) >=
                                                                    Number(
                                                                        dish.available_quantity
                                                                    )
                                                                    ? 0.5
                                                                    : 1,
                                                        }}
                                                        disabled={
                                                            (cart[dish.id] ||
                                                                0) >=
                                                            Number(
                                                                dish.available_quantity
                                                            )
                                                        }
                                                        onClick={() =>
                                                            changeQuantity(
                                                                dish,
                                                                1
                                                            )
                                                        }
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}

                <section id="cart" style={styles.cart}>
                    <h2 style={{ marginTop: 0 }}>Your cart</h2>

                    {cartItems.length === 0 ? (
                        <p style={styles.muted}>
                            Your cart is empty. Add an in-stock dish to get
                            started.
                        </p>
                    ) : (
                        <>
                            {cartItems.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 12,
                                        padding: "12px 0",
                                        borderBottom: "1px solid #eee9e0",
                                    }}
                                >
                                    <div>
                                        <strong>{item.name}</strong>
                                        <div style={styles.muted}>
                                            ₹{Number(item.price).toFixed(2)} ×{" "}
                                            {item.quantity}
                                        </div>
                                    </div>

                                    <strong>
                                        ₹
                                        {(
                                            Number(item.price) * item.quantity
                                        ).toFixed(2)}
                                    </strong>
                                </div>
                            ))}

                            <div style={{ marginTop: 20 }}>
                                <label htmlFor="orderType">
                                    <strong>
                                        How would you like your order?
                                    </strong>
                                </label>

                                <select
                                    id="orderType"
                                    value={orderType}
                                    disabled={placingOrder}
                                    onChange={(event) => {
                                        setOrderType(event.target.value);
                                        setNotice("");
                                        setError("");
                                    }}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        maxWidth: 320,
                                        padding: 12,
                                        marginTop: 10,
                                        borderRadius: 8,
                                        border: "1px solid #ded9ce",
                                        background: "#fff",
                                    }}
                                >
                                    <option value="takeaway">Takeaway</option>
                                    <option value="delivery">Delivery</option>
                                </select>
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    marginTop: 22,
                                    fontSize: 20,
                                }}
                            >
                                <strong>Subtotal</strong>
                                <strong>₹{subtotal.toFixed(2)}</strong>
                            </div>

                            <button
                                style={{
                                    ...styles.button,
                                    background: placingOrder
                                        ? "#748474"
                                        : "#263c2e",
                                    color: "#fff",
                                    width: "100%",
                                    marginTop: 18,
                                    padding: 15,
                                    cursor: placingOrder ? "wait" : "pointer",
                                }}
                                disabled={
                                    placingOrder || loading || !activeMeal
                                }
                                onClick={handlePlaceOrder}
                            >
                                {placingOrder
                                    ? "Placing order..."
                                    : "Place Order"}
                            </button>
                        </>
                    )}

                    {notice && (
                        <div
                            role="status"
                            style={{
                                marginTop: 18,
                                padding: 16,
                                background: "#edf6e9",
                                color: "#28572c",
                                borderRadius: 10,
                            }}
                        >
                            <strong>{notice}</strong>

                            {placedOrder && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        lineHeight: 1.8,
                                    }}
                                >
                                    <div>Order ID: #{placedOrder.id}</div>
                                    <div>
                                        Order type:{" "}
                                        {placedOrder.type === "delivery"
                                            ? "Delivery"
                                            : "Takeaway"}
                                    </div>
                                    <div>Status: {placedOrder.status}</div>
                                    <div>
                                        Order subtotal: ₹
                                        {Number(
                                            placedOrder.subtotal
                                        ).toFixed(2)}
                                    </div>
                                    <div>
                                        Payment status:{" "}
                                        {placedOrder.paymentStatus || "Unpaid"}
                                    </div>

                                    <button
                                        style={{
                                            ...styles.button,
                                            background: "#263c2e",
                                            color: "#fff",
                                            marginTop: 12,
                                        }}
                                        onClick={() =>
                                            navigate("/my-orders")
                                        }
                                    >
                                        View My Orders
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <p
                    style={{
                        ...styles.muted,
                        fontSize: 11,
                        marginTop: 16,
                    }}
                >
                    {lastMenuRefresh
                        ? `Menu last refreshed at ${new Intl.DateTimeFormat(
                            "en-IN",
                            {
                                timeZone: "Asia/Kolkata",
                                hour: "numeric",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: true,
                            }
                        ).format(lastMenuRefresh)} IST.`
                        : "Menu refreshes automatically."}
                </p>
            </main>
        </div>
    );
}
