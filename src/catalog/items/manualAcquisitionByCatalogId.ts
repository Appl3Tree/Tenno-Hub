// ===== FILE: src/catalog/items/manualAcquisitionByCatalogId.ts =====
// src/catalog/items/manualAcquisitionByCatalogId.ts

// Manual overrides live here intentionally.
// Policy: if a catalogId has a manual mapping, it MUST be included.
export const MANUAL_ACQUISITION_BY_CATALOG_ID: Record<string, string[]> = {
    // ----------------------------
    // Unobtainable / account-locked
    // ----------------------------
    "items:/Lotus/Powersuits/Excalibur/ExcaliburPrime": ["data:unobtainable/founders"],

    // ----------------------------
    // Daily Tribute (login milestone rewards)
    // ----------------------------
    "items:/Lotus/Weapons/Tenno/Pistols/SundialGun/SundialPistol": ["data:system/daily-tribute"], // Azima
    "items:/Lotus/Weapons/Tenno/Melee/SunDialAxe/SundialAxeWeapon": ["data:system/daily-tribute"], // Zenistar
    "items:/Lotus/Weapons/Tenno/LongGuns/LoginPrimary/SundialRifle": ["data:system/daily-tribute"], // Zenith
    "items:/Lotus/Weapons/Tenno/Melee/SwordsAndBoards/SundialSwordBoard/SundialBoardSword": ["data:system/daily-tribute"], // Sigma & Octantis

    // ----------------------------
    // Clan research (Tenno Lab) and Dojo replication
    // ----------------------------
    "items:/Lotus/Powersuits/VOLTFemale/VOLTFemale": ["data:clan/tenno-lab"], // Volt
    "items:/Lotus/Types/Recipes/WarframeRecipes/VOLTHelmetComponent": ["data:clan/tenno-lab"], // Volt Neuroptics
    "items:/Lotus/Types/Recipes/WarframeRecipes/VOLTChassisComponent": ["data:clan/tenno-lab"], // Volt Chassis
    "items:/Lotus/Types/Recipes/WarframeRecipes/VOLTSystemsComponent": ["data:clan/tenno-lab"], // Volt Systems

    "items:/Lotus/Powersuits/Banshee/Banshee": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/BansheeChassisComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/BansheeHelmetComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/BansheeSystemsComponent": ["data:clan/tenno-lab"],

    "items:/Lotus/Powersuits/Tengu/Tengu": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/TenguChassisComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/TenguHelmetComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/TenguSystemsComponent": ["data:clan/tenno-lab"],

    "items:/Lotus/Powersuits/MonkeyKing/MonkeyKing": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/WukongChassisComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/WukongHelmetComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/WukongSystemsComponent": ["data:clan/tenno-lab"],

    "items:/Lotus/Powersuits/Nezha/Nezha": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/NezhaChassisComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/NezhaHelmetComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/NezhaSystemsComponent": ["data:clan/tenno-lab"],

    "items:/Lotus/Powersuits/Archwing/StealthJetPack/StealthJetPack": ["data:clan/tenno-lab"], // Itzal
    "items:/Lotus/Types/Recipes/ArchwingRecipes/StealthArchwing/StealthArchwingChassisComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/ArchwingRecipes/StealthArchwing/StealthArchwingSystemsComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/ArchwingRecipes/StealthArchwing/StealthArchwingWingsComponent": ["data:clan/tenno-lab"],

    "items:/Lotus/Powersuits/Archwing/DemolitionJetPack/DemolitionJetPack": ["data:clan/tenno-lab"], // Elytron
    "items:/Lotus/Types/Recipes/ArchwingRecipes/DemolitionArchwing/DemolitionArchwingChassisComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/ArchwingRecipes/DemolitionArchwing/DemolitionArchwingSystemsComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/ArchwingRecipes/DemolitionArchwing/DemolitionArchwingWingsComponent": ["data:clan/tenno-lab"],

    "items:/Lotus/Powersuits/Archwing/SupportJetPack/SupportJetPack": ["data:clan/tenno-lab"], // Amesha
    "items:/Lotus/Types/Recipes/ArchwingRecipes/SupportArchwing/SupportArchwingChassisComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/ArchwingRecipes/SupportArchwing/SupportArchwingSystemsComponent": ["data:clan/tenno-lab"],
    "items:/Lotus/Types/Recipes/ArchwingRecipes/SupportArchwing/SupportArchwingWingsComponent": ["data:clan/tenno-lab"],

    "items:/Lotus/Weapons/Tenno/Archwing/Primary/ArchwingHeavyPistols/ArchHeavyPistols": ["data:clan/tenno-lab"], // Dual Decurion
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/ArchHeavyPistolsBarrel": ["data:clan/tenno-lab"], // Decurion Barrel
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/ArchHeavyPistolsReceiver": ["data:clan/tenno-lab"], // Decurion Receiver
    "items:/Lotus/Weapons/Tenno/Archwing/Primary/RocketArtillery/ArchRocketCrossbow": ["data:clan/tenno-lab"], // Fluctus
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/ArchRocketCrossbowBarrel": ["data:clan/tenno-lab"], // Fluctus Barrel
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/ArchRocketCrossbowStock": ["data:clan/tenno-lab"], // Fluctus Limbs (yes, Stock id; displayName “Limbs”)
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/ArchRocketCrossbowReceiver": ["data:clan/tenno-lab"],

    "items:/Lotus/Weapons/ClanTech/Chemical/FlameThrowerWraith": ["data:crafting"], // Ignis Wraith (crafted)
    "items:/Lotus/Weapons/ClanTech/Chemical/FlamethrowerWraithBlueprint": ["data:dojo/chem-lab"], // Ignis Wraith Blueprint (replicate)
    "items:/Lotus/Types/Recipes/Weapons/InfBeamPistolBlueprint": ["data:dojo/bio-lab"], // Catabolyst Blueprint

    // Dorrclave component blueprints come from Clan Dojo research (Dagath's Hollow)
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TnDagathBladeWhipBlade": ["data:dojo/dagaths-hollow"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TnDagathBladeWhipHilt": ["data:dojo/dagaths-hollow"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TnDagathBladeWhipString": ["data:dojo/dagaths-hollow"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TnDagathBladeWhipHook": ["data:dojo/dagaths-hollow"],

    // ============================
    // QUEST-LOCKED BLUEPRINTS
    // ============================
    "items:/Lotus/Types/Recipes/WarframeRecipes/ExcaliburUmbraBlueprint": ["data:quest/the-sacrifice"],
    "items:/Lotus/Types/Recipes/Weapons/BallasSwordBlueprint": ["data:quest/chimera-prologue"],
    "items:/Lotus/Types/Recipes/EidolonRecipes/SentientCoreConversionABlueprint": ["data:vendor/cetus/quills", "data:eidolon/hunts"],
    "items:/Lotus/Types/Keys/BardQuest/BardQuestSequencerBlueprint": ["data:quest/octavias-anthem"],
    "items:/Lotus/Types/Keys/BardQuest/BardQuestSequencerPartA": ["data:quest/octavias-anthem"],
    "items:/Lotus/Types/Keys/BardQuest/BardQuestSequencerPartB": ["data:quest/octavias-anthem"],
    "items:/Lotus/Types/Keys/BardQuest/BardQuestSequencerPartC": ["data:quest/octavias-anthem"],
    "items:/Lotus/Weapons/Tenno/Grimoire/TnDoppelgangerGrimoire": ["data:quest/whispers-in-the-walls"],
    "items:/Lotus/Types/Recipes/Weapons/TnModQuestRifleWeaponBlueprint": ["data:quest/the-teacher"], // Thornbak Blueprint

    // ----------------------------
    // Orb Vallis: Resources / Fortuna bounties / Heists
    // ----------------------------
    "items:/Lotus/Types/Gameplay/Venus/Resources/VenusTreeItem": ["data:bounty/solaris-united"], // Tepa Nodule
    "items:/Lotus/Types/Gameplay/Venus/Resources/ArachnoidCamperItem": ["data:heist/profit-taker"], // Crisma Toroid

    // ----------------------------
    // Market / Account / Starter / System-given
    // ----------------------------
    "items:/Lotus/Weapons/Tenno/Pistol/HeavyPistol": ["data:market/credits"], // Lex
    "items:/Lotus/Weapons/Tenno/Akimbo/AkimboPistol": ["data:market/credits"], // Aklato
    "items:/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun": ["data:necramech/arquebex-archgun"], // Mausolon (coarse)
    "items:/Lotus/Weapons/Sentients/OperatorAmplifiers/SentTrainingAmplifier/SentAmpTrainingBarrel": ["data:operator/amp-starter"], // Mote Prism
    "items:/Lotus/Types/Recipes/Weapons/CeramicDaggerBlueprint": ["data:market/credits"],
    "items:/Lotus/Types/Recipes/Weapons/HeatDaggerBlueprint": ["data:market/credits"],
    "items:/Lotus/Types/Recipes/Weapons/HeatSwordBlueprint": ["data:market/credits"],
    "items:/Lotus/Types/Recipes/Weapons/JawBlueprint": ["data:market/credits"],
    "items:/Lotus/Types/Recipes/Weapons/PangolinSwordBlueprint": ["data:market/credits"],
    "items:/Lotus/Types/Recipes/Weapons/PlasmaSwordBlueprint": ["data:market/credits"],

    // ----------------------------
    // Quest / Simaris / dojo / legacy blueprint cleanup
    // ----------------------------
    "items:/Lotus/Types/Recipes/ArchwingRecipes/StandardArchwing/StandardArchwingBlueprint": ["data:quest/the-archwing", "data:vendor/simaris"], // Odonata Blueprint
    "items:/Lotus/Types/Recipes/ArchwingRecipes/StandardArchwing/StandardArchwingChassisBlueprint": ["data:quest/the-archwing", "data:vendor/simaris"], // Odonata Harness Blueprint
    "items:/Lotus/Types/Recipes/ArchwingRecipes/StandardArchwing/StandardArchwingSystemsBlueprint": ["data:quest/the-archwing", "data:vendor/simaris"], // Odonata Systems Blueprint
    "items:/Lotus/Types/Recipes/ArchwingRecipes/StandardArchwing/StandardArchwingWingsBlueprint": ["data:quest/the-archwing", "data:vendor/simaris"], // Odonata Wings Blueprint

    "items:/Lotus/Types/Recipes/Railjack/RailjackCephalonBlueprint": ["data:quest/rising-tide"], // Railjack Cephalon Blueprint
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackHoodFeatureItemBlueprint": ["data:quest/rising-tide"], // Engine Cowling Blueprint
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackHullFeatureItemBlueprint": ["data:quest/rising-tide"], // Fuselage Blueprint
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackNacelleLeftFeatureItemBlueprint": ["data:quest/rising-tide"], // Port Nacelle Blueprint
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackHoodBraceFeatureItemBlueprint": ["data:quest/rising-tide"], // Propulsion Systems Blueprint
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackNacelleRightFeatureItemBlueprint": ["data:quest/rising-tide"], // Starboard Nacelle Blueprint
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackTailFeatureItemBlueprint": ["data:quest/rising-tide"], // Tail Section Blueprint
    "items:/Lotus/Types/Items/RailjackMiscItems/BracoidRailjackItem": ["data:legacy/railjack-resource/general"],
    "items:/Lotus/Types/Recipes/RailjackResourceRecipes/BracoidBlueprint": ["data:legacy/railjack-resource/general"],
    "items:/Lotus/Types/Items/RailjackMiscItems/CopernicsRailjackItem": ["data:legacy/railjack-resource/copernics"],
    "items:/Lotus/Types/Recipes/RailjackResourceRecipes/CopernicsBlueprint": ["data:legacy/railjack-resource/copernics"],
    "items:/Lotus/Types/Items/RailjackMiscItems/FresnelsRailjackItem": ["data:legacy/railjack-resource/general"],
    "items:/Lotus/Types/Recipes/RailjackResourceRecipes/FresnelsBlueprint": ["data:legacy/railjack-resource/general"],
    "items:/Lotus/Types/Items/RailjackMiscItems/KesslersRailjackItem": ["data:legacy/railjack-resource/general"],
    "items:/Lotus/Types/Recipes/RailjackResourceRecipes/KesslersBlueprint": ["data:legacy/railjack-resource/general"],
    "items:/Lotus/Types/Items/RailjackMiscItems/PustrelsRailjackItem": ["data:legacy/railjack-resource/pustrels"],
    "items:/Lotus/Types/Recipes/RailjackResourceRecipes/PustrelsBlueprint": ["data:legacy/railjack-resource/pustrels"],
    "items:/Lotus/Types/Items/RailjackMiscItems/TrachonsRailjackItem": ["data:legacy/railjack-resource/general"],
    "items:/Lotus/Types/Recipes/RailjackResourceRecipes/TrachonsBlueprint": ["data:legacy/railjack-resource/general"],
    "items:/Lotus/Types/Ship/AdvancedUcResourceDrone": ["data:vendor/relay/varzia"], // Distilling Extractor Prime
    "items:/Lotus/Types/Recipes/Drones/AdvancedUcResourceDroneBlueprint": ["data:vendor/relay/varzia"],
    "items:/Lotus/Types/Ship/AdvancedResourceDrone": ["data:vendor/relay/varzia"], // Titan Extractor Prime
    "items:/Lotus/Types/Recipes/Drones/AdvancedResourceDroneBlueprint": ["data:vendor/relay/varzia"],
    "items:/Lotus/Types/Items/MiscItems/UmbraEchoes": ["data:unobtainable/shelved"],
    "items:/Lotus/Types/Recipes/Components/UmbraEchoesBlueprint": ["data:unobtainable/shelved"],
    "items:/Lotus/Types/Items/MiscItems/FormaOmega": ["data:unobtainable/dev-only"],
    "items:/Lotus/Types/Recipes/Components/FormaOmegaBlueprint": ["data:unobtainable/dev-only"],

    "items:/Lotus/Types/Recipes/WarframeRecipes/ChromaBlueprint": ["data:quest/the-new-strange", "data:vendor/simaris", "data:duviri/circuit/warframe-rewards"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/ChromaChassisBlueprint": ["data:vendor/simaris", "data:duviri/circuit/warframe-rewards"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/ChromaHelmetBlueprint": ["data:vendor/simaris", "data:duviri/circuit/warframe-rewards"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/ChromaSystemsBlueprint": ["data:vendor/simaris", "data:duviri/circuit/warframe-rewards"],

    "items:/Lotus/Types/Recipes/WarframeRecipes/DagathBlueprint": ["data:dojo/dagaths-hollow"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/DagathChassisBlueprint": ["data:dojo/dagaths-hollow"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/DagathHelmetBlueprint": ["data:dojo/dagaths-hollow"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/DagathSystemsBlueprint": ["data:dojo/dagaths-hollow"],

    "items:/Lotus/Types/Recipes/Weapons/OperationsLaceraBlueprint": ["data:events/naberus"], // Ceti Lacera Blueprint
    "items:/Lotus/Types/Recipes/Weapons/GrineerCombatKnifeSortieBlueprint": ["data:invasion/rewards", "data:events/naberus"], // Sheev Blueprint
    "items:/Lotus/Types/StoreItems/Consumables/LisetAirSupportBlueprint": ["data:foundry/air-support-blueprint"],
    "items:/Lotus/Types/Restoratives/LisetAirSupport": ["data:foundry/air-support-blueprint"],
    "items:/Lotus/Types/StoreItems/Consumables/CipherBlueprint": ["data:market/credits"],
    "items:/Lotus/Types/Restoratives/Cipher": ["data:market/credits"],
    "items:/Lotus/Types/Restoratives/Consumable/Scanner": ["data:market/credits"],
    "items:/Lotus/Types/Restoratives/Consumable/BaseSpearFishingSpear": ["data:vendor/cetus/hai-luk"],
    "items:/Lotus/Types/Restoratives/OpenArchwingSummon": ["data:quest/the-archwing"],
    "items:/Lotus/Types/Restoratives/HoverboardSummon": ["data:quest/vox-solaris"],
    "items:/Lotus/Types/Restoratives/ErsatzSummon": ["data:duviri/intrinsics/riding-9"],
    "items:/Lotus/Types/Restoratives/MotorcycleSummon": ["data:quest/the-hex"],
    "items:/Lotus/Types/Restoratives/HeavyWeaponSummon": ["data:heist/profit-taker/first-clear"],
    "items:/Lotus/Types/Restoratives/LoadoutTechSummon": ["data:necramech/first-claim"],
    "items:/Lotus/Types/Restoratives/Consumable/CrewmateBall": ["data:railjack/intrinsics/command-9"],
    "items:/Lotus/Types/Restoratives/Consumable/MapMarker": ["data:clan/tenno-lab", "data:crafting"],
    "items:/Lotus/Types/Gameplay/Eidolon/Resources/SentientSecretItem": ["data:eidolon/tridolon", "data:vendor/sanctum/loid"],
    "items:/Lotus/Types/Restoratives/Consumable/NemesisBait": ["data:lich/kuva", "data:lich/tenet", "data:lich/infested-coda"],
    "items:/Lotus/Types/Items/Events/AmbulasDataFragment": ["data:enemy/ambulas-units"],
    "items:/Lotus/Types/Restoratives/Consumable/FomorianNegator": ["data:market/credits", "data:crafting"],
    "items:/Lotus/Types/Restoratives/Consumable/AssassinBait": ["data:baro/void-trader"],
    "items:/Lotus/Types/Restoratives/Consumable/AssassinBaitB": ["data:baro/void-trader"],
    "items:/Lotus/Types/Restoratives/Consumable/AssassinBaitC": ["data:baro/void-trader"],
    "items:/Lotus/Types/Restoratives/Consumable/AssassinBaitD": ["data:nightwave/cred-offerings"],
    "items:/Lotus/Types/Restoratives/Consumable/BaroFireWorksCrate": ["data:baro/void-trader"],
    "items:/Lotus/Types/Restoratives/Consumable/FireWorksCrate": ["data:market/credits"],
    "items:/Lotus/Types/Restoratives/Consumable/FireWorksSingle": ["data:market/credits"],
    "items:/Lotus/Types/Restoratives/Consumable/CameraConsumable": ["data:market/credits"],
    "items:/Lotus/Types/Restoratives/ThermianRPGSummon": ["data:activity/hollvania/scaldra-paratroopers"],
    "items:/Lotus/Types/Restoratives/Consumable/GlyphConsumable": ["data:market/credits"],
    "items:/Lotus/Types/Restoratives/Consumable/GlyphConsumableNoCharges": ["data:market/credits"],
    "items:/Lotus/Types/Restoratives/Conservation/Deimos/InfestedNexiferaLureGearItem": ["data:unobtainable/dev-only"],
    "items:/Lotus/Types/Restoratives/Conservation/Deimos/InfestedNexiferaRarityBoost": ["data:unobtainable/dev-only"],
    "items:/Lotus/Types/Restoratives/ScenarioBeacon": ["data:events/scarlet-spear"],
    "items:/Lotus/Types/Restoratives/Upgraded/HealthDebuffKey": ["data:dojo/orokin-lab"],
    "items:/Lotus/Types/Restoratives/Upgraded/ShieldDebuffKey": ["data:dojo/orokin-lab"],
    "items:/Lotus/Types/Restoratives/Upgraded/DamageDebuffKey": ["data:dojo/orokin-lab"],
    "items:/Lotus/Types/Restoratives/Upgraded/SpeedDebuffKey": ["data:dojo/orokin-lab"],
    "items:/Lotus/Types/Restoratives/LisetAutoHack": ["data:landing-craft/liset"],
    "items:/Lotus/Types/Restoratives/LisetMedStation": ["data:landing-craft/mantis"],
    "items:/Lotus/Types/Restoratives/LisetStun": ["data:landing-craft/nightwave"],
    "items:/Lotus/Types/Restoratives/LisetGoldenInstinct": ["data:landing-craft/parallax"],
    "items:/Lotus/Types/Restoratives/LisetBarrage": ["data:landing-craft/scimitar"],
    "items:/Lotus/Types/Restoratives/LisetKahl": ["data:landing-craft/skaut"],
    "items:/Lotus/Types/Restoratives/LisetTurret": ["data:landing-craft/xiphos"],
    "items:/Lotus/Types/Items/ShipFeatureItems/ArsenalFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/FoundryFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/ModsFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/SocialMenuFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/ClanFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/SolarChartFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/AlertsFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/EarthNavigationFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/MercuryNavigationFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/ModsFusionFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/ModsTransmuteFeatureItem": ["data:quest/vors-prize"],
    "items:/Lotus/Types/Items/ShipFeatureItems/VenusNavigationFeatureItem": ["data:junction/mercury-venus"],
    "items:/Lotus/Types/Items/ShipFeatureItems/MarsNavigationFeatureItem": ["data:junction/earth-mars"],
    "items:/Lotus/Types/Items/ShipFeatureItems/PhobosNavigationFeatureItem": ["data:junction/mars-phobos"],
    "items:/Lotus/Types/Items/ShipFeatureItems/CeresNavigationFeatureItem": ["data:junction/mars-ceres"],
    "items:/Lotus/Types/Items/ShipFeatureItems/JupiterNavigationFeatureItem": ["data:junction/ceres-jupiter"],
    "items:/Lotus/Types/Items/ShipFeatureItems/EuropaNavigationFeatureItem": ["data:junction/jupiter-europa"],
    "items:/Lotus/Types/Items/ShipFeatureItems/SaturnNavigationFeatureItem": ["data:junction/europa-saturn"],
    "items:/Lotus/Types/Items/ShipFeatureItems/UranusNavigationFeatureItem": ["data:junction/saturn-uranus"],
    "items:/Lotus/Types/Items/ShipFeatureItems/NeptuneNavigationFeatureItem": ["data:junction/uranus-neptune"],
    "items:/Lotus/Types/Items/ShipFeatureItems/PlutoNavigationFeatureItem": ["data:junction/neptune-pluto"],
    "items:/Lotus/Types/Items/ShipFeatureItems/SednaNavigationFeatureItem": ["data:junction/pluto-sedna"],
    "items:/Lotus/Types/Items/ShipFeatureItems/ErisNavigationFeatureItem": ["data:junction/sedna-eris"],
    "items:/Lotus/Types/Items/ShipFeatureItems/GeneticFoundryFeatureItem": ["data:junction/earth-mars"],
    "items:/Lotus/Types/Items/ShipFeatureItems/VoidProjectionFeatureItem": ["data:junction/earth-mars"],
    "items:/Lotus/Types/Items/ShipFeatureItems/ArsenalMeleeFeatureItem": ["data:quest/whispers-in-the-walls"],
    "items:/Lotus/Types/Items/ShipFeatureItems/PersonalQuartersFeatureBlueprint": ["data:quest/the-war-within"],
    "items:/Lotus/Types/Items/ShipFeatureItems/PersonalQuartersFeatureItem": ["data:quest/the-war-within"],
    "items:/Lotus/Types/Items/ShipFeatureItems/InfestedFoundryArchonShardBlueprint": ["data:quest/veilbreaker"],
    "items:/Lotus/Types/Items/ShipFeatureItems/InfestedFoundryArchonShardFeatureItem": ["data:quest/veilbreaker"],
    "items:/Lotus/Types/Items/ShipFeatureItems/InfestedFoundryArchonShardUpgradeFeatureBlueprint": ["data:vendor/sanctum/bird-3/researcher"],
    "items:/Lotus/Types/Items/ShipFeatureItems/InfestedFoundryArchonShardUpgradeFeatureItem": ["data:vendor/sanctum/bird-3/researcher"],
    "items:/Lotus/Types/Items/Eidolon/InfestedEventIngredient": ["data:events/plague-star"],
    "items:/Lotus/Types/Recipes/EidolonRecipes/InfestedEventIngredientBlueprint": ["data:vendor/cetus/nakak/operational-supply"],
    "items:/Lotus/Types/Recipes/Lens/AttackLensOstronBlueprint": ["data:bounty/cetus/level-40-60-cetus-bounty"],
    "items:/Lotus/Types/Recipes/Lens/TacticLensOstronBlueprint": ["data:bounty/cetus/level-40-60-cetus-bounty"],
    "items:/Lotus/Types/Recipes/Lens/WardLensOstronBlueprint": ["data:bounty/cetus/level-40-60-cetus-bounty"],
    "items:/Lotus/Types/Recipes/Lens/DefenseLensOstronBlueprint": ["data:bounty/cetus/level-40-60-cetus-bounty"],
    "items:/Lotus/Types/Recipes/Lens/PowerLensOstronBlueprint": ["data:bounty/cetus/level-40-60-cetus-bounty"],
    "items:/Lotus/Types/Recipes/Lens/AttackLensLuaBlueprint": ["data:missionreward/lua/apollo/rotationc"],
    "items:/Lotus/Types/Recipes/Lens/TacticLensLuaBlueprint": ["data:missionreward/lua/apollo/rotationc"],
    "items:/Lotus/Types/Recipes/Lens/WardLensLuaBlueprint": ["data:missionreward/lua/apollo/rotationc"],
    "items:/Lotus/Types/Recipes/Lens/DefenseLensLuaBlueprint": ["data:missionreward/lua/apollo/rotationc"],
    "items:/Lotus/Types/Recipes/Lens/PowerLensLuaBlueprint": ["data:missionreward/lua/apollo/rotationc"],
    "items:/Lotus/Types/Restoratives/Consumable/RazorbackCipher": ["data:events/razorback-armada"],
    "items:/Lotus/Types/Items/MiscItems/MirageCode": ["data:openworld/deimos/orokin-vault"],
    "items:/Lotus/Types/Items/Research/CipherPlus": ["data:events/arid-fear"],
    "items:/Lotus/Types/Items/MiscItems/RivenIdentifier": ["data:vendor/steel-path/teshin"],
    "items:/Lotus/Types/Enemies/Orokin/Entrati/EntratiTech/NechroTech/ExaltedArtilleryWeapon": ["data:necramech/arquebex-archgun"],

    // Helminth secretions are generated and spent through the Helminth system itself.
    "items:/Lotus/Types/Items/InfestedFoundry/HelminthBile": ["data:system/helminth"],
    "items:/Lotus/Types/Items/InfestedFoundry/HelminthBiotics": ["data:system/helminth"],
    "items:/Lotus/Types/Items/InfestedFoundry/HelminthCalx": ["data:system/helminth"],
    "items:/Lotus/Types/Items/InfestedFoundry/HelminthOxides": ["data:system/helminth"],
    "items:/Lotus/Types/Items/InfestedFoundry/HelminthPheromones": ["data:system/helminth"],
    "items:/Lotus/Types/Items/InfestedFoundry/HelminthSynthetics": ["data:system/helminth"],
    "items:/Lotus/Types/Items/InfestedFoundry/HelminthAppetiteCooldownReducer": ["data:system/helminth"],

    // Nightwave currencies and progression tokens
    "items:/Lotus/Types/Items/MiscItems/NoraInfestedCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraWolfCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraSeasonThreeCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraWolfTwoCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionTwoCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionThreeCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionFourCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionFiveCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionSixCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionSevenCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionEightCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionNineCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionTenCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionElevenCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionTwelveCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionThirteenCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionFourteenCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/MiscItems/NoraIntermissionFifteenCreds": ["data:nightwave/rank-reward"],
    "items:/Lotus/Types/Items/SyndicateDogTags/NoraInfestedDogTag": ["data:nightwave/standing"],
    "items:/Lotus/Types/Items/SyndicateDogTags/NoraWolfDogTag": ["data:nightwave/standing"],
    "items:/Lotus/Types/Items/SyndicateDogTags/NoraDogTag": ["data:nightwave/standing"],
    "items:/Lotus/Types/Items/SyndicateDogTags/NoraGlassmakerDogTag": ["data:nightwave/glassmaker"],
    "items:/Lotus/Types/PickUps/Nightwave/CephalonFissureTimePointItem": ["data:nightwave/glassmaker"],

    // Rising Tide Railjack sections: the repaired components and their damaged quest pickups all come from Rising Tide progression.
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackHoodFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/DamagedRailjackHoodFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackHullFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/DamagedRailjackHullFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackNacelleLeftFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/DamagedRailjackNacelleLeftFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackHoodBraceFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/DamagedRailjackHoodBraceFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackNacelleRightFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/DamagedRailjackNacelleRightFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/RailjackTailFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/Railjack/DamagedRailjackTailFeatureItem": ["data:quest/rising-tide"],
    "items:/Lotus/Types/Items/ShipFeatureItems/RailjackKeyShipFeatureItem": ["data:quest/rising-tide"],

    // Legacy reusable fishing blueprints removed in Update 24.6
    "items:/Lotus/Types/Items/Fish/Eidolon/Boosters/AnglerVisionBlueprint": ["data:unobtainable/legacy"], // Luminous Dye Blueprint
    "items:/Lotus/Types/Items/Fish/Eidolon/Boosters/SoftTouchBlueprint": ["data:unobtainable/legacy"], // Pharoma Blueprint


    // ----------------------------
    // Conclave / PvP variants
    // ----------------------------
    "items:/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipOne": ["data:conclave"],
    "items:/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipTwo": ["data:conclave"],
    "items:/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipThree": ["data:conclave"],
    "items:/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipFour": ["data:conclave"],
    "items:/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipFive": ["data:conclave"],
    "items:/Lotus/Weapons/Ostron/Melee/ModularMelee01/Tip/PvPVariantTipSix": ["data:conclave"],

    "items:/Lotus/Weapons/Ostron/Melee/ModularMeleeInfested/Tips/PvPVariantInfestedTipOne": ["data:events/plague-star"],
    "items:/Lotus/Weapons/Ostron/Melee/ModularMeleeInfested/Tips/PvPVariantInfestedTipTwo": ["data:events/plague-star"],

    // ----------------------------
    // Pets
    // ----------------------------
    "items:/Lotus/Powersuits/Khora/Kavat/KhoraPrimeKavatPowerSuit": ["data:warframe/khora-prime"], // Venari Prime

    // Regular Kavats — bred in the Orbiter Incubator using Kavat Genetic Codes
    "items:/Lotus/Types/Game/CatbrowPet/CheshireCatbrowPetPowerSuit": ["data:pets/kavat"], // Smeeta Kavat
    "items:/Lotus/Types/Game/CatbrowPet/MirrorCatbrowPetPowerSuit": ["data:pets/kavat"], // Adarza Kavat
    // Vasca Kavat — contract the Vasca strain by getting bitten on Plains of Eidolon at night
    "items:/Lotus/Types/Game/CatbrowPet/VampireCatbrowPetPowerSuit": ["data:openworld/cetus/vasca"], // Vasca Kavat

    // Regular Kubrows — bred in the Orbiter Incubator using a Kubrow Egg (found on Earth)
    "items:/Lotus/Types/Game/KubrowPet/AdventurerKubrowPetPowerSuit": ["data:pets/kubrow"], // Sahasa Kubrow
    "items:/Lotus/Types/Game/KubrowPet/FurtiveKubrowPetPowerSuit": ["data:pets/kubrow"], // Huras Kubrow
    "items:/Lotus/Types/Game/KubrowPet/GuardKubrowPetPowerSuit": ["data:pets/kubrow"], // Raksa Kubrow
    "items:/Lotus/Types/Game/KubrowPet/HunterKubrowPetPowerSuit": ["data:pets/kubrow"], // Sunika Kubrow
    "items:/Lotus/Types/Game/KubrowPet/RetrieverKubrowPetPowerSuit": ["data:pets/kubrow"], // Chesa Kubrow
    // Helminth Charger — incubate a Kubrow Egg while the Helminth cyst is active
    "items:/Lotus/Types/Game/KubrowPet/ChargerKubrowPetPowerSuit": ["data:pets/helminth-charger"], // Helminth Charger

    // Vulpaphyla (Infested Kavats) — Deimos conservation and Son (Deimos) vendor
    "items:/Lotus/Types/Friendly/Pets/CreaturePets/ArmoredInfestedCatbrowPetPowerSuit": ["data:activity/deimos/conservation", "data:vendor/deimos/son"], // Panzer Vulpaphyla
    "items:/Lotus/Types/Friendly/Pets/CreaturePets/HornedInfestedCatbrowPetPowerSuit": ["data:activity/deimos/conservation", "data:vendor/deimos/son"], // Crescent Vulpaphyla
    "items:/Lotus/Types/Friendly/Pets/CreaturePets/VulpineInfestedCatbrowPetPowerSuit": ["data:activity/deimos/conservation", "data:vendor/deimos/son"], // Sly Vulpaphyla

    // Predasite (Infested Kubrows) — Deimos conservation and Son (Deimos) vendor
    "items:/Lotus/Types/Friendly/Pets/CreaturePets/MedjayPredatorKubrowPetPowerSuit": ["data:activity/deimos/conservation", "data:vendor/deimos/son"], // Medjay Predasite
    "items:/Lotus/Types/Friendly/Pets/CreaturePets/PharaohPredatorKubrowPetPowerSuit": ["data:activity/deimos/conservation", "data:vendor/deimos/son"], // Pharaoh Predasite
    "items:/Lotus/Types/Friendly/Pets/CreaturePets/VizierPredatorKubrowPetPowerSuit": ["data:activity/deimos/conservation", "data:vendor/deimos/son"], // Vizier Predasite

    // ----------------------------
    // Moa companion weapons / parts (Fortuna)
    // ----------------------------
    "items:/Lotus/Types/Friendly/Pets/MoaPets/MoaPetComponents/HextraWeapon": ["data:pets/moa"], // Multron

    // ----------------------------
    // Sentinel weapons (general)
    // ----------------------------
    "items:/Lotus/Types/Sentinels/SentinelWeapons/Gremlin": ["data:market/credits"], // Artax
    "items:/Lotus/Types/Sentinels/SentinelWeapons/LaserRifle": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/PrimeLaserRifle": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/BurstLaserPistol": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/PrimeBurstLaserPistol": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/PrismaBurstLaserPistol": ["data:baro/void-trader"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/SentGlaiveWeapon": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/DeconstructorPrime/PrimeHeliosGlaiveWeapon": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/DethMachineRifle": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/PrimeDethMachineRifle": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/SentShotgun": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/PrimeSentShotgun": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/SentinelFreezeRayRifle": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/SentinelFreezeRayPrimeRifle": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelWeapons/SentElecRailgun": ["data:market/credits"],
    "items:/Lotus/Types/Sentinels/SentinelPowersuits/PrismaShadePowerSuit": ["data:baro/void-trader"],

    // ----------------------------
    // Baro Ki’Teer / Void Trader
    // ----------------------------
    "items:/Lotus/Weapons/Corpus/Bow/Longbow/PrismaLenz/PrismaLenzWeapon": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Corpus/LongGuns/CorpusUMP/PrismaCorpusUMP": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Corpus/Melee/CrpTonfa/CrpPrismaTonfa": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Corpus/Melee/KickAndPunch/PrismaObex": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Corpus/Pistols/CrpHandRL/PrismaAngstrum": ["data:baro/void-trader"],

    "items:/Lotus/Weapons/Grineer/LongGuns/GrineerLeverActionRifle/PrismaGrinlokWeapon": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Grineer/LongGuns/VoidTraderGorgon/VTGorgon": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Grineer/Melee/GrineerMachetteAndCleaver/PrismaDualCleavers": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Grineer/Melee/GrineerMachetteAndCleaver/PrismaMachete": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Grineer/Pistols/GrineerBulbousSMG/Prisma/PrismaTwinGremlinsWeapon": ["data:baro/void-trader"],

    "items:/Lotus/Weapons/Tenno/Archwing/Melee/VoidTraderArchsword/VTArchSwordWeapon": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Tenno/Archwing/Primary/ArchwingHeavyPistols/Prisma/PrismaArchHeavyPistols": ["data:baro/void-trader"],

    "items:/Lotus/Weapons/VoidTrader/PrismaGrakata": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/VoidTrader/PrismaSkana": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/VoidTrader/VTDetron": ["data:baro/void-trader"],
    "items:/Lotus/Weapons/Tenno/Melee/Warfan/TnMoonWarfan/MoonWarfanWeapon": ["data:baro/void-trader"],

    // ----------------------------
    // Variants / Starter series
    // ----------------------------
    "items:/Lotus/Weapons/Grineer/LongGuns/GrineerSniperRifle/VulkarWraith": ["data:variants/wraith"],
    "items:/Lotus/Weapons/Grineer/Melee/GrineerMachetteAndCleaver/WraithMacheteWeapon": ["data:variants/wraith"],
    "items:/Lotus/Weapons/Grineer/Melee/GrnBoomerang/HalikarWraithWeapon": ["data:variants/wraith"],
    "items:/Lotus/Weapons/Grineer/Pistols/WraithSingleViper/WraithSingleViper": ["data:variants/wraith"],

    "items:/Lotus/Weapons/Corpus/LongGuns/CrpBFG/Vandal/VandalCrpBFG": ["data:variants/vandal"],
    "items:/Lotus/Weapons/Corpus/LongGuns/CrpFreezeRay/Vandal/CrpFreezeRayVandalRifle": ["data:variants/vandal"],
    "items:/Lotus/Weapons/Corpus/LongGuns/CrpShockRifle/QuantaVandal": ["data:variants/vandal"],
    "items:/Lotus/Weapons/Corpus/LongGuns/Machinegun/SupraVandal": ["data:variants/vandal"],
    "items:/Lotus/Weapons/ClanTech/Energy/VandalElectroProd": ["data:variants/vandal"],

    "items:/Lotus/Weapons/Grineer/LongGuns/GrnOrokinRifle/GrnOrokinRifleWeapon": ["data:variants/prime"],
    "items:/Lotus/Weapons/Tenno/Pistol/LatoPrime": ["data:variants/prime"],
    "items:/Lotus/Weapons/Tenno/Melee/LongSword/SkanaPrime": ["data:variants/prime"],

    "items:/Lotus/Weapons/MK1Series/MK1Bo": ["data:market/credits"],
    "items:/Lotus/Weapons/MK1Series/MK1Furax": ["data:market/credits"],
    "items:/Lotus/Weapons/MK1Series/MK1Furis": ["data:market/credits"],
    "items:/Lotus/Weapons/MK1Series/MK1Kunai": ["data:market/credits"],
    "items:/Lotus/Weapons/MK1Series/MK1Paris": ["data:market/credits"],
    "items:/Lotus/Weapons/MK1Series/MK1Strun": ["data:market/credits"],
    "items:/Lotus/Weapons/Tenno/Rifle/StartingRifle": ["data:market/credits"],

    // ----------------------------
    // Invasions (weapon blueprints/parts; weapons are crafted)
    // ----------------------------
    // Wiki indicates these are obtained via invasion reward tables as BLUEPRINT + COMPONENTS, then crafted.
    // So: finished weapon -> data:crafting; bp/parts -> data:invasion/rewards.
    "items:/Lotus/Weapons/Grineer/LongGuns/GrineerM16Homage/KarakWraith": ["data:crafting"],
    "items:/Lotus/Types/Recipes/Weapons/KarakWraithBlueprint": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithBarrel": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithReceiver": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/KarakWraithStock": ["data:invasion/rewards"],

    "items:/Lotus/Weapons/Tenno/LongGuns/WraithLatron/WraithLatron": ["data:crafting"],
    "items:/Lotus/Types/Recipes/Weapons/LatronWraithBlueprint": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/LatronWraithBarrel": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/LatronWraithReceiver": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/LatronWraithStock": ["data:invasion/rewards"],

    "items:/Lotus/Weapons/Tenno/Shotgun/ShotgunVandal": ["data:crafting"], // Strun Wraith (weapon path in your list)
    "items:/Lotus/Types/Recipes/Weapons/StrunWraithBlueprint": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/StrunWraithBarrel": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/StrunWraithReceiver": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/StrunWraithStock": ["data:invasion/rewards"],

    // Leaving Twin Vipers Wraith as-is (not revalidated in the current web pass).
    "items:/Lotus/Weapons/Grineer/Pistols/WraithTwinVipers/WraithTwinVipers": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/TwinVipersWraithBlueprint": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TwinVipersWraithBarrel": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TwinVipersWraithReceiver": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TwinVipersWraithLink": ["data:invasion/rewards"],

    "items:/Lotus/Weapons/Tenno/Rifle/VandalSniperRifle": ["data:crafting"], // Snipetron Vandal
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronVandalBarrel": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronVandalReceiver": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/SnipetronVandalStock": ["data:invasion/rewards"],

    "items:/Lotus/Types/Recipes/Weapons/DeraVandalBlueprint": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DeraVandalBarrel": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DeraVandalReceiver": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DeraVandalStock": ["data:invasion/rewards"],

    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/GrineerCombatKnifeBlade": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/GrineerCombatKnifeHilt": ["data:invasion/rewards"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/GrineerCombatKnifeHeatsink": ["data:invasion/rewards"],

    // ----------------------------
    // Nightwave
    // ----------------------------
    "items:/Lotus/Powersuits/Trapper/Trapper": ["data:nightwave/cred-offerings"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/TrapperChassisComponent": ["data:nightwave/cred-offerings"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/TrapperHelmetComponent": ["data:nightwave/cred-offerings"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/TrapperSystemsComponent": ["data:nightwave/cred-offerings"],
    "items:/Lotus/Types/Recipes/DarkSwordBlueprint": ["data:nightwave/cred-offerings"], // Dark Sword Blueprint
    "items:/Lotus/Types/Recipes/Weapons/DarkDaggerBlueprint": ["data:nightwave/cred-offerings","data:market/credits"],
    "items:/Lotus/Types/Recipes/Weapons/GlaiveBlueprint": ["data:nightwave/cred-offerings","data:market/credits"],

    // Nightwave landing craft blueprint and component blueprints are now permanent Cred Offerings.
    "items:/Lotus/Types/Recipes/LandingCraftRecipes/NightwaveShip/NoraShipBlueprint": ["data:nightwave/cred-offerings"],
    "items:/Lotus/Types/Recipes/LandingCraftRecipes/NightwaveShip/NoraShipAvionicsComponent": ["data:nightwave/cred-offerings"],
    "items:/Lotus/Types/Recipes/LandingCraftRecipes/NightwaveShip/NoraShipEnginesComponent": ["data:nightwave/cred-offerings"],
    "items:/Lotus/Types/Recipes/LandingCraftRecipes/NightwaveShip/NoraShipFuselageComponent": ["data:nightwave/cred-offerings"],

    // Update 44 Cephalon Melica classroom supplies (all parts are blueprint purchases).
    "items:/Lotus/Weapons/Tenno/Bows/DuelistBow/DuelistBow": ["data:crafting"], // Nunchasa
    "items:/Lotus/Types/Recipes/Weapons/DuelistBowBlueprint": ["data:vendor/zariman/cephalon-melica"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowGrip": ["data:vendor/zariman/cephalon-melica"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowLowerLimb": ["data:vendor/zariman/cephalon-melica"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowString": ["data:vendor/zariman/cephalon-melica"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistBowUpperLimb": ["data:vendor/zariman/cephalon-melica"],
    "items:/Lotus/Weapons/Tenno/Pistols/DuelistPistols/DuelistPistols": ["data:crafting"], // Aksondol
    "items:/Lotus/Types/Recipes/Weapons/DuelistPistolsBlueprint": ["data:vendor/zariman/cephalon-melica"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsBarrel": ["data:vendor/zariman/cephalon-melica"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsLink": ["data:vendor/zariman/cephalon-melica"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/DuelistPistolsReceiver": ["data:vendor/zariman/cephalon-melica"],


    // ----------------------------
    // Duviri / Circuit / Abyss / Arbitration (coarse)
    // ----------------------------
    "items:/Lotus/Types/Recipes/Weapons/DaxDuviriMaceShieldBlueprint": ["data:vendor/duviri/teshins-cave"],
    "items:/Lotus/Types/Recipes/Weapons/DaxDuviriTwoHandedKatanaBlueprint": ["data:vendor/duviri/teshins-cave", "data:vendor/simaris"],
    "items:/Lotus/Types/Recipes/Weapons/DaxDuviriPolearmBlueprint": ["data:vendor/duviri/teshins-cave", "data:vendor/simaris"],
    "items:/Lotus/Types/Recipes/Weapons/DaxDuviriAsymmetricalLongBowPlayerWeaponBlueprint": ["data:duviri/enigma"],
    "items:/Lotus/Types/Recipes/Weapons/DaxDuviriHammerBlueprint": ["data:vendor/duviri/teshins-cave", "data:vendor/simaris"],
    "items:/Lotus/Types/Recipes/Weapons/DuviriDualSwordsBlueprint": ["data:quest/the-duviri-paradox", "data:vendor/simaris"],
    "items:/Lotus/Types/Recipes/Weapons/DaxDuviriKatanaBlueprint": ["data:vendor/duviri/teshins-cave", "data:vendor/simaris"],
    "items:/Lotus/Types/Recipes/Weapons/PaxDuviricusShotgunBlueprint": ["data:vendor/duviri/acrithis"],

    "items:/Lotus/Powersuits/PaxDuviricus/PaxDuviricus": ["data:duviri/kullervo"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/PaxDuviricusChassisComponent": ["data:duviri/kullervo"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/PaxDuviricusHelmetComponent": ["data:duviri/kullervo"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/PaxDuviricusSystemsComponent": ["data:duviri/kullervo"],

    "items:/Lotus/Powersuits/Dagath/Dagath": ["data:abyssal-zone/dagath"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/DagathChassisComponent": ["data:abyssal-zone/dagath"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/DagathHelmetComponent": ["data:abyssal-zone/dagath"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/DagathSystemsComponent": ["data:abyssal-zone/dagath"],

    "items:/Lotus/Powersuits/Devourer/Devourer": ["data:arbitrations/grendel"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/GrendelChassisComponent": ["data:arbitrations/grendel"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/GrendelHelmetComponent": ["data:arbitrations/grendel"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/GrendelSystemsComponent": ["data:arbitrations/grendel"],

    "items:/Lotus/Powersuits/Yareli/Yareli": ["data:quest/the-waverider"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/YareliChassisComponent": ["data:quest/the-waverider"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/YareliHelmetComponent": ["data:quest/the-waverider"],
    "items:/Lotus/Types/Recipes/WarframeRecipes/YareliSystemsComponent": ["data:quest/the-waverider"],

    "items:/Lotus/Powersuits/DemonFrame/DemonFrame": [
        "data:quest/the-old-peace",
        "data:vendor/roathe/la-cathedrale",
    ],

    "items:/Lotus/Types/Recipes/WarframeRecipes/UrielChassisComponent": [
        "data:activity/the-descendia/oblivion-on-infernium-21",
        "data:vendor/roathe/la-cathedrale"
    ],
    "items:/Lotus/Types/Recipes/WarframeRecipes/UrielHelmetComponent": [
        "data:activity/the-descendia/oblivion-on-infernium-21",
        "data:vendor/roathe/la-cathedrale"
    ],
    "items:/Lotus/Types/Recipes/WarframeRecipes/UrielSystemsComponent": [
        "data:activity/the-descendia/oblivion-on-infernium-21",
        "data:vendor/roathe/la-cathedrale"
    ],

    // ----------------------------
    // 1999 Mushrooms / Journal items (Souterrains + vendor)
    // ----------------------------
    "items:/Lotus/Types/Items/MushroomJournal/CorrosiveMushroomJournalItem": ["data:activity/souterrains/bounties", "data:vendor/fortuna/nightcap"],
    "items:/Lotus/Types/Items/MushroomJournal/MagneticMushroomJournalItem": ["data:activity/souterrains/bounties", "data:vendor/fortuna/nightcap"],
    "items:/Lotus/Types/Items/MushroomJournal/RadiationMushroomJournalItem": ["data:activity/souterrains/bounties", "data:vendor/fortuna/nightcap"],
    "items:/Lotus/Types/Items/MushroomJournal/GasMushroomJournalItem": ["data:activity/souterrains/bounties", "data:vendor/fortuna/nightcap"],
    "items:/Lotus/Types/Items/MushroomJournal/BlastMushroomJournalItem": ["data:activity/souterrains/bounties", "data:vendor/fortuna/nightcap"],
    "items:/Lotus/Types/Items/MushroomJournal/ViralMushroomJournalItem": ["data:activity/souterrains/bounties", "data:vendor/fortuna/nightcap"],

    // ----------------------------
    // Infested “Coda” weapons (Infested Lich system)
    // ----------------------------
    "items:/Lotus/Weapons/Infested/InfestedLich/LongGuns/1999InfShotgun/1999InfShotgunWeapon": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/LongGuns/CodaBubonico/CodaBubonicoCannon": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/LongGuns/CodaHema": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/LongGuns/CodaSporothrix": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/LongGuns/CodaSynapse": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Melee/CodaCaustacyst/CodaCaustacyst": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Melee/CodaHirudo": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Melee/CodaMire": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Melee/CodaPathocyst/CodaPathocyst": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Melee/InfestedHammer/InfLichHammerWeapon": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Pistols/1999InfSporePistol/1999InfSporePistolWeapon": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Pistols/CodaCatabolyst": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Pistols/CodaPox": ["data:lich/infested-coda"],
    "items:/Lotus/Weapons/Infested/InfestedLich/Pistols/CodaTysis": ["data:lich/infested-coda"],

    // ----------------------------
    // Remaining unknown-acquisition (coarse buckets)
    // ----------------------------
    "items:/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetMeleeWeaponPS": ["data:companions/hound-bhaira"],
    "items:/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetMeleeWeaponIP": ["data:companions/hound-bhaira"],
    "items:/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetMeleeWeaponIS": ["data:companions/hound-bhaira"],

    "items:/Lotus/Weapons/Grineer/Melee/GunBlade/GrnGunBlade/GrnGunblade": ["data:baro/void-trader"],
    "items:/Lotus/Powersuits/Khora/Kavat/KhoraKavatPowerSuit": ["data:warframe/khora"],

    "items:/Lotus/Types/Items/MiscItems/GrnFlameSpearPart": ["data:enemy-item/prosecutors"],
    "items:/Lotus/Types/Items/MiscItems/SentientFragmentLootItem": ["data:node/murex/20-sentients"],

    // ----------------------------
    // Deepmines (Fortuna Airlock) + Nightcap vendor
    // ----------------------------
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/NokkoArchGunBarrelBlueprint": [
        "data:activity/deepmines/bounties",
        "data:vendor/fortuna/nightcap"
    ],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/NokkoArchGunReceiverBlueprint": [
        "data:activity/deepmines/bounties",
        "data:vendor/fortuna/nightcap"
    ],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/NokkoArchGunStockBlueprint": [
        "data:activity/deepmines/bounties",
        "data:vendor/fortuna/nightcap"
    ],
    "items:/Lotus/Types/Items/MushroomJournal/PlainMushroomJournalItem": ["data:deepmines/gathering"],

    // ----------------------------
    // The Old Peace / The Descendia: Vinquibus
    // ----------------------------
    "items:/Lotus/Weapons/Tenno/Bayonet/TnBayonetRifleBlueprint": [
        "data:vendor/roathe/la-cathedrale",
        "data:activity/the-descendia/oblivion-on-infernium-21",
    ],

    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/VinquibusBarrelBlueprint": [
        "data:vendor/roathe/la-cathedrale",
        "data:activity/the-descendia/oblivion-on-infernium-21",
    ],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/VinquibusBladeBlueprint": [
        "data:vendor/roathe/la-cathedrale",
        "data:activity/the-descendia/oblivion-on-infernium-21",
    ],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/VinquibusReceiverBlueprint": [
        "data:vendor/roathe/la-cathedrale",
        "data:activity/the-descendia/oblivion-on-infernium-21",
    ],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/VinquibusStockBlueprint": [
        "data:vendor/roathe/la-cathedrale",
        "data:activity/the-descendia/oblivion-on-infernium-21",
    ],

    "items:/Lotus/Weapons/Tenno/Pistol/BurstPistol": ["data:market/credits"], // Sicarus
    "items:/Lotus/Weapons/Tenno/Shotgun/Shotgun": ["data:market/credits"], // Strun

    // ============================
    // VENDOR / SYSTEM BLUEPRINTS
    // ============================
    "items:/Lotus/Types/Recipes/Weapons/CrpChargeGunBlueprint": ["data:vendor/fortuna/vox-solaris"],

    // Kompressa component blueprints are purchased from Ventkids (Fortuna)
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TnYareliPistolBarrel": ["data:vendor/fortuna/ventkids"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/TnYareliPistolReceiver": ["data:vendor/fortuna/ventkids"],
    "items:/Lotus/Types/Recipes/DeimosRecipes/Mechs/NecromechBlueprint": ["data:vendor/deimos/necraloid"],

    // Purgator 1 component blueprints are purchased from The Hex
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/LasrianNoxPlayerWeaponBarrel": ["data:vendor/hollvania/the-hex"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/LasrianNoxPlayerWeaponReceiver": ["data:vendor/hollvania/the-hex"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/LasrianNoxPlayerWeaponStock": ["data:vendor/hollvania/the-hex"],


    // ===========================
    // Extras / Manual Additions
    // ===========================
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/InfTransformClawsWeaponBlade": ["data:vendor/deimos/father"],
    "items:/Lotus/Types/Recipes/Weapons/WeaponParts/InfTransformClawsWeaponBladeBlueprint": ["data:vendor/deimos/father"],
};
