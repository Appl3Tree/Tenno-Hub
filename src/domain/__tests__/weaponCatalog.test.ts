import { describe, expect, it } from "vitest";
import { filterBuilderExpertVariants, getModsForCompat, getModsForWeapon, getStancesForWeapon, getUnmodeledDamageEffectLines, sortBuilderModsForDisplay } from "../catalog/modCatalog";
import { getUnmodeledDamageEffectSourceUrl } from "../catalog/modEffectUtils";
import { getWeaponCatalog, getWeaponDisplayName, isBurstTriggerType } from "../catalog/weaponCatalog";
import { withSelectedAttack } from "../catalog/weaponRules";
import { effectiveDrain } from "../logic/capacityCalc";
import ITEMS_RAW from "../../data/_generated/items-lean.auto.json";

const ITEMS = ITEMS_RAW as Record<string, {
    name?: string;
    categories?: string[];
    parent?: string;
    parents?: string[];
    data?: {
        CompatibilityTags?: string[];
    };
}>;

describe("weapon catalog stance inference", () => {
    it("models Vulcax's charged Impact and centered Radial Attack as one bounded hit", () => {
        const vulcax = getWeaponCatalog().find((candidate) => candidate.name === "Vulcax");
        expect(vulcax).toBeDefined();
        const impactIndex = vulcax!.attacks.findIndex((attack) => attack.name === "Impact");
        const radialIndex = vulcax!.attacks.findIndex((attack) => attack.name === "Radial Attack");
        expect(impactIndex).toBeGreaterThanOrEqual(0);
        expect(radialIndex).toBeGreaterThanOrEqual(0);

        const impact = vulcax!.attacks[impactIndex]!;
        const radial = vulcax!.attacks[radialIndex]!;
        const sourceUrl = "https://wiki.warframe.com/w/Vulcax";
        expect(vulcax!.trigger).toBe("Charge");
        expect(impact.trigger).toBe("Charge");
        expect(impact.chargeTime).toBeCloseTo(1, 8);
        expect(impact.ammoCostPerShot).toBe(1);
        expect(impact.maximumRangeMeters).toBe(300);
        expect(impact.maximumRangeBehavior).toBe("hardHitCap");
        expect(impact.damage.heat).toBe(500);
        expect(impact.lingeringDamageRule).toMatchObject({
            componentAttackName: "Radial Attack",
            firstTickDelaySeconds: 0,
            tickCount: 1,
            attachedToDirectTarget: true,
            sourceUrl,
        });
        expect(impact.scoreBoundaryNote?.sourceUrl).toBe(sourceUrl);
        expect(impact.scoreBoundaryNote?.reason).toMatch(/assumes the hit.*excludes other enemies and area coverage/i);
        expect(radial.damage.blast).toBe(100);
        expect(radial.chargeTime).toBeCloseTo(1, 8);
        expect(radial.damageFalloff).toMatchObject({
            startDistanceMeters: 0,
            endDistanceMeters: 5,
            minimumDamageMultiplier: 0.5,
            sourceUrl,
        });
        expect(radial.modelLimitation?.reason).toMatch(/Select Impact.*reference-only/i);
        expect(withSelectedAttack(vulcax!, impactIndex).selectedAttackLingeringDamageRule)
            .toEqual(impact.lingeringDamageRule);
        expect(withSelectedAttack(vulcax!, radialIndex).selectedAttackModelLimitation)
            .toEqual(radial.modelLimitation);
    });

    it("corrects Kulstar's trigger and bounds the direct-hit rocket sequence", () => {
        const kulstar = getWeaponCatalog().find((candidate) => candidate.name === "Kulstar");
        expect(kulstar).toBeDefined();
        expect(kulstar!.trigger).toBe("Semi-Auto");

        const rocketIndex = kulstar!.attacks.findIndex((attack) => attack.name === "Rocket Impact");
        const explosionIndex = kulstar!.attacks.findIndex((attack) => attack.name === "Rocket Explosion");
        const clustersIndex = kulstar!.attacks.findIndex((attack) => attack.name === "Cluster Bombs");
        const clusterExplosionIndex = kulstar!.attacks.findIndex((attack) => attack.name === "Cluster Bomb Explosion");
        expect([rocketIndex, explosionIndex, clustersIndex, clusterExplosionIndex].every((index) => index >= 0)).toBe(true);

        const rocket = kulstar!.attacks[rocketIndex]!;
        const explosion = kulstar!.attacks[explosionIndex]!;
        const clusters = kulstar!.attacks[clustersIndex]!;
        const clusterExplosion = kulstar!.attacks[clusterExplosionIndex]!;
        const sourceUrl = "https://wiki.warframe.com/w/Kulstar";
        expect(kulstar!.attacks.every((attack) => attack.trigger === "Semi-Auto")).toBe(true);
        expect(rocket.damage.impact).toBe(200);
        expect(rocket.lingeringDamageRule).toMatchObject({
            componentAttackName: "Rocket Explosion",
            firstTickDelaySeconds: 0,
            tickCount: 1,
            attachedToDirectTarget: true,
            sourceUrl,
        });
        expect(rocket.scoreBoundaryNote?.reason).toMatch(/three bomblets in a loose arc/i);
        expect(rocket.scoreBoundaryNote?.reason).toMatch(/Knockdown/i);
        expect(explosion.damage.blast).toBe(300);
        expect(explosion.damageFalloff).toMatchObject({
            startDistanceMeters: 0,
            endDistanceMeters: 3.9,
            minimumDamageMultiplier: 0.6,
            sourceUrl,
        });
        expect(clusters.multishot).toBe(3);
        expect(clusters.multishotLocked).toBe(true);
        expect(clusters.modelLimitation?.reason).toContain("three bomblets");
        expect(clusterExplosion.multishotLocked).toBe(true);
        expect(clusterExplosion.modelLimitation?.reason).toContain("reference-only");
        expect(withSelectedAttack(kulstar!, rocketIndex).selectedAttackLingeringDamageRule)
            .toEqual(rocket.lingeringDamageRule);
        expect(withSelectedAttack(kulstar!, explosionIndex).selectedAttackModelLimitation)
            .toEqual(explosion.modelLimitation);
    });

    it("models source-backed single-charge profiles for Castanas, Sancti Castanas, and Talons", () => {
        const cases = [
            {
                name: "Castanas",
                sourceUrl: "https://wiki.warframe.com/w/Castanas",
                damageType: "electricity",
                midFlightDamage: 160,
                embeddedDamage: 160,
                midFlightStatus: 0.22,
                embeddedStatus: 0.22,
                radius: 3.6,
                minimumMultiplier: 0.6,
                forcedProc: { electricity: 1 },
            },
            {
                name: "Sancti Castanas",
                sourceUrl: "https://wiki.warframe.com/w/Sancti_Castanas",
                damageType: "electricity",
                midFlightDamage: 300,
                embeddedDamage: 300,
                midFlightStatus: 0.34,
                embeddedStatus: 0.1,
                radius: 3.6,
                minimumMultiplier: 0.6,
                forcedProc: { electricity: 1 },
            },
            {
                name: "Talons",
                sourceUrl: "https://wiki.warframe.com/w/Talons",
                damageType: "blast",
                midFlightDamage: 120,
                embeddedDamage: 250,
                midFlightStatus: 0.26,
                embeddedStatus: 0.1,
                radius: 4,
                minimumMultiplier: 0.5,
                forcedProc: { puncture: 1 },
            },
        ] as const;

        for (const testCase of cases) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === testCase.name);
            expect(weapon, testCase.name).toBeDefined();
            expect(weapon!.trigger).toBe("Active");
            const midFlightIndex = weapon!.attacks.findIndex((attack) => attack.name === "Mid-Flight Detonation");
            const embeddedIndex = weapon!.attacks.findIndex((attack) => attack.name === "Embedded Detonation");
            expect(midFlightIndex, `${testCase.name} mid-flight`).toBeGreaterThanOrEqual(0);
            expect(embeddedIndex, `${testCase.name} embedded`).toBeGreaterThanOrEqual(0);

            const midFlight = weapon!.attacks[midFlightIndex]!;
            const embedded = weapon!.attacks[embeddedIndex]!;
            expect(midFlight.trigger).toBe("Active");
            expect(embedded.trigger).toBe("Active");
            expect(midFlight.damage[testCase.damageType]).toBe(testCase.midFlightDamage);
            expect(embedded.damage[testCase.damageType]).toBe(testCase.embeddedDamage);
            expect(midFlight.statusChance).toBeCloseTo(testCase.midFlightStatus, 8);
            expect(embedded.statusChance).toBeCloseTo(testCase.embeddedStatus, 8);
            expect(midFlight.damageFalloff).toMatchObject({
                startDistanceMeters: 0,
                endDistanceMeters: testCase.radius,
                minimumDamageMultiplier: testCase.minimumMultiplier,
                sourceUrl: testCase.sourceUrl,
            });
            expect(embedded.damageFalloff).toEqual(midFlight.damageFalloff);
            expect(midFlight.multishotLocked).toBe(true);
            expect(embedded.multishotLocked).toBe(true);
            expect(midFlight.forcedProcs).toBeUndefined();
            expect(embedded.forcedProcs).toEqual(testCase.forcedProc);
            expect(midFlight.lingeringDamageRule).toBeUndefined();
            expect(embedded.lingeringDamageRule).toBeUndefined();
            expect(midFlight.scoreBoundaryNote?.reason).toMatch(/alternative.*not an additional hit/i);
            expect(embedded.scoreBoundaryNote?.reason).toMatch(/one thrown .* attaches to the selected target/i);
            expect(embedded.scoreBoundaryNote?.reason).toMatch(/extra widely-spread Multishot projectiles/i);
            expect(withSelectedAttack(weapon!, midFlightIndex).selectedAttackMultishotLocked).toBe(true);
            expect(withSelectedAttack(weapon!, embeddedIndex).selectedAttackMultishotLocked).toBe(true);
            if (testCase.name === "Sancti Castanas") {
                expect(embedded.scoreBoundaryNote?.reason).toMatch(/Purity radial effect/i);
            }
            if (testCase.name === "Talons") {
                expect(embedded.scoreBoundaryNote?.reason).toMatch(/forced Ragdoll control/i);
            }
        }
    });

    it("links Aegrit's direct hit to one immediate single-target detonation", () => {
        const aegrit = getWeaponCatalog().find((candidate) => candidate.name === "Aegrit");
        expect(aegrit).toBeDefined();
        const directIndex = aegrit!.attacks.findIndex((attack) => attack.name === "Direct Hit");
        const detonationIndex = aegrit!.attacks.findIndex((attack) => attack.name === "Detonation");
        expect(directIndex).toBeGreaterThanOrEqual(0);
        expect(detonationIndex).toBeGreaterThanOrEqual(0);

        const direct = aegrit!.attacks[directIndex]!;
        const detonation = aegrit!.attacks[detonationIndex]!;
        const sourceUrl = "https://wiki.warframe.com/w/Aegrit";
        expect(direct.trigger).toBe("Active");
        expect(direct.damageTotal).toBe(9);
        expect(direct.lingeringDamageRule).toMatchObject({
            componentAttackName: "Detonation",
            firstTickDelaySeconds: 0,
            tickCount: 1,
            attachedToDirectTarget: true,
            sourceUrl,
        });
        expect(direct.scoreBoundaryNote?.sourceUrl).toBe(sourceUrl);
        expect(direct.scoreBoundaryNote?.reason).toMatch(/immediate manual detonation/i);
        expect(direct.scoreBoundaryNote?.reason).toMatch(/no other targets/i);
        expect(direct.scoreBoundaryNote?.reason).toMatch(/guaranteed proc without naming its type/i);
        expect(detonation.damage.blast).toBe(797);
        expect(detonation.damageFalloff).toMatchObject({
            startDistanceMeters: 0,
            endDistanceMeters: 9,
            minimumDamageMultiplier: 0.3,
            sourceUrl,
        });
        expect(detonation.isAreaDamage).toBe(true);
        expect(detonation.forcedProcs).toBeUndefined();
        expect(detonation.modelLimitation?.sourceUrl).toBe(sourceUrl);
        expect(detonation.modelLimitation?.reason).toContain("Select Direct Hit");
        expect(withSelectedAttack(aegrit!, directIndex).selectedAttackLingeringDamageRule)
            .toEqual(direct.lingeringDamageRule);
        expect(withSelectedAttack(aegrit!, detonationIndex).selectedAttackModelLimitation)
            .toEqual(detonation.modelLimitation);
    });

    it("links each Penta grenade impact to its immediate single-target detonation", () => {
        const cases = [
            ["Penta", 75, 350, 1, 4, 0.5, "https://wiki.warframe.com/w/Penta"],
            ["Carmine Penta", 75, 350, 8 / 3, 4, 0.5, "https://wiki.warframe.com/w/Carmine_Penta"],
            ["Secura Penta", 75, 300, 2, 6, 0.4, "https://wiki.warframe.com/w/Secura_Penta"],
        ] as const;

        for (const [name, impactDamage, blastDamage, fireRate, falloffEnd, minimumDamage, sourceUrl] of cases) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === name);
            expect(weapon, name).toBeDefined();
            const impactIndex = weapon!.attacks.findIndex((attack) => attack.name === "Grenade Impact");
            const detonationIndex = weapon!.attacks.findIndex((attack) => attack.name === "Grenade Detonation");
            expect(impactIndex, `${name} impact`).toBeGreaterThanOrEqual(0);
            expect(detonationIndex, `${name} detonation`).toBeGreaterThanOrEqual(0);

            const impact = weapon!.attacks[impactIndex]!;
            const detonation = weapon!.attacks[detonationIndex]!;
            expect(impact.trigger).toBe("Active");
            expect(weapon!.fireRate).toBeCloseTo(fireRate, 6);
            expect(impact.damage.impact).toBe(impactDamage);
            expect(impact.lingeringDamageRule).toMatchObject({
                componentAttackName: "Grenade Detonation",
                firstTickDelaySeconds: 0,
                tickCount: 1,
                attachedToDirectTarget: true,
                stacks: true,
                sourceUrl,
            });
            expect(impact.scoreBoundaryNote?.sourceUrl).toBe(sourceUrl);
            expect(impact.scoreBoundaryNote?.reason).toMatch(/omits grenade flight and preloaded multiple-grenade bursts/i);
            expect(impact.scoreBoundaryNote?.reason).toMatch(/scores no other targets/i);
            expect(detonation.damage.blast).toBe(blastDamage);
            expect(detonation.isAreaDamage).toBe(true);
            expect(detonation.damageFalloff).toMatchObject({
                startDistanceMeters: 0,
                endDistanceMeters: falloffEnd,
                minimumDamageMultiplier: minimumDamage,
                sourceUrl,
            });
            expect(detonation.modelLimitation?.sourceUrl).toBe(sourceUrl);
            expect(detonation.modelLimitation?.reason).toContain("Select Grenade Impact");
            expect(withSelectedAttack(weapon!, impactIndex).selectedAttackLingeringDamageRule)
                .toEqual(impact.lingeringDamageRule);
            expect(withSelectedAttack(weapon!, detonationIndex).selectedAttackModelLimitation)
                .toEqual(detonation.modelLimitation);
        }
    });

    it("links Torid Grenade Impact to its attached Poison Cloud tick stream", () => {
        const torid = getWeaponCatalog().find((weapon) => weapon.name === "Torid");
        expect(torid).toBeDefined();
        const impactIndex = torid!.attacks.findIndex((attack) => attack.name === "Grenade Impact");
        const cloudIndex = torid!.attacks.findIndex((attack) => attack.name === "Poison Cloud");
        expect(impactIndex).toBeGreaterThanOrEqual(0);
        expect(cloudIndex).toBeGreaterThanOrEqual(0);

        const impact = torid!.attacks[impactIndex]!;
        expect(impact.lingeringDamageRule).toMatchObject({
            componentAttackName: "Poison Cloud",
            firstTickDelaySeconds: 1,
            tickIntervalSeconds: 1,
            tickCount: 10,
            attachedToDirectTarget: true,
            stacks: true,
        });
        expect(impact.lingeringDamageRule?.sourceUrl).toBe("https://wiki.warframe.com/w/Torid");

        const cloud = torid!.attacks[cloudIndex]!;
        expect(cloud.isAreaDamage).toBe(true);
        expect(cloud.appliesToAttachedTarget).toBe(true);
        expect(cloud.modelLimitation?.reason).toContain("Select Grenade Impact");
        expect(withSelectedAttack(torid!, impactIndex).selectedAttackLingeringDamageRule).toEqual(
            impact.lingeringDamageRule,
        );
        expect(withSelectedAttack(torid!, cloudIndex).selectedAttackModelLimitation).toEqual(
            cloud.modelLimitation,
        );
    });

    it("uses Charge timing for Zylok Incarnon direct attacks while preserving their radial rows", () => {
        for (const weaponName of ["Zylok", "Zylok Prime"]) {
            const weapon = getWeaponCatalog().find((candidate) => candidate.name === weaponName);
            expect(weapon).toBeDefined();

            const directIndex = weapon!.attacks.findIndex((attack) => attack.name === "Incarnon Form");
            const radialIndex = weapon!.attacks.findIndex((attack) => attack.name === "Incarnon Form Radial Attack");
            expect(directIndex).toBeGreaterThanOrEqual(0);
            expect(radialIndex).toBeGreaterThanOrEqual(0);

            const direct = weapon!.attacks[directIndex]!;
            expect(direct).toMatchObject({ trigger: "Charge", chargeTime: 0.6 });
            const selected = withSelectedAttack(weapon!, directIndex);
            expect(selected.trigger).toBe("Charge");

            // The Wiki comparison table lists the separately catalogued radial
            // component with Duplex; do not apply the direct-row correction to it.
            expect(weapon!.attacks[radialIndex]!.trigger).toBe("Duplex");
        }
    });

    it("uses Higasa's Charge trigger and discloses its unmodeled full-gauge gate", () => {
        const higasa = getWeaponCatalog().find((candidate) => candidate.name === "Higasa");
        expect(higasa).toBeDefined();

        const autoIndex = higasa!.attacks.findIndex((attack) => attack.name === "Auto");
        const chargedIndex = higasa!.attacks.findIndex((attack) => attack.name === "Charged Shot");
        expect(autoIndex).toBeGreaterThanOrEqual(0);
        expect(chargedIndex).toBeGreaterThanOrEqual(0);

        const auto = higasa!.attacks[autoIndex]!;
        const charged = higasa!.attacks[chargedIndex]!;
        expect(auto).toMatchObject({ trigger: "Burst", burstCount: 5 });
        expect(charged).toMatchObject({ trigger: "Charge", chargeTime: 1 });
        expect(charged.burstCount).toBeUndefined();
        expect(charged.burstDelay).toBeUndefined();
        expect(charged.modelLimitation?.sourceUrl).toBe("https://wiki.warframe.com/w/Higasa");
        expect(charged.modelLimitation?.reason).toMatch(/only when its gauge is full/i);
        expect(charged.modelLimitation?.reason).toMatch(/reference-only/i);

        const selected = withSelectedAttack(higasa!, chargedIndex);
        expect(selected.trigger).toBe("Charge");
        expect(selected.selectedAttackModelLimitation).toEqual(charged.modelLimitation);
    });

    it("keeps Mausolon's Archwing and Atmosphere damage profiles selectable and distinct", () => {
        const mausolons = getWeaponCatalog().filter((weapon) => weapon.name === "Mausolon");
        const archwing = mausolons.find((weapon) => weapon.variantLabel === "Archwing");
        const atmosphere = mausolons.find((weapon) => weapon.variantLabel === "Atmosphere");
        expect(archwing).toBeDefined();
        expect(atmosphere).toBeDefined();
        expect(getWeaponDisplayName(archwing!)).toBe("Mausolon (Archwing)");
        expect(getWeaponDisplayName(atmosphere!)).toBe("Mausolon (Atmosphere)");
        expect(atmosphere?.sourceUniqueName).toBe(archwing?.uniqueName);

        const attack = (weapon: NonNullable<typeof archwing>, name: string) =>
            weapon.attacks.find((candidate) => candidate.name === name);
        expect(archwing!.damage).toMatchObject({ total: 120, impact: 24, puncture: 46, heat: 50 });
        expect(attack(archwing!, "Auto")?.damage.total).toBe(120);
        expect(attack(archwing!, "Auto Radial Attack")?.damage.total).toBe(48);
        expect(attack(archwing!, "Charged Shot Laser")?.damage.total).toBe(1_000);
        expect(attack(archwing!, "Charged Shot Explosion")?.damage.total).toBe(3_000);
        for (const weapon of [archwing!, atmosphere!]) {
            for (const name of ["Charged Shot Laser", "Charged Shot Explosion"]) {
                expect(attack(weapon, name)).toMatchObject({ trigger: "Charge", chargeTime: 0.8 });
            }
            expect(attack(weapon, "Auto")?.trigger).toBe("Auto");
            expect(attack(weapon, "Auto")?.chargeTime ?? 0).toBe(0);
        }
        expect(atmosphere!.damage).toMatchObject({ total: 180, impact: 35, puncture: 70, heat: 75 });
        expect(attack(atmosphere!, "Auto")?.damage.total).toBe(180);
        expect(attack(atmosphere!, "Auto Radial Attack")?.damage.total).toBe(72);
        expect(attack(atmosphere!, "Charged Shot Laser")?.damage.total).toBe(1_500);
        expect(attack(atmosphere!, "Charged Shot Explosion")?.damage.total).toBe(4_500);

        const auto = attack(archwing!, "Auto")!;
        const radial = attack(archwing!, "Auto Radial Attack")!;
        expect(auto.lingeringDamageRule).toMatchObject({
            componentAttackName: "Auto Radial Attack",
            firstTickDelaySeconds: 0,
            tickCount: 1,
            attachedToDirectTarget: true,
            stacks: true,
        });
        expect(radial.multishotLocked).toBe(true);
        expect(withSelectedAttack(archwing!, archwing!.attacks.indexOf(radial)).selectedAttackMultishotLocked).toBe(true);
        expect(withSelectedAttack(archwing!, archwing!.attacks.indexOf(auto)).selectedAttackLingeringDamageRule).toEqual(
            auto.lingeringDamageRule,
        );

        const archwingMods = getModsForWeapon(archwing!);
        const atmosphereMods = getModsForWeapon(atmosphere!);
        const shellRush = archwingMods.find((mod) => mod.name === "Shell Rush");
        expect(shellRush?.effectsByRank.map((effect) => effect.chargeRateBonus)).toEqual([0.125, 0.25, 0.375, 0.5]);
        expect(shellRush?.hasDamageEffect).toBe(true);
        expect(shellRush?.unparsedStatsByRank?.every((lines) => lines.length === 0)).toBe(true);
        expect(archwingMods.some((mod) => mod.name === "Archgun Ace")).toBe(true);
        const archgunAce = archwingMods.find((mod) => mod.name === "Archgun Ace");
        expect(archgunAce?.effectsByRank.map((effect) => effect.conditionalEffects?.find((conditional) =>
            conditional.trigger === "onHeadshotKill" && (conditional.stats.fireRateBonus ?? 0) > 0,
        )?.durationSeconds)).toEqual([2, 3, 5, 6, 8, 9]);
        expect(new Set(atmosphereMods.map((mod) => mod.uniqueName))).toEqual(
            new Set(archwingMods.map((mod) => mod.uniqueName)),
        );
    });

    it("exposes Vinquibus as separate Primary and Melee build profiles", () => {
        const profiles = getWeaponCatalog().filter((weapon) => weapon.name === "Vinquibus");
        const primary = profiles.find((weapon) => weapon.variantLabel === "Primary");
        const melee = profiles.find((weapon) => weapon.variantLabel === "Melee");
        expect(primary).toBeDefined();
        expect(melee).toBeDefined();
        expect(profiles).toHaveLength(2);
        expect(primary).toMatchObject({ category: "Primary", modCompat: "Rifle", disposition: 0.7 });
        expect(melee).toMatchObject({
            category: "Melee",
            weaponType: "Bayonet",
            modCompat: "Melee",
            disposition: 0.7,
            stanceClass: "Bayonet",
            stanceClasses: ["Bayonet"],
            stancePolarity: "omni",
            meleeComboDurationSeconds: 5,
        });
        expect(getWeaponDisplayName(primary!)).toBe("Vinquibus (Primary)");
        expect(getWeaponDisplayName(melee!)).toBe("Vinquibus (Melee)");
        expect(melee?.sourceUniqueName).toBe(primary?.uniqueName);

        const primaryMods = getModsForWeapon(primary!);
        const meleeMods = getModsForWeapon(melee!);
        expect(primaryMods.some((mod) => mod.name === "Serration")).toBe(true);
        expect(primaryMods.some((mod) => mod.name === "Pressure Point")).toBe(false);
        expect(meleeMods.some((mod) => mod.name === "Pressure Point")).toBe(true);
        expect(meleeMods.some((mod) => mod.name === "Serration")).toBe(false);
        expect(getStancesForWeapon(melee!).some((mod) => mod.name === "Harrowing Spire")).toBe(true);

        const normal = melee!.attacks.find((attack) => attack.name === "Normal Attack");
        const explosion = melee!.attacks.find((attack) => attack.name === "Gunshot Explosion");
        const slam = melee!.attacks.find((attack) => attack.name === "Slam Attack");
        const heavySlam = melee!.attacks.find((attack) => attack.name === "Heavy Slam Attack");
        expect(normal).toMatchObject({ damage: { total: 260, puncture: 182, slash: 78 }, critChance: 0.4, critMultiplier: 3.2, statusChance: 0.2 });
        expect(explosion).toMatchObject({ damage: { total: 400, blast: 400 }, damageFalloff: { endDistanceMeters: 4, minimumDamageMultiplier: 0.7 } });
        expect(slam).toMatchObject({ damage: { total: 440, impact: 440 }, damageFalloff: { endDistanceMeters: 7, minimumDamageMultiplier: 0.5 } });
        expect(heavySlam).toMatchObject({ damage: { total: 660, blast: 660 }, critChance: 0.34, critMultiplier: 2.6, chargeTime: 1 });
        expect(normal?.scoreBoundaryNote?.reason).toMatch(/headshot.*damage stacks are not modeled/i);
    });

    it("keeps Cyngas Auto-Burst Archwing and regular Burst Atmosphere profiles distinct", () => {
        const profiles = getWeaponCatalog().filter((weapon) => weapon.name === "Cyngas");
        const archwing = profiles.find((weapon) => weapon.variantLabel === "Archwing");
        const atmosphere = profiles.find((weapon) => weapon.variantLabel === "Atmosphere");
        expect(profiles).toHaveLength(2);
        expect(archwing).toBeDefined();
        expect(atmosphere).toBeDefined();
        expect(getWeaponDisplayName(archwing!)).toBe("Cyngas (Archwing)");
        expect(getWeaponDisplayName(atmosphere!)).toBe("Cyngas (Atmosphere)");
        expect(atmosphere!.sourceUniqueName).toBe(archwing!.uniqueName);
        expect(atmosphere!.modCompat).toBe(archwing!.modCompat);
        expect(new Set(getModsForWeapon(atmosphere!).map((mod) => mod.uniqueName))).toEqual(
            new Set(getModsForWeapon(archwing!).map((mod) => mod.uniqueName)),
        );

        const archwingAttack = archwing!.attacks.find((attack) => attack.name === "Normal Attack")!;
        const atmosphereAttack = atmosphere!.attacks.find((attack) => attack.name === "Normal Attack")!;
        expect(archwing).toMatchObject({ trigger: "Auto-Burst", fireRate: 6.67, reloadTime: 1.25 });
        expect(archwing!.damage.total).toBeCloseTo(120, 4);
        expect(archwing!.damage.impact).toBeCloseTo(39.6, 4);
        expect(archwing!.damage.puncture).toBeCloseTo(39.6, 4);
        expect(archwing!.damage.slash).toBeCloseTo(40.8, 4);
        expect(archwingAttack).toMatchObject({
            trigger: "Auto-Burst",
            speed: 6.67,
            burstCount: 3,
            burstDelay: 0.06,
            damageFalloff: {
                startDistanceMeters: 1500,
                endDistanceMeters: 3000,
                minimumDamageMultiplier: 0.2,
                scaleBy: ["projectileSpeed"],
            },
        });
        expect(archwingAttack.maximumRangeMeters).toBeUndefined();
        expect(archwingAttack.scoreBoundaryNote?.reason).toContain("projectile travel time");
        expect(atmosphere).toMatchObject({ trigger: "Burst", fireRate: 6.67, reloadTime: 1.2 });
        expect(atmosphere!.damage).toMatchObject({ total: 240, impact: 80, puncture: 80, slash: 80 });
        expect(atmosphereAttack).toMatchObject({
            trigger: "Burst",
            speed: 6.67,
            burstCount: 3,
            burstDelay: 0.06,
            damageFalloff: undefined,
            maximumRangeMeters: 300,
            maximumRangeBehavior: "hardHitCap",
            maximumRangeSourceUrl: "https://wiki.warframe.com/w/Cyngas",
        });
        expect(atmosphereAttack.scoreBoundaryNote?.reason).toContain("punch-through hits");
        expect(isBurstTriggerType("Burst")).toBe(true);
        expect(isBurstTriggerType("Auto-Burst")).toBe(true);
        expect(isBurstTriggerType("Semi-Auto")).toBe(false);
    });

    it("marks the Larkspur charged grenade components as one sourced charged mode", () => {
        const larkspurs = getWeaponCatalog().filter((weapon) => weapon.name === "Larkspur" || weapon.name === "Larkspur Prime");
        expect(larkspurs).toHaveLength(4);
        for (const weapon of larkspurs) {
            for (const name of ["Alt-Fire Projectile Impact", "Explosion"]) {
                expect(weapon.attacks.find((attack) => attack.name === name)).toMatchObject({ trigger: "Charge", chargeTime: 0.5 });
            }
            const impact = weapon.attacks.find((attack) => attack.name === "Alt-Fire Projectile Impact")!;
            const explosion = weapon.attacks.find((attack) => attack.name === "Explosion")!;
            expect(impact.lingeringDamageRule).toMatchObject({
                componentAttackName: "Explosion",
                firstTickDelaySeconds: 0,
                tickCount: 1,
                attachedToDirectTarget: true,
            });
            expect(explosion.modelLimitation?.reason).toContain("Select Alt-Fire Projectile Impact");
            expect(impact.modelLimitation).toBeUndefined();
            expect(impact.scoreBoundaryNote?.reason).toContain("directly struck projectile and its linked explosion");
            expect(impact.scoreBoundaryNote?.reason).toContain("independent of Knockdown");
            expect(withSelectedAttack(weapon, weapon.attacks.indexOf(impact)).selectedAttackModelLimitation).toEqual(
                undefined,
            );
            const compatibleMods = getModsForWeapon(weapon);
            expect(compatibleMods.length).toBeGreaterThan(0);
            expect(compatibleMods.some((mod) => mod.effectsByRank.some((effect) =>
                effect.directDamagePerStatusBonus > 0 || effect.conditionOverloadDamagePerStatusBonus > 0,
            ))).toBe(false);
            expect(weapon.attacks.every((attack) => (attack.intrinsicDamagePerStatusBonus ?? 0) === 0)).toBe(true);
            const uncharged = weapon.attacks.find((attack) => attack.trigger !== "Charge");
            expect(uncharged).toBeDefined();
        }
    });

    it("keeps Larkspur and Larkspur Prime Archwing and Atmosphere profiles separate", () => {
        const catalog = getWeaponCatalog();
        for (const expected of [
            {
                name: "Larkspur",
                archwingNormalRange: 160,
                atmosphereNormalRange: 40,
                atmosphereNormalRangeBehavior: "hardHitCap",
                archwingAltFireRate: 1,
                sourceUrl: "https://wiki.warframe.com/w/Larkspur",
            },
            {
                name: "Larkspur Prime",
                archwingNormalRange: 180,
                atmosphereNormalRange: 50,
                atmosphereNormalRangeBehavior: "informational",
                archwingAltFireRate: 2,
                sourceUrl: "https://wiki.warframe.com/w/Larkspur_Prime",
            },
        ]) {
            const profiles = catalog.filter((weapon) => weapon.name === expected.name);
            const archwing = profiles.find((weapon) => weapon.variantLabel === "Archwing");
            const atmosphere = profiles.find((weapon) => weapon.variantLabel === "Atmosphere");
            expect(profiles).toHaveLength(2);
            expect(archwing).toBeDefined();
            expect(atmosphere).toBeDefined();
            const attack = (weapon: NonNullable<typeof archwing>, name: string) =>
                weapon.attacks.find((candidate) => candidate.name === name);

            expect(getWeaponDisplayName(archwing!)).toBe(`${expected.name} (Archwing)`);
            expect(getWeaponDisplayName(atmosphere!)).toBe(`${expected.name} (Atmosphere)`);
            expect(atmosphere!.sourceUniqueName).toBe(archwing!.uniqueName);
            expect(atmosphere!.modCompat).toBe(archwing!.modCompat);
            expect(new Set(getModsForWeapon(atmosphere!).map((mod) => mod.uniqueName))).toEqual(
                new Set(getModsForWeapon(archwing!).map((mod) => mod.uniqueName)),
            );

            expect(archwing!.damage).toMatchObject({ total: 90, impact: 10, radiation: 80 });
            expect(atmosphere!.damage).toMatchObject({ total: 180, impact: 20, radiation: 160 });
            expect(archwing!.reloadTime).toBe(4.5);
            expect(atmosphere!.reloadTime).toBe(2.5);

            const archwingBeam = attack(archwing!, "Normal Attack")!;
            const atmosphereBeam = attack(atmosphere!, "Normal Attack")!;
            for (const beam of [archwingBeam, atmosphereBeam]) {
                expect(beam).toMatchObject({
                    damageRamp: {
                        minimumDamageMultiplier: 0.2,
                        rampToFullSeconds: 0.6,
                        idleBeforeDecaySeconds: 0.8,
                        decayToMinimumSeconds: 2,
                    },
                    ammoCostPerShot: 0.5,
                });
                expect(beam.scoreBoundaryNote?.reason).toContain("Chained hits on up to three nearby enemies");
            }
            expect(archwingBeam.damage.total).toBe(90);
            expect(atmosphereBeam.damage.total).toBe(180);
            expect(archwingBeam.maximumRangeMeters).toBe(expected.archwingNormalRange);
            expect(atmosphereBeam.maximumRangeMeters).toBe(expected.atmosphereNormalRange);
            expect(archwingBeam.maximumRangeBehavior).toBe("informational");
            expect(atmosphereBeam.maximumRangeBehavior).toBe(expected.atmosphereNormalRangeBehavior);
            expect(atmosphereBeam.maximumRangeSourceUrl).toBe(expected.sourceUrl);
            expect(archwingBeam.scoreBoundaryNote?.reason).toContain("range is informational");
            if (expected.atmosphereNormalRangeBehavior === "hardHitCap") {
                expect(atmosphereBeam.scoreBoundaryNote?.reason).toContain("beyond 40m as misses");
            } else {
                expect(atmosphereBeam.scoreBoundaryNote?.reason).toContain("range remains informational");
            }

            const archwingImpact = attack(archwing!, "Alt-Fire Projectile Impact")!;
            const atmosphereImpact = attack(atmosphere!, "Alt-Fire Projectile Impact")!;
            expect(archwingImpact).toMatchObject({
                speed: expected.archwingAltFireRate,
                chargeTime: 0.5,
                ammoCostPerShot: 10,
                damage: { total: 420, impact: 140, blast: 180, radiation: 100 },
            });
            expect(atmosphereImpact).toMatchObject({
                speed: expected.archwingAltFireRate,
                chargeTime: 0.5,
                ammoCostPerShot: 10,
                maximumRangeMeters: 100,
                maximumRangeSourceUrl: expected.sourceUrl,
                lingeringDamageRule: { componentAttackName: "Explosion", tickCount: 1 },
                damage: { total: 840, impact: 280, blast: 360, radiation: 200 },
            });
            if (expected.name === "Larkspur Prime") {
                expect(atmosphereImpact.forcedProcs).toMatchObject({ impact: 1 });
                expect(atmosphereBeam.scoreBoundaryNote?.reason).toContain("under active revision");
            }

            for (const profile of [archwing!, atmosphere!]) {
                expect(attack(profile, "Explosion")).toMatchObject({
                    isAreaDamage: true,
                    damageFalloff: {
                        startDistanceMeters: 0,
                        endDistanceMeters: 9.6,
                        minimumDamageMultiplier: 0.4,
                        scaleBy: ["blastRadius"],
                    },
                });
            }
            expect(attack(archwing!, "Explosion")?.damage.total).toBe(800);
            expect(attack(atmosphere!, "Explosion")?.damage.total).toBe(1_600);
        }
    });

    it("infers Tonbo as a Polearms weapon with available stance mods", () => {
        const tonbo = getWeaponCatalog().find(weapon =>
            weapon.uniqueName === "/Lotus/Weapons/Tenno/Melee/Polearms/FlowerPowerPolearm/FlowerPowerPolearmWep");

        expect(tonbo).toBeTruthy();
        expect(tonbo?.category).toBe("Melee");
        expect(tonbo?.stancePolarity).toBe("zenurik");
        expect(tonbo?.stanceClasses).toContain("Polearms");
        expect(getStancesForWeapon(tonbo!).length).toBeGreaterThan(0);
    });

    it("preserves Ohma tonfa compatibility from items data", () => {
        const ohma = getWeaponCatalog().find((weapon) => weapon.name === "Ohma");

        expect(ohma).toBeTruthy();
        expect(ohma?.category).toBe("Melee");
        expect(ohma?.stancePolarity).toBe("naramon");
        expect(ohma?.polarities).toEqual(["madurai", "naramon"]);
        expect(ohma?.stanceClasses).toContain("Tonfas");
        expect(new Set(getStancesForWeapon(ohma!).map((mod) => mod.name)).has("Sovereign Outcast")).toBe(true);
    });

    it("maps Heavy Scythe weapons to Heavy Scythe stance mods", () => {
        const thalys = getWeaponCatalog().find((weapon) => weapon.name === "Thalys");

        expect(thalys).toBeTruthy();
        expect(thalys?.category).toBe("Melee");
        expect(thalys?.stanceClasses).toContain("Heavy Scythe");
        expect(new Set(getStancesForWeapon(thalys!).map((mod) => mod.name)).has("Galeforce Dawn")).toBe(true);
    });

    it("surfaces Iron Staff's built-in exalted stance without offering generic staff stances", () => {
        const ironStaff = getWeaponCatalog().find((weapon) => weapon.name === "Iron Staff");

        expect(ironStaff).toBeTruthy();
        expect(ironStaff?.isExalted).toBe(true);
        expect(ironStaff?.stancePolarity).toBe("zenurik");
        expect(getStancesForWeapon(ironStaff!)).toHaveLength(1);
        expect(getStancesForWeapon(ironStaff!)[0]?.name).toBe("Primal Fury");
        expect(getStancesForWeapon(ironStaff!)[0]?.isBuiltIn).toBe(true);
        expect(effectiveDrain(getStancesForWeapon(ironStaff!)[0]!, ironStaff!.stancePolarity ?? "", getStancesForWeapon(ironStaff!)[0]!.fusionLimit)).toBe(-10);
    });

    it("treats Diwata as a melee exalted weapon with its permanent Razorwing stance", () => {
        const diwata = getWeaponCatalog().find((weapon) => weapon.name === "Diwata");

        expect(diwata).toBeTruthy();
        expect(diwata?.category).toBe("Melee");
        expect(diwata?.modCompat).toBe("Melee");
        expect(diwata?.stancePolarity).toBe("zenurik");
        expect(getStancesForWeapon(diwata!)).toHaveLength(1);
        expect(getStancesForWeapon(diwata!)[0]?.name).toBe("Razorwing");
        expect(getStancesForWeapon(diwata!)[0]?.isBuiltIn).toBe(true);
        expect(effectiveDrain(getStancesForWeapon(diwata!)[0]!, diwata!.stancePolarity ?? "", getStancesForWeapon(diwata!)[0]!.fusionLimit)).toBe(-10);
    });

    it("inherits built-in exalted stances for prime and variant weapon paths", () => {
        const desertWindPrime = getWeaponCatalog().find((weapon) => weapon.name === "Desert Wind Prime");
        const exaltedUmbraBlade = getWeaponCatalog().find((weapon) => weapon.name === "Exalted Umbra Blade");
        const diwataPrime = getWeaponCatalog().find((weapon) => weapon.name === "Diwata Prime");

        expect(getStancesForWeapon(desertWindPrime!)[0]?.name).toBe("Serene Storm");
        expect(getStancesForWeapon(desertWindPrime!)[0]?.isBuiltIn).toBe(true);
        expect(getStancesForWeapon(exaltedUmbraBlade!)[0]?.name).toBe("Exalted Blade");
        expect(getStancesForWeapon(exaltedUmbraBlade!)[0]?.isBuiltIn).toBe(true);
        expect(getStancesForWeapon(diwataPrime!)[0]?.name).toBe("Razorwing");
        expect(getStancesForWeapon(diwataPrime!)[0]?.isBuiltIn).toBe(true);
    });

    it("includes archguns with archgun-only mod compatibility", () => {
        const mausolon = getWeaponCatalog().find((weapon) => weapon.name === "Mausolon");

        expect(mausolon).toBeTruthy();
        expect(mausolon?.category).toBe("Arch-Gun");
        expect(mausolon?.modCompat).toBe("Archgun");

        const mods = new Set(getModsForWeapon(mausolon!).map((mod) => mod.name));
        expect(mods.has("Dual Rounds")).toBe(true);
        expect(mods.has("Serration")).toBe(false);
    });

    it("keeps rifle and sniper mods visible for Perigale variants missing lean ancestry data", () => {
        const perigale = getWeaponCatalog().find((weapon) => weapon.name === "Perigale");
        const perigalePrime = getWeaponCatalog().find((weapon) => weapon.name === "Perigale Prime");

        expect(perigale).toBeTruthy();
        expect(perigalePrime).toBeTruthy();
        expect(perigale?.weaponType).toBe("Sniper");
        expect(perigale?.modCompat).toBe("Sniper");
        expect(perigalePrime?.category).toBe("Primary");
        expect(perigalePrime?.weaponType).toBe("Sniper");
        expect(perigalePrime?.modCompat).toBe("Sniper");

        const baseMods = filterBuilderExpertVariants(getModsForWeapon(perigale!));
        const mods = filterBuilderExpertVariants(getModsForWeapon(perigalePrime!));
        const hasStandardMod = (pool: typeof mods, name: string) => pool.some((mod) =>
            mod.name === name && !/\/(?:Beginner|Intermediate|Expert)\//i.test(mod.path),
        );

        expect(hasStandardMod(mods, "Serration")).toBe(true);
        expect(hasStandardMod(mods, "Split Chamber")).toBe(true);
        expect(hasStandardMod(mods, "Hunter Munitions")).toBe(true);
        expect(baseMods.some((mod) => mod.name === "Primed Chamber")).toBe(true);
        expect(mods.some((mod) => mod.name === "Charged Chamber")).toBe(true);
        expect(mods.some((mod) => mod.name === "Primed Chamber")).toBe(true);
        expect(mods.some((mod) => mod.name === "Target Acquired")).toBe(true);
        // Missing ancestry must not widen a family-specific restriction.
        expect(mods.some((mod) => mod.name === "Deft Tempo")).toBe(false);

        const serrationDisplayOrder = sortBuilderModsForDisplay(mods)
            .filter((mod) => mod.name === "Serration")
            .map((mod) => /\/beginner\//i.test(mod.path) || /Beginner$/i.test(mod.path)
                ? `${mod.name} (Flawed)`
                : mod.name);
        expect(serrationDisplayOrder).toEqual(["Serration", "Serration (Flawed)"]);

        const bratonPrime = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(getModsForWeapon(bratonPrime!).some((mod) => mod.name === "Primed Chamber")).toBe(false);
    });

    it("uses Rifle compatibility for Buzlok despite the upstream Sniper type label", () => {
        const buzlok = getWeaponCatalog().find((weapon) => weapon.name === "Buzlok");

        expect(buzlok).toBeTruthy();
        expect(ITEMS[buzlok!.uniqueName]?.categories).toContain("primary-rifle");
        expect(ITEMS[buzlok!.uniqueName]?.parents).toContain("/Lotus/Weapons/Tenno/Rifle/LotusAssaultRifle");
        expect(buzlok).toMatchObject({ weaponType: "Rifle", modCompat: "Rifle" });

        const mods = filterBuilderExpertVariants(getModsForWeapon(buzlok!));
        expect(mods.some((mod) => mod.name === "Serration" && mod.path === "/Lotus/Upgrades/Mods/Rifle/WeaponDamageAmountMod")).toBe(true);
        expect(mods.some((mod) => mod.name === "Charged Chamber")).toBe(false);
        expect(mods.some((mod) => mod.name === "Target Acquired")).toBe(false);
    });

    it("keeps primary Rifle and Sniper compatibility aligned with item ancestry", () => {
        const failures: Array<{ weapon: string; modCompat: string; ancestry: string[] }> = [];

        for (const weapon of getWeaponCatalog().filter((entry) => entry.category === "Primary")) {
            const raw = ITEMS[weapon.uniqueName];
            const ancestry = [raw?.parent, ...(raw?.parents ?? [])].filter((parent): parent is string => Boolean(parent));
            const isAssaultRifle = ancestry.includes("/Lotus/Weapons/Tenno/Rifle/LotusAssaultRifle");
            const isSniperRifle = ancestry.includes("/Lotus/Weapons/Tenno/Rifle/LotusSniperRifle");
            if ((isAssaultRifle && weapon.modCompat === "Sniper") || (isSniperRifle && weapon.modCompat === "Rifle")) {
                failures.push({ weapon: weapon.name, modCompat: weapon.modCompat, ancestry });
            }
        }

        expect(failures).toEqual([]);
    });

    it("keeps standard compatible mods available to every weapon in the builder catalog", () => {
        const isTrainingVariant = (path: string) => /(?:^|\/)(?:Beginner|Intermediate|Expert)(?:\/|$)/i.test(path)
            || /(?:Beginner|Intermediate|Expert)$/i.test(path);
        const isFlawedVariant = (path: string) => /(?:^|\/)Beginner(?:\/|$)/i.test(path) || /Beginner$/i.test(path);
        const failures: Array<{
            weapon: string;
            modCompat: string;
            builderModCount: number;
            missingStandardCounterparts: string[];
            flawedBeforeStandard: string[];
        }> = [];

        for (const weapon of getWeaponCatalog()) {
            // Owned Mods and the manual picker use this same filtered catalog pool.
            const builderMods = filterBuilderExpertVariants(getModsForWeapon(weapon));
            const displayMods = sortBuilderModsForDisplay(builderMods);
            const missingStandardCounterparts: string[] = [];
            const flawedBeforeStandard: string[] = [];

            for (const flawed of builderMods.filter((mod) => isFlawedVariant(mod.path))) {
                const standard = builderMods.find((mod) => mod.name === flawed.name && !isTrainingVariant(mod.path));
                if (!standard) {
                    missingStandardCounterparts.push(flawed.name);
                    continue;
                }
                if (displayMods.indexOf(standard) > displayMods.indexOf(flawed)) {
                    flawedBeforeStandard.push(flawed.name);
                }
            }

            if (builderMods.some((mod) => !isTrainingVariant(mod.path))
                && missingStandardCounterparts.length === 0
                && flawedBeforeStandard.length === 0) continue;
            failures.push({
                weapon: weapon.name,
                modCompat: weapon.modCompat,
                builderModCount: builderMods.length,
                missingStandardCounterparts,
                flawedBeforeStandard,
            });
        }

        expect(failures).toEqual([]);
    });

    it("keeps secondary pistol mods visible when the lean item ancestry is missing", () => {
        const standardPistolNames = new Set(["Aksondol", "Athodai Prime", "Regulators", "Regulators Prime"]);
        const standardPistolMods = getModsForCompat("Pistol");
        const standardPathFor = (name: string) => standardPistolMods.find((mod) =>
            mod.name === name && !/(?:^|\/)(?:Beginner|Intermediate|Expert)(?:\/|$)/i.test(mod.path),
        );

        for (const weapon of getWeaponCatalog().filter((entry) => standardPistolNames.has(entry.name))) {
            const mods = getModsForWeapon(weapon);
            expect(weapon.modCompat).toBe("Pistol");
            expect(mods.some((mod) => mod.name === "Hornet Strike" && mod.uniqueName === standardPathFor("Hornet Strike")?.uniqueName))
                .toBe(true);
            expect(mods.some((mod) => mod.name === "Barrel Diffusion" && mod.uniqueName === standardPathFor("Barrel Diffusion")?.uniqueName))
                .toBe(true);
        }
    });

    it("classifies Coda Bubonico as a shotgun and offers its standard shotgun mods", () => {
        const codaBubonico = getWeaponCatalog().find((weapon) => weapon.name === "Coda Bubonico");
        expect(codaBubonico).toBeTruthy();
        expect(codaBubonico?.weaponType).toBe("Shotgun");
        expect(codaBubonico?.modCompat).toBe("Shotgun");

        const mods = getModsForWeapon(codaBubonico!);
        expect(mods.some((mod) => mod.name === "Hell's Chamber" && !/(?:^|\/)(?:Beginner|Intermediate|Expert)(?:\/|$)/i.test(mod.path)))
            .toBe(true);
        expect(mods.some((mod) => mod.name === "Serration")).toBe(false);
    });

    it("keeps the Amp-class Sirocco out of the standard weapon build catalog", () => {
        expect(getWeaponCatalog().some((weapon) => weapon.name === "Sirocco")).toBe(false);
    });

    it("does not expose a training variant when its standard counterpart is incompatible", () => {
        const isTrainingVariant = (path: string) => /(?:^|\/)(?:Beginner|Intermediate|Expert)(?:\/|$)/i.test(path)
            || /(?:Beginner|Intermediate|Expert)$/i.test(path);
        const failures: Array<{ weapon: string; mod: string; trainingPath: string }> = [];
        const pools = getWeaponCatalog().map((weapon) => ({ weapon, mods: getModsForWeapon(weapon) }));
        const standardFamilies = new Set(pools.flatMap(({ mods }) => mods
            .filter((mod) => !isTrainingVariant(mod.path))
            .map((mod) => mod.compatBucket.toLowerCase() + "||" + mod.name.trim().toLowerCase())));

        for (const { weapon, mods } of pools) {
            const weaponStandardFamilies = new Set(mods.filter((mod) => !isTrainingVariant(mod.path))
                .map((mod) => mod.compatBucket.toLowerCase() + "||" + mod.name.trim().toLowerCase()));
            for (const mod of mods) {
                const family = mod.compatBucket.toLowerCase() + "||" + mod.name.trim().toLowerCase();
                if (!isTrainingVariant(mod.path) || !standardFamilies.has(family) || weaponStandardFamilies.has(family)) continue;
                failures.push({ weapon: weapon.name, mod: mod.name, trainingPath: mod.path });
            }
        }

        expect(failures).toEqual([]);
    });

    it("classifies companion weapons by their actual mod family", () => {
        const sweeper = getWeaponCatalog().find((weapon) => weapon.name === "Sweeper");
        const deconstructor = getWeaponCatalog().find((weapon) => weapon.name === "Deconstructor");
        const akaten = getWeaponCatalog().find((weapon) => weapon.name === "Akaten");
        const hurasClaws = getWeaponCatalog().find((weapon) => weapon.name === "Huras Claws");
        const shadowClaws = getWeaponCatalog().find((weapon) => weapon.name === "Shadow Claws");
        const vulklok = getWeaponCatalog().find((weapon) => weapon.name === "Vulklok");

        expect(sweeper?.category).toBe("Companion");
        expect(sweeper?.modCompat).toBe("Shotgun");
        expect(new Set(getModsForWeapon(sweeper!).map((mod) => mod.name)).has("Hell's Chamber")).toBe(true);
        expect(new Set(getModsForWeapon(sweeper!).map((mod) => mod.name)).has("Serration")).toBe(false);
        expect(new Set(getModsForWeapon(sweeper!).map((mod) => mod.name)).has("Amalgam Shotgun Barrage")).toBe(false);

        expect(deconstructor?.category).toBe("Companion");
        expect(deconstructor?.modCompat).toBe("Melee");
        expect(getStancesForWeapon(deconstructor!).length).toBe(0);
        expect(new Set(getModsForWeapon(deconstructor!).map((mod) => mod.name)).has("Condition Overload")).toBe(true);
        expect(new Set(getModsForWeapon(deconstructor!).map((mod) => mod.name)).has("Blood Rush")).toBe(false);

        expect(akaten?.category).toBe("Companion");
        expect(akaten?.modCompat).toBe("Melee");
        expect(new Set(getModsForWeapon(akaten!).map((mod) => mod.name)).has("Pressure Point")).toBe(true);
        expect(new Set(getModsForWeapon(akaten!).map((mod) => mod.name)).has("Serration")).toBe(false);
        expect(new Set(getModsForWeapon(akaten!).map((mod) => mod.name)).has("Blood Rush")).toBe(false);

        expect(hurasClaws?.category).toBe("Companion");
        expect(hurasClaws?.modCompat).toBe("Melee");
        expect(hurasClaws?.tags).toContain("BEAST_WEAPON");
        expect(hurasClaws?.stanceClasses).toContain("Claws");
        expect(hurasClaws?.stancePolarity).toBe("penjaga");
        expect(new Set(getStancesForWeapon(hurasClaws!).map((mod) => mod.name))).toEqual(new Set([
            "Assassin Posture",
            "Balanced Posture",
            "Elusive Posture",
            "Frenzied Posture",
            "Persistent Posture",
            "Protector Posture",
        ]));
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Burning Claws")).toBe(true);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Shocking Claws")).toBe(true);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Maul")).toBe(true);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Mecha Overdrive")).toBe(true);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Pressure Point")).toBe(false);
        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Condition Overload")).toBe(false);

        expect(new Set(getModsForWeapon(hurasClaws!).map((mod) => mod.name)).has("Swipe")).toBe(false);
        expect(new Set(getModsForWeapon(getWeaponCatalog().find((weapon) => weapon.name === "Smeeta Claws")!).map((mod) => mod.name)).has("Swipe")).toBe(true);

        expect(new Set(getModsForWeapon(shadowClaws!).map((mod) => mod.name)).has("Burning Claws")).toBe(false);

        expect(vulklok?.category).toBe("Companion");
        expect(vulklok?.modCompat).toBe("Sniper");
        expect(new Set(getModsForWeapon(vulklok!).map((mod) => mod.name)).has("Split Chamber")).toBe(true);
        expect(new Set(getModsForWeapon(vulklok!).map((mod) => mod.name)).has("Charged Chamber")).toBe(true);
    });

    it("resolves every non-exalted melee weapon with explicit stance tags to at least one stance mod", () => {
        const weaponsByPath = new Map(getWeaponCatalog().map((weapon) => [weapon.uniqueName, weapon]));
        const failures: Array<{ name: string; path: string; tags: string[] }> = [];

        for (const [path, item] of Object.entries(ITEMS)) {
            if (!item.categories?.includes("melee")) continue;
            const tags = item.data?.CompatibilityTags?.filter((tag) => tag.includes("STANCE")) ?? [];
            if (tags.length === 0) continue;

            const weapon = weaponsByPath.get(path);
            if (!weapon || weapon.isExalted) continue;

            if (getStancesForWeapon(weapon).length === 0) {
                failures.push({
                    name: weapon.name,
                    path,
                    tags,
                });
            }
        }

        expect(failures).toEqual([]);
    });
});

describe("source-backed held-fire profiles", () => {
    it("applies current Wiki damage ramps only to direct held-beam rows", () => {
        const catalog = getWeaponCatalog();
        const cases: Array<[string, string, number, number?]> = [
            ["Amprex", "Normal Attack", 0.3],
            ["Atomos", "Normal Attack", 0.35],
            ["Basmu", "Held", 0.2, 0.5],
            ["Boar", "Incarnon Form", 0.2],
            ["Boar Prime", "Incarnon Form", 0.2],
            ["Convectrix", "Normal Attack", 0.6],
            ["Convectrix", "Alt-Fire", 0.8],
            ["Cortege", "Held", 0.33],
            ["Cycron", "Normal Attack", 0.3],
            ["Tenet Cycron", "Normal Attack", 0.3],
            ["Embolist", "Normal Attack", 0.45],
            ["Flux Rifle", "Normal Attack", 0.25],
            ["Furis", "Incarnon Form", 0.2],
            ["Mk1-Furis", "Incarnon Form", 0.2],
            ["Gammacor", "Normal Attack", 0.25],
            ["Synoid Gammacor", "Normal Attack", 0.3],
            ["Kuva Nukor", "Normal Attack", 0.3],
            ["Nukor", "Normal Attack", 0.3],
            ["Panthera", "Alt-Fire", 0.2],
            ["Panthera Prime", "Alt-Fire", 0.2],
            ["Phage", "Normal Attack", 0.7],
            ["Phantasma", "Beam", 0.15],
            ["Phantasma Prime", "Beam", 0.15],
            ["Quanta", "Beam", 0.3],
            ["Quanta Vandal", "Beam", 0.3],
            ["Tenet Quanta", "Beam", 0.3],
            ["Synapse", "Normal Attack", 0.2],
            ["Coda Synapse", "Normal Attack", 0.2],
            ["Catabolyst", "Primary", 0.2],
            ["Coda Catabolyst", "Primary", 0.2],
            ["Torid", "Incarnon Form", 0.2],
            ["Larkspur", "Normal Attack", 0.2],
            ["Larkspur Prime", "Normal Attack", 0.2],
        ];

        for (const [weaponName, attackName, minimum, rampSeconds = 0.6] of cases) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName);
            expect(weapon, weaponName).toBeDefined();
            const attack = weapon!.attacks.find((candidate) => candidate.name === attackName);
            expect(attack, `${weaponName} / ${attackName}`).toMatchObject({
                trigger: "Held",
                damageRamp: {
                    minimumDamageMultiplier: minimum,
                    rampToFullSeconds: rampSeconds,
                    idleBeforeDecaySeconds: 0.8,
                    decayToMinimumSeconds: 2,
                },
            });
        }

        const noRampRows: Array<[string, string]> = [
            ["Basmu", "Radial Attack"],
            ["Catabolyst", "Partial Reload Impact"],
            ["Coda Catabolyst", "Reload From Empty Impact"],
            ["Cortege", "Grenade Impact"],
            ["Cortege", "Radial Attack"],
            ["Phantasma", "Plasma Bomb Impact"],
            ["Phantasma Prime", "Cluster Bombs Explosion"],
            ["Quanta", "Cube (direct hit)"],
            ["Quanta", "Cube Explosion"],
        ];
        for (const [weaponName, attackName] of noRampRows) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName);
            const attack = weapon?.attacks.find((candidate) => candidate.name === attackName);
            expect(attack, `${weaponName} / ${attackName}`).toBeDefined();
            expect(attack!.damageRamp, `${weaponName} / ${attackName}`).toBeUndefined();
        }
    });

    it("restores per-mode triggers and gates Onos's changing Incarnon sequence", () => {
        const catalog = getWeaponCatalog();
        const triggerCases: Array<[string, string, string]> = [
            ["Basmu", "Held", "Held"],
            ["Boar", "Incarnon Form", "Held"],
            ["Boar Prime", "Incarnon Form", "Held"],
            ["Furis", "Incarnon Form", "Held"],
            ["Mk1-Furis", "Incarnon Form", "Held"],
            ["Panthera", "Alt-Fire", "Held"],
            ["Panthera Prime", "Alt-Fire", "Held"],
            ["Enkaus", "Primary", "Held"],
            ["Enkaus", "Alt-Fire", "Semi"],
            ["Enkaus", "Alt-Fire Radial Attack", "Semi"],
            ["Quanta", "Cube (direct hit)", "Semi"],
            ["Quanta", "Cube Explosion", "Semi"],
            ["Quanta", "Cube (shot by player)", "Special"],
            ["Quanta Vandal", "Cube (direct hit)", "Semi"],
            ["Quanta Vandal", "Cube Explosion", "Semi"],
            ["Quanta Vandal", "Cube (shot by player)", "Special"],
            ["Tenet Quanta", "Cube (direct hit)", "Semi"],
            ["Tenet Quanta", "Cube Explosion", "Semi"],
            ["Tenet Quanta", "Cube (shot by player)", "Special"],
            ["Atomos", "Incarnon Form", "Semi"],
            ["Gammacor", "Incarnon Form", "Semi"],
            ["Synoid Gammacor", "Incarnon Form", "Semi"],
            ["Onos", "Incarnon Form Held Damage", "Held"],
            ["Onos", "Incarnon Form Charge Attack", "Charge"],
            ["Onos", "Incarnon Form Charge Radial Attack", "Charge"],
            ["Phantasma", "Plasma Bomb Impact", "Charge"],
            ["Phantasma Prime", "Cluster Bombs Explosion", "Charge"],
            ["Catabolyst", "Partial Reload Impact", "Special"],
            ["Catabolyst", "Partial Reload Explosion", "Special"],
            ["Catabolyst", "Reload From Empty Impact", "Special"],
            ["Catabolyst", "Reload From Empty Explosion", "Special"],
            ["Coda Catabolyst", "Partial Reload Impact", "Special"],
            ["Coda Catabolyst", "Partial Reload Explosion", "Special"],
            ["Coda Catabolyst", "Reload From Empty Impact", "Special"],
            ["Coda Catabolyst", "Reload From Empty Explosion", "Special"],
        ];
        for (const [weaponName, attackName, trigger] of triggerCases) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName);
            const attack = weapon?.attacks.find((candidate) => candidate.name === attackName);
            expect(attack, `${weaponName} / ${attackName}`).toBeDefined();
            expect(attack!.trigger, `${weaponName} / ${attackName}`).toBe(trigger);
        }

        for (const [weaponName, sourceUrl] of [
            ["Quanta", "https://wiki.warframe.com/w/Quanta"],
            ["Quanta Vandal", "https://wiki.warframe.com/w/Quanta_Vandal"],
            ["Tenet Quanta", "https://wiki.warframe.com/w/Tenet_Quanta"],
        ] as const) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName)!;
            const direct = weapon.attacks.find((attack) => attack.name === "Cube (direct hit)")!;
            const explosion = weapon.attacks.find((attack) => attack.name === "Cube Explosion")!;
            const playerShot = weapon.attacks.find((attack) => attack.name === "Cube (shot by player)")!;
            expect(direct.lingeringDamageRule).toMatchObject({
                componentAttackName: "Cube Explosion",
                firstTickDelaySeconds: 0,
                tickCount: 1,
                attachedToDirectTarget: true,
                sourceUrl,
            });
            expect(direct.scoreBoundaryNote?.reason).toContain("immediately includes its linked 0.5m contact explosion");
            expect(explosion.modelLimitation?.sourceUrl).toBe(sourceUrl);
            expect(explosion.modelLimitation?.reason).toContain("Select Cube (direct hit)");
            expect(playerShot.modelLimitation?.sourceUrl).toBe(sourceUrl);
            expect(playerShot.modelLimitation?.reason).toContain("linked-weapon or deployed-cube state");
            expect(withSelectedAttack(weapon, weapon.attacks.indexOf(direct)).selectedAttackModelLimitation).toBeUndefined();
            expect(withSelectedAttack(weapon, weapon.attacks.indexOf(explosion)).selectedAttackModelLimitation).toEqual(
                explosion.modelLimitation,
            );
            expect(withSelectedAttack(weapon, weapon.attacks.indexOf(playerShot)).selectedAttackModelLimitation).toEqual(
                playerShot.modelLimitation,
            );
        }

        for (const [weaponName, sourceUrl] of [
            ["Catabolyst", "https://wiki.warframe.com/w/Catabolyst"],
            ["Coda Catabolyst", "https://wiki.warframe.com/w/Coda_Catabolyst"],
        ] as const) {
            const weapon = catalog.find((candidate) => candidate.name === weaponName)!;
            for (const name of [
                "Partial Reload Impact",
                "Partial Reload Explosion",
                "Reload From Empty Impact",
                "Reload From Empty Explosion",
            ]) {
                const attack = weapon.attacks.find((candidate) => candidate.name === name)!;
                expect(attack.trigger).toBe("Special");
                expect(attack.modelLimitation?.sourceUrl).toBe(sourceUrl);
                expect(attack.modelLimitation?.reason).toMatch(/reference-only.*Auto Optimize/i);
                expect(withSelectedAttack(weapon, weapon.attacks.indexOf(attack)).selectedAttackModelLimitation)
                    .toEqual(attack.modelLimitation);
            }
        }

        const onos = catalog.find((candidate) => candidate.name === "Onos");
        expect(onos).toBeDefined();
        for (const name of [
            "Incarnon Form Held Damage",
            "Incarnon Form Charge Attack",
            "Incarnon Form Charge Radial Attack",
        ]) {
            const attack = onos!.attacks.find((candidate) => candidate.name === name);
            expect(attack?.modelLimitation?.sourceUrl).toBe("https://wiki.warframe.com/w/Onos");
            expect(attack?.modelLimitation?.reason).toMatch(/reference-only/i);
            expect(withSelectedAttack(onos!, onos!.attacks.indexOf(attack!)).selectedAttackModelLimitation)
                .toEqual(attack!.modelLimitation);
        }

        const cortege = catalog.find((candidate) => candidate.name === "Cortege");
        expect(cortege?.attacks.find((attack) => attack.name === "Grenade Impact")?.modelLimitation?.reason)
            .toMatch(/five primary-fire kills/i);

        const unhandledHeldRows = catalog.flatMap((weapon) => weapon.attacks
            .filter((attack) => attack.trigger === "Held" && !attack.damageRamp && !attack.modelLimitation)
            .map((attack) => `${weapon.name} / ${attack.name}`));
        expect(unhandledHeldRows).toEqual([]);

        const unhandledAutoSpoolRows = catalog.flatMap((weapon) => weapon.attacks
            .filter((attack) => attack.trigger === "Auto-Spool" &&
                !attack.autoSpoolCadence && !attack.autoSpoolShotSequence && !attack.autoSpoolTimingLimitation)
            .map((attack) => `${weapon.name} / ${attack.name}`));
        expect(unhandledAutoSpoolRows).toEqual([]);
    });
});

describe("Dreadful Killshot rank data", () => {
    it("parses the Basmu rank values and keeps the sourced mechanic out of unparsed-effect warnings", () => {
        const basmu = getWeaponCatalog().find((weapon) => weapon.name === "Basmu");
        expect(basmu).toBeDefined();
        const mod = getModsForWeapon(basmu!).find((candidate) => candidate.name === "Dreadful Killshot");
        expect(mod).toBeDefined();
        expect(mod!.effectsByRank.map((effect) => effect.dreadfulKillshotDamageAndStatusPer75Health))
            .toEqual([0.1, 0.12, 0.14, 0.16, 0.18, 0.2]);
        expect(mod!.unparsedStatsByRank?.every((rank) => rank.length === 0)).toBe(true);
        expect(mod!.effectsByRank.every((_, rank) => getUnmodeledDamageEffectLines(mod!, rank).length === 0)).toBe(true);
    });
});

describe("Deadly Maneuvers rank data", () => {
    it("parses all Magnus augment ranks and scores only with the configured Burst headshot snapshot", () => {
        const magnusVariants = getWeaponCatalog().filter((weapon) =>
            weapon.name === "Magnus" || weapon.name === "Magnus Prime",
        );
        expect(magnusVariants.map((weapon) => weapon.name)).toEqual(["Magnus", "Magnus Prime"]);

        for (const weapon of magnusVariants) {
            const mod = getModsForWeapon(weapon).find((candidate) => candidate.name === "Deadly Maneuvers");
            expect(mod).toBeDefined();
            expect(mod!.effectsByRank.map((effect) => effect.deadlyManeuversHeadshotCritChanceBonus))
                .toEqual([1, 2, 3, 4]);
            expect(mod!.unparsedStatsByRank?.every((rank) => rank.length === 0)).toBe(true);
            expect(getUnmodeledDamageEffectLines(mod!, mod!.fusionLimit)).toEqual(expect.arrayContaining([
                expect.stringContaining("editable 0–2 remaining-shot snapshot"),
            ]));
            expect(getUnmodeledDamageEffectLines(mod!, mod!.fusionLimit, {
                selectedWeaponName: weapon.name,
                selectedAttackIsAreaDamage: false,
                selectedAttackHeadshotRate: 0.5,
                deadlyManeuversShotsRemaining: 2,
                selectedGoal: "burst",
            })).toEqual([]);
            expect(getUnmodeledDamageEffectSourceUrl(mod!)).toBe("https://wiki.warframe.com/w/Deadly_Maneuvers");
        }
    });
});

describe("weapon mod set membership", () => {
    it("maps all Strain Infection ranks to Critical Damage per cyst without an unmodeled damage warning", () => {
        const melee = getWeaponCatalog().find((weapon) =>
            weapon.category === "Melee" && getModsForWeapon(weapon).some((mod) => mod.name === "Strain Infection"),
        );
        expect(melee).toBeDefined();
        const mod = getModsForWeapon(melee!).find((candidate) => candidate.name === "Strain Infection");
        expect(mod).toBeDefined();
        expect(mod!.effectsByRank.map((effect) => effect.strainInfectionCritDamagePerCyst)).toEqual([
            0.05, 0.1, 0.15, 0.2,
        ]);
        expect(mod!.hasDamageEffect).toBe(true);
        for (let rank = 0; rank < mod!.effectsByRank.length; rank++) {
            expect(getUnmodeledDamageEffectLines(mod!, rank).some((line) => /Critical Damage per Cyst/i.test(line))).toBe(false);
        }
    });

    it("retains source set identity while leaving ordinary mods ungrouped", () => {
        const bratonPrime = getWeaponCatalog().find((weapon) => weapon.name === "Braton Prime");
        expect(bratonPrime).toBeTruthy();

        const mods = getModsForWeapon(bratonPrime!);
        const vigilanteSetPath = "/Lotus/Upgrades/Mods/Sets/Vigilante/VigilanteSetMod";
        const vigilanteMods = mods.filter((mod) => mod.setBonusPath === vigilanteSetPath);
        expect(vigilanteMods.map((mod) => mod.name)).toContain("Vigilante Armaments");
        expect(vigilanteMods.length).toBeGreaterThan(0);
        for (const mod of vigilanteMods) {
            expect(mod.effectsByRank.every((effect) => effect.vigilanteSetModCount === 1)).toBe(true);
        }
        expect(mods.find((mod) => mod.name === "Serration")?.setBonusPath).toBeUndefined();
        expect(mods.find((mod) => mod.name === "Serration")?.effect.vigilanteSetModCount).toBe(0);
    });

    it("marks Nira set membership on the compatible whip mod at every rank", () => {
        const whip = getWeaponCatalog().find((weapon) =>
            weapon.category === "Melee" && getModsForWeapon(weapon).some((mod) => mod.name === "Nira's Contempt"),
        );
        expect(whip).toBeDefined();
        const nira = getModsForWeapon(whip!).find((mod) => mod.name === "Nira's Contempt");
        expect(nira).toBeDefined();
        expect(nira!.setBonusPath).toBe("/Lotus/Upgrades/Mods/Sets/Nira/NiraSetMod");
        expect(nira!.effectsByRank.every((effect) => effect.niraSetModCount === 1)).toBe(true);
        expect(nira!.effectsByRank[5].damageBonus).toBeCloseTo(0.9, 10);
        expect(nira!.effectsByRank[5].statusChanceBonus).toBeCloseTo(0.6, 10);
    });
});

describe("source-backed charge-trigger gates", () => {
    it("restores Ambassador's charged trigger and keeps incomplete rows reference-only", () => {
        const ambassador = getWeaponCatalog().find((weapon) => weapon.name === "Ambassador");
        expect(ambassador).toBeDefined();
        expect(ambassador!.attacks.find((attack) => attack.name === "Auto")?.trigger).toBe("Auto");

        for (const name of ["Charge", "Charged AoE"]) {
            const attackIndex = ambassador!.attacks.findIndex((attack) => attack.name === name);
            expect(attackIndex, name).toBeGreaterThanOrEqual(0);
            const attack = ambassador!.attacks[attackIndex]!;
            expect(attack.trigger, name).toBe("Charge");
            expect(attack.modelLimitation?.sourceUrl, name).toBe("https://wiki.warframe.com/w/Ambassador");
            expect(attack.modelLimitation?.reason, name).toMatch(/reference-only/i);
        }
    });

    it("restores Tenet Plinx Alt-Fire charge metadata and gates unsupported magazine scaling", () => {
        const plinx = getWeaponCatalog().find((weapon) => weapon.name === "Tenet Plinx");
        expect(plinx).toBeDefined();
        expect(plinx!.attacks.find((attack) => attack.name === "Semi-Auto")?.trigger).toBe("Semi");

        for (const name of ["Alt-Fire", "Alt-Fire AoE"]) {
            const attackIndex = plinx!.attacks.findIndex((attack) => attack.name === name);
            expect(attackIndex, name).toBeGreaterThanOrEqual(0);
            const attack = plinx!.attacks[attackIndex]!;
            expect(attack.trigger, name).toBe("Charge");
            expect(attack.modelLimitation?.sourceUrl, name).toBe("https://wiki.warframe.com/w/Tenet_Plinx");
            expect(attack.modelLimitation?.reason, name).toMatch(/full magazine/i);
        }
    });

    it("restores EFV-5 Jupiter Buckshot's charged single-release stats and spread boundary", () => {
        const weapon = getWeaponCatalog().find((entry) => entry.name.toLowerCase() === "efv-5 jupiter");
        expect(weapon).toBeDefined();
        expect(weapon!.attacks.find((attack) => attack.name === "Auto")?.trigger).toBe("Auto");

        const buckshot = weapon!.attacks.find((attack) => attack.name === "Buckshot");
        expect(buckshot).toMatchObject({
            trigger: "Charge",
            chargeTime: 1,
            multishot: 11,
            pelletSpreadCone: {
                minimumSpreadDegrees: 24,
                maximumSpreadDegrees: 42,
                sourceUrl: "https://wiki.warframe.com/w/EFV-5_Jupiter",
            },
            ammoCostPerShot: 15,
            ammoGate: {
                minimumMagazineAmmoToFire: 15,
                sourceUrl: "https://wiki.warframe.com/w/Alternate_Fire",
            },
            damageFalloff: {
                startDistanceMeters: 5,
                endDistanceMeters: 10,
                minimumDamageMultiplier: 0.0079,
                scaleBy: ["projectileSpeed"],
                sourceUrl: "https://wiki.warframe.com/w/EFV-5_Jupiter",
            },
            forcedProcs: { corrosive: 1 },
        });
        expect(buckshot?.modelLimitation?.sourceUrl).toBe("https://wiki.warframe.com/w/EFV-5_Jupiter");
        expect(buckshot?.modelLimitation?.reason).toMatch(/target overlap/i);
        expect(buckshot?.modelLimitation?.reason).toContain("24° minimum and 42° maximum spread");
        expect(buckshot?.modelLimitation?.reason).toContain("at least one near the reticle center");
        const buckshotIndex = weapon!.attacks.findIndex((attack) => attack.name === "Buckshot");
        expect(withSelectedAttack(weapon!, buckshotIndex).selectedAttackAmmoGate).toEqual({
            minimumMagazineAmmoToFire: 15,
            sourceUrl: "https://wiki.warframe.com/w/Alternate_Fire",
        });
    });
});
