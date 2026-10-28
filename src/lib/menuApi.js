import { supabase } from "./supabaseClient";

export async function getMenu() {
    const { data, error } = await supabase
        .from("food_categories")
        .select(`
      id,
      name,
      description,
      food_items (
        id,
        category_id,
        name,
        price,
        preparation_time,
        is_available
      )
    `)
        .order("name");

    if (error) {
        throw error;
    }

    return data.map((category) => ({
        category_id: category.id,
        category_name: category.name,
        varieties: (category.food_items || []).map((food) => ({
            food_id: food.id,
            name: food.name,
            price: food.price,
            preparation_time: food.preparation_time,
            is_available: food.is_available,
        })),
    }));
}