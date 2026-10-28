
import { useNavigate } from "react-router-dom";

const sections = [
    {
        title: "Dashboard",
        description: "View restaurant performance, sales, and order summaries.",
        path: "/dashboard",
        icon: "▦",
    },
    {
        title: "Categories",
        description: "Add categories, manage dishes, and monitor food availability.",
        path: "/categories",
        icon: "◈",
    },
    {
        title: "Orders",
        description: "Review customer orders and manage their progress.",
        path: "/orders",
        icon: "▤",
    },
    {
        title: "Tickets",
        description: "Review customer requests and manage support tickets.",
        path: "/tickets",
        icon: "◇",
    },
];

export default function ManagerHome() {
    const navigate = useNavigate();

    return (
        <main className="manager-home">
            <header className="manager-home-header">
                <div>
                    <p className="manager-eyebrow">CRAVELY MANAGEMENT</p>
                    <h1>Manager Home</h1>
                    <p className="manager-home-subtitle">
                        Manage your restaurant from one place.
                    </p>
                </div>
            </header>

            <section className="manager-home-grid">
                {sections.map((section) => (
                    <button
                        type="button"
                        key={section.path}
                        className="manager-home-card"
                        onClick={() => navigate(section.path)}
                    >
                        <span className="manager-home-icon" aria-hidden="true">
                            {section.icon}
                        </span>

                        <h2>{section.title}</h2>
                        <p>{section.description}</p>

                        <span className="manager-home-open">
                            Open section <span aria-hidden="true">→</span>
                        </span>
                    </button>
                ))}
            </section>
        </main>
    );
}
