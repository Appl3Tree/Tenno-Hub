import type { WeaponUniqueStatusType } from "../catalog/weaponCatalog";
import type { StatusDamageType } from "./damageRuleset";

/** Statuses that can be supplied by another weapon, ability, or ally. */
export type ExternalStatusType = StatusDamageType | WeaponUniqueStatusType;

export const EXTERNAL_STATUS_TYPE_OPTIONS: ReadonlyArray<{
    type: ExternalStatusType;
    label: string;
}> = Object.freeze([
    { type: "impact", label: "Impact" },
    { type: "puncture", label: "Puncture" },
    { type: "slash", label: "Slash" },
    { type: "heat", label: "Heat" },
    { type: "cold", label: "Cold" },
    { type: "electricity", label: "Electricity" },
    { type: "toxin", label: "Toxin" },
    { type: "blast", label: "Blast" },
    { type: "radiation", label: "Radiation" },
    { type: "gas", label: "Gas" },
    { type: "magnetic", label: "Magnetic" },
    { type: "viral", label: "Viral" },
    { type: "corrosive", label: "Corrosive" },
    { type: "void", label: "Void" },
    { type: "tau", label: "Tau" },
    { type: "microwave", label: "Microwave" },
    { type: "lifted", label: "Lifted" },
    { type: "knockdown", label: "Knockdown" },
]);

const EXTERNAL_STATUS_TYPE_SET = new Set<ExternalStatusType>(
    EXTERNAL_STATUS_TYPE_OPTIONS.map(({ type }) => type),
);

/**
 * Validate persisted/imported values and enforce the Wiki rule that Lifted
 * and Knockdown cannot be active on the same target at once. If old input
 * contains both, retain whichever appeared last.
 */
export function normalizeExternalStatusTypes(value: unknown): ExternalStatusType[] {
    if (!Array.isArray(value)) return [];

    const selected = new Set<ExternalStatusType>();
    for (const entry of value) {
        if (typeof entry === "string" && EXTERNAL_STATUS_TYPE_SET.has(entry as ExternalStatusType)) {
            selected.add(entry as ExternalStatusType);
        }
    }

    if (selected.has("lifted") && selected.has("knockdown")) {
        const liftedIndex = value.lastIndexOf("lifted");
        const knockdownIndex = value.lastIndexOf("knockdown");
        selected.delete(liftedIndex > knockdownIndex ? "knockdown" : "lifted");
    }

    return EXTERNAL_STATUS_TYPE_OPTIONS
        .map(({ type }) => type)
        .filter((type) => selected.has(type));
}

export function isUniqueStatusType(type: ExternalStatusType): type is WeaponUniqueStatusType {
    return type === "microwave" || type === "lifted" || type === "knockdown";
}

/** Remove named damage statuses that the active target profile cannot receive. */
export function filterExternalStatusTypesForTarget(
    statusTypes: unknown,
    statusImmuneTypes: Iterable<StatusDamageType> = [],
    statusStackCaps: Partial<Record<StatusDamageType, number>> = {},
): ExternalStatusType[] {
    if (!Array.isArray(statusTypes) || statusTypes.length === 0) return [];
    const normalizedTypes = normalizeExternalStatusTypes(statusTypes);
    if (normalizedTypes.length === 0) return normalizedTypes;
    const immuneTypes = statusImmuneTypes instanceof Set ? statusImmuneTypes : new Set(statusImmuneTypes);
    return normalizedTypes.filter((type) => {
        if (isUniqueStatusType(type)) return true;
        const cap = statusStackCaps[type];
        return !immuneTypes.has(type) && !(Number.isFinite(cap) && (cap ?? 0) <= 0);
    });
}

/** Condition Overload includes Tau; Galvanized per-status bonuses do not. */
export function getDirectDamageEligibleStatusTypes(
    statusTypes: Iterable<ExternalStatusType>,
): Set<ExternalStatusType> {
    return new Set(normalizeExternalStatusTypes([...statusTypes]).filter((type) => type !== "tau"));
}

/** The steady-state and finite models use the same unique-status union. */
export function unionUniqueStatusTypes(
    ...groups: ReadonlyArray<Iterable<WeaponUniqueStatusType>>
): Set<WeaponUniqueStatusType> {
    const result = new Set<WeaponUniqueStatusType>();
    for (const group of groups) {
        for (const type of group) {
            if (type === "lifted") result.delete("knockdown");
            if (type === "knockdown") result.delete("lifted");
            result.add(type);
        }
    }
    return result;
}
