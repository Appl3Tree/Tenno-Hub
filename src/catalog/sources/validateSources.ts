// ===== FILE: src/catalog/sources/validateSources.ts =====

import { SOURCE_CATALOG, SOURCE_INDEX } from "./sourceCatalog";
import { FULL_CATALOG } from "../../domain/catalog/loadFullCatalog";
import { getAcquisitionByCatalogId } from "../items/itemAcquisition";
import { normalizeSourceId } from "../../domain/ids/sourceIds";

type ValidationIssue = {
    code: string;
    sourceId: string;
    message: string;
};

const CURATED_DOMAIN_PREFIXES = [
    "data:vendor",
    "data:market",
    "data:dojo",
    "data:quest",
    "data:nightwave",
    "data:invasion",
    "data:baro",
    "data:events",
    "data:pets",
    "data:lich",
    "data:duviri",
    "data:abyssal-zone",
    "data:arbitrations",
    "data:system",
];

function inCuratedDomain(id: string): boolean {
    return CURATED_DOMAIN_PREFIXES.some((p) => id === p || id.startsWith(p + "/"));
}

function isParentBucket(all: string[], id: string): boolean {
    return all.some((x) => x !== id && x.startsWith(id + "/"));
}

/**
 * “Actionable” means the source describes an acquisition action the player can perform.
 * This is intentionally conservative; adjust tokens as you harden taxonomy.
 */
function isActionableLabel(label: string): boolean {
    const t = label.toLowerCase();

    // Verbs / actions
    const actionTokens = [
        "buy",
        "purchase",
        "shop",
        "vendor",
        "research",
        "replicate",
        "craft",
        "farm",
        "drop",
        "mission",
        "bounty",
        "quest",
        "reward",
        "earn",
        "trade",
        "baro",
        "nightwave",
        "invasion",
        "event",
        "incub",
        "synth",
        "scan",
        "helminth",
        "starter",
        "ducat",
        "arbitration",
        "duviri",
        "lich",
        "sister",
        "teshin",
        "simaris",
        "unlock",
        "receive",
    ];

    return actionTokens.some((x) => t.includes(x));
}

function isClearlyNonActionableId(sourceId: string): boolean {
    // Synthetic set-bonus metadata is not a route for obtaining an item.
    return sourceId === "data:system/set-bonus-record";
}

function isExpectedNonAcquisitionMetadataUse(catalogId: string, sourceId: string): boolean {
    return sourceId === "data:system/set-bonus-record"
        && catalogId.startsWith("items:/Lotus/Upgrades/Mods/Sets/");
}

function isExpectedUnusedCuratedLeaf(sourceId: string): boolean {
    return (
        sourceId === "data:system/starter" ||
        sourceId === "data:vendor/duviri/acrithis" ||
        sourceId === "data:vendor/cetus/ostron" ||
        sourceId === "data:vendor/fortuna/solaris-united" ||
        sourceId === "data:vendor/deimos/entrati" ||
        sourceId === "data:vendor/deimos/mother" ||
        sourceId === "data:vendor/zariman/holdfasts" ||
        sourceId === "data:vendor/zariman/cavalero" ||
        sourceId === "data:vendor/zariman/yonta" ||
        sourceId === "data:vendor/sanctum/cavia" ||
        sourceId === "data:vendor/kahl-garrison/chipper" ||
        sourceId === "data:vendor/darvo" ||
        sourceId === "data:vendor/iron-wake/palladino" ||
        sourceId === "data:vendor/relay/varzia" ||
        sourceId === "data:vendor/relay/legs" ||
        sourceId === "data:vendor/marie-leroux/la-cathedrale" ||
        sourceId.startsWith("data:duviri/endless/tier-")
    );
}

export function validateSources(): { issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];

    const curatedIdsAll = SOURCE_CATALOG.map((s) => s.id);
    const curatedIds = curatedIdsAll.filter(inCuratedDomain);

    // 1) Curated sources must exist in SOURCE_INDEX
    for (const sid of curatedIds) {
        const id = normalizeSourceId(sid);
        if (!SOURCE_INDEX[id]) {
            issues.push({
                code: "curated_missing_from_index",
                sourceId: id,
                message: "Curated source exists in SOURCE_CATALOG but not in SOURCE_INDEX.",
            });
        }
    }

    // 2) Parent buckets may exist, but should not be “actionable”
    //    (They are taxonomy, not acquisition steps)
    const parents = curatedIds.filter((sid) => isParentBucket(curatedIds, sid));
    for (const sid of parents) {
        const id = normalizeSourceId(sid);
        const label = SOURCE_INDEX[id]?.label ?? "";
        if (label && isActionableLabel(label)) {
            issues.push({
                code: "parent_bucket_looks_actionable",
                sourceId: sid,
                message: `Parent bucket label looks like an action; parent buckets should be taxonomy only. label="${label}"`,
            });
        }
    }

    // 3) Leaf sources should have actionable labels
    const parentSet = new Set(parents);
    const leaves = curatedIds.filter((sid) => !parentSet.has(sid));
    for (const sid of leaves) {
        const id = normalizeSourceId(sid);
        const label = SOURCE_INDEX[id]?.label ?? "";
        if (!label) continue;

        if (!isClearlyNonActionableId(sid) && !isActionableLabel(label)) {
            issues.push({
                code: "leaf_not_actionable",
                sourceId: sid,
                message: `Leaf source label does not look like an acquisition action. label="${label}"`,
            });
        }
    }

    // 4) No item may ever resolve to a parent bucket, or to an explicitly-non-actionable leaf
    const forbiddenUsed: Array<{ sid: string; exampleCid: string }> = [];
    const used = new Map<string, number>();

    for (const cid of FULL_CATALOG.itemIds as string[]) {
        const def = getAcquisitionByCatalogId(cid as any);
        const srcs = (def as any)?.sources as string[] | undefined;
        for (const sid of srcs ?? []) {
            used.set(sid, (used.get(sid) ?? 0) + 1);

            if (parentSet.has(sid) || (isClearlyNonActionableId(sid) && !isExpectedNonAcquisitionMetadataUse(cid, sid))) {
                if (forbiddenUsed.length < 25) forbiddenUsed.push({ sid, exampleCid: cid });
            }
        }
    }

    for (const f of forbiddenUsed) {
        issues.push({
            code: "forbidden_source_used_by_item",
            sourceId: f.sid,
            message: `Forbidden source is referenced by computed acquisition. exampleCatalogId="${f.exampleCid}"`,
        });
    }

    // 5) Unused curated leaves: allow, but surface them clearly (you decide whether to delete or fill)
    for (const sid of leaves) {
        const count = used.get(sid) ?? 0;
        if (count === 0 && !isExpectedUnusedCuratedLeaf(sid)) {
            issues.push({
                code: "curated_leaf_unused",
                sourceId: sid,
                message: "Curated leaf source is unused by computed acquisition.",
            });
        }
    }

    return { issues };
}

export function runSourceValidationOrThrow(): void {
    const { issues } = validateSources();

    const errors = issues.filter(
        (i) =>
            i.code === "curated_missing_from_index" ||
            i.code === "parent_bucket_looks_actionable" ||
            i.code === "leaf_not_actionable" ||
            i.code === "forbidden_source_used_by_item"
    );

    const warnings = issues.filter((i) => !errors.includes(i));

    if (warnings.length) {
        console.log("[source-validation] warnings:", warnings.length);
        for (const w of warnings) {
            console.log(`WARN ${w.code}  ${w.sourceId}  ${w.message}`);
        }
    }

    if (errors.length) {
        console.log("[source-validation] errors:", errors.length);
        for (const e of errors) {
            console.log(`ERR  ${e.code}  ${e.sourceId}  ${e.message}`);
        }
        throw new Error("Source validation failed.");
    }

    console.log("[source-validation] OK");
}
