import type { ModEffect } from "./modCatalog";

export const VOLATILE_VARIANT_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/Nightwave/NightwaveSporothrixAugmentMod";
export const ACID_SHELLS_MOD_PATH = "/Lotus/Upgrades/Mods/Shotgun/Event/ProjectNightwatch/SobekNightwatchMod";
export const COMBUSTION_BEAM_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/WeaponBeamExplodeOnDeath";
export const VULCAN_BLITZ_MOD_PATH = "/Lotus/Upgrades/Mods/Melee/Event/ProjectNightwatch/JatKittagNightwatchMod";
export const ENTROPY_DETONATION_MOD_PATH = "/Lotus/Upgrades/Mods/Syndicate/ObexMod";
export const AMALGAM_FURAX_BODY_COUNT_MOD_PATH = "/Lotus/Upgrades/Mods/DualSource/Melee/FuraxLauncherMod";
export const NIGHTWATCH_NAPALM_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/ProjectNightwatch/OgrisNightwatchMod";
export const BRUTE_CONDITIONING_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/BeastBruteConditioningMod";
export const DISABLING_CONDITIONING_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/BeastDisablingConditioningMod";
export const PRECISION_CONDITIONING_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/BeastPrecisionConditioningMod";
export const BURNING_CLAWS_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/KubrowHeatConversionMod";
export const CHILLING_CLAWS_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/KubrowColdConversionMod";
export const SEPSIS_CLAWS_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/KubrowToxicConversionMod";
export const SHOCKING_CLAWS_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/KubrowElectricConversionMod";
export const BELL_RINGER_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/BeastKnockdownWeaponMod";
export const BLOODTHIRST_MOD_PATH = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/BeastWeapon/BeastDrainingBiteMod";
export const VILE_DISCHARGE_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/Nightwave/NightwaveEmbolistAugmentMod";
export const SENTIENT_INCISION_MOD_PATH = "/Lotus/Upgrades/Mods/Melee/Event/Nightwave/NightwaveVenatoAugmentMod";

const DAMAGE_RELEVANT_UNPARSED_STAT = /damage|critical|\bcrit\b|status\s+(?:chance|effects?|damage|duration)|multishot|projectile|fire rate|attack speed|charge rate|ammo efficiency|magazine|reload|combo|headshot|weak point|punch through|beam range|blast range|blast radius|\brange\b|\bentropy\b|\btennokai\b|opportunity\s+(?:chance|window)|melee hits?\b|\b(?:impact|puncture|slash|heat|cold|electricity|toxin|blast|gas|magnetic|viral|corrosive|radiation|void|tau)\b/i;

const UNSCORED_HIT_LOCATION_EFFECTS = [
    ["weakPointDamageBonus", "Weak-point damage bonus"],
    ["weakPointCritChanceBonus", "Weak-point critical chance bonus"],
] as const;

/** Parsed effects that the current damage and optimizer models cannot safely apply. */
export function getUnmodeledScoringEffectLines(effect?: Partial<ModEffect> | null): string[] {
    if (!effect) return [];
    const lines: string[] = [];
    const sources: Array<{ label: string; stats: Record<string, unknown> }> = [
        { label: "Effect", stats: effect as Record<string, unknown> },
        ...(effect.conditionalEffects ?? []).map((conditional, index) => ({
            label: `Conditional effect ${index + 1}`,
            stats: conditional.stats as Record<string, unknown>,
        })),
    ];

    for (const source of sources) {
        const statusSpreadChance = Number(source.stats.aoeElementalStatusSpreadChance ?? 0);
        const statusSpreadRadius = Number(source.stats.aoeElementalStatusSpreadRadius ?? 0);
        if (statusSpreadChance > 0 || statusSpreadRadius > 0) {
            // Melee Influence copies elemental hits and status effects across
            // nearby targets; the current score has no neighboring status history.
            // https://wiki.warframe.com/w/Melee_Influence
            lines.push(
                `${source.label}: Elemental status spread and its neighboring-target damage/proc histories are not modeled; this single-target score ignores the effect.`,
            );
        }
        if (source.stats.knockdownOnMeleeHit === true) {
            lines.push(
                "Bell Ringer's knockdown contribution to Condition Overload/Galvanized per-status counts is not modeled because target susceptibility and knockdown duration are unknown; Auto Optimize skips this mod.",
            );
        }
        if (source.label === "Effect") {
            for (const conditional of effect.conditionalEffects ?? []) {
                if (conditional.trigger === "afterJumpLanding") {
                    lines.push(
                        "Jump-landing activation and its rank-specific 1–4 second expiration/refresh timing are not simulated; Auto Optimize skips this conditional effect.",
                    );
                }
            }
        }
        for (const [key, label] of UNSCORED_HIT_LOCATION_EFFECTS) {
            const value = source.stats[key];
            if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
                lines.push(`${source.label}: ${label} is not scored because the target's weak-point rules are not modeled.`);
            }
        }
    }

    return [...new Set(lines)];
}

/** Raw lines that a conservative keyword screen flags for parser review at this rank. */
export function getUnmodeledDamageEffectLines(
    mod: {
        path?: string;
        unparsedStatsByRank?: string[][];
        effectsByRank?: Partial<ModEffect>[];
        effect?: Partial<ModEffect>;
    },
    rank: number,
): string[] {
    const lines = (mod.unparsedStatsByRank?.[rank] ?? [])
        .filter((line) => mod.path !== BLOODTHIRST_MOD_PATH && DAMAGE_RELEVANT_UNPARSED_STAT.test(line));
    if (mod.path === VOLATILE_VARIANT_MOD_PATH) {
        lines.push("Punch Through, instant direct-hit barb-explosion timing, and its added radius are not modeled; the rank-specific Status Chance bonus applies only to a selected AoE attack.");
    }
    if (mod.path === ACID_SHELLS_MOD_PATH) {
        lines.push("Acid Shells' on-death explosion is not scored; its falloff, line-of-sight checks, mode-specific max-Health scaling, and chain explosions are not modeled, so Auto Optimize skips the mod.");
    }
    if (mod.path === COMBUSTION_BEAM_MOD_PATH) {
        lines.push("Combustion Beam's delayed on-kill Blast explosion is not scored; its radius/falloff and line-of-sight rules, damage attribution/scaling, and chain behavior are not modeled, so Auto Optimize skips this mod.");
    }
    if (mod.path === VULCAN_BLITZ_MOD_PATH) {
        lines.push("Vulcan Blitz's on-death Blast explosion is not scored; target placement, linear falloff, line of sight, faction/stealth scaling, and whether explosion kills chain are not modeled, so Auto Optimize skips this mod.");
    }
    if (mod.path === ENTROPY_DETONATION_MOD_PATH) {
        lines.push("Entropy Detonation triggers only when a Ground Finisher kills an enemy. Its rank-scaled Blast explosion combines flat damage with a percentage of enemy Max Health, reaches the selected rank’s radius, and requires line of sight; Ground Finishers, explosion damage resolution, and the Entropy effect are not modeled, so Auto Optimize skips this mod.");
    }
    if (mod.path === AMALGAM_FURAX_BODY_COUNT_MOD_PATH) {
        lines.push("Amalgam Furax Body Count triggers on melee kills, including melee DoT kills but not Exalted or pseudo-exalted kills. It applies Blast/Stagger in the selected rank’s radius through line of sight. The Wiki reports a variable ~6 Blast/Impact procs (up to 10) and only 1 damage per Blast stack; it also notes these procs can trigger Shattering Impact. That armor-strip interaction, neighboring-target proc history, and stagger utility are not modeled, so Auto Optimize skips this mod.");
    }
    if (mod.path === VILE_DISCHARGE_MOD_PATH) {
        // Vile Discharge needs a timed build-up/release encounter, not a static
        // per-hit damage bonus. https://wiki.warframe.com/w/Vile_Discharge
        lines.push("Vile Discharge's accumulated primary-fire/DoT charge, Alt-Fire timing, and 6m Toxin explosion are not simulated, so Auto Optimize skips this mod.");
    }
    if (mod.path === SENTIENT_INCISION_MOD_PATH) {
        // This augment chooses damage from the target weakness and special-cases
        // Overguard; the current model cannot change its channel with target stage.
        // It also exempts Slams and does not scale the matching elemental DoT.
        // https://wiki.warframe.com/w/Sentient_Incision
        lines.push("Sentient Incision's faction weakness mapping, Overguard-specific element selection, Slam exclusion, and non-scaling elemental status DoT are not modeled, so Auto Optimize skips this mod.");
    }
    if (mod.path === BLOODTHIRST_MOD_PATH) {
        // The Slash keyword appears in the stat line because it determines
        // companion healing; this is not a weapon damage modifier.
        // https://wiki.warframe.com/w/Bloodthirst
        lines.push("Bloodthirst heals the companion for each active Slash stack per hit; companion healing is outside the damage score, so Auto Optimize skips this mod.");
    }
    if (lines.some((line) => /\btennokai\b|opportunity\s+(?:chance|window)|melee hits?\b/i.test(line))) {
        lines.push("Tennokai opportunity timing and attack-chain cadence are not modeled or scored.");
    }
    if (lines.some((line) => /\bentropy\b/i.test(line))) {
        lines.push("Entropy syndicate side effect is not modeled.");
    }
    const effect = mod.effectsByRank?.[rank] ?? mod.effect;
    return [...new Set([...lines, ...getUnmodeledScoringEffectLines(effect)])];
}

/** Current-source links for the on-kill area effects called out in the builder. */
export function getUnmodeledDamageEffectSourceUrl(mod: { path?: string }): string | undefined {
    if (mod.path === ENTROPY_DETONATION_MOD_PATH) {
        return "https://wiki.warframe.com/w/Entropy_Detonation";
    }
    if (mod.path === AMALGAM_FURAX_BODY_COUNT_MOD_PATH) {
        return "https://wiki.warframe.com/w/Amalgam_Furax_Body_Count";
    }
    if (mod.path === BLOODTHIRST_MOD_PATH) {
        return "https://wiki.warframe.com/w/Bloodthirst";
    }
    return undefined;
}

export function emptyEffect(): ModEffect {
    return {
        damageBonus: 0, firstShotMagazineDamageBonus: 0, lastShotMagazineDamageBonus: 0,
        springLoadedBroadheadDamageBonus: 0,
        springLoadedBroadheadMinDistanceMeters: 0,
        sentientSurgeMagazineRefillPerKill: 0,
        shatteringImpactBaseArmorPerHit: 0, impactBonus: 0, punctureBonus: 0, slashBonus: 0,
        heavyAttackDamageBonus: 0,
        slamAttackDamageBonus: 0,
        forcedImpactProcsPerMeleeHit: 0,
        knockdownOnMeleeHit: false,
        heatBonus: 0, coldBonus: 0, electricityBonus: 0, toxinBonus: 0,
        blastBonus: 0, gasBonus: 0, magneticBonus: 0, viralBonus: 0, corrosiveBonus: 0, radiationBonus: 0,
        voidBonus: 0, tauBonus: 0, trueBonus: 0,
        critChanceBonus: 0, vigilanteSetModCount: 0, gladiatorSetModCount: 0, niraSetModCount: 0, sacrificialSetModCount: 0, heavyAttackCritChanceBonus: 0, slideAttackCritChanceBonus: 0,
        nonCriticalHitDamageProcs: [], comboCritChanceBonus: 0, finalCritChanceBonus: 0, critMultBonus: 0,
        strainInfectionCritDamagePerCyst: 0, finalCritMultiplierBonus: 0,
        statusChanceBonus: 0, comboStatusChanceBonus: 0,
        areaDamageStatusChanceBonus: 0,
        multishotBonus: 0, multishotDamageBonus: 0, fireRateBonus: 0, chargeRateBonus: 0, fireRateLocked: false, magazineBonus: 0,
        reloadSpeedBonus: 0, attackSpeedBonus: 0,
        statusDurationBonus: 0, statusDamageBonus: 0, targetStatusDamageVulnerabilityBonus: 0,
        nightwatchNapalmEffect: 0,
        projectileSpeedBonus: 0, accuracyBonus: 0, blastRadiusBonus: 0,
        beamRangeBonus: 0, punchThrough: 0, rangeBonus: 0,
        headshotMultiplierBonus: 0, bodyshotDamageBonus: 0, weakPointDamageBonus: 0, weakPointCritChanceBonus: 0,
        comboDurationBonus: 0, initialComboBonus: 0, comboCountChanceBonus: 0,
        heavyAttackEfficiencyBonus: 0, heavyAttackWindUpBonus: 0,
        lifeStealBonus: 0, ammoEfficiencyBonus: 0, directDamagePerStatusBonus: 0,
        conditionOverloadDamagePerStatusBonus: 0,
        perHitCritChanceBonus: 0, nextMagazineStatusChancePerShot: 0, nextMagazineMultishotPerShot: 0, nextMagazineMaxStacks: 0,
        finalStatusChanceBonus: 0,
        impactStatusAppliesMagneticChance: 0,
        impactStatusAppliesSlashChance: 0,
        impactStatusExtraProcLowFireRateThreshold: 0,
        impactStatusExtraProcLowFireRateMultiplier: 0,
        critAppliesSlashChance: 0,
        aoeElementalStatusSpreadChance: 0,
        aoeElementalStatusSpreadRadius: 0,
        conditionalEffects: [],
        factionDamageBonus: 0, targetFaction: "",
    };
}

