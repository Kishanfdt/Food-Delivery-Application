
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AuthPanel from "../components/AuthPanel";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
    const navigate = useNavigate();

    const handleSessionChange = useCallback(
        async (session) => {
            if (!session) return;

            const { data, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .maybeSingle();

            if (error) {
                console.error("Could not load account role:", error.message);
                return;
            }

            if (data?.role === "manager") {
                navigate("/dashboard", { replace: true });
            } else if (data?.role === "customer") {
                navigate("/customer", { replace: true });
            } else {
                console.error("No valid role was found for this account.");
            }
        },
        [navigate]
    );

    return <AuthPanel onSessionChange={handleSessionChange} />;
}
