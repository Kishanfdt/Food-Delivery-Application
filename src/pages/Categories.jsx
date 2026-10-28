
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../App.css";

const initialDish = {
    name: "",
    description: "",
    price: "",
    image_url: "",
    is_available: true,
    available_quantity: "0",
    low_stock_threshold: "5",
};

const initialCategory = {
    name: "",
    description: "",
    meal_period: "lunch",
};

const mealPeriods = [
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "dinner", label: "Dinner" },
];

export default function Categories() {
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [foods, setFoods] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState("");
    const [dishModal, setDishModal] = useState(false);
    const [categoryModal, setCategoryModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [dishForm, setDishForm] = useState(initialDish);
    const [categoryForm, setCategoryForm] = useState(initialCategory);
    const [editingCategoryId, setEditingCategoryId] = useState(null);

    async function loadData() {
        setLoading(true);

        const [categoryResult, foodResult] = await Promise.all([
            supabase.from("food_categories").select("*").order("name"),
            supabase.from("food_items").select("*").order("name"),
        ]);

        if (categoryResult.error || foodResult.error) {
            setNotice(
                `Database error: ${categoryResult.error?.message ||
                foodResult.error?.message
                }`
            );
            setLoading(false);
            return;
        }

        const nextCategories = categoryResult.data || [];
        setCategories(nextCategories);
        setFoods(foodResult.data || []);

        // Keep the selected category synchronized with database changes.
        if (selectedCategory) {
            const updatedCategory = nextCategories.find(
                (category) =>
                    Number(category.id) === Number(selectedCategory.id)
            );

            setSelectedCategory(updatedCategory || null);
        }

        setLoading(false);
    }

    useEffect(() => {
        loadData();
        // Initial load only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const categoryFoods = useMemo(() => {
        return foods.filter((food) => {
            const matchesCategory =
                Number(food.category_id) === Number(selectedCategory?.id);

            const matchesSearch = (food.name || "")
                .toLowerCase()
                .includes(search.toLowerCase());

            return matchesCategory && matchesSearch;
        });
    }, [foods, selectedCategory, search]);

    async function saveDish(event) {
        event.preventDefault();

        if (!selectedCategory) return;

        const quantity = Number(dishForm.available_quantity);
        const threshold = Number(dishForm.low_stock_threshold);
        const price = Number(dishForm.price);

        if (
            !Number.isInteger(quantity) ||
            quantity < 0 ||
            !Number.isInteger(threshold) ||
            threshold < 0 ||
            !Number.isFinite(price) ||
            price < 0
        ) {
            setNotice(
                "Enter a valid price and non-negative whole-number stock quantities."
            );
            return;
        }

        setSaving(true);

        const payload = {
            name: dishForm.name.trim(),
            category: selectedCategory.name,
            price,
            category_id: selectedCategory.id,
            is_available: dishForm.is_available,
            available_quantity: quantity,
            low_stock_threshold: threshold,
        };

        let result;

        if (editingId !== null) {
            result = await supabase
                .from("food_items")
                .update(payload)
                .eq("id", editingId);
        } else {
            result = await supabase
                .from("food_items")
                .insert([payload]);
        }

        setSaving(false);

        if (result.error) {
            setNotice(`Could not save dish: ${result.error.message}`);
            return;
        }

        const wasEditing = editingId !== null;

        setDishModal(false);
        setEditingId(null);
        setDishForm({ ...initialDish });
        setNotice(
            wasEditing
                ? "Dish and stock updated successfully."
                : "Dish added successfully."
        );

        await loadData();
    }

    function openAddDish() {
        setEditingId(null);
        setDishForm({ ...initialDish });
        setDishModal(true);
    }

    function openEditDish(food) {
        setEditingId(food.id);
        setDishForm({
            name: food.name || "",
            description: food.description || "",
            price: food.price ?? "",
            image_url: food.image_url || "",
            is_available: food.is_available !== false,
            available_quantity: String(food.available_quantity ?? 0),
            low_stock_threshold: String(food.low_stock_threshold ?? 5),
        });
        setDishModal(true);
    }

    async function deleteDish(food) {
        if (!window.confirm(`Delete ${food.name}?`)) return;

        const { error } = await supabase
            .from("food_items")
            .delete()
            .eq("id", food.id);

        if (error) {
            setNotice(`Could not delete dish: ${error.message}`);
            return;
        }

        setNotice("Dish deleted successfully.");
        await loadData();
    }

    async function toggleAvailability(food) {
        const { error } = await supabase
            .from("food_items")
            .update({ is_available: food.is_available === false })
            .eq("id", food.id);

        if (error) {
            setNotice(`Could not update availability: ${error.message}`);
            return;
        }

        setNotice("Dish availability updated.");
        await loadData();
    }

    function openAddCategory() {
        setEditingCategoryId(null);
        setCategoryForm({ ...initialCategory });
        setCategoryModal(true);
    }

    function openEditCategory(category) {
        setEditingCategoryId(category.id);
        setCategoryForm({
            name: category.name || "",
            description: category.description || "",
            meal_period: category.meal_period || "lunch",
        });
        setCategoryModal(true);
    }

    async function saveCategory(event) {
        event.preventDefault();
        setSaving(true);

        const payload = {
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || null,
            meal_period: categoryForm.meal_period,
        };

        let result;

        if (editingCategoryId !== null) {
            result = await supabase
                .from("food_categories")
                .update(payload)
                .eq("id", editingCategoryId)
                .select()
                .single();
        } else {
            result = await supabase
                .from("food_categories")
                .insert([payload])
                .select()
                .single();
        }

        setSaving(false);

        if (result.error) {
            setNotice(`Could not save category: ${result.error.message}`);
            return;
        }

        setCategoryModal(false);
        setEditingCategoryId(null);
        setCategoryForm({ ...initialCategory });
        setNotice(
            editingCategoryId !== null
                ? "Category updated successfully."
                : "Category created successfully."
        );

        await loadData();

        if (editingCategoryId === null) {
            setSelectedCategory(result.data);
        } else {
            setSelectedCategory(result.data);
        }
    }

    function goBack() {
        setSelectedCategory(null);
        setSearch("");
    }

    async function handleLogout() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            setNotice(`Logout failed: ${error.message}`);
            return;
        }

        navigate("/login", { replace: true });
    }

    function getStockStatus(food) {
        const quantity = Number(food.available_quantity ?? 0);
        const threshold = Number(food.low_stock_threshold ?? 5);

        if (quantity === 0) {
            return { label: "Sold out", color: "#b91c1c" };
        }

        if (quantity <= threshold) {
            return { label: "Low stock", color: "#b45309" };
        }

        return { label: "In stock", color: "#15803d" };
    }

    return (
        <div className="food-app">
            <aside className="sidebar">
                <button className="logo" onClick={goBack}>
                    <span className="logo-mark">✳</span>
                    <span>
                        Crave<span className="logo-accent">ly</span>
                    </span>
                </button>

                <p className="nav-caption">MENU</p>

                <button
                    className="nav-link"
                    onClick={() => navigate("/dashboard")}
                >
                    <span>▥</span> Dashboard
                </button>

                <button className="nav-link active" onClick={goBack}>
                    <span>▦</span> Categories
                </button>

                <div className="sidebar-note">
                    <span className="note-icon">✦</span>
                    <h3>Your menu, organized.</h3>
                    <p>
                        Organize categories by meal period and manage dish stock.
                    </p>
                    <button onClick={openAddCategory}>
                        + New category
                    </button>
                </div>

                <div className="sidebar-footer">
                    <div className="profile-icon">R</div>
                    <div>
                        <strong>Restaurant Admin</strong>
                        <small>Menu manager</small>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        style={{
                            marginLeft: "auto",
                            padding: "8px 10px",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            background: "#ffffff",
                            cursor: "pointer",
                        }}
                    >
                        Logout
                    </button>
                </div>
            </aside>

            <main className="main">
                <header className="topbar">
                    <div className="crumbs">
                        Workspace <span>/</span>{" "}
                        {selectedCategory
                            ? selectedCategory.name
                            : "Categories"}
                    </div>

                    <div className="db-status">
                        <span className="status-dot" />
                        Menu workspace
                    </div>
                </header>

                <section className="content">
                    <div className="hero-row">
                        <div>
                            <p className="overline">RESTAURANT MENU</p>
                            <h1>
                                {selectedCategory
                                    ? selectedCategory.name
                                    : "Manage your menu"}
                            </h1>
                            <p className="subtitle">
                                {selectedCategory
                                    ? `Manage dishes in ${selectedCategory.name}.`
                                    : "Organize categories, meal periods, and stock."}
                            </p>
                        </div>

                        <div className="hero-actions">
                            {selectedCategory && (
                                <>
                                    <button
                                        className="button-light"
                                        onClick={goBack}
                                    >
                                        ← Categories
                                    </button>
                                    <button
                                        className="button-light"
                                        onClick={() =>
                                            openEditCategory(selectedCategory)
                                        }
                                    >
                                        Edit category
                                    </button>
                                </>
                            )}

                            <button
                                className="button-primary"
                                onClick={() =>
                                    selectedCategory
                                        ? openAddDish()
                                        : openAddCategory()
                                }
                            >
                                + {selectedCategory ? "Add dish" : "Add category"}
                            </button>
                        </div>
                    </div>

                    {notice && (
                        <div className="notice">
                            <span>{notice}</span>
                            <button onClick={() => setNotice("")}>×</button>
                        </div>
                    )}

                    {loading ? (
                        <div className="loading-state">Loading menu...</div>
                    ) : !selectedCategory ? (
                        <>
                            <div className="section-title">
                                <div>
                                    <h2>Categories</h2>
                                    <p>
                                        Select a category to manage its dishes.
                                    </p>
                                </div>
                                <span className="count-pill">
                                    {categories.length} categories
                                </span>
                            </div>

                            {categories.length === 0 ? (
                                <div className="empty-state">
                                    <h3>No categories yet</h3>
                                    <p>Create your first category to get started.</p>
                                    <button
                                        className="button-primary"
                                        onClick={openAddCategory}
                                    >
                                        + Create category
                                    </button>
                                </div>
                            ) : (
                                <div className="category-grid">
                                    {categories.map((cat) => {
                                        const count = foods.filter(
                                            (food) =>
                                                Number(food.category_id) ===
                                                Number(cat.id)
                                        ).length;

                                        const mealLabel =
                                            mealPeriods.find(
                                                (period) =>
                                                    period.value === cat.meal_period
                                            )?.label || "Lunch";

                                        return (
                                            <div
                                                className="category-card"
                                                key={cat.id}
                                                style={{
                                                    textAlign: "left",
                                                    cursor: "default",
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCategory(cat);
                                                        setSearch("");
                                                    }}
                                                    style={{
                                                        display: "block",
                                                        width: "100%",
                                                        textAlign: "left",
                                                        border: 0,
                                                        background: "transparent",
                                                        cursor: "pointer",
                                                        color: "inherit",
                                                    }}
                                                >
                                                    <div className="category-simple-icon">
                                                        <span>
                                                            {String(cat.name || "?")
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                        <span className="category-arrow">
                                                            →
                                                        </span>
                                                    </div>

                                                    <div className="category-info">
                                                        <div>
                                                            <h3>{cat.name}</h3>
                                                            <p>
                                                                {cat.description ||
                                                                    "View dishes in this category"}
                                                            </p>
                                                        </div>
                                                        <span className="item-count">
                                                            {count}{" "}
                                                            {count === 1
                                                                ? "item"
                                                                : "items"}
                                                        </span>
                                                    </div>
                                                </button>

                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        marginTop: 12,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            padding: "5px 9px",
                                                            borderRadius: 20,
                                                            background: "#f3f4f6",
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {mealLabel}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="button-light"
                                                        onClick={() =>
                                                            openEditCategory(cat)
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <button
                                        className="add-category-card"
                                        onClick={openAddCategory}
                                    >
                                        <span className="add-circle">+</span>
                                        <strong>Create category</strong>
                                        <span>
                                            Add another section to your menu.
                                        </span>
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="category-banner">
                                <div className="banner-icon">
                                    {selectedCategory.name.charAt(0).toUpperCase()}
                                </div>

                                <div>
                                    <span className="banner-label">
                                        {(
                                            selectedCategory.meal_period || "lunch"
                                        ).toUpperCase()}{" "}
                                        MENU
                                    </span>
                                    <h2>{selectedCategory.name}</h2>
                                    <p>
                                        {selectedCategory.description ||
                                            "Manage the dishes in this category."}
                                    </p>
                                </div>

                                <div className="banner-total">
                                    <strong>
                                        {foods.filter(
                                            (food) =>
                                                Number(food.category_id) ===
                                                Number(selectedCategory.id)
                                        ).length}
                                    </strong>
                                    <span>Dishes</span>
                                </div>
                            </div>

                            <div className="section-title dishes-heading">
                                <div>
                                    <h2>Dishes and stock</h2>
                                    <p>
                                        Track available portions and low-stock alerts.
                                    </p>
                                </div>

                                <div className="search-control">
                                    <span>⌕</span>
                                    <input
                                        placeholder="Search dishes..."
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            {categoryFoods.length === 0 ? (
                                <div className="empty-state">
                                    <h3>No dishes found</h3>
                                    <p>
                                        {search
                                            ? "Try another search term."
                                            : `Add the first dish to ${selectedCategory.name}.`}
                                    </p>
                                    {!search && (
                                        <button
                                            className="button-primary"
                                            onClick={openAddDish}
                                        >
                                            + Add first dish
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="dish-grid">
                                    {categoryFoods.map((food) => {
                                        const stockStatus = getStockStatus(food);

                                        return (
                                            <article
                                                className="dish-card"
                                                key={food.id}
                                            >
                                                <div className="dish-body">
                                                    <div className="dish-title-row">
                                                        <h3>{food.name}</h3>
                                                        <strong>
                                                            ₹
                                                            {Number(
                                                                food.price || 0
                                                            ).toLocaleString("en-IN")}
                                                        </strong>
                                                    </div>

                                                    {food.description && (
                                                        <p className="dish-description">
                                                            {food.description}
                                                        </p>
                                                    )}

                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            gap: 8,
                                                            alignItems: "center",
                                                            margin: "12px 0",
                                                            flexWrap: "wrap",
                                                        }}
                                                    >
                                                        <span>
                                                            Stock:{" "}
                                                            <strong>
                                                                {food.available_quantity ?? 0}
                                                            </strong>
                                                        </span>
                                                        <span
                                                            style={{
                                                                color: stockStatus.color,
                                                                fontSize: 12,
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {stockStatus.label}
                                                        </span>
                                                    </div>

                                                    <p
                                                        style={{
                                                            fontSize: 12,
                                                            color: "#6b7280",
                                                            margin: "0 0 12px",
                                                        }}
                                                    >
                                                        Low-stock alert at{" "}
                                                        {food.low_stock_threshold ?? 5}{" "}
                                                        portions
                                                    </p>

                                                    <div className="dish-actions">
                                                        <button
                                                            className="availability-toggle"
                                                            onClick={() =>
                                                                toggleAvailability(food)
                                                            }
                                                        >
                                                            {food.is_available === false
                                                                ? "+ Enable"
                                                                : "✓ Available"}
                                                        </button>

                                                        <div>
                                                            <button
                                                                title="Edit dish"
                                                                onClick={() =>
                                                                    openEditDish(food)
                                                                }
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                title="Delete dish"
                                                                onClick={() =>
                                                                    deleteDish(food)
                                                                }
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </section>
            </main>

            {dishModal && selectedCategory && (
                <div
                    className="modal-overlay"
                    onClick={() => setDishModal(false)}
                >
                    <form
                        className="modal"
                        onSubmit={saveDish}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="modal-heading">
                            <div>
                                <p className="overline">
                                    {selectedCategory.name}
                                </p>
                                <h2>
                                    {editingId !== null ? "Edit dish" : "Add dish"}
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => setDishModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <label>
                            Dish name
                            <input
                                required
                                value={dishForm.name}
                                onChange={(event) =>
                                    setDishForm({
                                        ...dishForm,
                                        name: event.target.value,
                                    })
                                }
                                placeholder="e.g. Chicken Dum Biryani"
                            />
                        </label>

                        <label>
                            Price (₹)
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={dishForm.price}
                                onChange={(event) =>
                                    setDishForm({
                                        ...dishForm,
                                        price: event.target.value,
                                    })
                                }
                                placeholder="e.g. 220"
                            />
                        </label>

                        <label>
                            Available quantity (portions)
                            <input
                                type="number"
                                min="0"
                                step="1"
                                required
                                value={dishForm.available_quantity}
                                onChange={(event) =>
                                    setDishForm({
                                        ...dishForm,
                                        available_quantity: event.target.value,
                                    })
                                }
                            />
                        </label>

                        <label>
                            Low-stock alert threshold
                            <input
                                type="number"
                                min="0"
                                step="1"
                                required
                                value={dishForm.low_stock_threshold}
                                onChange={(event) =>
                                    setDishForm({
                                        ...dishForm,
                                        low_stock_threshold: event.target.value,
                                    })
                                }
                            />
                        </label>

                        <label className="check-row">
                            <input
                                type="checkbox"
                                checked={dishForm.is_available}
                                onChange={(event) =>
                                    setDishForm({
                                        ...dishForm,
                                        is_available: event.target.checked,
                                    })
                                }
                            />
                            Available to order
                        </label>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="button-light"
                                onClick={() => setDishModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="button-primary"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : editingId !== null
                                        ? "Save changes"
                                        : "Save dish"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {categoryModal && (
                <div
                    className="modal-overlay"
                    onClick={() => setCategoryModal(false)}
                >
                    <form
                        className="modal"
                        onSubmit={saveCategory}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="modal-heading">
                            <div>
                                <p className="overline">MENU ORGANIZATION</p>
                                <h2>
                                    {editingCategoryId !== null
                                        ? "Edit category"
                                        : "New category"}
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => setCategoryModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <label>
                            Category name
                            <input
                                required
                                value={categoryForm.name}
                                onChange={(event) =>
                                    setCategoryForm({
                                        ...categoryForm,
                                        name: event.target.value,
                                    })
                                }
                                placeholder="e.g. Seafood"
                            />
                        </label>

                        <label>
                            Meal period
                            <select
                                required
                                value={categoryForm.meal_period}
                                onChange={(event) =>
                                    setCategoryForm({
                                        ...categoryForm,
                                        meal_period: event.target.value,
                                    })
                                }
                            >
                                {mealPeriods.map((period) => (
                                    <option
                                        key={period.value}
                                        value={period.value}
                                    >
                                        {period.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Description
                            <textarea
                                rows="3"
                                value={categoryForm.description}
                                onChange={(event) =>
                                    setCategoryForm({
                                        ...categoryForm,
                                        description: event.target.value,
                                    })
                                }
                                placeholder="Describe this category (optional)"
                            />
                        </label>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="button-light"
                                onClick={() => setCategoryModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="button-primary"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : editingCategoryId !== null
                                        ? "Save changes"
                                        : "Create category"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
