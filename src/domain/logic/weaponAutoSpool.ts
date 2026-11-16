import type { WeaponAutoSpoolShotSequenceRule } from "../catalog/weaponCatalog";

export interface AutoSpoolShotSequenceState {
    projectiles: number;
    projectileRatio: number;
    ammoCost: number;
}

/** Resolve the current magazine's Auto-Spool pellet count and ammo cost. */
export function getAutoSpoolShotSequenceState(
    rule: WeaponAutoSpoolShotSequenceRule,
    shotsFiredInMagazine: number,
): AutoSpoolShotSequenceState {
    const maxProjectiles = Math.max(1, finitePositive(rule.maxProjectiles, 1));
    const increasePerShot = Math.max(0, finiteNonNegative(rule.projectilesAddedPerShot));
    const shotIndex = Math.max(0, Math.floor(finiteNonNegative(shotsFiredInMagazine)));
    const projectiles = Math.min(
        maxProjectiles,
        Math.max(1, 1 + shotIndex * increasePerShot),
    );
    const projectileRatio = projectiles / maxProjectiles;
    const ammoCost = Math.max(
        finiteNonNegative(rule.minimumAmmoCostPerShot),
        finiteNonNegative(rule.ammoCostAtMaximumProjectiles) * projectileRatio,
    );

    return { projectiles, projectileRatio, ammoCost };
}

/**
 * Count consecutive shots from a fresh magazine using the modeled per-shot
 * ammo-cost interpolation. Fractional ammo is retained across shots; the
 * resulting counts match the Wiki's from-rest magazine examples for Kohmak
 * and Twin Kohmak. Other weapon counts remain model-derived unless a Wiki
 * page supplies a matching from-rest example.
 */
export function getAutoSpoolMagazineAttackCount(
    rule: WeaponAutoSpoolShotSequenceRule,
    magazineSize: number,
    ammoEfficiencyBonus = 0,
): number {
    const magazine = Math.max(0, finiteNonNegative(magazineSize));
    const efficiency = Math.max(0, finiteNonNegative(ammoEfficiencyBonus));
    if (magazine <= 0) return 1;
    if (efficiency >= 1) return Number.MAX_SAFE_INTEGER;

    let remainingAmmo = magazine;
    let shots = 0;
    const safetyLimit = Math.ceil(magazine / Math.max(
        1e-9,
        finiteNonNegative(rule.minimumAmmoCostPerShot) * Math.max(0, 1 - efficiency),
    )) + Math.max(1, Math.floor(finitePositive(rule.maxProjectiles, 1))) + 1;
    while (shots < safetyLimit) {
        const { ammoCost } = getAutoSpoolShotSequenceState(rule, shots);
        const effectiveAmmoCost = ammoCost * Math.max(0, 1 - efficiency);
        if (effectiveAmmoCost <= Number.EPSILON) return Number.MAX_SAFE_INTEGER;
        if (remainingAmmo + 1e-9 < effectiveAmmoCost) break;
        remainingAmmo = Math.max(0, remainingAmmo - effectiveAmmoCost);
        shots++;
    }
    return Math.max(1, shots);
}

/** Count attacks for the selected fully-spooled profile's constant ammo cost. */
export function getFullySpooledMagazineAttackCount(
    rule: WeaponAutoSpoolShotSequenceRule,
    magazineSize: number,
    ammoEfficiencyBonus = 0,
): number {
    const magazine = Math.max(0, finiteNonNegative(magazineSize));
    const efficiency = Math.max(0, finiteNonNegative(ammoEfficiencyBonus));
    if (magazine <= 0) return 1;
    if (efficiency >= 1) return Number.MAX_SAFE_INTEGER;

    const fullSpoolAmmoCost = Math.max(
        Number.EPSILON,
        finiteNonNegative(rule.fullySpooledMagazineAmmoCost ?? rule.ammoCostAtMaximumProjectiles),
    );
    const unroundedShots = magazine / (fullSpoolAmmoCost * (1 - efficiency));
    return efficiency > 0
        ? Math.max(1, Math.ceil(unroundedShots - 1e-9))
        : Math.max(1, Math.floor(unroundedShots + 1e-9));
}

function finiteNonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function finitePositive(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
