import type { ModEffect } from "./modCatalog";
import { getSentientIncisionDamageType } from "../logic/sentientIncision";

export const VOLATILE_VARIANT_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/Nightwave/NightwaveSporothrixAugmentMod";
export const ACID_SHELLS_MOD_PATH = "/Lotus/Upgrades/Mods/Shotgun/Event/ProjectNightwatch/SobekNightwatchMod";
export const THERMAGNETIC_SHELLS_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/CorpusArena/SupraCorpusArenaMod";
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
export const OVERPRESSURED_ROUNDS_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/Nightwave/NightwaveLasGooAKAugmentMod";
export const PRECISION_STRIKE_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/Arbitration/GrnGrenadeLauncherArbitrationMod";
export const COMBAT_RELOAD_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/Nightwave/NightwaveTigrisAugmentMod";
export const DEADLY_MANEUVERS_MOD_PATH = "/Lotus/Upgrades/Mods/Nightwave/MagnusNightwaveMod";
export const CRITICAL_PRECISION_MOD_PATH = "/Lotus/Upgrades/Mods/Rifle/Event/Nightwave/NightwaveTiberonAugmentMod";
export const UNSEEN_DREAD_MOD_PATH = "/Lotus/Upgrades/Mods/Bows/Event/Nightwave/NightwaveStalkerBowAugmentMod";
export const CRITICAL_MUTATION_MOD_PATH = "/Lotus/Upgrades/Mods/Pistol/Event/Nightwave/NightwaveCatabolystAugmentMod";
export const AMALGAM_RIPKAS_TRUE_STEEL_MOD_PATH = "/Lotus/Upgrades/Mods/DualSource/Melee/RipkasShotgunMod";
export const STRAIN_FEVER_MOD_PATH = "/Lotus/Upgrades/Mods/Sets/Strain/HelminthStrainFeverMod";
export const STATIC_DISCHARGE_MOD_PATH = "/Lotus/Upgrades/Mods/Melee/Event/CorpusArena/ProvaCorpusArenaMod";
export const SWIPE_MOD_PATH = "/Lotus/Types/Friendly/Pets/CatbrowPetPrecepts/CatbrowSwipePrecept";
const TRUTH_FLAME_MOD_PATH = "/Lotus/Upgrades/EmpoweredHeavyMelee/CursedSyndicateEmpoweredHeavyMeleeMod";
const RELENTLESS_COMBINATION_MOD_PATH = "/Lotus/Upgrades/Mods/Melee/WeaponMeleeComboChanceFromDot";
const TRUE_PUNISHMENT_MOD_PATH = "/Lotus/Upgrades/Mods/Melee/Channel/ChannelCritsMod";
const CORRUPT_CHARGE_MOD_PATH = "/Lotus/Upgrades/Mods/Melee/DualStat/CorruptedHeavyDamageChargeSpeedMod";

const DAMAGE_RELEVANT_UNPARSED_STAT = /damage|critical|\bcrit\b|status\s+(?:chance|effects?|damage|duration)|multishot|projectile|fire rate|attack speed|charge rate|ammo efficiency|magazine|reload|combo|headshot|weak point|punch through|beam range|blast range|blast radius|\brange\b|\bentropy\b|\btennokai\b|opportunity\s+(?:chance|window)|melee hits?\b|\b(?:impact|puncture|slash|heat|cold|electricity|toxin|blast|gas|magnetic|viral|corrosive|radiation|void|tau)\b/i;

function hasUnparsedTruthSyndicateStat(lines: string[] | undefined): boolean {
    return (lines ?? []).some((line) => /[+-]?\d+(?:\.\d+)?\s+['"]Truth['"]/i.test(line));
}

export interface ScoringEffectContext {
    /** True only when the selected target profile confirms its head is a weak point. */
    headIsWeakPoint?: boolean;
    /** Whether the selected attack row is radial; direct-hit-only effects are unavailable on radial rows. */
    selectedAttackIsAreaDamage?: boolean;
    /** Name of the selected attack row for source-specific trigger boundaries. */
    selectedAttackName?: string;
    /** Trigger type of the selected attack row. */
    selectedAttackTrigger?: string;
    /** Selected target faction used by target-adaptive effects. */
    targetFaction?: string;
    /** Whether the scored attack begins against a target with an Overguard pool. */
    targetHasOverguard?: boolean;
    /** Whether the selected melee attack is a Slam, which Sentient Incision excludes. */
    selectedAttackUsesSlamDamageBonus?: boolean;
    /** Selected weapon name for weapon-specific snapshot rules. */
    selectedWeaponName?: string;
    /** Configured fraction of direct hits expected to land on headshot locations. */
    selectedAttackHeadshotRate?: number;
    /** Current remaining Deadly Maneuvers shots, used only for Burst scoring. */
    deadlyManeuversShotsRemaining?: number;
    /** Prior Critical Precision headshot projectiles, used only for Burst scoring. */
    criticalPrecisionHeadshotProjectiles?: number;
    /** Whether Dread is assumed invisible for Unseen Dread Burst scoring. */
    unseenDreadInvisibilityActive?: boolean;
    /** Prior Catabolyst kills represented by Critical Mutation's Burst snapshot. */
    criticalMutationPriorKills?: number;
    /** Whether Lifted is explicitly assumed active on the selected target. */
    targetHasLiftedStatus?: boolean;
    /** Active Strain cysts at impact for Burst-only Strain Infection/Fever snapshots. */
    strainInfectionCystsAtImpact?: number;
    /** Current optimization objective; these snapshots are Burst-only. */
    selectedGoal?: string;
    /** User-entered same-profile enemies actually hit per Swipe strike (0–4). */
    selectedSwipeTargetCount?: number;
    /** Successful enemy attacks assumed blocked per Tennokai attack cycle. */
    selectedTennokaiBlockedHitsBetweenHeavy?: number;
}

const UNSCORED_HIT_LOCATION_EFFECTS = [
    ["weakPointDamageBonus", "Weak-point damage bonus"],
    ["weakPointCritChanceBonus", "Weak-point critical chance bonus"],
] as const;

/** Parsed effects that remain unscored for the current target context. */
export function getUnmodeledScoringEffectLines(
    effect?: Partial<ModEffect> | null,
    context?: ScoringEffectContext,
): string[] {
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
        if (context?.headIsWeakPoint !== true) {
            for (const [key, label] of UNSCORED_HIT_LOCATION_EFFECTS) {
                const value = source.stats[key];
                if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
                    const reason = context?.headIsWeakPoint === false
                        ? "the selected target's head is not a modeled weak point"
                        : "the target's weak-point rules are not modeled";
                    lines.push(`${source.label}: ${label} is not scored because ${reason}.`);
                }
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
    context?: ScoringEffectContext,
): string[] {
    const truthFlameCycleScope = mod.path === TRUTH_FLAME_MOD_PATH && context?.selectedGoal === "tennokaiDps";
    const lines = (mod.unparsedStatsByRank?.[rank] ?? [])
        .filter((line) => mod.path !== BLOODTHIRST_MOD_PATH &&
            !(truthFlameCycleScope && /^CURSE:/i.test(line)) &&
            DAMAGE_RELEVANT_UNPARSED_STAT.test(line));
    if (hasUnparsedTruthSyndicateStat(mod.unparsedStatsByRank?.[rank])) {
        // Syndicate augments gain this combat effect from weapon-earned Affinity.
        // Its radial damage and encounter timing are not represented by the single-target score.
        // https://wiki.warframe.com/w/Syndicates
        // https://wiki.warframe.com/w/Weapon_Augment
        lines.push(truthFlameCycleScope
            ? "Tennokai Cycle DPS models Truth's Flame's kill chain by repeating the selected target profile, but excludes its player-side Heat curse and Truth syndicate effects; scores are target-damage-only."
            : mod.path === TRUTH_FLAME_MOD_PATH
                ? "Truth's Affinity-earned syndicate effect (radial Gas damage, 25% Health restore, and a temporary +25% Parkour Maneuvers buff) is not modeled. Standard goals exclude Truth's Flame; Tennokai Cycle DPS models its direct kill chain across repeated targets but omits this side effect."
                : "Truth's Affinity-earned syndicate effect (radial Gas damage, 25% Health restore, and a temporary +25% Parkour Maneuvers buff) is not modeled, so Auto Optimize skips this mod.");
    }
    if (mod.path === VOLATILE_VARIANT_MOD_PATH) {
        lines.push("Punch Through, instant direct-hit barb-explosion timing, and its added radius are not modeled; the rank-specific Status Chance bonus applies only to a selected AoE attack.");
    }
    if (mod.path === ACID_SHELLS_MOD_PATH) {
        lines.push("Acid Shells' on-death explosion is not scored; its falloff, line-of-sight checks, mode-specific max-Health scaling, and chain explosions are not modeled, so Auto Optimize skips the mod.");
    }
    if (mod.path === THERMAGNETIC_SHELLS_MOD_PATH) {
        // This Detron augment damages nearby enemies when one dies. Keep the
        // sourced rank text visible, but do not treat it as ordinary hit damage.
        // https://wiki.warframe.com/w/Thermagnetic_Shells
        lines.push("Thermagnetic Shells triggers an on-death explosion: 20–80 Magnetic Damage plus 10–40% of the triggering enemy's max Health as Blast Damage in a 6m radius. Linear falloff and line of sight apply. The Wiki says Elemental Ammo status effects no longer recursively retrigger these death explosions; the planner still does not resolve on-kill area damage, adjacent-target deaths, or mission-specific max-Health scaling, so Auto Optimize skips the mod.");
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
        if (context?.selectedGoal !== "vileDischargeDps" || context?.selectedWeaponName !== "Embolist" ||
            context?.selectedAttackName !== "Normal Attack") {
            // The dedicated objective owns the charge/discharge timeline and
            // its bounded neighboring-target estimate. Other scores exclude it.
            lines.push("Vile Discharge is scored only by the Embolist Normal Attack cycle objective. It models primary hits and expected DoT ticks charging to the rank cap, then a no-crit/no-status contact and 6m Toxin explosion with reload/action timing. The selected target is centered; configured same-profile neighbors in 0–3m and 3–6m bands use an area-uniform linear falloff estimate because the Wiki gives only approximate 80% edge falloff. Auto Optimize excludes it from other objectives. Wiki: https://wiki.warframe.com/w/Vile_Discharge");
        }
    }
    if (mod.path === OVERPRESSURED_ROUNDS_MOD_PATH) {
        // This EFV-5 augment crosses attack modes and requires a kill-driven
        // magazine timeline. Buckshot's numeric spread reduction is unknown;
        // a manual effective cone snapshot is available for Burst only.
        // https://wiki.warframe.com/w/Overpressured_Rounds
        // https://wiki.warframe.com/w/EFV-5_Jupiter
        lines.push("Overpressured Rounds' Rifle-kill buff applies only to the next Buckshot, and its magazine restore requires a Buckshot kill. The planner does not simulate cross-mode kill history or ammo changes, and the Wiki does not specify the spread reduction. An optional user-entered effective post-kill spread range enables an experimental single-target Burst estimate and applies the selected rank's sourced Falloff Distance bonus to the entered target distance. This models one assumed post-kill Buckshot event only; it does not simulate the prior Rifle kill, one-shot buff consumption, or repeat-fire history. Finite TTK, 5s Avg DPS, and Magazine Restore remain unscored, and Auto Optimize skips the mod.");
    }
    if (mod.path === SENTIENT_INCISION_MOD_PATH) {
        if (!context) {
            lines.push("Sentient Incision needs an explicit supported target faction or active Overguard to resolve its adaptive damage type. Without target context, this effect is unscored, so Auto Optimize skips the mod. Wiki: https://wiki.warframe.com/w/Sentient_Incision");
        } else if (context.selectedAttackUsesSlamDamageBonus === true) {
            lines.push("Sentient Incision does not affect Slam attacks, so this selected attack receives no bonus and Auto Optimize skips it for this attack. Wiki: https://wiki.warframe.com/w/Sentient_Incision");
        } else if (!getSentientIncisionDamageType(
            context.targetFaction ?? "",
            context.targetHasOverguard === true,
        )) {
            lines.push("Sentient Incision needs a supported target faction or active Overguard to select its adaptive damage type. No matching target is selected, so Auto Optimize skips this mod. Wiki: https://wiki.warframe.com/w/Sentient_Incision");
        }
    }
    if (mod.path === PRECISION_STRIKE_MOD_PATH && (
        context?.selectedAttackName !== "Grenade Impact" || context?.selectedAttackIsAreaDamage !== false
    )) {
        lines.push("Precision Strike's Reload Speed bonus requires a direct Tonkor grenade hit. The selected attack does not model that trigger, so Auto Optimize skips this mod.");
    }
    if (mod.path === COMBAT_RELOAD_MOD_PATH) {
        lines.push("Combat Reload requires five Tigris pellets to land on headshot locations and grants rank-scaled Reload Speed for 3s. Per-pellet headshot probability and buff expiry/refresh timing are not modeled, so Realistic leaves the effect inactive. Custom/Fully Stacked can represent a manual active-buff snapshot; Auto Optimize skips this mod.");
    }
    if (mod.path === DEADLY_MANEUVERS_MOD_PATH) {
        const weaponSupportsSnapshot = context?.selectedWeaponName === "Magnus" || context?.selectedWeaponName === "Magnus Prime";
        const hasHeadshotShare = Number.isFinite(context?.selectedAttackHeadshotRate) &&
            (context?.selectedAttackHeadshotRate ?? 0) > 0;
        const hasBurstSnapshot = context?.selectedGoal === "burst" &&
            Number.isFinite(context?.deadlyManeuversShotsRemaining) &&
            (context?.deadlyManeuversShotsRemaining ?? 0) > 0;
        if (!weaponSupportsSnapshot || context?.selectedAttackIsAreaDamage === true || !hasHeadshotShare || !hasBurstSnapshot) {
            lines.push("Deadly Maneuvers' dodge-triggered bonus applies to the next two Magnus/Magnus Prime shots. This planner uses an editable 0–2 remaining-shot snapshot for single-target Burst only; without a Burst snapshot and configured headshot share, the effect is unscored and Auto Optimize skips it. Dodge timing, shot history, and finite TTK / 5s DPS are not modeled.");
        }
    }
    if (mod.path === CRITICAL_PRECISION_MOD_PATH) {
        const weaponSupportsSnapshot = context?.selectedWeaponName === "Tiberon" || context?.selectedWeaponName === "Tiberon Prime";
        const isBurstAttack = context?.selectedAttackTrigger === "Burst" && (
            (context?.selectedWeaponName === "Tiberon" && context?.selectedAttackName === "Normal Attack") ||
            (context?.selectedWeaponName === "Tiberon Prime" && context?.selectedAttackName === "Burst")
        );
        const hasBurstSnapshot = context?.selectedGoal === "burst" &&
            Number.isFinite(context?.criticalPrecisionHeadshotProjectiles) &&
            (context?.criticalPrecisionHeadshotProjectiles ?? 0) > 0;
        if (!weaponSupportsSnapshot || !isBurstAttack || !hasBurstSnapshot || context?.selectedAttackIsAreaDamage !== false) {
            lines.push("Critical Precision adds rank-scaled base Critical Chance per prior headshot projectile, up to +500%. This planner uses an editable 0–200 prior-headshot snapshot only for Tiberon Burst and Tiberon Prime Burst scoring; missed-burst decay and non-Burst objectives are not modeled, so Auto Optimize skips it outside this supported snapshot.");
        }
    }
    if (mod.path === UNSEEN_DREAD_MOD_PATH) {
        const weaponSupportsSnapshot = context?.selectedWeaponName === "Dread";
        const hasBurstSnapshot = context?.selectedGoal === "burst" && context?.unseenDreadInvisibilityActive === true;
        if (!weaponSupportsSnapshot || context?.selectedAttackIsAreaDamage !== false || !hasBurstSnapshot) {
            lines.push("Unseen Dread adds rank-scaled Critical Damage while Dread is invisible. This planner uses an editable active-invisibility snapshot for direct, single-target Burst scoring only; the three-enemy trigger, invisibility duration/history, area coverage, finite TTK, and 5s DPS are not modeled, so Auto Optimize skips it outside this snapshot.");
        }
    }
    if (mod.path === CRITICAL_MUTATION_MOD_PATH) {
        const weaponSupportsSnapshot = context?.selectedWeaponName === "Catabolyst" || context?.selectedWeaponName === "Coda Catabolyst";
        const isDirectPrimaryAttack = context?.selectedAttackName === "Primary" && context?.selectedAttackIsAreaDamage === false;
        const hasBurstSnapshot = context?.selectedGoal === "burst" && Number.isFinite(context?.criticalMutationPriorKills) &&
            (context?.criticalMutationPriorKills ?? 0) > 0;
        if (!weaponSupportsSnapshot || !isDirectPrimaryAttack || !hasBurstSnapshot) {
            lines.push("Critical Mutation gains rank-scaled Critical Chance and Critical Damage with kills, up to +300%. This planner uses an editable 0–60 prior-kill snapshot for the direct Catabolyst/Coda Catabolyst Primary Burst row only; stack changes, including grenade-hit reduction, are not simulated. Reload grenade rows, finite TTK, 5s DPS, and non-Burst objectives remain unscored, so Auto Optimize skips it outside this supported snapshot.");
        }
    }
    if (mod.path === STATIC_DISCHARGE_MOD_PATH) {
        lines.push("Static Discharge's spin/overhead pulse sequence is scored only by the manual Prova cycle estimate. Standard single-attack objectives do not include its pulse history, and Auto Optimize skips the mod. The cycle assumes the target stays within 4m of the player, counts first-animation pulses at 0.2s intervals, and does not model nearby enemies or proc history. Wiki: https://wiki.warframe.com/w/Static_Discharge");
    }
    if (mod.path === SWIPE_MOD_PATH) {
        const selectedTargets = Number.isFinite(context?.selectedSwipeTargetCount)
            ? Math.max(0, Math.min(4, Math.floor(context?.selectedSwipeTargetCount ?? 0)))
            : 0;
        const supportedGroupScore = (context?.selectedGoal === "burst" || context?.selectedGoal === "scaling") &&
            selectedTargets > 0;
        if (!supportedGroupScore) {
            lines.push("Swipe's rank grants +1–4 additional enemies per Kavat Claw strike and +0.5–2m Attack Range. The planner scores an entered group-hit estimate for Burst or Scaling only; without a positive target count or for other objectives, the effect is unscored and Auto Optimize skips it. Target spacing, target selection, and companion movement are not simulated. Wiki: https://wiki.warframe.com/w/Swipe");
        }
    }
    if (mod.path === STRAIN_FEVER_MOD_PATH) {
        const hasSupportedWeapon = context?.selectedWeaponName === "Helminth Claws";
        const hasBurstSnapshot = context?.selectedGoal === "burst" && Number.isFinite(context?.strainInfectionCystsAtImpact) &&
            (context?.strainInfectionCystsAtImpact ?? 0) > 0;
        if (!hasSupportedWeapon || !hasBurstSnapshot) {
            lines.push("Strain Fever adds rank-scaled Helminth Charger Claw Damage per active cyst. This planner uses the saved 0–8 active-cyst snapshot for Helminth Claws Burst scoring only; cyst growth, eruption timing, and average uptime are not modeled, so Auto Optimize skips it without a positive Burst snapshot. The rank table and Update 37 correction imply +320% at eight cysts, while the Wiki's note says +240%; that note is treated as stale.");
        }
    }
    if (mod.path === AMALGAM_RIPKAS_TRUE_STEEL_MOD_PATH && context?.selectedWeaponName === "Ripkas") {
        // The mod's Critical Chance applies to this selected Ripkas profile, but
        // the Wiki's shotgun Reload Speed bonus belongs to a separate weapon.
        // https://wiki.warframe.com/w/Amalgam_Ripkas_True_Steel
        lines.push("Amalgam Ripkas True Steel's Critical Chance is scored on Ripkas; its Reload Speed bonus applies to separate Shotgun equipment, and Gore Chance is a utility effect. Neither is included in this weapon damage score.");
    }
    if (mod.path === BLOODTHIRST_MOD_PATH) {
        // The Slash keyword appears in the stat line because it determines
        // companion healing; this is not a weapon damage modifier.
        // https://wiki.warframe.com/w/Bloodthirst
        lines.push("Bloodthirst heals the companion for each active Slash stack per hit; companion healing is outside the damage score, so Auto Optimize skips this mod.");
    }
    if (mod.path === RELENTLESS_COMBINATION_MOD_PATH && context?.selectedGoal !== "tennokaiDps") {
        lines.push("Relentless Combination's Slash application and Bleed-tick combo gains are modeled only by Tennokai Cycle DPS. Standard weapon-scoring objectives do not advance those events or stop ticks on target death, so Auto Optimize skips this mod outside Tennokai Cycle DPS.");
    }
    if (context?.selectedGoal !== "tennokaiDps" &&
        lines.some((line) => /\btennokai\b|opportunity\s+(?:chance|window)|melee hits?\b/i.test(line))) {
        lines.push("The manual Tennokai panel models supported Normal Attack / Heavy Attack or Heavy Slam cycles. Standard single-attack scores and Auto Optimize still omit this event history; unsupported weapon-specific sequences remain unscored.");
    }
    if (lines.some((line) => /\bentropy\b/i.test(line))) {
        lines.push("Entropy syndicate side effect is not modeled.");
    }
    const effect = mod.effectsByRank?.[rank] ?? mod.effect;
    if ((effect?.liftedComboCountChanceBonus ?? 0) > 0 && context?.selectedGoal !== "tennokaiDps") {
        lines.push("Enduring Strike adds rank-scaled Additional Combo Count Chance only while the target is Lifted. The planner scores it in Tennokai Cycle DPS only when Lifted is explicitly selected as an external target status; Lifted duration and renewal are not simulated, and other objectives skip it.");
    }
    const blockingComboCountChance = effect?.blockingComboCountChanceBonus ?? 0;
    const blockedHitsPerCycle = Number.isFinite(context?.selectedTennokaiBlockedHitsBetweenHeavy)
        ? Math.max(0, Math.min(20, Math.floor(context?.selectedTennokaiBlockedHitsBetweenHeavy ?? 0)))
        : 0;
    if (blockingComboCountChance > 0 &&
        (context?.selectedGoal !== "tennokaiDps" || blockedHitsPerCycle <= 0)) {
        lines.push("Guardian Derision's Additional Combo Count Chance applies only to successful blocked enemy attacks. The planner scores it only in Tennokai Cycle DPS when at least one successful blocked attack per cycle is entered; block timing and incoming attacks are not predicted, and other objectives skip it.");
    }
    if (blockingComboCountChance > 0) {
        lines.push("Guardian Derision's blocking taunt changes enemy targeting; this utility effect is outside the damage score.");
    }
    const hasComboDurationEffect = (effect?.comboDurationBonus ?? 0) !== 0 ||
        (effect?.comboDurationBaseBonus ?? 0) !== 0;
    if (hasComboDurationEffect && context?.selectedGoal !== "tennokaiDps" && context?.selectedGoal !== "burst") {
        lines.push("Combo Duration changes the weapon's combo timeout. This objective does not simulate that timer's expiration, so Auto Optimize skips this mod.");
    }
    if ((effect?.comboCountChanceBonus ?? 0) !== 0 && mod.path !== RELENTLESS_COMBINATION_MOD_PATH) {
        if (context?.selectedGoal === undefined) {
            lines.push("Additional Combo Count Chance is modeled as expected extra combo points per qualifying regular hit in Tennokai Cycle DPS; other objectives do not apply this event history.");
        } else if (context.selectedGoal !== "burst" && context.selectedGoal !== "tennokaiDps") {
            lines.push("Additional Combo Count Chance can add random combo points per qualifying hit. This selected objective does not model the combo gain, so Auto Optimize skips this mod.");
        }
    }
    if (effect?.tennokaiEnabled) {
        if (context?.selectedGoal === "tennokaiDps") {
            if ((effect.tennokaiRangeBonusMeters ?? 0) > 0) {
                lines.push("Opportunity's Reach adds Tennokai melee range. The direct-hit timeline assumes each selected event connects with its target, so this range bonus does not change the score; its opportunity-window bonus is modeled.");
            }
        } else {
            lines.push("Tennokai rank stats feed the manual event timeline and dedicated Tennokai Cycle DPS objective for supported direct-hit cycles, including opportunity timing, event-local Heavy Attack bonuses, and combo retention. Truth's Flame uses a selected-target expected-damage threshold for its repeated-target chain there. Standard single-attack objectives and their Auto Optimize searches exclude Tennokai history; unsupported timing, status-tick kills, range, and player-side curse/syndicate effects remain unscored.");
        }
    }
    return [...new Set([...lines, ...getUnmodeledScoringEffectLines(effect, context)])];
}

/** Current-source links for unmodeled effects called out in the builder. */
export function getUnmodeledDamageEffectSourceUrl(mod: {
    path?: string;
    unparsedStatsByRank?: string[][];
}): string | undefined {
    if (mod.path === SWIPE_MOD_PATH) {
        return "https://wiki.warframe.com/w/Swipe";
    }
    if (mod.path === "/Lotus/Upgrades/Mods/Melee/Channel/ChannelStatusMod") {
        return "https://wiki.warframe.com/w/Enduring_Strike";
    }
    if (mod.path === "/Lotus/Upgrades/Mods/Melee/WeaponBlockingTauntMod") {
        return "https://wiki.warframe.com/w/Guardian_Derision";
    }
    if (mod.path === THERMAGNETIC_SHELLS_MOD_PATH) {
        return "https://wiki.warframe.com/w/Thermagnetic_Shells";
    }
    if (mod.path === ENTROPY_DETONATION_MOD_PATH) {
        return "https://wiki.warframe.com/w/Entropy_Detonation";
    }
    if (mod.path === AMALGAM_FURAX_BODY_COUNT_MOD_PATH) {
        return "https://wiki.warframe.com/w/Amalgam_Furax_Body_Count";
    }
    if (mod.path === BLOODTHIRST_MOD_PATH) {
        return "https://wiki.warframe.com/w/Bloodthirst";
    }
    if (mod.path === OVERPRESSURED_ROUNDS_MOD_PATH) {
        return "https://wiki.warframe.com/w/Overpressured_Rounds";
    }
    if (mod.path === PRECISION_STRIKE_MOD_PATH) {
        return "https://wiki.warframe.com/w/Precision_Strike";
    }
    if (mod.path === COMBAT_RELOAD_MOD_PATH) {
        return "https://wiki.warframe.com/w/Combat_Reload";
    }
    if (mod.path === DEADLY_MANEUVERS_MOD_PATH) {
        return "https://wiki.warframe.com/w/Deadly_Maneuvers";
    }
    if (mod.path === CRITICAL_PRECISION_MOD_PATH) {
        return "https://wiki.warframe.com/w/Critical_Precision";
    }
    if (mod.path === UNSEEN_DREAD_MOD_PATH) {
        return "https://wiki.warframe.com/w/Unseen_Dread";
    }
    if (mod.path === AMALGAM_RIPKAS_TRUE_STEEL_MOD_PATH) {
        return "https://wiki.warframe.com/w/Amalgam_Ripkas_True_Steel";
    }
    if (mod.path === STATIC_DISCHARGE_MOD_PATH) {
        return "https://wiki.warframe.com/w/Static_Discharge";
    }
    if (mod.path === VILE_DISCHARGE_MOD_PATH) {
        return "https://wiki.warframe.com/w/Vile_Discharge";
    }
    if (mod.path === STRAIN_FEVER_MOD_PATH) {
        return "https://wiki.warframe.com/w/Strain_Fever";
    }
    if (mod.path === RELENTLESS_COMBINATION_MOD_PATH) {
        return "https://wiki.warframe.com/w/Relentless_Combination";
    }
    if (mod.path === TRUE_PUNISHMENT_MOD_PATH) {
        return "https://wiki.warframe.com/w/True_Punishment";
    }
    if (mod.path === CORRUPT_CHARGE_MOD_PATH) {
        return "https://wiki.warframe.com/w/Corrupt_Charge";
    }
    if (mod.path === SENTIENT_INCISION_MOD_PATH) {
        return "https://wiki.warframe.com/w/Sentient_Incision";
    }
    if (mod.unparsedStatsByRank?.some((rank) => hasUnparsedTruthSyndicateStat(rank))) {
        return "https://wiki.warframe.com/w/Syndicates";
    }
    return undefined;
}

export function emptyEffect(): ModEffect {
    return {
        damageBonus: 0,
        tennokaiEnabled: false,
        tennokaiOpportunityChanceBonus: 0,
        tennokaiOpportunityEveryHits: 0,
        tennokaiDamageBonus: 0,
        tennokaiCritDamageBonus: 0,
        tennokaiStatusChanceBonus: 0,
        tennokaiOpportunityWindowSeconds: 0,
        tennokaiRangeBonusMeters: 0,
        tennokaiChainedDamageBonus: 0,
        tennokaiChainedOpportunitySeconds: 0,
        sentientIncisionDamageBonus: 0, firstShotMagazineDamageBonus: 0, lastShotMagazineDamageBonus: 0,
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
        strainInfectionCritDamagePerCyst: 0, strainFeverDamagePerCyst: 0, dreadfulKillshotDamageAndStatusPer75Health: 0,
        staticDischargeDamagePerWeaponDamage: 0,
        vileDischargeMaximumDamage: 0,
        deadlyManeuversHeadshotCritChanceBonus: 0, criticalPrecisionCritChancePerHeadshot: 0,
        unseenDreadCritDamageBonus: 0, finalCritMultiplierBonus: 0,
        criticalMutationCritChanceAndDamagePerKill: 0,
        statusChanceBonus: 0, comboStatusChanceBonus: 0,
        areaDamageStatusChanceBonus: 0,
        multishotBonus: 0, multishotDamageBonus: 0, fireRateBonus: 0, chargeRateBonus: 0, fireRateLocked: false, multishotLocked: false,
        magazineCapacityFlatBonus: 0, magazineBonus: 0,
        reloadSpeedBonus: 0, directHitReloadSpeedBonus: 0, directHitReloadSpeedDurationSeconds: 0,
        overpressuredRoundsFalloffDistanceBonus: 0,
        attackSpeedBonus: 0,
        statusDurationBonus: 0, statusDamageBonus: 0, targetStatusDamageVulnerabilityBonus: 0,
        nightwatchNapalmEffect: 0,
        projectileSpeedBonus: 0, accuracyBonus: 0, blastRadiusBonus: 0,
        beamRangeBonus: 0, punchThrough: 0, rangeBonus: 0,
        swipeAdditionalEnemyCount: 0, swipeAttackRangeBonusMeters: 0,
        headshotMultiplierBonus: 0, bodyshotDamageBonus: 0, weakPointDamageBonus: 0, weakPointCritChanceBonus: 0,
        comboDurationBonus: 0, comboDurationBaseBonus: 0, initialComboBonus: 0, comboCountChanceBonus: 0,
        blockingComboCountChanceBonus: 0,
        liftedComboCountChanceBonus: 0,
        relentlessCombinationSlashComboChance: 0,
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


