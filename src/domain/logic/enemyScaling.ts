/**
 * Current enemy level scaling from the WARFRAME Wiki's Enemy Level Scaling page.
 * All arithmetic is rounded through Math.fround in the order described there.
 * Target-specific exceptions (bosses, special units, Steel Path, squad scaling)
 * belong in the caller and are intentionally not inferred here.
 */

export type EnemyScalingFaction =
    | "grineer"
    | "corpus"
    | "infested"
    | "corrupted"
    | "murmur"
    | "sentient"
    | "anarchs"
    | "unaffiliated"
    | "techrot";

export type EnemyBaseStat = "health" | "shield" | "armor";

interface EndpointCurves {
    lowCoefficient: number;
    lowExponent: number;
    highCoefficient: number;
    highExponent: number;
    transitionStart: number;
    transitionEnd: number;
}

const f32 = Math.fround;
const STANDARD_TRANSITION_START = 70;
const STANDARD_TRANSITION_END = 80;
export const STEEL_PATH_ENEMY_LEVEL_BONUS = 100;
export const STEEL_PATH_HEALTH_SHIELD_MULTIPLIER = 2.5;

const HEALTH_CURVES: Readonly<Record<EnemyScalingFaction, EndpointCurves>> = Object.freeze({
    grineer: { lowCoefficient: 0.015, lowExponent: 2.12, highCoefficient: 10.7332, highExponent: 0.72, transitionStart: 70, transitionEnd: 80 },
    corpus: { lowCoefficient: 0.015, lowExponent: 2.12, highCoefficient: 13.4165, highExponent: 0.55, transitionStart: 70, transitionEnd: 80 },
    infested: { lowCoefficient: 0.0225, lowExponent: 2.12, highCoefficient: 16.0998, highExponent: 0.72, transitionStart: 70, transitionEnd: 80 },
    corrupted: { lowCoefficient: 0.015, lowExponent: 2.1, highCoefficient: 10.7332, highExponent: 0.685, transitionStart: 70, transitionEnd: 80 },
    murmur: { lowCoefficient: 0.015, lowExponent: 2, highCoefficient: 10.7332, highExponent: 0.5, transitionStart: 70, transitionEnd: 80 },
    sentient: { lowCoefficient: 0.015, lowExponent: 2, highCoefficient: 10.7332, highExponent: 0.5, transitionStart: 70, transitionEnd: 80 },
    anarchs: { lowCoefficient: 0.015, lowExponent: 2, highCoefficient: 10.7332, highExponent: 0.5, transitionStart: 70, transitionEnd: 80 },
    unaffiliated: { lowCoefficient: 0.015, lowExponent: 2, highCoefficient: 10.7332, highExponent: 0.5, transitionStart: 70, transitionEnd: 80 },
    techrot: { lowCoefficient: 0.02, lowExponent: 2.12, highCoefficient: 15.0998, highExponent: 0.7, transitionStart: 70, transitionEnd: 80 },
});

const SHIELD_CURVES: Readonly<Partial<Record<EnemyScalingFaction, EndpointCurves>>> = Object.freeze({
    grineer: { lowCoefficient: 0.02, lowExponent: 1.75, highCoefficient: 1.6, highExponent: 0.75, transitionStart: 70, transitionEnd: 80 },
    corpus: { lowCoefficient: 0.02, lowExponent: 1.76, highCoefficient: 2, highExponent: 0.76, transitionStart: 70, transitionEnd: 80 },
    corrupted: { lowCoefficient: 0.02, lowExponent: 1.75, highCoefficient: 2, highExponent: 0.75, transitionStart: 70, transitionEnd: 80 },
    sentient: { lowCoefficient: 0.02, lowExponent: 1.75, highCoefficient: 1.6, highExponent: 0.75, transitionStart: 70, transitionEnd: 80 },
    techrot: { lowCoefficient: 0.02, lowExponent: 1.76, highCoefficient: 3.5, highExponent: 0.76, transitionStart: 70, transitionEnd: 80 },
});

const ARMOR_CURVES: EndpointCurves = {
    lowCoefficient: 0.005,
    lowExponent: 1.75,
    highCoefficient: 0.4,
    highExponent: 0.75,
    transitionStart: STANDARD_TRANSITION_START,
    transitionEnd: STANDARD_TRANSITION_END,
};

const OVERGUARD_CURVES: EndpointCurves = {
    lowCoefficient: 0.0015,
    lowExponent: 4,
    highCoefficient: 260,
    highExponent: 0.9,
    transitionStart: 45,
    transitionEnd: 50,
};

function endpointCurve(q: number, coefficient: number, exponent: number): number {
    const power = f32(Math.pow(q, f32(exponent)));
    const scaled = f32(f32(coefficient) * power);
    return f32(f32(1) + scaled);
}

function blendCurves(q: number, curves: EndpointCurves): number {
    const lower = endpointCurve(q, curves.lowCoefficient, curves.lowExponent);
    const upper = endpointCurve(q, curves.highCoefficient, curves.highExponent);
    const unclampedWeight = f32(
        f32(q - f32(curves.transitionStart)) /
        f32(f32(curves.transitionEnd) - f32(curves.transitionStart)),
    );
    const t = Math.max(0, Math.min(1, unclampedWeight));
    const smoothstep = f32(f32(f32(t * t)) * f32(f32(3) - f32(f32(2) * t)));
    return f32(lower + f32(f32(upper - lower) * smoothstep));
}

function levelDifference(baseLevel: number, currentLevel: number): number {
    if (!Number.isFinite(baseLevel) || !Number.isFinite(currentLevel)) return 0;
    return Math.max(0, f32(f32(currentLevel) - f32(baseLevel)));
}

/** Steel Path Origin System missions add 100 to the mission's enemy level. */
export function getSteelPathEnemyLevel(currentMissionLevel: number, steelPath: boolean): number {
    if (!Number.isFinite(currentMissionLevel)) return 1;
    const level = Math.max(1, f32(currentMissionLevel));
    return steelPath
        ? f32(level + f32(STEEL_PATH_ENEMY_LEVEL_BONUS))
        : level;
}

/** Steel Path multiplies Health and Shields by 2.5; it has no separate Armor multiplier. */
export function applySteelPathStatMultiplier(
    stat: EnemyBaseStat,
    value: number,
    steelPath: boolean,
): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (!steelPath || stat === "armor") return value;
    return f32(f32(value) * f32(STEEL_PATH_HEALTH_SHIELD_MULTIPLIER));
}

export function enemyStatLevelMultiplier(
    stat: EnemyBaseStat,
    faction: EnemyScalingFaction,
    baseLevel: number,
    currentLevel: number,
): number {
    const q = levelDifference(baseLevel, currentLevel);
    const curves = stat === "health"
        ? HEALTH_CURVES[faction]
        : stat === "shield"
            ? SHIELD_CURVES[faction]
            : ARMOR_CURVES;
    if (!curves) {
        throw new RangeError(`No verified ${stat} scaling curve is available for ${faction}.`);
    }
    return blendCurves(q, curves);
}

/**
 * Scale a base stat and apply the enemy armor floor/cap. The 200–2700 armor clamp
 * applies only to level-scaled initial armor; later stripping can go below 200.
 */
export function scaleEnemyStat(
    stat: EnemyBaseStat,
    baseValue: number,
    faction: EnemyScalingFaction,
    baseLevel: number,
    currentLevel: number,
): number {
    if (!Number.isFinite(baseValue) || baseValue <= 0) return 0;
    const multiplier = enemyStatLevelMultiplier(stat, faction, baseLevel, currentLevel);
    const value = f32(f32(baseValue) * f32(multiplier));
    if (stat === "armor") return Math.min(2700, Math.max(200, value));
    return value;
}

/** Overguard uses Current Level - 1, regardless of the enemy's base level. */
export function scaleEnemyOverguard(baseValue: number, currentLevel: number): number {
    if (!Number.isFinite(baseValue) || baseValue <= 0 || !Number.isFinite(currentLevel)) return 0;
    const q = Math.max(0, f32(f32(currentLevel) - f32(1)));
    return f32(f32(baseValue) * f32(blendCurves(q, OVERGUARD_CURVES)));
}

function eximusLevelMultiplier(level: number): number {
    const x = Math.max(1, f32(Number.isFinite(level) ? level : 1));
    if (x <= 15) return f32(1);
    if (x <= 25) return f32(f32(1) + f32(f32(0.025) * f32(x - f32(15))));
    if (x <= 35) return f32(f32(1.25) + f32(f32(0.125) * f32(x - f32(25))));
    if (x <= 50) return f32(f32(2.5) + f32(f32(2 / 15) * f32(x - f32(35))));
    if (x <= 100) return f32(f32(4.5) + f32(f32(0.03) * f32(x - f32(50))));
    return f32(6);
}

/**
 * Current Eximus base Health adjustment from the Wiki Enemy Level Scaling page,
 * before the faction level curve is applied. Eximus armor uses standard armor
 * scaling: Update 36 removed its separate Eximus armor scaling.
 * Sources: https://wiki.warframe.com/w/Eximus and Update 36 patch notes.
 */
export function applyEximusHealthBaseAdjustment(
    baseHealth: number,
    level: number,
    hasShieldsOrArmor: boolean,
): number {
    if (!Number.isFinite(baseHealth) || baseHealth <= 0) return 0;
    const x = Math.max(1, f32(Number.isFinite(level) ? level : 1));
    const minimumScale = hasShieldsOrArmor ? f32(0.25) : f32(0.375);
    const floorHealth = f32(f32(baseHealth) * f32(1.1));
    const baseWithFlat = f32(f32(baseHealth) + f32(900));
    const levelScale = eximusLevelMultiplier(x);
    const alternate = f32(f32(minimumScale * baseWithFlat) * levelScale);
    return Math.max(floorHealth, alternate);
}

/** Current Eximus base Shield adjustment before the faction-specific level curve. */
export function applyEximusShieldBaseAdjustment(baseShield: number, level: number): number {
    if (!Number.isFinite(baseShield) || baseShield <= 0) return 0;
    const x = Math.max(1, f32(Number.isFinite(level) ? level : 1));
    const floorShield = f32(f32(baseShield) * f32(1.1));
    if (x <= 15) return floorShield;
    return Math.max(floorShield, f32(f32(baseShield) * eximusLevelMultiplier(x)));
}

/** Base Overguard granted to all Eximus enemies before its separate level curve. */
export const EXIMUS_BASE_OVERGUARD = 12;

