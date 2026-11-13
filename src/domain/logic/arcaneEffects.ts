import type { ArcaneEntry } from "../catalog/arcaneCatalog";
import type { ModEffect } from "../catalog/modCatalog";

/** Resolve a rank's weapon-arcane effect using an explicitly supplied Warframe armor value. */
export function getArcaneEffectAtRank(
    arcane: ArcaneEntry,
    rank: number,
    warframeArmor?: number,
    useOptimizerEffect = false,
    energyContext?: { warframeMaxEnergy?: number; warframeEnergyPercent?: number },
): Partial<ModEffect> | null {
    const safeRank = Math.max(0, Math.min(arcane.maxRank, Math.floor(Number.isFinite(rank) ? rank : 0)));
    const base = useOptimizerEffect
        ? (arcane.optimizerEffectByRank[safeRank] ?? arcane.permanentEffectByRank[safeRank])
        : arcane.permanentEffectByRank[safeRank];
    const resolved: Partial<ModEffect> = base ? { ...base } : {};
    if (arcane.armorScaledWeaponDamage) {
        if (!Number.isFinite(warframeArmor) || (warframeArmor ?? -1) < 0) return null;

        const scaling = arcane.armorScaledWeaponDamage;
        const armorAboveThreshold = Math.min(
            Math.max(0, (warframeArmor ?? 0) - scaling.minimumArmor),
            scaling.maxArmorAboveMinimumByRank[safeRank] ?? 0,
        );
        const damageBonus = armorAboveThreshold * (scaling.damageBonusPerArmorByRank[safeRank] ?? 0);
        resolved.damageBonus = ((resolved.damageBonus as number | undefined) ?? 0) + damageBonus;
    }
    if (arcane.energyScaledMultishot) {
        const maxEnergy = energyContext?.warframeMaxEnergy;
        const energyPercent = energyContext?.warframeEnergyPercent;
        if (!Number.isFinite(maxEnergy) || (maxEnergy ?? -1) < 0 || !Number.isFinite(energyPercent)) return null;
        const scaling = arcane.energyScaledMultishot;
        const gainedMultishot = (energyPercent ?? 0) >= scaling.energyPercentThreshold
            ? Math.min((maxEnergy ?? 0) * scaling.maxEnergyFraction / 100, (scaling.capByRank[safeRank] ?? 0) / 100)
            : 0;
        resolved.multishotBonus = ((resolved.multishotBonus as number | undefined) ?? 0) + gainedMultishot;
    }
    return Object.keys(resolved).length > 0 ? resolved : null;
}
