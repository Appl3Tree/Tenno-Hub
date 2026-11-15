import { describe, expect, it } from "vitest";
import { getWeaponCatalog } from "../weaponCatalog";
import {
    buildIncarnonCandidateConfigs,
    getIncarnonRecordForWeapon,
    resolveIncarnonState,
    selectIncarnonSearchShortlist,
} from "../incarnonCatalog";

describe("incarnonCatalog", () => {
    it("finds records for Incarnon Genesis variants and native Incarnons", () => {
        const weapons = getWeaponCatalog();
        const telosBoltor = weapons.find((weapon) => weapon.name === "Telos Boltor") ?? null;
        const phenmor = weapons.find((weapon) => weapon.name === "Phenmor") ?? null;
        const thalys = weapons.find((weapon) => weapon.name === "Thalys") ?? null;

        expect(telosBoltor).toBeTruthy();
        expect(phenmor).toBeTruthy();
        expect(thalys).toBeTruthy();
        expect(getIncarnonRecordForWeapon(telosBoltor)?.kind).toBe("genesis");
        expect(getIncarnonRecordForWeapon(phenmor)?.kind).toBe("native");
        expect(getIncarnonRecordForWeapon(thalys)?.tiers.some((tier) => tier.tier === 1)).toBe(true);
    });

    it("applies static Incarnon stat adjustments to the selected weapon", () => {
        const weapons = getWeaponCatalog();
        const bratonPrime = weapons.find((weapon) => weapon.name === "Braton Prime");
        expect(bratonPrime).toBeTruthy();

        const resolved = resolveIncarnonState(bratonPrime!, 0, {
            unlockedTier: 4,
            selectedOptionsByTier: {
                4: "tier-4-critical-parallel",
            },
        });

        expect(resolved.weapon.attacks[0]?.critChance).toBeCloseTo(0.3, 5);
        expect(resolved.weapon.attacks[0]?.critMultiplier).toBeCloseTo(2.2, 5);
    });

    it("uses current Torid Wiki evolution stats and scopes its magazine bonus to normal form", () => {
        const torid = getWeaponCatalog().find((weapon) => weapon.name === "Torid");
        expect(torid).toBeTruthy();
        const record = getIncarnonRecordForWeapon(torid!);
        expect(record).toBeTruthy();

        const finalFusillade = record!.tiers.find((tier) => tier.tier === 2)?.options
            .find((option) => option.id === "tier-2-final-fusillade");
        expect(finalFusillade?.descriptionLines).toEqual([
            "Increase Base Damage by +51.",
            "+3 Multishot on last shot in magazine.",
        ]);
        expect(finalFusillade?.model.adjustments).toContainEqual(expect.objectContaining({
            scope: "all",
            baseDamageFlat: 51,
        }));
        expect(finalFusillade?.model.unsupportedLines).toContain("+3 Multishot on last shot in magazine.");

        const normal = resolveIncarnonState(torid!, 0, {
            unlockedTier: 4,
            selectedOptionsByTier: {
                3: "tier-3-extended-volley",
                4: "tier-4-commodore-s-fortune",
            },
        });
        const incarnonAttack = torid!.attacks.findIndex((attack) => /incarnon form/i.test(attack.name));
        expect(incarnonAttack).toBeGreaterThanOrEqual(0);
        const transformed = resolveIncarnonState(torid!, incarnonAttack, {
            unlockedTier: 4,
            selectedOptionsByTier: {
                3: "tier-3-extended-volley",
                4: "tier-4-commodore-s-fortune",
            },
        });

        expect(normal.weapon.attacks[0]?.damage.total).toBeCloseTo(100, 5);
        expect(normal.weapon.magazineSize).toBe(14);
        expect(normal.weapon.attacks[0]?.critChance).toBeCloseTo(0.35, 5);
        expect(transformed.weapon.magazineSize).toBe(torid!.magazineSize);
        expect(transformed.weapon.attacks[incarnonAttack]?.critChance).toBeCloseTo(0.49, 5);
        expect(transformed.weapon.attacks[incarnonAttack]?.damage.total).toBeCloseTo(51, 5);

        const elementalBalance = resolveIncarnonState(torid!, incarnonAttack, {
            unlockedTier: 4,
            selectedOptionsByTier: { 4: "tier-4-elemental-balance" },
        });
        expect(elementalBalance.weapon.attacks[incarnonAttack]?.statusChance).toBeCloseTo(0.73, 5);
        expect(elementalBalance.appliedOptions[0]?.model.unsupportedLines).toEqual([]);
    });

    it("resolves legacy Incarnon stat wording and values for each weapon variant", () => {
        const boVariants = [
            { name: "Bo", baseDamage: 110, critChance: 0.12, statusChance: 0.12 },
            { name: "Mk1-Bo", baseDamage: 90, critChance: 0.15, statusChance: 0.15 },
            { name: "Bo Prime", baseDamage: 34, critChance: 0.06, statusChance: 0.06 },
        ];

        for (const expected of boVariants) {
            const record = getIncarnonRecordForWeapon(expected.name);
            const baseDamage = record?.tiers.find((tier) => tier.tier === 2)?.options
                .find((option) => option.id === "tier-2-stalwart-oak");
            const combinedChance = record?.tiers.find((tier) => tier.tier === 4)?.options
                .find((option) => option.id === "tier-4-subtle-force");

            expect(baseDamage?.descriptionLines[0]).toContain(`+${expected.baseDamage}.`);
            expect(baseDamage?.model.adjustments[0]?.baseDamageFlat).toBe(expected.baseDamage);
            expect(combinedChance?.descriptionLines).toContain(`Increase Base Critical Chance by +${expected.critChance * 100}%.`);
            expect(combinedChance?.descriptionLines).toContain(`Increase Base Status Chance by +${expected.statusChance * 100}%.`);
            expect(combinedChance?.model.adjustments[0]?.critChanceFlat).toBe(expected.critChance);
            expect(combinedChance?.model.adjustments[0]?.statusChanceFlat).toBe(expected.statusChance);
            expect(baseDamage?.model.unsupportedLines.filter((line) => /increase (?:base )?(?:damage|critical chance|status chance|critical damage multiplier)/i.test(line))).toEqual([]);
            expect(combinedChance?.model.unsupportedLines.filter((line) => /increase (?:base )?(?:damage|critical chance|status chance|critical damage multiplier)/i.test(line))).toEqual([]);
        }

        const standardAngstrum = getIncarnonRecordForWeapon("Angstrum")?.tiers
            .find((tier) => tier.tier === 4)?.options
            .find((option) => option.id === "tier-4-critical-parallel");
        const prismaAngstrum = getIncarnonRecordForWeapon("Prisma Angstrum")?.tiers
            .find((tier) => tier.tier === 4)?.options
            .find((option) => option.id === "tier-4-critical-parallel");

        expect(standardAngstrum?.model.adjustments[0]?.critChanceFlat).toBe(0.14);
        expect(prismaAngstrum?.model.adjustments[0]?.critChanceFlat).toBe(0.1);
        expect(standardAngstrum?.model.adjustments[0]?.critMultiplierFlat).toBe(0.2);
        expect(prismaAngstrum?.model.adjustments[0]?.critMultiplierFlat).toBe(0.2);
        expect(standardAngstrum?.model.unsupportedLines.filter((line) => /increase (?:base )?(?:damage|critical chance|status chance|critical damage multiplier)/i.test(line))).toEqual([]);
        expect(prismaAngstrum?.model.unsupportedLines.filter((line) => /increase (?:base )?(?:damage|critical chance|status chance|critical damage multiplier)/i.test(line))).toEqual([]);
    });

    it("parses corrected Burston, Gorgon, and Latron Wiki values without leaking form-specific magazine notes", () => {
        const burstonValues = [
            { name: "Burston", absoluteDamage: 42, magazine: 21 },
            { name: "Burston Prime", absoluteDamage: 42, magazine: 21 },
        ];
        for (const expected of burstonValues) {
            const weapon = getWeaponCatalog().find((entry) => entry.name === expected.name);
            const record = getIncarnonRecordForWeapon(expected.name);
            expect(weapon).toBeTruthy();
            expect(record).toBeTruthy();
            const finality = record!.tiers.find((tier) => tier.tier === 2)?.options
                .find((option) => option.id === "tier-2-forceful-finality");
            const volley = record!.tiers.find((tier) => tier.tier === 3)?.options
                .find((option) => option.id === "tier-3-extended-volley");
            expect(finality?.model.adjustments.find((adjustment) => adjustment.baseDamageFlat !== undefined)?.baseDamageFlat)
                .toBe(expected.absoluteDamage);
            expect(finality?.model.unsupportedLines).toContain("+5 Base Multishot on final magazine burst.");

            const incarnonAttack = weapon!.attacks.findIndex((attack) => /incarnon form/i.test(attack.name));
            expect(incarnonAttack).toBeGreaterThanOrEqual(0);
            const transformed = resolveIncarnonState(weapon!, incarnonAttack, {
                unlockedTier: 3,
                selectedOptionsByTier: {
                    2: "tier-2-forceful-finality",
                    3: "tier-3-extended-volley",
                },
            });
            expect(transformed.weapon.attacks[incarnonAttack]?.damage.total)
                .toBeCloseTo((weapon!.attacks[incarnonAttack]?.damage.total ?? 0) + expected.absoluteDamage, 5);
            expect(transformed.weapon.magazineSize).toBe(weapon!.magazineSize);
            if (expected.magazine > 0) {
                expect(volley?.model.adjustments).toContainEqual(expect.objectContaining({
                    scope: "normal",
                    magazineSizeFlat: expected.magazine,
                }));
            }
        }

        for (const [name, damage, critChance, critMultiplier] of [
            ["Latron", 48, 0.3, 0.6],
            ["Latron Wraith", 12, 0.24, 0.2],
            ["Latron Prime", 6, 0.24, 0.2],
        ] as const) {
            const record = getIncarnonRecordForWeapon(name);
            const targetDamage = record?.tiers.find((tier) => tier.tier === 2)?.options
                .find((option) => option.id === "tier-2-riddled-target");
            const critical = record?.tiers.find((tier) => tier.tier === 4)?.options
                .find((option) => option.id === "tier-4-critical-parallel");
            expect(targetDamage?.model.adjustments[0]?.baseDamageFlat).toBe(damage);
            expect(critical?.model.adjustments[0]?.critChanceFlat).toBe(critChance);
            expect(critical?.model.adjustments[0]?.critMultiplierFlat).toBe(critMultiplier);
        }

        for (const [name, damage] of [["Gorgon", 10], ["Gorgon Wraith", 5], ["Prisma Gorgon", 5]] as const) {
            const passive = getIncarnonRecordForWeapon(name)?.tiers.find((tier) => tier.tier === 2)?.options
                .find((option) => option.id === "tier-2-hunter-s-mantra");
            expect(passive?.model.adjustments[0]?.baseDamageFlat).toBe(damage);
        }

        const affliction = getIncarnonRecordForWeapon("Angstrum")?.tiers.find((tier) => tier.tier === 4)?.options
            .find((option) => option.id === "tier-4-fatal-affliction");
        expect(affliction?.model.effects.flatMap((entry) => entry.effect.directDamagePerStatusBonus)).toContain(0.4);
        expect(affliction?.model.unsupportedLines).not.toContain("+40% Direct Damage per Status Type affecting the target.");
    });

    it("does not auto-apply an evolution when no tier is selected", () => {
        const weapons = getWeaponCatalog();
        const bratonPrime = weapons.find((weapon) => weapon.name === "Braton Prime");
        expect(bratonPrime).toBeTruthy();

        const resolved = resolveIncarnonState(bratonPrime!, 0, {
            unlockedTier: 5,
            selectedOptionsByTier: {},
        });

        expect(resolved.appliedOptions).toHaveLength(0);
        expect(resolved.activeEffects).toHaveLength(0);
        expect(resolved.weapon.attacks[0]?.critChance).toBeCloseTo(bratonPrime!.attacks[0]?.critChance ?? 0, 5);
    });

    it("surfaces modeled Incarnon perk effects for optimizer scoring", () => {
        const weapons = getWeaponCatalog();
        const phenmor = weapons.find((weapon) => weapon.name === "Phenmor");
        expect(phenmor).toBeTruthy();

        const resolved = resolveIncarnonState(phenmor!, 0, {
            unlockedTier: 2,
            selectedOptionsByTier: {
                2: "tier-2-rapid-wrath",
            },
        });

        expect(resolved.activeEffects.some((effect) => effect.fireRateBonus === 0.2)).toBe(true);
    });

    it("models Devouring Attrition as a probabilistic noncritical damage bonus", () => {
        for (const weaponName of ["Laetum", "Phenmor"]) {
            const option = getIncarnonRecordForWeapon(weaponName)?.tiers
                .find((tier) => tier.tier === 5)?.options
                .find((candidate) => candidate.id === "tier-5-devouring-attrition");

            expect(option?.model.effects.flatMap((entry) => entry.effect.nonCriticalHitDamageProcs ?? [])).toEqual([
                { chance: 0.5, damageBonus: 20 },
            ]);
            expect(option?.model.unsupportedLines).toEqual([]);
        }

        const laetumOption = getIncarnonRecordForWeapon("Laetum")?.tiers
            .find((tier) => tier.tier === 5)?.options
            .find((candidate) => candidate.id === "tier-5-devouring-attrition");
        expect(laetumOption?.descriptionLines).not.toContain("Bosses ignore this perk.");
    });

    it("models Overwhelming Attrition as a decaying noncritical, statusless hit-group bonus", () => {
        const option = getIncarnonRecordForWeapon("Laetum")?.tiers
            .find((tier) => tier.tier === 5)?.options
            .find((candidate) => candidate.id === "tier-5-overwhelming-attrition");
        const conditional = option?.model.effects.flatMap((entry) => entry.effect.conditionalEffects)
            .find((effect) => effect.trigger === "onNonCriticalNoStatusHit");

        expect(conditional).toEqual({
            trigger: "onNonCriticalNoStatusHit",
            durationSeconds: 10,
            requiresAiming: false,
            maxStacks: 3,
            stats: { damageBonus: 4 },
        });
        expect(option?.model.unsupportedLines).toEqual([]);
    });

    it("models Braton Prime Munitions Grit extra-projectile damage in both forms", () => {
        const bratonPrime = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(bratonPrime).toBeTruthy();
        const incarnonAttack = bratonPrime!.attacks.findIndex((attack) => /incarnon form$/i.test(attack.name));
        expect(incarnonAttack).toBeGreaterThanOrEqual(0);
        const config = {
            unlockedTier: 2,
            selectedOptionsByTier: { 2: "tier-2-munitions-grit" },
        } as const;

        const normal = resolveIncarnonState(bratonPrime!, 0, config);
        const transformed = resolveIncarnonState(bratonPrime!, incarnonAttack, config);

        for (const resolved of [normal, transformed]) {
            expect(resolved.activeEffects.some((effect) => effect.multishotBonus === 0.2)).toBe(true);
            expect(resolved.activeEffects.some((effect) => effect.multishotDamageBonus === 0.54)).toBe(true);
            expect(resolved.appliedOptions[0]?.model.unsupportedLines).toEqual([]);
        }
    });

    it("keeps unsupported conditional Incarnon bonuses out of unconditional effects", () => {
        const bratonOption = getIncarnonRecordForWeapon("Braton Prime")?.tiers
            .find((tier) => tier.tier === 2)?.options
            .find((option) => option.id === "tier-2-daring-reverie");
        expect(bratonOption?.model.unsupportedLines.some((line) => /^With Channeled Ability active:/i.test(line))).toBe(true);
        expect(bratonOption?.model.effects.flatMap((entry) => [
            entry.effect.ammoEfficiencyBonus,
            ...entry.effect.conditionalEffects.map((effect) => effect.stats.ammoEfficiencyBonus ?? 0),
        ])).not.toContain(0.5);

        const deraOption = getIncarnonRecordForWeapon("Dera")?.tiers
            .find((tier) => tier.tier === 2)?.options
            .find((option) => option.id === "tier-2-paragon-essence");
        expect(deraOption?.model.unsupportedLines.some((line) => /^On Status Effect:/i.test(line))).toBe(true);
        expect(deraOption?.model.effects.flatMap((entry) => [
            entry.effect.fireRateBonus,
            ...entry.effect.conditionalEffects.map((effect) => effect.stats.fireRateBonus ?? 0),
        ])).not.toContain(0.05);

        const boltorOption = getIncarnonRecordForWeapon("Boltor Prime")?.tiers
            .find((tier) => tier.tier === 2)?.options
            .find((option) => option.id === "tier-2-crimson-overture");
        expect(boltorOption?.model.unsupportedLines.some((line) => /^On Kill:.*Ammo Efficiency/i.test(line))).toBe(false);
        expect(boltorOption?.model.unsupportedLines.some((line) => /^On Kill: Increase Damage by \+2/i.test(line))).toBe(true);
        expect(boltorOption?.model.effects.flatMap((entry) => [
            entry.effect.ammoEfficiencyBonus,
            ...entry.effect.conditionalEffects.map((effect) => effect.stats.ammoEfficiencyBonus ?? 0),
        ])).not.toContain(0.2);
    });

    it("keeps the manually selected evolution path when path optimization is disabled", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime");
        const record = getIncarnonRecordForWeapon(weapon ?? null);
        expect(record).toBeTruthy();
        const selected = { 2: "tier-2-accurate-salvos", 4: "tier-4-critical-parallel" } as const;

        expect(buildIncarnonCandidateConfigs(record!, selected, false)).toEqual([{
            unlockedTier: 4,
            selectedOptionsByTier: selected,
        }]);
    });

    it("searches only explicitly selected tiers when a partial evolution path is given", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime");
        const record = getIncarnonRecordForWeapon(weapon ?? null);
        const tier = record?.tiers.find((candidate) => candidate.tier === 4);
        expect(tier?.options.length).toBeGreaterThan(1);

        const candidates = buildIncarnonCandidateConfigs(record ?? null, { 4: tier!.options[0].id }, true);
        expect(candidates).toHaveLength(tier!.options.length);
        expect(candidates.every((candidate) => Object.keys(candidate.selectedOptionsByTier).join(",") === "4")).toBe(true);
        expect(new Set(candidates.map((candidate) => candidate.selectedOptionsByTier[4])).size).toBe(tier!.options.length);
        expect(candidates.every((candidate) => candidate.unlockedTier === 4)).toBe(true);
    });

    it("searches every available tier when path optimization is enabled with no selections", () => {
        const weapon = getWeaponCatalog().find((candidate) => candidate.name === "Braton Prime");
        const record = getIncarnonRecordForWeapon(weapon ?? null);
        expect(record).toBeTruthy();
        const optionTiers = record!.tiers.filter((tier) => tier.options.length > 0);
        const expectedCandidateCount = optionTiers.reduce((product, tier) => product * tier.options.length, 1);

        const candidates = buildIncarnonCandidateConfigs(record!, {}, true);
        expect(candidates).toHaveLength(expectedCandidateCount);
        expect(candidates.every((candidate) => optionTiers.every((tier) => Boolean(candidate.selectedOptionsByTier[tier.tier])))).toBe(true);
        expect(candidates.every((candidate) => candidate.unlockedTier === Math.max(...optionTiers.map((tier) => tier.tier)))).toBe(true);
    });

    it("keeps a stable, unique shortlist and excludes already optimized configurations", () => {
        const candidates = [
            { signature: "baseline", score: 20, label: "baseline" },
            { signature: "path-a", score: 30, label: "first path A" },
            { signature: "path-a", score: 30, label: "duplicate path A" },
            { signature: "path-b", score: 25, label: "path B" },
            { signature: "path-c", score: 10, label: "path C" },
            { signature: "invalid", score: Number.NaN, label: "invalid score" },
        ];

        expect(selectIncarnonSearchShortlist(candidates, ["baseline"], 2).map((candidate) => candidate.label)).toEqual([
            "first path A",
            "path B",
        ]);
        expect(selectIncarnonSearchShortlist(candidates, ["baseline"], 0)).toEqual([]);
    });

    it("uses path diversity to refine a near-tied Incarnon screen", () => {
        const candidates = [
            { signature: "first", score: 100, path: { 1: "a", 2: "a", 3: "a" } },
            { signature: "nearby", score: 100, path: { 1: "b", 2: "a", 3: "a" } },
            { signature: "diverse", score: 100, path: { 1: "b", 2: "b", 3: "b" } },
            { signature: "outside-score-window", score: 90, path: { 1: "c", 2: "c", 3: "c" } },
        ];

        expect(selectIncarnonSearchShortlist(candidates, [], 2).map((candidate) => candidate.signature)).toEqual([
            "first",
            "diverse",
        ]);
    });
});
