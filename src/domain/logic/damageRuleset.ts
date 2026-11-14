/**
 * Versioned facts used by the Damage 3.0 calculator and optimizer.
 *
 * The Impact, Puncture, melee Slam Damage, and Korumm pages were checked on 2026-11-14. The official patch
 * index, Melee Combo page, Amanata Pressure page, and Hotfix 44.1.4 were checked on
 * 2026-11-13; broader mechanics pages and formulas were reviewed on 2026-11-10–11.
 * Damage quantization follows the
 * current Damage/Calculation and Damage Quantization pages; encounter and weapon-
 * specific details that remain approximate are recorded rather than inferred.
 */
export const DAMAGE_RULESET = Object.freeze({
    id: "damage-3.0",
    lastVerified: "2026-11-14",
    gameUpdate: "Update 36.0 onward; checked through Update 44.1.4.1",
    sources: Object.freeze({
        damage: "https://wiki.warframe.com/w/Damage/Calculation",
        quantization: "https://wiki.warframe.com/w/Damage_Quantization",
        meleeStance: "https://wiki.warframe.com/w/Stance_Mods",
        meleeCombo: "https://wiki.warframe.com/w/Melee_Combo",
        amanataPressure: "https://wiki.warframe.com/w/Amanata_Pressure",
        hotfix4414: "https://www.warframe.com/en/patch-notes/pc/44-1-4",
        pcPatchIndex: "https://www.warframe.com/en/patch-notes/pc",
        heavyAttack: "https://wiki.warframe.com/w/Heavy_Attack",
        bloodRush: "https://wiki.warframe.com/w/Blood_Rush",
        weepingWounds: "https://wiki.warframe.com/w/Weeping_Wounds",
        fireRate: "https://wiki.warframe.com/w/Fire_Rate",
        ammoEfficiency: "https://wiki.warframe.com/w/Ammo#Ammo_Efficiency",
        heat: "https://wiki.warframe.com/w/Damage/Heat_Damage",
        impact: "https://wiki.warframe.com/w/Damage/Impact_Damage",
        shatteringImpact: "https://wiki.warframe.com/w/Shattering_Impact",
        seismicWave: "https://wiki.warframe.com/w/Seismic_Wave",
        korumm: "https://wiki.warframe.com/w/Korumm",
        melee: "https://wiki.warframe.com/w/Melee",
        meleeUpdate35: "https://wiki.warframe.com/w/Update_35",
        puncture: "https://wiki.warframe.com/w/Damage/Puncture_Damage",
        cold: "https://wiki.warframe.com/w/Damage/Cold_Damage",
        status: "https://wiki.warframe.com/w/Status_Effect",
        statusChance: "https://wiki.warframe.com/w/Status_Chance",
        damageOverTime: "https://wiki.warframe.com/w/Damage_over_Time",
        blast: "https://wiki.warframe.com/w/Damage/Blast_Damage",
        magnetic: "https://wiki.warframe.com/w/Damage/Magnetic_Damage",
        armor: "https://wiki.warframe.com/w/Armor",
        enemyShieldGate: "https://wiki.warframe.com/w/Shield#Shield_Gating",
        overguard: "https://wiki.warframe.com/w/Overguard",
        critical: "https://wiki.warframe.com/w/Critical_Hit",
        criticalDamage: "https://wiki.warframe.com/w/Critical_Damage",
        damageTypeModifiers: "https://wiki.warframe.com/w/Damage_Type_Modifier",
        enemyLevelScaling: "https://wiki.warframe.com/w/Enemy_Level_Scaling",
        eximus: "https://wiki.warframe.com/w/Eximus",
        update36: "https://www.warframe.com/en/patch-notes/psn/36-0-0",
        update40: "https://www.warframe.com/en/patch-notes/pc/40-0-2",
        update43: "https://www.warframe.com/en/patch-notes/pc/43-0-0",
    }),
    knownLimitations: Object.freeze([
        "Primary elemental mods resolve in weapon mod-slot order; repeated types remain at their first slot, conditional effects retain their source mod slot, and innate primary elements append in Heat/Cold/Electricity/Toxin order. Slot-order results are covered by independent fixtures but not in-game telemetry.",
        "The Wiki confirms non-elemental bonuses multiply final quantized values without changing damage composition; the current implementation uses an algebraically equivalent shared-scale application for uniform base-damage bonuses. This equivalence has direct tests but has not been independently compared with in-game telemetry.",
        "The current DoT path applies the documented binary32 tick accumulator and faction double-dip order; average crit seeds, forced-proc grouping, and encounter-time stack state remain approximations. The finite encounter models same-source Heat stack accumulation, shared tick cadence, duration refresh, and armor-strip ramp/recovery; simultaneous Electricity ticks share a pulse while retaining separate timers. Configured 0–20 same-profile neighbors receive scheduled Electricity/Gas tick damage through their own evolving pools, and Gas ticks continue after the host dies. Gas replacement at its ten-stack cap cancels/reduces the oldest cloud's pending tick damage. Neighbor status histories, positioning, chain geometry, and Gas radius growth are not modeled; cross-source Heat inheritance remains unsupported. Per-attack forced-proc counts are source-annotated for Glaive Prime and Pathocyst variants, but coverage across other weapons and melee stances remains incomplete. Blast records an expected pre-defense hit value H and applies each stack's max(1, 0.3H) payout to the afflicted target at expiry or cap. At cap and primary-target death it also applies the separate 3×sum(H) radial to configured Blast neighbors through their defenses. Optimizer crowd scoring uses configured Electric/Gas counts and estimates Blast cap-radial value with a Poisson arrival proxy; it does not score death-triggered Blast value or evolve neighbor pools.",
        "Puncture lasts 10 seconds with five stacks on ordinary targets: it reduces enemy outgoing attack damage by 40% at one stack and 10 percentage points per additional stack up to 80%. The status panel displays the mean-field outgoing-damage reduction, but the planner does not simulate enemy attacks or score this defensive value. Its offensive support grants +5 percentage points of critical chance to incoming weapon hits per stack up to +25%, additive after mods, but not to Area-of-Effect damage or Warframe abilities. The damage model uses expected Puncture stacks for weapon attack rows; only rows explicitly marked as AoE are excluded, so unclassified attack rows remain uncertain. The Wiki also documents a three-stack cap for Overguarded VIPs; target identity does not currently apply that exception.",
        "Impact status lasts 6 seconds and stacks to five; repeat procs extend its stagger. Ospreys, bosses, and Tenno are immune to that stagger. On heavy Mercy-eligible units, each stack raises the Mercy health threshold by 8 percentage points to +40%; Corpus/Eximus with all Shields removed can be eligible at 100% Health. The panel reports only the expected threshold bonus: target eligibility, stagger immunity, shield state, and Mercy outcomes are not modeled, and this utility is not scored by the optimizer.",
        "Shattering Impact removes 1–6 flat base Armor per qualifying melee hit with nonzero Damage 3.0-quantized Impact damage; it does not require an Impact status proc and applies before percentage Heat/Corrosive strips. Expected multishot is used as a mean-field number of hits, and normal level scaling/caps apply before the persistent base-Armor reduction. Charged/heavy Glaive throws are excluded. Melee Duplicate's critical-hit doubling and Archon/commandeered Prime immunity exceptions are not modeled.",
        "Seismic Wave adds its rank-scaled 50–200% Slam Damage category, multiplicative with other melee damage bonuses, for catalog rows named Slam Attack, Heavy Slam Attack, or a slam attack performed by a stance combo. The multiplier scales quantization and status seeds. Korumm's Tactical Combo Slam hit is verified to benefit, but the complete multi-hit combo and its special restrictions on other mods/conditional effects are not modeled; other stance-combo rows are treated as ordinary selected attacks. Slam attacks absent from the catalog, falloff, radius/geometry, Nira's Set, Riven Slam Damage, and weapon-specific Slam effects are not modeled.",
        "The finite encounter and direct-hit sequence start a 0.1s enemy Shield Gate after Shields reach zero: direct body hits send 5% of Health damage through, weakspot hits bypass the gate, and the selected slam/AoE mode blocks direct damage. Scheduled status damage remains ungated. Both estimates assume the user-selected hit mode applies to every event and do not regenerate enemy Shields; the one-hit calculation and optimizer score do not simulate the gate.",
        "Magnetic's forced Electricity proc is modeled on a Shield/Overguard break using the active mean-field Magnetic stacks, starting pool maximum, a six-second tick schedule, Status Damage and faction double-dips, and ordinary Electricity mods. Same-hit Magnetic application timing, shield regeneration/recharge, and random status timing are not represented.",
        "Ordinary Ammo Efficiency bonuses are additive to a 75% cap; the calculator uses accumulated fractional ammo for positive efficiency and ignores those bonuses in transformed Incarnon form. Perigale and Perigale Prime's Gale Force is modeled as maintained infinite ammo only in Fully stacked or Custom scenarios with at least one external stack; it suppresses reloads and first-shot Chamber bonuses. Its headshot/kill activation, four-second refresh timing, and uptime are not simulated, so Initial and Realistic scenarios leave it inactive. Aiming effects use the documented 75% uptime assumption; airborne effects default inactive unless the user selects a fully stacked/custom conditional state because a general airborne uptime is not defined. Energized Munitions' multiplicative stacking, Infinite Ammo abilities, external ability state, and other weapon-specific ammo exceptions are not modeled or telemetry-verified.",
        "Enemy level-scaling helpers model standard faction curves only; special boss, Steel Path, squad-size, and target-specific exceptions require explicit profiles.",
        "The optional standard Eximus target applies current Eximus base Health/Shield adjustments, standard armor level scaling, base 12 Overguard scaling, Radiation immunity while Overguard is active, and a four-stack Cold limit while Overguard remains. Blast retains its normal ten-stack detonation threshold. It does not model special-unit Eximus variants or evolving post-Overguard status state.",
        "The finite encounter applies Cold's three-second freeze at ten stacks and restores three residual stacks afterward. The Wiki does not specify the residual stacks' remaining timers, so they are assigned one fresh Cold duration; fractional mean-field applications approximate when the ten-stack threshold is crossed.",
        "Blood Rush and Weeping Wounds scale from their parsed bonus per combo tier above 1x. The user enters the assumed tier; Initial state derives it from Initial Combo mods and supported innate weapon passives. Standard weapons cap at 12x, Dex Nikana uses 11 points per tier and caps at 11x, and Venka Prime caps at 13x. Normal melee attacks do not receive the combo damage multiplier. Selected heavy-attack rows apply the active tier after Damage 3.0 channel quantization. Direct-hit TTK steps repeated Heavy Attacks through Heavy Attack Efficiency retention and restores Initial Combo at 40 points per second, capped at its starting Initial Combo value; combo-scaled critical chance is recomputed per tier. This direct-only path does not add combo from hits, model Tennokai, stance sequences, heavy-attack wind-up, or natural combo decay. DPS, the finite status encounter, and optimizer scoring still hold the selected starting tier across scored hits.",
        "Galvanized Reflex's On Melee Kill effect adds 20 Initial Combo per stack for 20s, up to four stacks. The selected conditional state applies this bonus to the modeled starting combo; the Realistic state uses the shared 60% kill uptime and 70% stack-cap heuristic (33.6 points at the four-stack maximum), not a target-specific kill history. The finite status encounter and optimizer still hold that starting combo tier across attacks.",
        "Amanata Pressure contributes one uniformly distributed expected proc across Impact, Puncture, Slash, Heat, Cold, Electricity, Toxin, Blast, Radiation, Gas, Magnetic, Viral, and Corrosive on selected heavy-attack rows at 8x combo or higher. Its combo threshold and one-proc distribution are modeled for the primary target. DPS, optimizer scoring, and finite status encounters keep that starting tier static across repeated hits; status histories on other enemies hit by the heavy slam are not evolved.",
        "An optional melee stance-average DPS formula accepts user-entered average combo damage multiplier and base combo length, but the catalog has no coverage-verified stance timing table. It excludes stance hit sequences/forced procs, combo generation and decay, target defenses, and status history; the optimizer's Burst/Sustained objectives remain attack-rate proxies for melee.",
    ]),
});

export const DAMAGE_QUANTIZATION_DENOMINATOR = 32;
export const CRITICAL_DAMAGE_CODE_MAX = 4095;
export const CRITICAL_DAMAGE_MULTIPLIER_MAX = 32;
export const STANDARD_ENEMY_ARMOR_CAP = 2700;
export const STANDARD_ENEMY_ARMOR_FLOOR = 200;
/** Enemy Shield Gate duration after depletion, for ordinary body hits. */
export const ENEMY_SHIELD_GATE_DURATION_SECONDS = 0.1;
/** Fraction of direct Health damage that passes an active enemy Shield Gate. */
export const ENEMY_SHIELD_GATE_BODY_DAMAGE_MULTIPLIER = 0.05;
/** Magnetic stacks deal 3% of the broken Shield/Overguard maximum each as forced Electricity DoT. */
export const MAGNETIC_BREAK_ELECTRIC_DAMAGE_PER_STACK = 0.03;
export const MAGNETIC_BREAK_ELECTRIC_DURATION_SECONDS = 6;

export const DAMAGE_TYPES = [
    "impact", "puncture", "slash",
    "heat", "cold", "electricity", "toxin",
    "blast", "radiation", "gas", "magnetic", "viral", "corrosive",
    "void", "tau", "true",
] as const;

export type DamageType = typeof DAMAGE_TYPES[number];
export type StatusDamageType = Exclude<DamageType, "true">;

/** Types whose damage can produce a status proc. True damage has no proc type. */
export const STATUS_DAMAGE_TYPES: readonly StatusDamageType[] = DAMAGE_TYPES.filter(
    (type): type is StatusDamageType => type !== "true",
);

export interface StatusEffectRule {
    /** Base time before the effect expires, in seconds. */
    durationSeconds: number;
    /** null means stacks are not capped by the status rule. */
    maxStacks: number | null;
    /** Delay before the first DoT tick; null when the status does not deal DoT. */
    firstTickSeconds: number | null;
    /** DoT tick coefficient against the proc's Modded Base Damage, where verified. */
    dotCoefficient: number | null;
    /** Delay before the Blast stack resolves. */
    detonationDelaySeconds?: number;
    /** Fraction of recorded hit damage dealt when one Blast stack expires. */
    stackExpiryDamageCoefficient?: number;
    /** Neighbor-only radial multiplier applied to summed recorded hit damage at stack cap. */
    stackCapDetonationMultiplier?: number;
    /** Minimum damage dealt when one Blast stack expires. */
    stackExpiryMinimumDamage?: number;
    /** Cold's freeze interval and residual stack count when the tenth stack lands. */
    freezeDurationSeconds?: number;
    residualStacksAfterFreeze?: number;
}

/**
 * Current enemy status durations/caps. This is a rules reference, not an encounter
 * simulator: refresh/inheritance, independent DoT instances, proc rolls, and
 * target-state transitions still require encounter logic or remain approximate.
 */
export const STATUS_EFFECT_RULES: Readonly<Record<StatusDamageType, StatusEffectRule>> = Object.freeze({
    impact: { durationSeconds: 6, maxStacks: 5, firstTickSeconds: null, dotCoefficient: null },
    puncture: { durationSeconds: 10, maxStacks: 5, firstTickSeconds: null, dotCoefficient: null },
    slash: { durationSeconds: 6, maxStacks: null, firstTickSeconds: 1, dotCoefficient: 0.35 },
    heat: { durationSeconds: 6, maxStacks: null, firstTickSeconds: 1, dotCoefficient: 0.5 },
    cold: {
        durationSeconds: 6,
        maxStacks: 10,
        firstTickSeconds: null,
        dotCoefficient: null,
        freezeDurationSeconds: 3,
        residualStacksAfterFreeze: 3,
    },
    electricity: { durationSeconds: 6, maxStacks: null, firstTickSeconds: 0, dotCoefficient: 0.5 },
    toxin: { durationSeconds: 6, maxStacks: null, firstTickSeconds: 1, dotCoefficient: 0.5 },
    blast: {
        durationSeconds: 1.5,
        maxStacks: 10,
        firstTickSeconds: null,
        dotCoefficient: null,
        detonationDelaySeconds: 1.5,
        stackExpiryDamageCoefficient: 0.3,
        stackCapDetonationMultiplier: 3,
        stackExpiryMinimumDamage: 1,
    },
    corrosive: { durationSeconds: 8, maxStacks: 10, firstTickSeconds: null, dotCoefficient: null },
    gas: { durationSeconds: 6, maxStacks: 10, firstTickSeconds: 0, dotCoefficient: 0.5 },
    magnetic: { durationSeconds: 6, maxStacks: 10, firstTickSeconds: null, dotCoefficient: null },
    radiation: { durationSeconds: 12, maxStacks: 10, firstTickSeconds: null, dotCoefficient: null },
    viral: { durationSeconds: 6, maxStacks: 10, firstTickSeconds: null, dotCoefficient: null },
    void: { durationSeconds: 3, maxStacks: null, firstTickSeconds: null, dotCoefficient: null },
    tau: { durationSeconds: 8, maxStacks: 10, firstTickSeconds: null, dotCoefficient: null },
});

/** Blast's single-target stack payout at expiry/cap is an individual payout. */
export function blastStackExpiryDamage(hitDamage: number): number {
    const value = Number.isFinite(hitDamage) ? Math.max(0, hitDamage) : 0;
    if (value <= 0) return 0;
    const scaled = Math.fround(Math.fround(value) * Math.fround(STATUS_EFFECT_RULES.blast.stackExpiryDamageCoefficient ?? 0.3));
    return Math.max(STATUS_EFFECT_RULES.blast.stackExpiryMinimumDamage ?? 1, scaled);
}

/** Blast's separate cap/death radial hit deals 3× recorded damage to nearby enemies. */
export function blastStackCapDetonationDamage(totalRecordedHitDamage: number): number {
    const value = Number.isFinite(totalRecordedHitDamage) ? Math.max(0, totalRecordedHitDamage) : 0;
    return Math.fround(Math.fround(value) * Math.fround(STATUS_EFFECT_RULES.blast.stackCapDetonationMultiplier ?? 3));
}

/** Current Update 36+ faction damage type multipliers. Values are additive modifiers. */
export const FACTION_DAMAGE_TYPE_MODIFIERS: Readonly<
    Record<string, Partial<Record<DamageType, number>>>
> = Object.freeze({
    grineer: { corrosive: 0.5, impact: 0.5 },
    "kuva grineer": { impact: 0.5, corrosive: 0.5, heat: -0.5 },
    corpus: { magnetic: 0.5, puncture: 0.5 },
    "corpus amalgam": { magnetic: 0.5, electricity: 0.5, blast: -0.5 },
    infested: { heat: 0.5, slash: 0.5 },
    "infested deimos": { blast: 0.5, gas: 0.5, viral: -0.5 },
    "deimos infested": { blast: 0.5, gas: 0.5, viral: -0.5 },
    orokin: { puncture: 0.5, viral: 0.5, radiation: -0.5 },
    "the murmur": { radiation: 0.5, electricity: 0.5, viral: -0.5 },
    zariman: { void: 0.5 },
    sentient: { radiation: 0.5, cold: 0.5, corrosive: -0.5 },
    narmer: { slash: 0.5, toxin: 0.5, magnetic: -0.5 },
    techrot: { magnetic: 0.5, gas: 0.5, cold: -0.5 },
    "techrot (1999)": { magnetic: 0.5, gas: 0.5, cold: -0.5 },
    scaldra: { corrosive: 0.5, impact: 0.5, gas: -0.5 },
    "scaldra (1999)": { corrosive: 0.5, impact: 0.5, gas: -0.5 },
    anarchs: { impact: 0.5, electricity: 0.5, radiation: -0.5 },
});

export function factionDamageTypeModifier(faction: string, damageType: DamageType): number {
    return FACTION_DAMAGE_TYPE_MODIFIERS[faction.trim().toLowerCase()]?.[damageType] ?? 0;
}

/** Count the one-second ticks that occur before this proc expires. */
export function countStatusDamageTicks(type: StatusDamageType, durationSeconds: number): number {
    const rule = STATUS_EFFECT_RULES[type];
    if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0 ||
        rule.firstTickSeconds === null ||
        rule.dotCoefficient === null
    ) return 0;

    // Electricity and Gas tick at t=0 and expire before a tick exactly at duration.
    if (rule.firstTickSeconds === 0) {
        return Math.max(0, Math.ceil(durationSeconds));
    }
    // Slash, Heat, and Toxin tick at t=1 and include a tick at their expiry time.
    return Math.max(0, Math.floor(durationSeconds - rule.firstTickSeconds + 1e-9) + 1);
}

/**
 * Count periodic DoT ticks that land during a finite encounter when proc
 * opportunities occur at a regular weapon cadence starting at t=0. Independent
 * Slash/Toxin instances can use this exact schedule sum without simulating each
 * proc. It intentionally does not model weapon-specific burst spacing.
 */
export function countFiniteEncounterStatusTicks(
    type: StatusDamageType,
    statusDurationSeconds: number,
    encounterDurationSeconds: number,
    procsPerSecond: number,
): number {
    if (
        !Number.isFinite(statusDurationSeconds) || statusDurationSeconds <= 0 ||
        !Number.isFinite(encounterDurationSeconds) || encounterDurationSeconds <= 0 ||
        !Number.isFinite(procsPerSecond) || procsPerSecond <= 0
    ) return 0;

    const tickCount = countStatusDamageTicks(type, statusDurationSeconds);
    const firstTick = STATUS_EFFECT_RULES[type].firstTickSeconds;
    if (tickCount <= 0 || firstTick === null) return 0;

    let total = 0;
    for (let tickIndex = 0; tickIndex < tickCount; tickIndex++) {
        const tickAge = firstTick + tickIndex;
        const latestProcTime = encounterDurationSeconds - tickAge;
        if (latestProcTime < 0) continue;
        // Proc opportunities at 0, 1/r, 2/r, ...; tolerate floating-point
        // noise where a tick lands exactly at the encounter boundary.
        total += Math.floor(latestProcTime * procsPerSecond + 1e-9) + 1;
    }
    return total;
}

/**
 * Damage 3.0's signed round-half-up quantization to 1/32 of Modded Base Damage.
 * Physical and elemental contributions enter this operation; uniform non-elemental
 * multipliers can be applied to its result without changing damage composition.
 */
export function quantizeDamageContribution(damage: number, moddedBaseDamage: number): number {
    if (!Number.isFinite(damage)) return 0;
    if (!Number.isFinite(moddedBaseDamage) || moddedBaseDamage <= 0) return damage;
    const magnitude = Math.floor(
        (Math.abs(damage) / moddedBaseDamage) * DAMAGE_QUANTIZATION_DENOMINATOR + 0.5,
    );
    return Math.sign(damage) * magnitude * (moddedBaseDamage / DAMAGE_QUANTIZATION_DENOMINATOR);
}

/**
 * Encode and decode the weapon's base critical damage multiplier using the current
 * 12-bit game representation. Relative critical-damage bonuses are applied after
 * this base-stat quantization. The Wiki specifies binary32 intermediate arithmetic.
 */
export function quantizeBaseCriticalDamageMultiplier(multiplier: number): number {
    if (!Number.isFinite(multiplier)) return 0;
    const f32 = Math.fround;
    const bounded = f32(Math.max(0, Math.min(CRITICAL_DAMAGE_MULTIPLIER_MAX, multiplier)));
    const scale = f32(CRITICAL_DAMAGE_CODE_MAX / CRITICAL_DAMAGE_MULTIPLIER_MAX);
    const code = Math.floor(f32(f32(bounded * scale) + f32(0.5)));
    return f32(f32(code) * f32(CRITICAL_DAMAGE_MULTIPLIER_MAX / CRITICAL_DAMAGE_CODE_MAX));
}

/** Exact probability of at least one weighted proc under independent proc/projectile rolls. */
export function probabilityAtLeastOneStatusProc(
    statusChance: number,
    multishot: number,
    typeWeight: number,
): number {
    if (![statusChance, multishot, typeWeight].every(Number.isFinite)) return 0;
    const chance = Math.max(0, statusChance);
    const projectiles = Math.max(0, multishot);
    const weight = Math.max(0, Math.min(1, typeWeight));
    if (chance <= 0 || projectiles <= 0 || weight <= 0) return 0;

    const wholeProcRolls = Math.floor(chance);
    const fractionalProcRoll = chance - wholeProcRolls;
    const noTypePerProjectile = Math.pow(1 - weight, wholeProcRolls) *
        (1 - fractionalProcRoll * weight);
    const wholeProjectiles = Math.floor(projectiles);
    const fractionalProjectile = projectiles - wholeProjectiles;
    const noTypePerAttack = Math.pow(noTypePerProjectile, wholeProjectiles) *
        (1 - fractionalProjectile * (1 - noTypePerProjectile));
    return Math.max(0, Math.min(1, 1 - noTypePerAttack));
}

/**
 * Current pre-defense DoT tick arithmetic for a single grouped stack of seeds.
 * Faction bonus on the proc seed is intentionally separate from the remaining
 * multiplier so the accumulator's +1 is not faction-scaled on the first pass.
 */
export function statusDotTickDamage(
    seedDamage: number,
    type: StatusDamageType,
    remainingMultiplier = 1,
    accumulatorProbability = 1,
): number {
    if (![seedDamage, remainingMultiplier, accumulatorProbability].every(Number.isFinite)) return 0;
    const coefficient = STATUS_EFFECT_RULES[type].dotCoefficient;
    if (coefficient === null) return 0;
    const f32 = Math.fround;
    const accumulated = f32(
        f32(seedDamage) + f32(Math.max(0, Math.min(1, accumulatorProbability))),
    );
    const weighted = f32(accumulated * f32(coefficient));
    return f32(weighted * f32(remainingMultiplier));
}

/**
 * Standard enemy incoming-damage multiplier after armor. Damage type modifiers,
 * pool-specific rules, and the game's one-damage-per-type minimum are separate.
 */
export function enemyArmorDamageMultiplier(netArmor: number): number {
    const armor = Number.isFinite(netArmor) ? Math.max(0, netArmor) : 0;
    if (armor <= 0) return 1;
    if (armor <= STANDARD_ENEMY_ARMOR_CAP) {
        return Math.max(0, 1 - 0.9 * Math.sqrt(armor / STANDARD_ENEMY_ARMOR_CAP));
    }
    return 300 / (armor + 300);
}

/** Apply the standard armor rule to per-type health damage, including its 1-point floor. */
export function applyEnemyArmorToDamageByType(
    damageByType: Partial<Record<DamageType, number>>,
    netArmor: number,
): number {
    const multiplier = enemyArmorDamageMultiplier(netArmor);
    const hasArmor = Number.isFinite(netArmor) && netArmor > 0;
    return DAMAGE_TYPES.reduce((sum, type) => {
        const damage = damageByType[type] ?? 0;
        if (damage <= 0) return sum;
        if (type === "true" || !hasArmor) return sum + damage;
        return sum + Math.max(1, damage * multiplier);
    }, 0);
}

/**
 * Apply current Damage 3.0 faction modifiers after damage construction and
 * quantization, then apply enemy armor to each Health damage type. This helper
 * models Health damage only; ordered Shield/Overguard pools and Toxin bypass
 * belong to an encounter-level target model.
 */
export function applyHealthDamageTypeModifiers(
    damageByType: Partial<Record<DamageType, number>>,
    faction: string,
    netArmor = 0,
): Record<DamageType, number> {
    const armorMultiplier = enemyArmorDamageMultiplier(netArmor);
    const hasArmor = Number.isFinite(netArmor) && netArmor > 0;
    const output = Object.fromEntries(DAMAGE_TYPES.map((type) => [type, 0])) as Record<DamageType, number>;

    for (const type of DAMAGE_TYPES) {
        const damage = damageByType[type] ?? 0;
        if (damage <= 0) continue;
        const factionMultiplier = type === "true" ? 1 : 1 + factionDamageTypeModifier(faction, type);
        const factionAdjusted = damage * factionMultiplier;
        if (type === "true" || !hasArmor) {
            output[type] = factionAdjusted;
        } else {
            output[type] = Math.max(1, factionAdjusted * armorMultiplier);
        }
    }
    return output;
}
