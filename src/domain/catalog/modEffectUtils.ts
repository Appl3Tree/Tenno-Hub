import type { ModEffect } from "./modCatalog";

const DAMAGE_RELEVANT_UNPARSED_STAT = /damage|critical|\bcrit\b|status\s+(?:chance|effects?|damage|duration)|multishot|projectile|fire rate|attack speed|charge rate|ammo efficiency|magazine|reload|combo|headshot|weak point|punch through|beam range|blast range|blast radius|\brange\b|\b(?:impact|puncture|slash|heat|cold|electricity|toxin|blast|gas|magnetic|viral|corrosive|radiation|void|tau)\b/i;

/** Raw lines that a conservative keyword screen flags for parser review at this rank. */
export function getUnmodeledDamageEffectLines(
    mod: { unparsedStatsByRank?: string[][] },
    rank: number,
): string[] {
    return (mod.unparsedStatsByRank?.[rank] ?? []).filter((line) => DAMAGE_RELEVANT_UNPARSED_STAT.test(line));
}

export function emptyEffect(): ModEffect {
    return {
        damageBonus: 0, firstShotMagazineDamageBonus: 0, lastShotMagazineDamageBonus: 0, impactBonus: 0, punctureBonus: 0, slashBonus: 0,
        heavyAttackDamageBonus: 0,
        heatBonus: 0, coldBonus: 0, electricityBonus: 0, toxinBonus: 0,
        blastBonus: 0, gasBonus: 0, magneticBonus: 0, viralBonus: 0, corrosiveBonus: 0, radiationBonus: 0,
        voidBonus: 0, tauBonus: 0, trueBonus: 0,
        critChanceBonus: 0, nonCriticalHitDamageProcs: [], comboCritChanceBonus: 0, finalCritChanceBonus: 0, critMultBonus: 0, finalCritMultiplierBonus: 0,
        statusChanceBonus: 0, comboStatusChanceBonus: 0,
        multishotBonus: 0, multishotDamageBonus: 0, fireRateBonus: 0, magazineBonus: 0,
        reloadSpeedBonus: 0, attackSpeedBonus: 0,
        statusDurationBonus: 0, statusDamageBonus: 0,
        projectileSpeedBonus: 0, accuracyBonus: 0, blastRadiusBonus: 0,
        beamRangeBonus: 0, punchThrough: 0, rangeBonus: 0,
        headshotMultiplierBonus: 0, weakPointDamageBonus: 0, weakPointCritChanceBonus: 0,
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
