function foldDiacritics(value: string): string {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeWfcdAcquisitionName(value: string): string {
    return foldDiacritics(value.trim())
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function stripQuantity(value: string): string {
    return value.replace(/^\s*\d+\s*[xX]\s*/g, "").trim();
}

function stripBlueprintSuffix(value: string): string {
    return value.replace(/\bBlueprint\b/gi, "").trim();
}

/**
 * Resolve WFCD syndicate item labels. Syndicate rows append the owning
 * Warframe to augment names (for example, "Aegis Gale (Hildryn)"), while the
 * canonical item catalog stores the augment's own name. Only accept that
 * suffix fallback when the matching canonical path is an AugmentCard.
 */
export function resolveWfcdAcquisitionItemName(
    rawName: string,
    nameIndex: ReadonlyMap<string, string>,
): string | null {
    const withoutQuantity = stripQuantity(rawName);
    const exactAttempts = [
        withoutQuantity,
        rawName.trim(),
        stripBlueprintSuffix(withoutQuantity),
    ];

    for (const attempt of exactAttempts) {
        const catalogId = nameIndex.get(normalizeWfcdAcquisitionName(attempt));
        if (catalogId) return catalogId;
    }

    const ownerSuffix = withoutQuantity.match(/^(.+?)\s+\([^()]+\)$/);
    if (!ownerSuffix) return null;

    const baseName = ownerSuffix[1]!.trim();
    for (const attempt of [baseName, stripBlueprintSuffix(baseName)]) {
        const catalogId = nameIndex.get(normalizeWfcdAcquisitionName(attempt));
        if (catalogId && /AugmentCard$/i.test(catalogId)) return catalogId;
    }
    return null;
}
