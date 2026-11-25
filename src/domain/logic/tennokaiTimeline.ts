/**
 * Mean-field opportunity history for a repeated direct-hit melee cycle.
 * Each modeled event is one qualifying melee hit against one target. The
 * caller is responsible for excluding attack rows with unsupported
 * multi-strike, multi-target, Gunblade, or ability-wave behavior.
 */

import type { ModEffect } from "../catalog/modCatalog";
import type { WeaponEntry } from "../catalog/weaponCatalog";
import { getMeleeComboRules, withSelectedAttack } from "../catalog/weaponRules";
import { STATUS_EFFECT_RULES, countStatusDamageTicks } from "./damageRuleset";
import {
    calculateBuild,
    DEFAULT_CONDITIONAL_STATE,
    type ConditionalState,
    type DamageCalculationOptions,
    type ModdedWeaponStats,
} from "./damageCalc";
import { calculateDirectDamageToInitialPools, calculateStatusTickToTargetPools } from "./targetDamage";
import type { DirectTargetDamageInput, TargetDamagePool } from "./targetDamage";
import { normalizeExternalStatusTypes } from "./uniqueStatusRules";

export type TennokaiTargetProfile = Pick<
    DirectTargetDamageInput,
    | "health"
    | "shields"
    | "overguard"
    | "armor"
    | "baseArmorValue"
    | "armorLevelMultiplier"
    | "armorDamageReductionMultiplier"
    | "toxinBypassesShields"
>;

export interface TennokaiOpportunityTimelineInput {
    /** Number of regular direct-hit attacks before each Heavy Attack. */
    regularHitsBetweenHeavy: number;
    /** Time between regular attacks after the first event, in seconds. */
    regularAttackIntervalSeconds: number;
    /** Time from the final regular hit to the following Heavy Attack, in seconds. */
    heavyAttackIntervalSeconds: number;
    /** Expected opportunity chance per qualifying hit before the rank bonus. */
    baseOpportunityChance?: number;
    /** Relative rank increase, where 0.5 means +50% of the base chance. */
    opportunityChanceBonus?: number;
    /** Active opportunity lifetime; defaults to the sourced two-second window. */
    opportunityWindowSeconds?: number;
    /** Guaranteed opportunity cadence in qualifying hits; overrides random chance. */
    guaranteedOpportunityEveryHits?: number;
    /** Number of attack events to schedule. */
    maxEvents: number;
    /** Combo points on the weapon before the first event. */
    startingComboPoints?: number;
    /** Expected combo points added by a qualifying regular hit. The default is one point. */
    comboPointsPerRegularHit?: number;
    /** Heavy Attack Efficiency as a fraction, capped to the game's 90% limit. */
    heavyAttackEfficiency?: number;
    /** Initial Combo points that regenerate at 40 points per second after Heavy Attacks. */
    initialComboPoints?: number;
    /** Combo points required per tier; weapon-specific values can be supplied by the caller. */
    comboPointsPerTier?: number;
    /** Highest combo multiplier available to this weapon. */
    maximumComboMultiplier?: number;
    /** Combo duration before the counter resets to Initial Combo. */
    comboDurationSeconds?: number;
    /** Whether a Tennokai kill refreshes the opportunity and unlocks chained damage. */
    truthFlameEnabled?: boolean;
    /** Additional opportunity lifetime from a Tennokai kill; Truth's Flame lists 4 seconds. */
    truthChainOpportunitySeconds?: number;
    /** Conditional kill probability for each event if that event is Tennokai-active. */
    tennokaiKillProbabilityByEvent?: readonly number[];
    /** Expected extra combo events from Slash applications and scheduled Bleed ticks. */
    additionalComboPointGains?: readonly TennokaiComboPointGainEvent[];
}

export interface TennokaiComboPointGainEvent {
    timeSeconds: number;
    comboPoints: number;
    /** Slash application gains happen after the direct attack at this event index. */
    afterAttackEventIndex?: number;
}

export interface TennokaiOpportunityTimelineEvent {
    index: number;
    timeSeconds: number;
    attackType: "regular" | "heavy";
    qualifyingHitNumber: number;
    /** Probability an active opportunity is available immediately before this attack. */
    activeOpportunityProbability: number;
    /** Probability this event itself produces a new opportunity after resolving. */
    generatedOpportunityProbability: number;
    /** Probability an opportunity remains available after this event resolves. */
    activeOpportunityProbabilityAfterEvent: number;
    /** Expected combo points immediately before this event. */
    comboPointsBeforeEvent: number;
    /** Integer combo tier used by the event-local damage profile. */
    comboMultiplierBeforeEvent: number;
    /** Expected combo points immediately after this event resolves. */
    comboPointsAfterEvent: number;
    /** Integer combo tier after this event resolves. */
    comboMultiplierAfterEvent: number;
    /** Conditional probability the damage chain is active, given an opportunity at this event. */
    tennokaiKillChainProbability: number;
}

export interface TennokaiOpportunityTimelineResult {
    events: TennokaiOpportunityTimelineEvent[];
    expectedTennokaiHeavyAttacks: number;
    heavyAttacks: number;
}

export interface TennokaiAttackTimelineInput {
    weapon: WeaponEntry;
    mods: readonly (ModEffect | null)[];
    targetFaction?: string;
    regularAttackIndex: number;
    /** Catalog row for Heavy Attack or Heavy Slam Attack; Heavy Slam is the currently available row. */
    heavyAttackIndex: number;
    regularHitsBetweenHeavy: number;
    /** Successful enemy attacks assumed blocked during each regular/Heavy cycle (0–20). */
    blockedEnemyAttacksBetweenHeavy?: number;
    conditionalState?: ConditionalState;
    damageOptions?: Omit<DamageCalculationOptions, "conditionalState">;
    /** Current target pools for direct/tick scoring, death resets, and Truth's Flame's direct-kill chain. */
    targetProfile?: TennokaiTargetProfile;
    /** Number of full regular/Heavy cycles to score; bounded to 1–100. */
    cycles?: number;
}

export interface TennokaiScoredEvent extends TennokaiOpportunityTimelineEvent {
    expectedDamageBeforeTargetDefenses: number;
    /** Uncapped direct damage after routing and defense multipliers for the selected target's initial pools. */
    expectedDamageAfterTargetDefenses: number | null;
    /** Expected-direct-hit threshold result, conditional on this being a Tennokai Heavy Attack. */
    tennokaiTargetKillProbability: number;
    statusChance: number;
    criticalChance: number;
    criticalMultiplier: number;
    tennokaiDamageBonus: number;
    tennokaiCritDamageBonus: number;
    tennokaiStatusChanceBonus: number;
    expectedSlashApplications: number;
    expectedRelentlessComboPointsFromSlashApplication: number;
}

export interface TennokaiAttackTimelineResult {
    supported: boolean;
    limitation: string | null;
    events: TennokaiScoredEvent[];
    expectedDamageBeforeTargetDefenses: number;
    expectedDamagePerSecondBeforeTargetDefenses: number;
    /** Expected direct and Bleed damage applied to target pools across repeated identical targets. */
    expectedDamagePerSecondAfterTargetDefenses: number | null;
    /** Expected Slash tick damage applied to target pools over the full Bleed tail. */
    expectedBleedDamageAfterTargetDefenses: number;
    /** Expected number of melee Slash applications that landed before target death. */
    expectedSlashApplications: number;
    /** Expected Relentless Combination points from Slash applications and landed Bleed ticks. */
    expectedRelentlessComboPoints: number;
    /** Expected combo points from Slash applications only. */
    expectedRelentlessComboPointsFromSlashApplications: number;
    /** Expected combo points from Bleed damage ticks only. */
    expectedRelentlessComboPointsFromBleedTicks: number;
    /** Expected landed per-stack Bleed tick events across the schedule and tail. */
    expectedBleedTicks: number;
    /** Count of repeated identical targets killed by a Bleed tick. */
    expectedBleedTickTargetKills: number;
    /** Scored attack schedule plus the longest selected Slash duration tail. */
    evaluationDurationSeconds: number;
    expectedTennokaiHeavyAttackShare: number;
    regularHitsBetweenHeavy: number;
    blockedEnemyAttacksBetweenHeavy: number;
    expectedComboPointsPerBlockedEnemyAttack: number;
    opportunityChancePerHit: number;
    opportunityWindowSeconds: number;
    opportunityRangeBonusMeters: number;
    comboGainAssumptionPointsPerRegularHit: number;
    notes: string[];
}

interface OpportunityState {
    expiresAt: number;
    chainDamageActive: boolean;
    probability: number;
}

const NONE_EXPIRY = Number.NEGATIVE_INFINITY;
const EPSILON = 1e-9;
const MIN_COMBO_DURATION_SECONDS = 0.1;

function finiteNonNegative(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) ? Math.max(0, value ?? fallback) : fallback;
}

function normalizeEventCount(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(20_000, Math.floor(value))) : 0;
}

function mergeStates(states: OpportunityState[]): OpportunityState[] {
    const probabilities = new Map<string, OpportunityState>();
    for (const state of states) {
        if (state.probability <= Number.EPSILON) continue;
        const key = `${state.expiresAt}:${state.chainDamageActive ? 1 : 0}`;
        const previous = probabilities.get(key);
        if (previous) previous.probability += state.probability;
        else probabilities.set(key, { ...state });
    }
    return [...probabilities.values()];
}

function expireStates(states: OpportunityState[], timeSeconds: number): OpportunityState[] {
    return mergeStates(states.map((state) => state.expiresAt <= timeSeconds + EPSILON
        ? { ...state, expiresAt: NONE_EXPIRY }
        : state));
}

function activeProbability(states: OpportunityState[]): number {
    return Math.min(1, states.reduce((sum, state) => sum + (
        state.expiresAt === NONE_EXPIRY ? 0 : state.probability
    ), 0));
}

function chainProbabilityDuringOpportunity(states: OpportunityState[]): number {
    const active = activeProbability(states);
    if (active <= Number.EPSILON) return 0;
    const activeAndChained = states.reduce((sum, state) => sum + (
        state.expiresAt !== NONE_EXPIRY && state.chainDamageActive ? state.probability : 0
    ), 0);
    return Math.max(0, Math.min(1, activeAndChained / active));
}

function rollOpportunity(
    states: OpportunityState[],
    timeSeconds: number,
    chance: number,
    guaranteed: boolean,
    opportunityWindowSeconds: number,
): OpportunityState[] {
    const expiry = timeSeconds + opportunityWindowSeconds;
    if (guaranteed || chance >= 1) {
        // Preserve the probability split for Truth's Flame's persistent chain
        // while refreshing each state's single active opportunity marker.
        return mergeStates(states.map((state) => ({
            ...state,
            expiresAt: Math.max(state.expiresAt, expiry),
        })));
    }
    if (chance <= 0) return states;
    const next: OpportunityState[] = [];
    for (const state of states) {
        next.push({ expiresAt: state.expiresAt, chainDamageActive: state.chainDamageActive, probability: state.probability * (1 - chance) });
        next.push({
            expiresAt: Math.max(state.expiresAt, expiry),
            chainDamageActive: state.chainDamageActive,
            probability: state.probability * chance,
        });
    }
    return mergeStates(next);
}

/**
 * Simulate the active-opportunity probability at every event in a repeated
 * regular-hit/Heavy-Attack cycle. This is an expected-state timeline, not a
 * Monte Carlo trace. A new opportunity roll refreshes the active marker.
 */
export function simulateTennokaiOpportunityTimeline(
    input: TennokaiOpportunityTimelineInput,
): TennokaiOpportunityTimelineResult {
    const regularHitsBetweenHeavy = Math.max(1, normalizeEventCount(input.regularHitsBetweenHeavy));
    const regularInterval = finiteNonNegative(input.regularAttackIntervalSeconds, 0);
    const heavyInterval = finiteNonNegative(input.heavyAttackIntervalSeconds, 0);
    const opportunityWindowSeconds = finiteNonNegative(input.opportunityWindowSeconds, 2) || 2;
    const cadence = Math.max(0, normalizeEventCount(input.guaranteedOpportunityEveryHits ?? 0));
    const chance = Math.min(1, finiteNonNegative(input.baseOpportunityChance, 0.15) *
        (1 + finiteNonNegative(input.opportunityChanceBonus, 0)));
    const eventLimit = normalizeEventCount(input.maxEvents);
    let states: OpportunityState[] = [{ expiresAt: NONE_EXPIRY, chainDamageActive: false, probability: 1 }];
    const events: TennokaiOpportunityTimelineEvent[] = [];
    let qualifyingHitNumber = 0;
    let expectedTennokaiHeavyAttacks = 0;
    let heavyAttacks = 0;
    const pointsPerTier = finiteNonNegative(input.comboPointsPerTier, 20) || 20;
    const maximumComboMultiplier = Math.max(1, normalizeEventCount(input.maximumComboMultiplier ?? 12));
    const comboDurationSeconds = finiteNonNegative(input.comboDurationSeconds, 5);
    const initialComboPoints = finiteNonNegative(input.initialComboPoints, 0);
    const startingComboPoints = Math.max(initialComboPoints, finiteNonNegative(input.startingComboPoints, initialComboPoints));
    const regularHitComboPoints = finiteNonNegative(input.comboPointsPerRegularHit, 1);
    const heavyAttackEfficiency = Math.min(0.9, finiteNonNegative(input.heavyAttackEfficiency, 0));
    let initialComboPointsRemaining = Math.min(initialComboPoints, startingComboPoints);
    let earnedComboPoints = Math.max(0, startingComboPoints - initialComboPointsRemaining);
    let lastComboGainAt = Number.NEGATIVE_INFINITY;
    let lastInitialComboRegenAt = Number.NEGATIVE_INFINITY;
    let canRegenInitialCombo = false;
    const timedComboGains = (input.additionalComboPointGains ?? [])
        .filter((gain) => gain.afterAttackEventIndex === undefined &&
            Number.isFinite(gain.timeSeconds) && Number.isFinite(gain.comboPoints) && gain.comboPoints > 0)
        .slice()
        .sort((left, right) => left.timeSeconds - right.timeSeconds);
    const comboGainsAfterAttack = new Map<number, number>();
    for (const gain of input.additionalComboPointGains ?? []) {
        if (!Number.isInteger(gain.afterAttackEventIndex) || !Number.isFinite(gain.comboPoints) || gain.comboPoints <= 0) continue;
        const eventIndex = gain.afterAttackEventIndex!;
        comboGainsAfterAttack.set(eventIndex, (comboGainsAfterAttack.get(eventIndex) ?? 0) + gain.comboPoints);
    }
    let nextTimedComboGain = 0;

    const advanceComboClock = (timeSeconds: number) => {
        if (Number.isFinite(lastComboGainAt) && timeSeconds - lastComboGainAt > comboDurationSeconds + EPSILON) {
            initialComboPointsRemaining = initialComboPoints;
            earnedComboPoints = 0;
        }
        if (canRegenInitialCombo && Number.isFinite(lastInitialComboRegenAt) && timeSeconds > lastInitialComboRegenAt) {
            initialComboPointsRemaining = Math.min(
                initialComboPoints,
                initialComboPointsRemaining + (timeSeconds - lastInitialComboRegenAt) * 40,
            );
            lastInitialComboRegenAt = timeSeconds;
        }
    };

    const addComboPointsAt = (timeSeconds: number, points: number) => {
        if (points <= 0) return;
        advanceComboClock(timeSeconds);
        earnedComboPoints += points;
        lastComboGainAt = timeSeconds;
    };

    const comboTier = (points: number) => Math.max(1, Math.min(
        maximumComboMultiplier,
        1 + Math.floor(Math.max(0, points) / pointsPerTier),
    ));

    for (let index = 0; index < eventLimit; index++) {
        const cycleLength = regularHitsBetweenHeavy + 1;
        const cycleIndex = Math.floor(index / cycleLength);
        const positionInCycle = index % cycleLength;
        const isHeavy = positionInCycle === regularHitsBetweenHeavy;
        const cycleDuration = regularHitsBetweenHeavy * regularInterval + heavyInterval;
        const timeSeconds = cycleIndex * cycleDuration + (isHeavy
            ? Math.max(0, regularHitsBetweenHeavy - 1) * regularInterval + heavyInterval
            : positionInCycle * regularInterval);

        states = expireStates(states, timeSeconds);
        advanceComboClock(timeSeconds);
        while (timedComboGains[nextTimedComboGain] &&
            timedComboGains[nextTimedComboGain].timeSeconds <= timeSeconds + EPSILON) {
            const gain = timedComboGains[nextTimedComboGain++];
            addComboPointsAt(gain.timeSeconds, gain.comboPoints);
        }
        // A Bleed tick at an attack's timestamp lands first. Slash applications
        // from the attack itself are applied after the event below.
        advanceComboClock(timeSeconds);
        const availableProbability = activeProbability(states);
        const chainProbability = chainProbabilityDuringOpportunity(states);
        const comboPointsBeforeEvent = initialComboPointsRemaining + earnedComboPoints;
        const comboMultiplierBeforeEvent = comboTier(comboPointsBeforeEvent);
        if (isHeavy) {
            heavyAttacks++;
            expectedTennokaiHeavyAttacks += availableProbability;
            const truthFlameEnabled = input.truthFlameEnabled === true;
            const killProbability = truthFlameEnabled
                ? Math.max(0, Math.min(1, input.tennokaiKillProbabilityByEvent?.[index] ?? 0))
                : 0;
            const chainOpportunitySeconds = finiteNonNegative(input.truthChainOpportunitySeconds, 4) || 4;
            // A successful Tennokai heavy consumes the current flash, then
            // Truth's Flame immediately creates a new timed opportunity.
            states = mergeStates(states.flatMap((state) => {
                const hasOpportunity = state.expiresAt !== NONE_EXPIRY;
                const consumed = { ...state, expiresAt: NONE_EXPIRY };
                if (!hasOpportunity || !truthFlameEnabled || killProbability <= 0) return [hasOpportunity ? consumed : state];
                const successfulKillProbability = state.probability * killProbability;
                const failedKillProbability = state.probability * (1 - killProbability);
                return [
                    ...(successfulKillProbability > 0 ? [{
                        expiresAt: timeSeconds + chainOpportunitySeconds,
                        chainDamageActive: true,
                        probability: successfulKillProbability,
                    }] : []),
                    ...(failedKillProbability > 0 ? [{
                        ...consumed,
                        probability: failedKillProbability,
                    }] : []),
                ];
            }));
            const expectedRetention = availableProbability * (truthFlameEnabled ? killProbability : 1) +
                (1 - availableProbability) * heavyAttackEfficiency;
            initialComboPointsRemaining *= expectedRetention;
            earnedComboPoints *= expectedRetention;
            canRegenInitialCombo = true;
            lastInitialComboRegenAt = timeSeconds;
        } else {
            earnedComboPoints += regularHitComboPoints;
        }

        addComboPointsAt(timeSeconds, comboGainsAfterAttack.get(index) ?? 0);

        qualifyingHitNumber++;
        const guaranteed = cadence > 0 && qualifyingHitNumber % cadence === 0;
        states = rollOpportunity(
            states,
            timeSeconds,
            cadence > 0 ? 0 : chance,
            guaranteed,
            opportunityWindowSeconds,
        );
        events.push({
            index,
            timeSeconds,
            attackType: isHeavy ? "heavy" : "regular",
            qualifyingHitNumber,
            activeOpportunityProbability: availableProbability,
            generatedOpportunityProbability: guaranteed ? 1 : cadence > 0 ? 0 : chance,
            activeOpportunityProbabilityAfterEvent: activeProbability(states),
            comboPointsBeforeEvent,
            comboMultiplierBeforeEvent,
            comboPointsAfterEvent: initialComboPointsRemaining + earnedComboPoints,
            comboMultiplierAfterEvent: comboTier(initialComboPointsRemaining + earnedComboPoints),
            tennokaiKillChainProbability: chainProbability,
        });
        lastComboGainAt = timeSeconds;
    }

    return { events, expectedTennokaiHeavyAttacks, heavyAttacks };
}
function buildEventStats(
    input: TennokaiAttackTimelineInput,
    regularWeapon: WeaponEntry,
    heavyWeapon: WeaponEntry,
    event: TennokaiOpportunityTimelineEvent,
    tennokaiProbability: number,
    chainProbability: number,
): ModdedWeaponStats {
    const eventWeapon = event.attackType === "regular" ? regularWeapon : heavyWeapon;
    return calculateBuild(eventWeapon, [...input.mods], input.targetFaction ?? "", {
        ...(input.damageOptions ?? {}),
        conditionalState: {
            ...(input.conditionalState ?? DEFAULT_CONDITIONAL_STATE),
            meleeComboPointsAtImpact: event.comboPointsBeforeEvent,
            tennokaiAttackProbability: event.attackType === "heavy" ? tennokaiProbability : 0,
            tennokaiKillChainProbability: event.attackType === "heavy" ? chainProbability : 0,
        },
    }).modded;
}

function initialTargetPools(target: TennokaiTargetProfile): Record<TargetDamagePool, number> {
    return {
        health: Math.max(0, target.health),
        shields: Math.max(0, target.shields),
        overguard: Math.max(0, target.overguard),
    };
}

function targetDamageForStats(
    stats: ModdedWeaponStats,
    target: TennokaiTargetProfile,
    remaining: Record<TargetDamagePool, number>,
    faction: string,
) {
    const armorStrip = 1 - ((1 - stats.heatArmorStrip) * (1 - stats.corrosiveArmorStrip));
    return calculateDirectDamageToInitialPools({
        ...target,
        health: remaining.health,
        shields: remaining.shields,
        overguard: remaining.overguard,
        armorDamageReductionMultiplier: (target.armorDamageReductionMultiplier ?? 1) * (1 - armorStrip),
        damageByType: stats.damageBreakdownBeforePerStatus,
        faction,
        factionDamageBonus: stats.factionDamageBonus,
        viralHealthDamageBonus: stats.viralHealthDamageBonus,
        magneticDefenseDamageBonus: stats.magneticShieldDamageBonus,
        expectedHitDamageMultiplier: stats.expectedHitDamageMultiplier,
        expectedProjectiles: stats.multishot,
        expectedDamageMultiplier: stats.damageWeightedMultishot,
        singleProjectileDamageBonus: stats.singleProjectileDamageBonus,
    });
}

function targetPoolsAreDestroyed(
    remaining: Record<TargetDamagePool, number>,
    uncappedDamage: Record<TargetDamagePool, number>,
): boolean {
    return (["overguard", "shields", "health"] as const).every((pool) =>
        remaining[pool] <= EPSILON || uncappedDamage[pool] + EPSILON >= remaining[pool]);
}

export function findSupportedTennokaiAttackPair(
    weapon: WeaponEntry,
): { regularAttackIndex: number; heavyAttackIndex: number } | null {
    if (weapon.category !== "Melee" && weapon.category !== "Arch-Melee") return null;
    if (/\b(?:gunblade|glaive)\b/i.test(`${weapon.weaponType} ${weapon.name}`)) return null;
    const regularAttackIndex = weapon.attacks.findIndex((attack) =>
        /^normal attack$/i.test(attack.name.trim()) &&
        (attack.multishot ?? weapon.multishot) <= 1 &&
        attack.isAreaDamage !== true &&
        !attack.modelLimitation,
    );
    if (regularAttackIndex < 0) return null;
    const heavyCandidates = weapon.attacks
        .map((attack, index) => ({ attack, index }))
        .filter(({ attack }) => /^(?:heavy attack|heavy slam attack)$/i.test(attack.name.trim()))
        .sort((left, right) => Number(/slam/i.test(left.attack.name)) - Number(/slam/i.test(right.attack.name)));
    const heavyAttackIndex = heavyCandidates.find(({ attack }) => {
        const isSlam = /^heavy slam attack$/i.test(attack.name.trim());
        return (attack.multishot ?? weapon.multishot) <= 1 &&
            (attack.isAreaDamage !== true || isSlam) &&
            !attack.modelLimitation;
    })?.index;
    return heavyAttackIndex === undefined ? null : { regularAttackIndex, heavyAttackIndex };
}

function reduceTargetPools(
    remaining: Record<TargetDamagePool, number>,
    damage: Record<TargetDamagePool, number>,
): Record<TargetDamagePool, number> {
    return {
        overguard: Math.max(0, remaining.overguard - damage.overguard),
        shields: Math.max(0, remaining.shields - damage.shields),
        health: Math.max(0, remaining.health - damage.health),
    };
}

interface SlashBleedCohort {
    nextTickAt: number;
    ticksRemaining: number;
    expectedStacks: number;
    damagePerTick: number;
    viralHealthDamageBonus: number;
    magneticShieldDamageBonus: number;
}

interface TennokaiSlashTimelinePass {
    events: TennokaiScoredEvent[];
    comboPointGains: TennokaiComboPointGainEvent[];
    killProbabilities: number[];
    expectedDamageBeforeTargetDefenses: number;
    expectedDamageAfterTargetDefenses: number | null;
    expectedBleedDamageAfterTargetDefenses: number;
    expectedSlashApplications: number;
    expectedRelentlessComboPoints: number;
    expectedRelentlessComboPointsFromSlashApplications: number;
    expectedRelentlessComboPointsFromBleedTicks: number;
    expectedBleedTicks: number;
    expectedBleedTickTargetKills: number;
    evaluationDurationSeconds: number;
}

function expectedSlashApplications(stats: ModdedWeaponStats): number {
    return Math.max(0, stats.averageProcsPerShot * (stats.procChanceByType.slash ?? 0));
}

function simulateTennokaiSlashTimeline(
    input: TennokaiAttackTimelineInput,
    timeline: TennokaiOpportunityTimelineResult,
    regularWeapon: WeaponEntry,
    heavyWeapon: WeaponEntry,
    relentlessChance: number,
    evaluationDurationSeconds: number,
): TennokaiSlashTimelinePass {
    const target = input.targetProfile;
    const originalPools = target ? initialTargetPools(target) : null;
    let remainingPools = originalPools ? { ...originalPools } : null;
    const bleedCohorts: SlashBleedCohort[] = [];
    const comboPointGains: TennokaiComboPointGainEvent[] = [];
    const killProbabilities = Array.from({ length: timeline.events.length }, () => 0);
    const eventSummaries: TennokaiScoredEvent[] = [];
    let expectedDamageBeforeTargetDefenses = 0;
    let expectedDamageAfterTargetDefenses = 0;
    let expectedBleedDamageAfterTargetDefenses = 0;
    let expectedSlashApplicationsTotal = 0;
    let expectedRelentlessComboPoints = 0;
    let expectedRelentlessComboPointsFromSlashApplications = 0;
    let expectedRelentlessComboPointsFromBleedTicks = 0;
    let expectedBleedTicks = 0;
    let expectedBleedTickTargetKills = 0;
    const faction = input.targetFaction ?? "";
    const comparisonEpsilon = 1e-9;

    const processDueBleedTicks = (untilSeconds: number) => {
        while (bleedCohorts.length > 0) {
            const tickTime = Math.min(...bleedCohorts.map((cohort) => cohort.nextTickAt));
            if (tickTime > untilSeconds + comparisonEpsilon) break;
            const dueCohorts = bleedCohorts.filter((cohort) => Math.abs(cohort.nextTickAt - tickTime) <= comparisonEpsilon);
            const tickDamage = dueCohorts.reduce(
                (sum, cohort) => sum + cohort.expectedStacks * cohort.damagePerTick,
                0,
            );
            const tickStacks = dueCohorts.reduce((sum, cohort) => sum + cohort.expectedStacks, 0);
            expectedBleedTicks += tickStacks;
            if (tickDamage > 0) {
                expectedDamageBeforeTargetDefenses += tickDamage;
                if (relentlessChance > 0 && tickStacks > 0) {
                    const comboPoints = tickStacks * relentlessChance;
                    comboPointGains.push({ timeSeconds: tickTime, comboPoints });
                    expectedRelentlessComboPoints += comboPoints;
                    expectedRelentlessComboPointsFromBleedTicks += comboPoints;
                }
                if (target && remainingPools) {
                    const weightedViralBonus = tickStacks > 0
                        ? dueCohorts.reduce((sum, cohort) => sum + cohort.expectedStacks * cohort.viralHealthDamageBonus, 0) / tickStacks
                        : 0;
                    const weightedMagneticBonus = tickStacks > 0
                        ? dueCohorts.reduce((sum, cohort) => sum + cohort.expectedStacks * cohort.magneticShieldDamageBonus, 0) / tickStacks
                        : 0;
                    const applied = calculateStatusTickToTargetPools({
                        faction,
                        armor: target.armor,
                        viralHealthDamageBonus: weightedViralBonus,
                        magneticDefenseDamageBonus: weightedMagneticBonus,
                        toxinBypassesShields: target.toxinBypassesShields,
                    }, remainingPools, "slash", tickDamage);
                    expectedBleedDamageAfterTargetDefenses += Object.values(applied).reduce((sum, damage) => sum + damage, 0);
                    expectedDamageAfterTargetDefenses += Object.values(applied).reduce((sum, damage) => sum + damage, 0);
                    remainingPools = reduceTargetPools(remainingPools, applied);
                }
            }

            for (const cohort of dueCohorts) {
                cohort.ticksRemaining--;
                cohort.nextTickAt += 1;
            }
            for (let index = bleedCohorts.length - 1; index >= 0; index--) {
                if (bleedCohorts[index].ticksRemaining <= 0) bleedCohorts.splice(index, 1);
            }

            if (remainingPools && targetPoolsAreDestroyed(remainingPools, { health: 0, shields: 0, overguard: 0 })) {
                expectedBleedTickTargetKills++;
                remainingPools = originalPools ? { ...originalPools } : null;
                // Bleed instances stay on the defeated enemy and do not transfer to its replacement.
                bleedCohorts.length = 0;
            }
        }
    };

    for (const event of timeline.events) {
        // A previously applied Slash ticks before an attack at the same timestamp.
        processDueBleedTicks(event.timeSeconds);
        const opportunityProbability = event.attackType === "heavy"
            ? event.activeOpportunityProbability
            : 0;
        const branches: Array<{ probability: number; stats: ModdedWeaponStats; tennokai: boolean }> = [];
        if (opportunityProbability < 1 - Number.EPSILON) {
            branches.push({
                probability: 1 - opportunityProbability,
                stats: buildEventStats(input, regularWeapon, heavyWeapon, event, 0, 0),
                tennokai: false,
            });
        }
        if (opportunityProbability > Number.EPSILON) {
            branches.push({
                probability: opportunityProbability,
                stats: buildEventStats(input, regularWeapon, heavyWeapon, event, 1, event.tennokaiKillChainProbability),
                tennokai: true,
            });
        }
        if (branches.length === 0) {
            branches.push({ probability: 1, stats: buildEventStats(input, regularWeapon, heavyWeapon, event, 0, 0), tennokai: false });
        }

        let eventRawDamage = 0;
        let eventAppliedDamage = 0;
        let eventSlashApplications = 0;
        let eventSlashApplicationComboPoints = 0;
        let eventKillWeight = 0;
        const nextPools: Record<TargetDamagePool, number> | null = remainingPools ? { health: 0, shields: 0, overguard: 0 } : null;

        for (const branch of branches) {
            if (branch.probability <= Number.EPSILON) continue;
            eventRawDamage += branch.probability * branch.stats.totalDamage;
            let branchDamage: ReturnType<typeof targetDamageForStats> | null = null;
            let branchKilled = false;
            if (target && remainingPools) {
                branchDamage = targetDamageForStats(branch.stats, target, remainingPools, faction);
                branchKilled = targetPoolsAreDestroyed(remainingPools, branchDamage.uncappedDamageByPool);
                eventAppliedDamage += branch.probability * Object.values(branchDamage.damageByPool)
                    .reduce((sum, damage) => sum + damage, 0);
                if (branch.tennokai && branchKilled) killProbabilities[event.index] = 1;
                const branchPools = branchKilled
                    ? originalPools!
                    : reduceTargetPools(remainingPools, branchDamage.damageByPool);
                if (nextPools) {
                    for (const pool of ["health", "shields", "overguard"] as const) {
                        nextPools[pool] += branch.probability * branchPools[pool];
                    }
                }
                if (branchKilled) eventKillWeight += branch.probability;
            }
            if (!branchKilled) {
                const applications = expectedSlashApplications(branch.stats);
                if (applications > 0) {
                    const weightedApplications = branch.probability * applications;
                    eventSlashApplications += weightedApplications;
                    const tickCount = countStatusDamageTicks(
                        "slash",
                        STATUS_EFFECT_RULES.slash.durationSeconds * branch.stats.statusDurationMultiplier,
                    );
                    const tickDamage = Math.max(0, branch.stats.slashDotTickDamagePerProc);
                    if (tickCount > 0 && tickDamage > 0) {
                        bleedCohorts.push({
                            nextTickAt: event.timeSeconds + (STATUS_EFFECT_RULES.slash.firstTickSeconds ?? 1),
                            ticksRemaining: tickCount,
                            expectedStacks: weightedApplications,
                            damagePerTick: tickDamage,
                            viralHealthDamageBonus: branch.stats.viralHealthDamageBonus,
                            magneticShieldDamageBonus: branch.stats.magneticShieldDamageBonus,
                        });
                    }
                    if (relentlessChance > 0) {
                        const comboPoints = weightedApplications * relentlessChance;
                        eventSlashApplicationComboPoints += comboPoints;
                        expectedRelentlessComboPoints += comboPoints;
                        expectedRelentlessComboPointsFromSlashApplications += comboPoints;
                        comboPointGains.push({
                            timeSeconds: event.timeSeconds,
                            comboPoints,
                            afterAttackEventIndex: event.index,
                        });
                    }
                }
            }
        }

        if (remainingPools && nextPools) {
            remainingPools = nextPools;
            // A kill branch cancels every Bleed instance on the defeated target.
            if (eventKillWeight >= 1 - Number.EPSILON) bleedCohorts.length = 0;
            else if (eventKillWeight > 0) {
                for (const cohort of bleedCohorts) cohort.expectedStacks *= 1 - eventKillWeight;
                for (let index = bleedCohorts.length - 1; index >= 0; index--) {
                    if (bleedCohorts[index].expectedStacks <= Number.EPSILON) bleedCohorts.splice(index, 1);
                }
            }
        }

        expectedDamageBeforeTargetDefenses += eventRawDamage;
        if (target) expectedDamageAfterTargetDefenses += eventAppliedDamage;
        expectedSlashApplicationsTotal += eventSlashApplications;
        const expectedStatusChance = branches.reduce((sum, branch) => sum + branch.probability * branch.stats.statusChance, 0);
        const expectedCriticalChance = branches.reduce((sum, branch) => sum + branch.probability * branch.stats.critChance, 0);
        const expectedCriticalMultiplier = branches.reduce((sum, branch) => sum + branch.probability * branch.stats.critMultiplier, 0);
        const tennokaiBranch = branches.find((branch) => branch.tennokai);
        const branchProbability = tennokaiBranch?.probability ?? 0;
        eventSummaries.push({
            ...event,
            expectedDamageBeforeTargetDefenses: eventRawDamage,
            expectedDamageAfterTargetDefenses: target ? eventAppliedDamage : null,
            tennokaiTargetKillProbability: killProbabilities[event.index] ?? 0,
            statusChance: expectedStatusChance,
            criticalChance: expectedCriticalChance,
            criticalMultiplier: expectedCriticalMultiplier,
            tennokaiDamageBonus: (tennokaiBranch?.stats.tennokaiDamageBonus ?? 0) * branchProbability,
            tennokaiCritDamageBonus: (tennokaiBranch?.stats.tennokaiCritDamageBonus ?? 0) * branchProbability,
            tennokaiStatusChanceBonus: (tennokaiBranch?.stats.tennokaiStatusChanceBonus ?? 0) * branchProbability,
            expectedSlashApplications: eventSlashApplications,
            expectedRelentlessComboPointsFromSlashApplication: eventSlashApplicationComboPoints,
        });
    }
    processDueBleedTicks(Number.POSITIVE_INFINITY);

    return {
        events: eventSummaries,
        comboPointGains,
        killProbabilities,
        expectedDamageBeforeTargetDefenses,
        expectedDamageAfterTargetDefenses: target ? expectedDamageAfterTargetDefenses : null,
        expectedBleedDamageAfterTargetDefenses,
        expectedSlashApplications: expectedSlashApplicationsTotal,
        expectedRelentlessComboPoints,
        expectedRelentlessComboPointsFromSlashApplications,
        expectedRelentlessComboPointsFromBleedTicks,
        expectedBleedTicks,
        expectedBleedTickTargetKills,
        evaluationDurationSeconds,
    };
}

/**
 * Score a bounded direct-hit regular/Heavy Attack cycle. Opportunity,
 * combo-retention, and Tennokai-only mod stats are represented as expected
 * event-local values. The caller must not interpret the raw output as
 * target-specific damage, finite TTK, or optimizer evidence.
 */
export function calculateTennokaiAttackTimeline(
    input: TennokaiAttackTimelineInput,
): TennokaiAttackTimelineResult {
    const unsupported = (limitation: string): TennokaiAttackTimelineResult => ({
        supported: false,
        limitation,
        events: [],
        expectedDamageBeforeTargetDefenses: 0,
        expectedDamagePerSecondBeforeTargetDefenses: 0,
        expectedDamagePerSecondAfterTargetDefenses: null,
        expectedBleedDamageAfterTargetDefenses: 0,
        expectedSlashApplications: 0,
        expectedRelentlessComboPoints: 0,
        expectedRelentlessComboPointsFromSlashApplications: 0,
        expectedRelentlessComboPointsFromBleedTicks: 0,
        expectedBleedTicks: 0,
        expectedBleedTickTargetKills: 0,
        evaluationDurationSeconds: 0,
        expectedTennokaiHeavyAttackShare: 0,
        regularHitsBetweenHeavy: Math.max(1, Math.floor(input.regularHitsBetweenHeavy || 1)),
        blockedEnemyAttacksBetweenHeavy: 0,
        expectedComboPointsPerBlockedEnemyAttack: 1,
        opportunityChancePerHit: 0,
        opportunityWindowSeconds: 2,
        opportunityRangeBonusMeters: 0,
        comboGainAssumptionPointsPerRegularHit: 1,
        notes: [],
    });

    if (input.weapon.category !== "Melee" && input.weapon.category !== "Arch-Melee") {
        return unsupported("Tennokai is supported only for melee weapon profiles.");
    }
    if (/\b(?:gunblade|glaive)\b/i.test(`${input.weapon.weaponType} ${input.weapon.name}`)) {
        return unsupported("Gunblade and Glaive event rows need weapon-specific trigger, impact, and detonation history.");
    }
    const regularAttack = input.weapon.attacks[input.regularAttackIndex];
    const heavyAttack = input.weapon.attacks[input.heavyAttackIndex];
    if (!regularAttack || !/^normal attack$/i.test(regularAttack.name.trim())) {
        return unsupported("Choose a catalogued Normal Attack row for qualifying regular hits.");
    }
    const isHeavyAttackRow = /^heavy attack$/i.test(heavyAttack?.name.trim() ?? "");
    const isHeavySlamAttackRow = /^heavy slam attack$/i.test(heavyAttack?.name.trim() ?? "");
    if (!heavyAttack || (!isHeavyAttackRow && !isHeavySlamAttackRow)) {
        return unsupported("Choose a catalogued Heavy Attack or Heavy Slam Attack row; weapon-specific projectile sequences need separate timing models.");
    }
    if ((regularAttack.multishot ?? input.weapon.multishot) > 1 ||
        (heavyAttack.multishot ?? input.weapon.multishot) > 1) {
        return unsupported("Multi-strike attack rows are excluded because their component hits do not map to one qualifying Tennokai event.");
    }
    if (regularAttack.isAreaDamage === true || regularAttack.modelLimitation ||
        (heavyAttack.isAreaDamage === true && !isHeavySlamAttackRow) || heavyAttack.modelLimitation) {
        return unsupported("The selected attack rows are area or otherwise model-limited; this timeline accepts one direct target only.");
    }
    if (!input.mods.some((effect) => effect?.tennokaiEnabled === true)) {
        return unsupported("Equip a Tennokai-enabling mod to activate the opportunity timeline.");
    }

    const regularWeapon = withSelectedAttack(input.weapon, input.regularAttackIndex);
    const heavyWeapon = withSelectedAttack(input.weapon, input.heavyAttackIndex);
    const conditionalState = input.conditionalState ?? DEFAULT_CONDITIONAL_STATE;
    const options = input.damageOptions ?? {};
    const regularBaseStats = calculateBuild(regularWeapon, [...input.mods], input.targetFaction ?? "", {
        ...options,
        conditionalState: { ...conditionalState, tennokaiAttackProbability: 0, tennokaiKillChainProbability: 0 },
    }).modded;
    const heavyBaseStats = calculateBuild(heavyWeapon, [...input.mods], input.targetFaction ?? "", {
        ...options,
        conditionalState: { ...conditionalState, tennokaiAttackProbability: 0, tennokaiKillChainProbability: 0 },
    }).modded;
    const effectRows = input.mods.filter((effect): effect is ModEffect => effect !== null);
    const comboDurationBonusSeconds = effectRows.reduce(
        (total, effect) => total + (effect.comboDurationBonus ?? 0),
        0,
    );
    const comboDurationBaseBonus = effectRows.reduce(
        (total, effect) => total + (effect.comboDurationBaseBonus ?? 0),
        0,
    );
    const baseComboDurationSeconds = getMeleeComboRules(input.weapon).baseDurationSeconds;
    const comboDurationSeconds = Math.max(
        MIN_COMBO_DURATION_SECONDS,
        baseComboDurationSeconds * (1 + comboDurationBaseBonus) + comboDurationBonusSeconds,
    );
    const guaranteedOpportunityEveryHits = Math.min(...effectRows
        .map((effect) => effect.tennokaiOpportunityEveryHits ?? 0)
        .filter((hits) => hits > 0), Number.POSITIVE_INFINITY);
    const opportunityChanceBonus = effectRows.reduce(
        (total, effect) => total + (effect.tennokaiOpportunityChanceBonus ?? 0),
        0,
    );
    const opportunityChancePerHit = guaranteedOpportunityEveryHits < Number.POSITIVE_INFINITY
        ? 0
        : Math.min(1, 0.15 * (1 + opportunityChanceBonus));
    const opportunityWindowSeconds = effectRows.reduce(
        (maximum, effect) => Math.max(maximum, effect.tennokaiOpportunityWindowSeconds ?? 0),
        2,
    );
    const opportunityRangeBonusMeters = effectRows.reduce(
        (maximum, effect) => Math.max(maximum, effect.tennokaiRangeBonusMeters ?? 0),
        0,
    );
    const liftedTargetAssumed = normalizeExternalStatusTypes(conditionalState.externalStatusTypes).includes("lifted");
    const hasLiftedComboEffect = effectRows.some((effect) => (effect.liftedComboCountChanceBonus ?? 0) > 0);
    const liftedComboCountChance = liftedTargetAssumed
        ? effectRows.reduce((total, effect) => total + (effect.liftedComboCountChanceBonus ?? 0), 0)
        : 0;
    const additionalComboCountChance = Math.max(0, effectRows.reduce(
        (total, effect) => total + ((effect.relentlessCombinationSlashComboChance ?? 0) > 0
            ? 0
            : (effect.comboCountChanceBonus ?? 0)),
        0,
    ) + liftedComboCountChance);
    const expectedComboPointsPerRegularHit = 1 + additionalComboCountChance;
    const blockingComboCountChance = Math.max(0, effectRows.reduce(
        (total, effect) => total + (effect.blockingComboCountChanceBonus ?? 0),
        0,
    ));
    const expectedComboPointsPerBlockedEnemyAttack = 1 + blockingComboCountChance;
    const rules = getMeleeComboRules(input.weapon);
    const hitsBetweenHeavy = Math.max(1, Math.min(20, Math.floor(
        Number.isFinite(input.regularHitsBetweenHeavy) ? input.regularHitsBetweenHeavy : 1,
    )));
    const cycles = Math.max(1, Math.min(100, Math.floor(Number.isFinite(input.cycles) ? input.cycles ?? 8 : 8)));
    const maxEvents = (hitsBetweenHeavy + 1) * cycles;
    const regularInterval = 1 / Math.max(0.0001, regularBaseStats.fireRate);
    // The source lists faster Tennokai wind-up but not a numeric attack-row
    // wind-up value; the estimate therefore leaves wind-up out of this interval.
    const heavyInterval = 1 / Math.max(0.0001, heavyBaseStats.fireRate);
    const cycleDuration = hitsBetweenHeavy * regularInterval + heavyInterval;
    const blockedEnemyAttacksBetweenHeavy = Math.max(0, Math.min(20, Math.floor(
        Number.isFinite(input.blockedEnemyAttacksBetweenHeavy) ? input.blockedEnemyAttacksBetweenHeavy ?? 0 : 0,
    )));
    const blockedComboPointGains: TennokaiComboPointGainEvent[] = [];
    if (blockedEnemyAttacksBetweenHeavy > 0) {
        for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex++) {
            for (let blockIndex = 0; blockIndex < blockedEnemyAttacksBetweenHeavy; blockIndex++) {
                blockedComboPointGains.push({
                    timeSeconds: cycleIndex * cycleDuration +
                        ((blockIndex + 1) / (blockedEnemyAttacksBetweenHeavy + 1)) * cycleDuration,
                    comboPoints: expectedComboPointsPerBlockedEnemyAttack,
                });
            }
        }
    }
    const scheduleInput = {
        regularHitsBetweenHeavy: hitsBetweenHeavy,
        regularAttackIntervalSeconds: regularInterval,
        heavyAttackIntervalSeconds: heavyInterval,
        opportunityChanceBonus,
        opportunityWindowSeconds,
        ...(guaranteedOpportunityEveryHits < Number.POSITIVE_INFINITY
            ? { guaranteedOpportunityEveryHits }
            : {}),
        startingComboPoints: heavyBaseStats.meleeComboPointsBeforeHeavyAttack,
        initialComboPoints: heavyBaseStats.meleeInitialComboPoints,
        comboPointsPerRegularHit: expectedComboPointsPerRegularHit,
        heavyAttackEfficiency: heavyBaseStats.heavyAttackEfficiency,
        comboDurationSeconds,
        comboPointsPerTier: rules.pointsPerTier,
        maximumComboMultiplier: rules.maxMultiplier,
        maxEvents,
        additionalComboPointGains: blockedComboPointGains,
    };
    const truthFlameEnabled = effectRows.some((effect) => (effect.tennokaiChainedDamageBonus ?? 0) > 0);
    const truthChainOpportunitySeconds = effectRows.reduce(
        (maximum, effect) => Math.max(maximum, effect.tennokaiChainedOpportunitySeconds ?? 0),
        4,
    );
    const modelTruthChain = truthFlameEnabled && input.targetProfile !== undefined;
    const relentlessChance = Math.min(1, effectRows.reduce(
        (total, effect) => total + (effect.relentlessCombinationSlashComboChance ?? 0),
        0,
    ));
    const maximumSlashDurationSeconds = Math.max(
        STATUS_EFFECT_RULES.slash.durationSeconds * regularBaseStats.statusDurationMultiplier,
        STATUS_EFFECT_RULES.slash.durationSeconds * heavyBaseStats.statusDurationMultiplier,
    );
    const evaluationDurationSeconds = cycles * cycleDuration + maximumSlashDurationSeconds;
    let killProbabilities = Array.from({ length: maxEvents }, () => 0);
    let additionalComboPointGains: TennokaiComboPointGainEvent[] = [];
    let timeline = simulateTennokaiOpportunityTimeline({
        ...scheduleInput,
        truthFlameEnabled: modelTruthChain,
        truthChainOpportunitySeconds,
        tennokaiKillProbabilityByEvent: killProbabilities,
    });
    let slashTimeline = simulateTennokaiSlashTimeline(
        input,
        timeline,
        regularWeapon,
        heavyWeapon,
        relentlessChance,
        evaluationDurationSeconds,
    );
    let converged = relentlessChance <= 0 && !modelTruthChain;
    const passLimit = relentlessChance > 0 || modelTruthChain ? 12 : 1;
    for (let pass = 0; pass < passLimit; pass++) {
        if (pass > 0) {
            timeline = simulateTennokaiOpportunityTimeline({
                ...scheduleInput,
                truthFlameEnabled: modelTruthChain,
                truthChainOpportunitySeconds,
                tennokaiKillProbabilityByEvent: killProbabilities,
                additionalComboPointGains: [...blockedComboPointGains, ...additionalComboPointGains],
            });
            slashTimeline = simulateTennokaiSlashTimeline(
                input,
                timeline,
                regularWeapon,
                heavyWeapon,
                relentlessChance,
                evaluationDurationSeconds,
            );
        }
        const comboStable = slashTimeline.comboPointGains.length === additionalComboPointGains.length &&
            slashTimeline.comboPointGains.every((gain, index) => {
                const prior = additionalComboPointGains[index];
                return prior !== undefined &&
                    prior.afterAttackEventIndex === gain.afterAttackEventIndex &&
                    Math.abs(prior.timeSeconds - gain.timeSeconds) <= 1e-7 &&
                    Math.abs(prior.comboPoints - gain.comboPoints) <= 1e-7;
            });
        const killsStable = slashTimeline.killProbabilities.length === killProbabilities.length &&
            slashTimeline.killProbabilities.every((probability, index) =>
                Math.abs(probability - (killProbabilities[index] ?? 0)) <= 1e-7,
            );
        if (comboStable && killsStable) {
            converged = true;
            break;
        }
        additionalComboPointGains = slashTimeline.comboPointGains;
        killProbabilities = slashTimeline.killProbabilities;
    }
    if (!converged) {
        return unsupported("The expected Slash / combo / target-kill timeline did not converge within 12 passes for this build.");
    }
    const events = slashTimeline.events;
    const heavyEvents = events.filter((event) => event.attackType === "heavy");
    const expectedTennokaiHeavyAttacks = heavyEvents.reduce(
        (total, event) => total + event.activeOpportunityProbability,
        0,
    );
    return {
        supported: true,
        limitation: null,
        events,
        expectedDamageBeforeTargetDefenses: slashTimeline.expectedDamageBeforeTargetDefenses,
        expectedDamagePerSecondBeforeTargetDefenses: slashTimeline.evaluationDurationSeconds > 0
            ? slashTimeline.expectedDamageBeforeTargetDefenses / slashTimeline.evaluationDurationSeconds
            : 0,
        expectedDamagePerSecondAfterTargetDefenses: slashTimeline.expectedDamageAfterTargetDefenses !== null && slashTimeline.evaluationDurationSeconds > 0
            ? slashTimeline.expectedDamageAfterTargetDefenses / slashTimeline.evaluationDurationSeconds
            : null,
        expectedBleedDamageAfterTargetDefenses: slashTimeline.expectedBleedDamageAfterTargetDefenses,
        expectedSlashApplications: slashTimeline.expectedSlashApplications,
        expectedRelentlessComboPoints: slashTimeline.expectedRelentlessComboPoints,
        expectedRelentlessComboPointsFromSlashApplications: slashTimeline.expectedRelentlessComboPointsFromSlashApplications,
        expectedRelentlessComboPointsFromBleedTicks: slashTimeline.expectedRelentlessComboPointsFromBleedTicks,
        expectedBleedTicks: slashTimeline.expectedBleedTicks,
        expectedBleedTickTargetKills: slashTimeline.expectedBleedTickTargetKills,
        evaluationDurationSeconds: slashTimeline.evaluationDurationSeconds,
        expectedTennokaiHeavyAttackShare: heavyEvents.length > 0
            ? expectedTennokaiHeavyAttacks / heavyEvents.length
            : 0,
        regularHitsBetweenHeavy: hitsBetweenHeavy,
        blockedEnemyAttacksBetweenHeavy,
        expectedComboPointsPerBlockedEnemyAttack,
        opportunityChancePerHit,
        opportunityWindowSeconds,
        opportunityRangeBonusMeters,
        comboGainAssumptionPointsPerRegularHit: expectedComboPointsPerRegularHit,
        notes: [
            additionalComboCountChance > 0
                ? `Each qualifying Normal Attack hit adds one base combo point plus ${Math.round(additionalComboCountChance * 100)}% expected extra combo points from Additional Combo Count Chance; random gains are averaged, not sampled. Stance-specific combo generation remains outside this cycle.`
                : "One qualifying regular hit per Normal Attack event adds one combo point; stance-specific combo generation remains outside this cycle.",
            ...(additionalComboCountChance > 1 + EPSILON
                ? ["The Wiki says Additional Combo Count Chance stacks additively and can award extra hits above 100%; this cycle applies the combined value as expected extra combo points, so random gains are averaged rather than sampled."]
                : []),
            ...(liftedComboCountChance > 0
                ? [`Enduring Strike contributes ${Math.round(liftedComboCountChance * 100)}% Additional Combo Count Chance because Lifted is selected as an external target status and assumed maintained for this cycle; Lifted application and expiry (including Heavy Slam application) and Heavy Attack combo gains are not simulated.`]
                : []),
            ...(hasLiftedComboEffect && !liftedTargetAssumed
                ? ["Enduring Strike is equipped but inactive because Lifted is not selected as an external target status; its combo chance is not added to this cycle."]
                : []),
            ...(blockedEnemyAttacksBetweenHeavy > 0
                ? [`The cycle assumes ${blockedEnemyAttacksBetweenHeavy} successful enemy hit(s) or projectile(s) are blocked per Normal/Heavy cycle, evenly distributed in time. Each adds one base combo point; block events do not roll Tennokai opportunities.`]
                : []),
            ...(blockingComboCountChance > 0 && blockedEnemyAttacksBetweenHeavy > 0
                ? [`Guardian Derision adds ${Math.round(blockingComboCountChance * 100)}% expected extra combo points per assumed successful block; random gains are averaged, not sampled.`]
                : blockingComboCountChance > 0
                    ? ["Guardian Derision is equipped but inactive because no successful blocked enemy attacks are entered per cycle."]
                    : []),
            `The combo counter expires after ${comboDurationSeconds}s without a combo-gaining melee hit or blocked attack; the weapon's ${baseComboDurationSeconds}s base duration, percentage modifiers applied to that base, flat seconds, and the 0.1s minimum are included.`,
            ...(relentlessChance > 0
                ? [`Relentless Combination adds an expected ${Math.round(relentlessChance * 100)}% combo point per eligible melee Slash application and each landed Bleed tick; each gain updates later event combo tiers and refreshes the combo timer.`]
                : []),
            `Slash applications schedule up to ${countStatusDamageTicks("slash", maximumSlashDurationSeconds)} Bleed ticks at one-second intervals, starting one second later. Each Slash stack keeps its own source damage; ticks affect the target's active pool and bypass armor. When direct damage or a Bleed tick kills a target, its remaining Bleed stops and the next event starts against an identical target profile. The score includes a ${maximumSlashDurationSeconds.toFixed(1)}s Bleed tail after the attack cycles; other status types are not scored.`,
            "Target-aware Cycle DPS applies the selected faction, initial armor and pool routing, caps damage to each target, and repeats the same profile after a kill. Expected status applications and combo gains are mean-field values; hit, status, and critical rolls are not sampled.",
            isHeavySlamAttackRow
                ? "The Heavy Slam Attack row is scored against one centered target; nearby-target coverage and jump/position timing are excluded."
                : "Heavy-attack wind-up is omitted because the selected attack rows do not provide a verified numeric wind-up duration; the Tennokai speed bonus is also not quantified.",
            ...(opportunityRangeBonusMeters > 0
                ? ["Opportunity's Reach range bonus is reported but not applied because the weapon's base melee range and target distance are not part of this profile."]
                : []),
            ...(truthFlameEnabled && modelTruthChain
                ? ["Truth's Flame repeats identical target pools and activates its chain on a direct Tennokai Heavy Attack kill; Slash tick kills reset the target but do not activate the chain. Failed-kill combo resets are modeled; its Heat curse and Truth syndicate effect are not."]
                : truthFlameEnabled
                    ? ["Truth's Flame's repeated-target kill chain is not scored without target pools. Failed-kill combo resets, the Heat curse, and the Truth syndicate effect are not modeled."]
                : []),
        ],
    };
}
