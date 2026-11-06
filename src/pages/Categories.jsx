import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit3, Plus, Search } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ManagerLayout from "../components/ManagerLayout";
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
        `Database error: ${
          categoryResult.error?.message || foodResult.error?.message
        }`
      );
      setLoading(false);
      return;
    }

    const nextCategories = categoryResult.data || [];
    setCategories(nextCategories);
    setFoods(foodResult.data || []);

    if (selectedCategory) {
      const updatedCategory = nextCategories.find(
        (category) => Number(category.id) === Number(selectedCategory.id)
      );
      setSelectedCategory(updatedCategory || null);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
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
      result = await supabase.from("food_items").insert([payload]);
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

    if (result.data) {
      setSelectedCategory(result.data);
    }
  }

  function goBack() {
    setSelectedCategory(null);
    setSearch("");
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

  const breadcrumbs = selectedCategory
    ? [
        { label: "Categories", path: "/categories" },
        { label: selectedCategory.name },
      ]
    : [{ label: "Categories" }];

  return (
    <ManagerLayout
      title={selectedCategory ? selectedCategory.name : "Menu & Dish Inventory"}
      subtitle={
        selectedCategory
          ? `Manage dish details, prices, and portion availability for ${selectedCategory.name}.`
          : "Organize food categories, assign meal periods, and track portion levels."
      }
      breadcrumbs={breadcrumbs}
      onRefresh={loadData}
      refreshing={loading}
      actions={
        <>
          {selectedCategory ? (
            <>
              <button
                type="button"
                className="manager-btn-secondary"
                onClick={goBack}
              >
                <ArrowLeft size={16} />
                <span>All Categories</span>
              </button>
              <button
                type="button"
                className="manager-btn-secondary"
                onClick={() => openEditCategory(selectedCategory)}
              >
                <Edit3 size={16} />
                <span>Edit Category</span>
              </button>
              <button
                type="button"
                className="manager-btn-primary"
                onClick={openAddDish}
              >
                <Plus size={16} />
                <span>Add Dish</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="manager-btn-primary"
              onClick={openAddCategory}
            >
              <Plus size={16} />
              <span>Create Category</span>
            </button>
          )}
        </>
      }
    >
      <div className="food-app" style={{ minHeight: "auto", background: "transparent" }}>
        {notice && (
          <div className="notice" style={{ marginBottom: "20px" }}>
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Loading menu data...</div>
        ) : !selectedCategory ? (
          <>
            <div className="section-title">
              <div>
                <h2>Categories</h2>
                <p>Select a category to view and manage its dishes.</p>
              </div>
              <span className="count-pill">
                {categories.length} {categories.length === 1 ? "category" : "categories"}
              </span>
            </div>

            {categories.length === 0 ? (
              <div className="empty-state">
                <h3>No categories yet</h3>
                <p>Create your first menu category to get started.</p>
                <button
                  className="manager-btn-primary"
                  onClick={openAddCategory}
                >
                  <Plus size={16} />
                  <span>Create Category</span>
                </button>
              </div>
            ) : (
              <div className="category-grid">
                {categories.map((cat) => {
                  const count = foods.filter(
                    (food) => Number(food.category_id) === Number(cat.id)
                  ).length;

                  const mealLabel =
                    mealPeriods.find(
                      (period) => period.value === cat.meal_period
                    )?.label || "Lunch";

                  return (
                    <div
                      className="category-card"
                      key={cat.id}
                      style={{ textAlign: "left", cursor: "default" }}
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
                          padding: "16px 16px 8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "14px",
                          }}
                        >
                          <span
                            style={{
                              width: "44px",
                              height: "44px",
                              display: "grid",
                              placeItems: "center",
                              borderRadius: "12px",
                              background: "#EAF1E7",
                              color: "#263C2E",
                              fontWeight: 800,
                              fontSize: "18px",
                            }}
                          >
                            {String(cat.name || "?").charAt(0).toUpperCase()}
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#387A55",
                            }}
                          >
                            Open Dishes →
                          </span>
                        </div>

                        <div>
                          <h3
                            style={{
                              margin: "0 0 6px",
                              fontSize: "16px",
                              fontWeight: 800,
                              color: "#263C2E",
                            }}
                          >
                            {cat.name}
                          </h3>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "12.5px",
                              color: "#697064",
                              lineHeight: 1.5,
                              minHeight: "36px",
                            }}
                          >
                            {cat.description || "Browse dishes in this category."}
                          </p>
                        </div>
                      </button>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          padding: "12px 16px 16px",
                          borderTop: "1px solid #F0F2EB",
                        }}
                      >
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "#EAF1E7",
                              color: "#263C2E",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {mealLabel}
                          </span>
                          <span className="item-count">
                            {count} {count === 1 ? "dish" : "dishes"}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="button-light"
                          style={{ padding: "6px 10px", fontSize: "11.5px" }}
                          onClick={() => openEditCategory(cat)}
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
                  style={{ minHeight: "180px" }}
                >
                  <span className="add-circle">+</span>
                  <strong>Create category</strong>
                  <span>Add another section to your menu.</span>
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
                  {(selectedCategory.meal_period || "lunch").toUpperCase()} MENU
                </span>
                <h2>{selectedCategory.name}</h2>
                <p>
                  {selectedCategory.description ||
                    "Manage dishes and inventory for this section."}
                </p>
              </div>

              <div className="banner-total">
                <strong>
                  {
                    foods.filter(
                      (food) =>
                        Number(food.category_id) === Number(selectedCategory.id)
                    ).length
                  }
                </strong>
                <span>Dishes</span>
              </div>
            </div>

            <div className="section-title dishes-heading">
              <div>
                <h2>Dishes and Stock</h2>
                <p>Track available portions, pricing, and availability flags.</p>
              </div>

              <div className="search-control">
                <Search size={16} />
                <input
                  placeholder="Search dishes..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            {categoryFoods.length === 0 ? (
              <div className="empty-state">
                <h3>No dishes found</h3>
                <p>
                  {search
                    ? "Try another search keyword."
                    : `Add the first dish to ${selectedCategory.name}.`}
                </p>
                {!search && (
                  <button className="manager-btn-primary" onClick={openAddDish}>
                    <Plus size={16} />
                    <span>Add First Dish</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="dish-grid">
                {categoryFoods.map((food) => {
                  const stockStatus = getStockStatus(food);

                  return (
                    <article className="dish-card" key={food.id}>
                      <div className="dish-body">
                        <div className="dish-title-row">
                          <h3>{food.name}</h3>
                          <strong>
                            ₹{Number(food.price || 0).toLocaleString("en-IN")}
                          </strong>
                        </div>

                        {food.description && (
                          <p className="dish-description">{food.description}</p>
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
                          <span style={{ fontSize: "12px", color: "#384033" }}>
                            Stock:{" "}
                            <strong style={{ color: "#263C2E" }}>
                              {food.available_quantity ?? 0} portions
                            </strong>
                          </span>
                          <span
                            style={{
                              color: stockStatus.color,
                              fontSize: 12,
                              fontWeight: 700,
                              background:
                                stockStatus.label === "Sold out"
                                  ? "#FEE2E2"
                                  : stockStatus.label === "Low stock"
                                  ? "#FEF3C7"
                                  : "#DCFCE7",
                              padding: "2px 8px",
                              borderRadius: "999px",
                            }}
                          >
                            {stockStatus.label}
                          </span>
                        </div>

                        <p
                          style={{
                            fontSize: 11.5,
                            color: "#697064",
                            margin: "0 0 12px",
                          }}
                        >
                          Low-stock alert threshold:{" "}
                          <strong>{food.low_stock_threshold ?? 5} portions</strong>
                        </p>

                        <div className="dish-actions">
                          <button
                            className="availability-toggle"
                            onClick={() => toggleAvailability(food)}
                          >
                            {food.is_available === false
                              ? "✕ Hidden (Enable)"
                              : "✓ Available"}
                          </button>

                          <div>
                            <button
                              title="Edit dish"
                              onClick={() => openEditDish(food)}
                            >
                              Edit
                            </button>
                            <button
                              title="Delete dish"
                              onClick={() => deleteDish(food)}
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
      </div>

      {/* Dish Modal */}
      {dishModal && selectedCategory && (
        <div className="modal-overlay" onClick={() => setDishModal(false)}>
          <form
            className="modal"
            onSubmit={saveDish}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="overline">{selectedCategory.name}</p>
                <h2>{editingId !== null ? "Edit dish" : "Add dish"}</h2>
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
                className="manager-btn-primary"
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

      {/* Category Modal */}
      {categoryModal && (
        <div className="modal-overlay" onClick={() => setCategoryModal(false)}>
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
                  <option key={period.value} value={period.value}>
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
                className="manager-btn-primary"
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
    </ManagerLayout>
  );
}
