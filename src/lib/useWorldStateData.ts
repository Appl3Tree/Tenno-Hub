import { useEffect, useState, useSyncExternalStore } from "react";
import {
    getWorldStateSnapshot,
    subscribeWorldState,
    type WorldStateData,
    type WorldStateSnapshot,
} from "./worldStateCache";

export function useWorldStateSnapshot(): WorldStateSnapshot {
    return useSyncExternalStore(subscribeWorldState, getWorldStateSnapshot, getWorldStateSnapshot);
}

export function useWorldStateData(): WorldStateData | null {
    return useWorldStateSnapshot().data;
}

/** Local clock for expiry-aware World State selectors; it does not trigger network requests. */
export function useWorldStateNow(): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    return now;
}
