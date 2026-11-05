"use client";

import { useEffect, useRef, useState } from "react";
import { updateDoctorPresence } from "@/lib/consultationService";
import { useAuth } from "@/components/AuthProvider";

const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

export function useDoctorPresence() {
    const { user } = useAuth();
    const [isOnline, setIsOnline] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const isDoctor = user?.user_metadata?.role === "doctor";
    const userId = user?.id;

    useEffect(() => {
        if (!isDoctor || !userId) {
            setIsOnline(false);
            return;
        }

        let isMounted = true;

        // 1. Mark doctor online immediately on mount
        updateDoctorPresence(userId, true)
            .then(() => {
                if (isMounted) setIsOnline(true);
            })
            .catch((err) => console.error("Failed to mark doctor online:", err));

        // 2. Set up 30-second heartbeat
        intervalRef.current = setInterval(() => {
            updateDoctorPresence(userId, true).catch((err) =>
                console.error("Presence heartbeat error:", err)
            );
        }, HEARTBEAT_INTERVAL_MS);

        // 3. Mark offline on window close or tab exit
        const handleBeforeUnload = () => {
            // Best-effort presence cleanup
            updateDoctorPresence(userId, false);
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        // 4. Cleanup on unmount (e.g. route change away or logout)
        return () => {
            isMounted = false;
            window.removeEventListener("beforeunload", handleBeforeUnload);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            updateDoctorPresence(userId, false).catch(() => {});
        };
    }, [isDoctor, userId]);

    return { isOnline };
}

