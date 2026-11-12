import type { ModEffect } from "./modCatalog";

export function emptyEffect(): ModEffect {
    return {
        damageBonus: 0, impactBonus: 0, punctureBonus: 0, slashBonus: 0,
        heatBonus: 0, coldBonus: 0, electricityBonus: 0, toxinBonus: 0,
        blastBonus: 0, gasBonus: 0, magneticBonus: 0, viralBonus: 0, corrosiveBonus: 0, radiationBonus: 0,
        voidBonus: 0, tauBonus: 0, trueBonus: 0,
        critChanceBonus: 0, comboCritChanceBonus: 0, finalCritChanceBonus: 0, critMultBonus: 0, finalCritMultiplierBonus: 0,
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
