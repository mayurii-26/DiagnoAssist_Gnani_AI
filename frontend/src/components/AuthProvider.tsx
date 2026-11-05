"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { updateDoctorPresence } from "@/lib/consultationService";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signOut: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

const PUBLIC_ROUTES = ["/login", "/signup", "/"];

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const supabase = createClient();

        // Check current session on mount
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setLoading(false);
            setInitialized(true);
        });

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                const currentUser = session?.user ?? null;
                setUser(currentUser);
                setLoading(false);
                setInitialized(true);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Route protection — only runs AFTER initial auth check
    useEffect(() => {
        if (!initialized) return;

        const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

        if (!user && !isPublicRoute) {
            router.replace("/login");
        }
        // Don't auto-redirect authenticated users away from login/signup
        // They'll be redirected after form submission instead
    }, [user, initialized, pathname, router]);

    const signOut = useCallback(async () => {
        const supabase = createClient();

        // If user was a doctor, mark them offline before signing out
        if (user && user.user_metadata?.role === "doctor") {
            try {
                await updateDoctorPresence(user.id, false);
            } catch (err) {
                console.warn("Could not clean up doctor presence on signOut:", err);
            }
        }

        await supabase.auth.signOut();
        setUser(null);
        router.replace("/login");
    }, [user, router]);

    // Show loading only on initial mount
    if (!initialized) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                background: "#F8FAFB",
                fontFamily: "'Inter', sans-serif",
                color: "#64748B",
                fontSize: "0.9rem",
            }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        width: 36,
                        height: 36,
                        border: "3px solid #E2E8F0",
                        borderTopColor: "#0F7B8A",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        margin: "0 auto 12px",
                    }} />
                    Loading...
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
