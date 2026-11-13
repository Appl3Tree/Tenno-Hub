import type { WeaponDamageRampRule } from "../catalog/weaponCatalog";

export interface WeaponDamageRampMultipliers {
    firstAttack: number;
    freshMagazineAverage: number;
    sustainedAverage: number;
}

export function getInitialDamageRampMultiplier(rule?: WeaponDamageRampRule): number {
    return rule ? clampMultiplier(rule.minimumDamageMultiplier) : 1;
}

/** Advances the linear ramp while firing or the delayed linear decay while idle. */
export function advanceDamageRampMultiplier(
    rule: WeaponDamageRampRule,
    currentMultiplier: number,
    elapsedSeconds: number,
    firing: boolean,
): number {
    const minimum = clampMultiplier(rule.minimumDamageMultiplier);
    const current = Math.max(minimum, Math.min(1, Number.isFinite(currentMultiplier) ? currentMultiplier : minimum));
    const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
    if (elapsed <= 0 || minimum >= 1) return current;

    if (firing) {
        const rampDuration = Math.max(1e-9, finitePositive(rule.rampToFullSeconds, 1));
        return Math.min(1, current + elapsed * (1 - minimum) / rampDuration);
    }

    const decayDuration = Math.max(1e-9, finitePositive(rule.decayToMinimumSeconds, 1));
    const decayTime = Math.max(0, elapsed - Math.max(0, finiteNonNegative(rule.idleBeforeDecaySeconds)));
    return Math.max(minimum, current - decayTime * (1 - minimum) / decayDuration);
}

/**
 * Returns attack-timed ramp multipliers. Burst DPS uses a fresh first magazine;
 * sustained DPS uses the stable repeating magazine/reload cycle.
 */
export function calculateDamageRampMultipliers(
    rule: WeaponDamageRampRule | undefined,
    shotsPerMagazine: number,
    fireRate: number,
    reloadSeconds: number,
    ignoresMagazineAndReload = false,
): WeaponDamageRampMultipliers {
    if (!rule) return { firstAttack: 1, freshMagazineAverage: 1, sustainedAverage: 1 };

    const minimum = getInitialDamageRampMultiplier(rule);
    const count = Math.max(1, Math.floor(finitePositive(shotsPerMagazine, 1) + 1e-9));
    const rate = finitePositive(fireRate, 0);
    if (rate <= 0) return { firstAttack: minimum, freshMagazineAverage: minimum, sustainedAverage: minimum };

    const perAttackIncrease = (1 - minimum) / Math.max(1e-9, finitePositive(rule.rampToFullSeconds, 1) * rate);
    const freshMagazineAverage = averageRampedShots(minimum, count, perAttackIncrease);
    if (ignoresMagazineAndReload || finiteNonNegative(reloadSeconds) <= 0) {
        return { firstAttack: minimum, freshMagazineAverage, sustainedAverage: 1 };
    }

    const reload = finiteNonNegative(reloadSeconds);
    if (reload <= finiteNonNegative(rule.idleBeforeDecaySeconds)) {
        return { firstAttack: minimum, freshMagazineAverage, sustainedAverage: 1 };
    }

    const attackInterval = 1 / rate;
    let stableMagazineStart = minimum;
    for (let cycle = 0; cycle < 64; cycle++) {
        const lastAttack = Math.min(1, stableMagazineStart + perAttackIncrease * Math.max(0, count - 1));
        const nextStart = advanceDamageRampMultiplier(
            rule,
            advanceDamageRampMultiplier(rule, lastAttack, reload, false),
            attackInterval,
            true,
        );
        if (Math.abs(nextStart - stableMagazineStart) < 1e-10) {
            stableMagazineStart = nextStart;
            break;
        }
        stableMagazineStart = nextStart;
    }
    const sustainedAverage = averageRampedShots(stableMagazineStart, count, perAttackIncrease);
    return { firstAttack: minimum, freshMagazineAverage, sustainedAverage };
}

function averageRampedShots(start: number, count: number, increasePerAttack: number): number {
    if (count <= 0) return 1;
    const boundedStart = clampMultiplier(start);
    if (increasePerAttack <= 0 || boundedStart >= 1) return boundedStart;
    const attacksBeforeFull = Math.min(
        count,
        Math.max(0, Math.ceil((1 - boundedStart) / increasePerAttack - 1e-12)),
    );
    const rampedSum = attacksBeforeFull * boundedStart +
        increasePerAttack * attacksBeforeFull * (attacksBeforeFull - 1) / 2;
    const fullDamageAttacks = count - attacksBeforeFull;
    return (rampedSum + fullDamageAttacks) / count;
}

function clampMultiplier(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

function finitePositive(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteNonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}
