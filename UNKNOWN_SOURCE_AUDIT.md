# Unknown Source Audit

Generated: 2026-11-06T20:15:39.557Z

## Summary

- Catalog records: 22621
- Catalog records with acquisition: 13267
- Catalog records without acquisition: 9354
- Displayable records: 20446
- Displayable records without acquisition: 9022
- Placeholder blueprint records (`data:blueprint/unclassified`): 177
- Displayable recipe/component records with zero acquisition: 4
- Manual coarse activity/vendor mappings still in place: 24

## Placeholder Blueprint Buckets

| Bucket | Count |
| --- | --- |
| /Lotus/Types/Recipes/Helmets | 129 |
| /Lotus/Types/Recipes/WarframeRecipes | 12 |
| /Lotus/Types/Recipes/WeaponSkins | 12 |
| /Lotus/Types/Recipes/SolarisRecipes | 7 |
| /Lotus/Types/Recipes/OperatorArmour | 5 |
| /Lotus/Types/Recipes/LandingCraftRecipes | 3 |
| /Lotus/Types/Items/RelayRebuild | 1 |
| /Lotus/Types/Items/Titles | 1 |
| /Lotus/Types/Keys/LimboQuestKeyBlueprint | 1 |
| /Lotus/Types/Keys/MirageQuestKeyBlueprint | 1 |
| /Lotus/Types/Keys/MummyQuestKeyBlueprint | 1 |
| /Lotus/Types/Keys/PatientZeroKeyBlueprint | 1 |
| /Lotus/Types/Recipes/Components | 1 |
| /Lotus/Types/Recipes/HunhowTrinketBlueprint | 1 |
| /Lotus/Types/Recipes/Syandanas | 1 |

## Placeholder Blueprint Likely Fix Paths

| Likely Fix Path | Count |
| --- | --- |
| manual-or-new-source | 177 |

Interpretation:
- `warframe-items-drop-type-join`: the blueprint name already appears in `warframe-items` drop `type` fields, so the derivation layer should be able to assign a real source from those locations.
- `drop-data-blueprint-tables`: the blueprint already exists in `blueprintLocations.json` or `enemyBlueprintTables.json`, so the join is probably failing or incomplete.
- `syndicates-name-join`: the blueprint name exists in `syndicates.json` but is not currently mapped to the catalog record.
- `manual-or-new-source`: current raw datasets do not expose an obvious matching source string for the catalog record, so this likely needs a manual mapping or a new importer/source family.

## Placeholder Blueprint Examples

- `items:/Lotus/Types/Items/RelayRebuild/PhaseOneClanItemBlueprint` (/Lotus/Types/Items/RelayRebuild/PhaseOneClanItemBlueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Items/Titles/RoatheTitles/TitleHarrowChasisBlueprint` (The Power of Harrow Compels Thee Honoria) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Keys/LimboQuestKeyBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Keys/MirageQuestKeyBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Keys/MummyQuestKeyBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Keys/PatientZeroKeyBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Components/SurgeEximusBallBlueprint` (Surge Eximus Specter Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/AnimaAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/AshAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/BansheeAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/BardAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/BrawlerAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/BrawlerAltTwoHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/CalibanAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ChromaAltBHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/CitrineAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionAntiAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionAspAltHelmetBBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionAspAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionDecreeAltHelmetBBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionDecreeAltHelmetBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionEmberHelmetAltBBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionEmberHelmetAltBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionExcaliburHelmetAltBBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence
- `items:/Lotus/Types/Recipes/Helmets/ConversionExcaliburHelmetAltBlueprint` (Blueprint) -> manual-or-new-source; no current raw evidence

## Zero-Source Displayable Recipe/Component Records

| CatalogId | Display Name | Sibling Blueprint |
| --- | --- | --- |
| `items:/Lotus/Types/Recipes/Weapons/WeaponParts/SagekPrimeStock` | Sagek Prime Stock |  |
| `items:/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronBarrel` | SNIPETRON BARREL |  |
| `items:/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronReceiver` | SNIPETRON RECEIVER |  |
| `items:/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronStock` | SNIPETRON STOCK |  |

These are displayable `/Types/Recipes/` records that still return no acquisition at all. They are a separate gap from placeholder blueprints and are good candidates for recipe-output or sibling-blueprint inheritance fixes.

## Displayable No-Acquisition Prefixes

| Displayable No-Acq Prefix | Count |
| --- | --- |
| /Lotus/Types/StoreItems/AvatarImages | 1701 |
| /Lotus/Types/Items/ShipDecos | 1207 |
| /Lotus/Upgrades/Skins/Operator | 682 |
| /Lotus/Upgrades/Skins/Armor | 445 |
| /Lotus/Upgrades/Skins/Scarves | 291 |
| /Lotus/Types/Items/Titles | 218 |
| /Lotus/Upgrades/Skins/Sigils | 183 |
| /Lotus/Upgrades/Skins/Clan | 127 |
| /Lotus/Types/Game/KubrowPet | 118 |
| /Lotus/Types/Items/Emotes | 118 |
| /Lotus/Upgrades/Skins/Sentinels | 118 |
| /Lotus/Types/Items/MiscItems | 114 |
| /Lotus/Types/Game/CatbrowPet | 92 |
| /Lotus/Upgrades/Skins/Effects | 91 |
| /Lotus/Upgrades/Skins/Liset | 82 |
| /Lotus/Types/Items/SongItems | 70 |
| /Lotus/Interface/Graphics/CustomUI | 69 |
| /Lotus/Upgrades/Skins/Promo | 68 |
| /Lotus/Upgrades/Skins/Weapons | 66 |
| /Lotus/Upgrades/Skins/SteamWorkshop | 65 |

Most of the remaining displayable no-acquisition population is cosmetics, glyphs, decorations, enemy avatars, and other non-progression records. The `displayableWithoutAcquisition.byPrefix` section in the JSON output keeps the full distribution if we want to carve those down later.

## Manual Coarse Mappings

- `items:/Lotus/Types/Friendly/Pets/CreaturePets/ArmoredInfestedCatbrowPetPowerSuit` -> data:activity/deimos/conservation, data:vendor/deimos/son
- `items:/Lotus/Types/Friendly/Pets/CreaturePets/HornedInfestedCatbrowPetPowerSuit` -> data:activity/deimos/conservation, data:vendor/deimos/son
- `items:/Lotus/Types/Friendly/Pets/CreaturePets/MedjayPredatorKubrowPetPowerSuit` -> data:activity/deimos/conservation, data:vendor/deimos/son
- `items:/Lotus/Types/Friendly/Pets/CreaturePets/PharaohPredatorKubrowPetPowerSuit` -> data:activity/deimos/conservation, data:vendor/deimos/son
- `items:/Lotus/Types/Friendly/Pets/CreaturePets/VizierPredatorKubrowPetPowerSuit` -> data:activity/deimos/conservation, data:vendor/deimos/son
- `items:/Lotus/Types/Friendly/Pets/CreaturePets/VulpineInfestedCatbrowPetPowerSuit` -> data:activity/deimos/conservation, data:vendor/deimos/son
- `items:/Lotus/Types/Items/MushroomJournal/BlastMushroomJournalItem` -> data:activity/souterrains/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Items/MushroomJournal/CorrosiveMushroomJournalItem` -> data:activity/souterrains/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Items/MushroomJournal/GasMushroomJournalItem` -> data:activity/souterrains/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Items/MushroomJournal/MagneticMushroomJournalItem` -> data:activity/souterrains/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Items/MushroomJournal/RadiationMushroomJournalItem` -> data:activity/souterrains/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Items/MushroomJournal/ViralMushroomJournalItem` -> data:activity/souterrains/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Recipes/WarframeRecipes/UrielChassisComponent` -> data:activity/the-descendia/oblivion-on-infernium-21, data:vendor/roathe/la-cathedrale
- `items:/Lotus/Types/Recipes/WarframeRecipes/UrielHelmetComponent` -> data:activity/the-descendia/oblivion-on-infernium-21, data:vendor/roathe/la-cathedrale
- `items:/Lotus/Types/Recipes/WarframeRecipes/UrielSystemsComponent` -> data:activity/the-descendia/oblivion-on-infernium-21, data:vendor/roathe/la-cathedrale
- `items:/Lotus/Types/Recipes/Weapons/WeaponParts/NokkoArchGunBarrelBlueprint` -> data:activity/deepmines/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Recipes/Weapons/WeaponParts/NokkoArchGunReceiverBlueprint` -> data:activity/deepmines/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Recipes/Weapons/WeaponParts/NokkoArchGunStockBlueprint` -> data:activity/deepmines/bounties, data:vendor/fortuna/nightcap
- `items:/Lotus/Types/Recipes/Weapons/WeaponParts/VinquibusBarrelBlueprint` -> data:vendor/roathe/la-cathedrale, data:activity/the-descendia/oblivion-on-infernium-21
- `items:/Lotus/Types/Recipes/Weapons/WeaponParts/VinquibusBladeBlueprint` -> data:vendor/roathe/la-cathedrale, data:activity/the-descendia/oblivion-on-infernium-21
- `items:/Lotus/Types/Recipes/Weapons/WeaponParts/VinquibusReceiverBlueprint` -> data:vendor/roathe/la-cathedrale, data:activity/the-descendia/oblivion-on-infernium-21
- `items:/Lotus/Types/Recipes/Weapons/WeaponParts/VinquibusStockBlueprint` -> data:vendor/roathe/la-cathedrale, data:activity/the-descendia/oblivion-on-infernium-21
- `items:/Lotus/Types/Restoratives/ThermianRPGSummon` -> data:activity/hollvania/scaldra-paratroopers
- `items:/Lotus/Weapons/Tenno/Bayonet/TnBayonetRifleBlueprint` -> data:vendor/roathe/la-cathedrale, data:activity/the-descendia/oblivion-on-infernium-21

