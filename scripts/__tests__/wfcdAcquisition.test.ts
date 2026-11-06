import { describe, expect, it } from "vitest";
import {
    normalizeWfcdAcquisitionName,
    resolveWfcdAcquisitionItemName,
} from "../lib/wfcdAcquisition";

describe("WFCD acquisition item-name resolution", () => {
    it("resolves an owner-qualified syndicate augment to its canonical AugmentCard", () => {
        const nameIndex = new Map([
            [normalizeWfcdAcquisitionName("Aegis Gale"), "items:/Lotus/Powersuits/IronFrame/IronFrameEruptionAugmentCard"],
        ]);

        expect(resolveWfcdAcquisitionItemName("Aegis Gale (Hildryn)", nameIndex))
            .toBe("items:/Lotus/Powersuits/IronFrame/IronFrameEruptionAugmentCard");
    });

    it("prefers an exact match and does not strip arbitrary parenthetical names", () => {
        const nameIndex = new Map([
            [normalizeWfcdAcquisitionName("Beacon (Prime)"), "items:/Lotus/Items/BeaconPrime"],
            [normalizeWfcdAcquisitionName("Beacon"), "items:/Lotus/Items/Beacon"],
        ]);

        expect(resolveWfcdAcquisitionItemName("Beacon (Prime)", nameIndex))
            .toBe("items:/Lotus/Items/BeaconPrime");
        expect(resolveWfcdAcquisitionItemName("Unknown (Prime)", nameIndex)).toBeNull();
    });

    it("strips a leading quantity before exact item-name matching", () => {
        const nameIndex = new Map([
            [normalizeWfcdAcquisitionName("Synthesis Scanner"), "items:/Lotus/Items/Scanner"],
        ]);

        expect(resolveWfcdAcquisitionItemName("25x Synthesis Scanner", nameIndex))
            .toBe("items:/Lotus/Items/Scanner");
    });
});
