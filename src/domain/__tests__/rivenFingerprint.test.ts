import { describe, expect, it } from "vitest";
import { getWeaponCatalog } from "../catalog/weaponCatalog";
import { parseAlecaFrameRiven } from "../rivenFingerprint";
import { RIVEN_BASE_WEIGHTS } from "../rivenBaseWeights";

const rivenPath = "/Lotus/Upgrades/Mods/Randomized/LotusRifleRandomModRare";
const maximumEncodedRoll = 0x3fffffff;

describe("AlecaFrame personalized Riven normalization", () => {
  it("derives max-rank displayed percentages from the fingerprint roll", async () => {
    const weapon = getWeaponCatalog().find((entry) => entry.name === "Acceltra");
    expect(weapon).toBeDefined();
    const encodedRoll = Math.round(maximumEncodedRoll / 2);
    const roll = encodedRoll / maximumEncodedRoll;
    const result = await parseAlecaFrameRiven({
      ItemId: { $oid: "synthetic-instance-id" },
      UpgradeFingerprint: {
        compat: weapon!.uniqueName,
        lvl: 2,
        lvlReq: 6,
        rerolls: 4,
        pol: "AP_ATTACK",
        buffs: [{ Tag: "WeaponDamageAmountMod", Value: encodedRoll }],
        curses: [],
      },
    }, rivenPath, "rivens:synthetic", 0);

    const base = RIVEN_BASE_WEIGHTS.LotusRifleRandomModRare.WeaponDamageAmountMod;
    const expected = Math.round(
      base * 1.5 * weapon!.disposition * 10 * (0.9 + 0.2 * roll) * 9 * 100 * 10,
    ) / 10;
    expect(result.record.importStatus).toBe("ready");
    expect(result.record.sourceRank).toBe(2);
    expect(result.record.stats).toEqual([{ stat: "damage", value: expected }]);
    expect(result.record.sourceAttributes).toEqual([
      { tag: "WeaponDamageAmountMod", roll, polarity: "positive" },
    ]);
    expect(result.record.name).toBe("Acceltra Riven");
    expect(result.record.id).not.toContain("synthetic-instance-id");
  });

  it("retains a Riven with unknown rank without deriving or fabricating stats", async () => {
    const weapon = getWeaponCatalog().find((entry) => entry.name === "Acceltra");
    expect(weapon).toBeDefined();
    const result = await parseAlecaFrameRiven({
      ItemId: "synthetic-instance-id",
      UpgradeFingerprint: {
        compat: weapon!.uniqueName,
        lvlReq: 6,
        pol: "AP_ATTACK",
        buffs: [{ Tag: "WeaponDamageAmountMod", Value: Math.round(maximumEncodedRoll / 2) }],
      },
    }, rivenPath, "rivens:synthetic", 0);

    expect(result.record.importStatus).toBe("rank-unknown");
    expect(result.record.sourceRank).toBeNull();
    expect(result.record.stats).toEqual([]);
    expect(result.record.sourceAttributes).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes("rank"))).toBe(true);
  });
});
