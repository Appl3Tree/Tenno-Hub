import { useWorldStateData } from "./useWorldStateData";
import type { VaultTrader } from "./worldStateCache";

/** Prime Resurgence is projected from the same World State snapshot as every other consumer. */
export function useVaultTraderData(): VaultTrader | null {
    return useWorldStateData()?.vaultTrader ?? null;
}
