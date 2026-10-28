
import { useEffect, useState } from "react";
import { getMenu } from "./lib/menuApi";

export default function MenuList() {
    const [menu, setMenu] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        getMenu()
            .then(setMenu)
            .catch((err) => setError(err.message));
    }, []);

    if (error) return <p>Error: {error}</p>;

    return (
        <div>
            {menu.map((category) => (
                <section key={category.category_id}>
                    <h2>
                        {category.category_name}
                        {" "} (ID: {category.category_id})
                    </h2>

                    {category.varieties.map((food) => (
                        <p key={food.food_id}>
                            {food.name} — ₹{food.price}
                            {" "}— {food.preparation_time} min
                        </p>
                    ))}
                </section>
            ))}
        </div>
    );
}
