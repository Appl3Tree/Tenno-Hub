import { PR } from "../../domain/ids/prereqIds";

/** Prerequisite relationships consumed outside the registry and source catalog. */
export const STAR_CHART_REGION_PREREQUISITES = [
    { prerequisiteId: PR.SYSTEM_PROXIMA_ACCESS, regionId: "region:earth_proxima" },
    { prerequisiteId: PR.SYSTEM_PROXIMA_ACCESS, regionId: "region:venus_proxima" },
    { prerequisiteId: PR.SYSTEM_PROXIMA_SATURN_ACCESS, regionId: "region:saturn_proxima" },
    { prerequisiteId: PR.SYSTEM_PROXIMA_NEPTUNE_ACCESS, regionId: "region:neptune_proxima" },
    { prerequisiteId: PR.SYSTEM_PROXIMA_PLUTO_ACCESS, regionId: "region:pluto_proxima" },
    { prerequisiteId: PR.SYSTEM_PROXIMA_VEIL_ACCESS, regionId: "region:veil_proxima" },
    { prerequisiteId: PR.SYSTEM_URANUS_PROXIMA, regionId: "region:uranus_proxima" },
] as const;

/** A specific acquired Amp is one valid way to satisfy the generic Amp gate. */
export const DERIVED_PREREQUISITE_COMPLETIONS = [
    { prerequisiteId: PR.AMP_MOTE, dependentPrerequisiteId: PR.SYSTEM_OPERATOR_AMP },
] as const;
