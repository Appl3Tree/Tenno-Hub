# Prerequisite Registry Inventory

Generated from `PREREQ_REGISTRY`, `MILESTONE_REGISTRY`, `SOURCE_INDEX`, and `STAR_CHART_DATA` by `npm run audit:prerequisites`.

- Registry entries: 188
- Direct required edges: 231
- Alternative prerequisite references: 6
- Milestone rollups: 45
- Source catalog entries: 16256
- Star Chart nodes: 514
- Star Chart junctions: 13
- Prerequisite categories: Quests 24; Systems 90; SideQuests 20; Hubs 11; Railjack 5; Segments 13; Necramech 3; Syndicates 22
- Root entries: quest_vors_prize, system_operator_amp_owned, system_rank30_warframe_eligible
- Entries with release metadata: 27
- Entries introduced after the Update 41 baseline: 13 (Quests 2; Hubs 2; Systems 8; Railjack 1)
- Duplicate IDs: none
- Duplicate milestone IDs: none
- Duplicate canonical labels: none
- Self-references: none
- Duplicate direct relationships: none
- Unresolved prerequisite references: none
- Unresolved source-catalog references: none
- Unresolved milestone references: none
- Unresolved quest/junction condition references: none
- Dependency cycles: none
- Junction definitions missing or duplicated on chart nodes: none
- Duplicate Star Chart node IDs: none
- Invalid Star Chart planet/node relationships: none
- Entries without per-entry evidence metadata: 116
- Gated entries without per-entry evidence: 115
- Direct relationships / conditions on entries without evidence: 150

## Tracked Entries

| Identifier | Name | Category | Required (AND) | Alternative (OR) | Typed conditions (AND) | Direct dependents | Completion source | Evidence / release metadata |
|---|---|---|---|---|---|---|---|---|
| `quest_vors_prize` | Vor's Prize | Quests | — | — | — | Any Relay Access, Clan Dojo Access, Invasions Available, Mastery Rank 10, Mastery Rank 15, Mastery Rank 30, Mastery Rank 5, Mastery Rank 8, Nightmare Missions Unlocked, Nightwave Access, Operation: Taubound (Limited Event), Orbiter: Arsenal Segment, Orbiter: Codex Scanner Segment, Orbiter: Communications Segment, Orbiter: Foundry Segment, Orbiter: Modding Segment, The Teacher | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_teacher` | The Teacher | Quests | Vor's Prize | — | — | Cetus (Plains of Eidolon) Access, Junction: Earth → Venus, Opt into Dark Refractory Mission Preview | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_once_awake` | Once Awake | Quests | Junction: Venus → Mercury | — | — | Junction: Earth → Mars, Patient Zero | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_archwing` | The Archwing | Quests | Junction: Earth → Mars | — | — | Junction: Europa → Saturn, Natah, The Limbo Theorem | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_natah` | Natah | Quests | The Archwing | — | — | Junction: Uranus → Neptune | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `quest_the_second_dream` | The Second Dream | Quests | Junction: Uranus → Neptune | — | — | Focus System Unlocked, Junction: Neptune → Pluto, Lua Access, Octavia's Anthem, The Silver Grove | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `quest_the_war_within` | The War Within | Quests | Junction: Neptune → Pluto | — | Mastery Rank 5 | Junction: Pluto → Eris, Kuva Fortress Access, Kuva Lich System, Orbiter: Personal Quarters Segment, Rising Tide, Sisters of Parvos System, Sorties, The Glast Gambit, Visited Quill Onkko | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `quest_chains_of_harrow` | Chains of Harrow | Quests | Visited Quill Onkko | — | — | Apostasy Prologue, Aspirant Zorba Access, Follie's Hunt | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/35-5-0); release not tagged |
| `quest_apostasy_prologue` | Apostasy Prologue | Quests | Chains of Harrow, Orbiter: Personal Quarters Segment | — | — | The Sacrifice | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_sacrifice` | The Sacrifice | Quests | Apostasy Prologue | — | — | Chimera Prologue | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_chimera_prologue` | Chimera Prologue | Quests | The Sacrifice | — | — | Erra, Ropalolyst Assassination | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_erra` | Erra | Quests | Chimera Prologue | — | — | Prelude to War — The Maker | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_prelude_to_war` | Prelude to War — The Maker | Quests | Erra | — | — | The New War | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_new_war` | The New War | Quests | Prelude to War — The Maker, Railjack: Ship Constructed, Operator Amp Owned | — | — | Angels of the Zariman, Drifter's Camp Access, Jade Shadows, Operator: Sirocco Acquired, Veilbreaker, Whispers in the Walls | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/The_New_War); [official](https://www.warframe.com/en/patch-notes/pc/38-5-0); [official](https://www.warframe.com/en/patch-notes/pc/33-5-0); release not tagged |
| `quest_the_duviri_paradox` | The Duviri Paradox | Quests | Junction: Saturn → Uranus | — | — | The Circuit, The Hex, The Steel Path Circuit | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `quest_angels_of_the_zariman` | Angels of the Zariman | Quests | The New War | — | — | The Icebind, Yuvan Peak Access, Zariman (Chrysalith) Access | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_whispers_in_the_walls` | Whispers in the Walls | Quests | The New War, Heart of Deimos | — | — | Deep Archimedea, Orbiter: Melee Upgrade Segment, Sanctum Anatomica Access, The Icebind, The Lotus Eaters, Yuvan Peak Access | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_lotus_eaters` | The Lotus Eaters | Quests | Whispers in the Walls | — | — | The Hex, The Old Peace | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_hex` | The Hex | Quests | The Lotus Eaters, The Duviri Paradox | — | — | Fables & Frontiers: Running Late, Höllvania Central Mall Access, Tau Prologue Quest Series, Technocyte Coda System, Temporal Archimedea, The Hex: All Six Members Liked | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_old_peace` | The Old Peace | Quests | The Lotus Eaters | — | — | Dark Refractory Access, Devil's Triad KIM Access, La Cathédrale Access, Tau Prologue Quest Series | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_jade_shadows` | Jade Shadows | Quests | The New War | — | — | Jade Shadows: Constellations | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_jade_shadows_constellations` | Jade Shadows: Constellations | Quests | Jade Shadows | — | — | Uranus Proxima Access | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/43-0-0); introduced Update 43 (June 17, 2026) |
| `system_hex_all_liked` | The Hex: All Six Members Liked | Systems | The Hex | — | Syndicate syndicate_hex_1999 rank 3 | The Hex Finale | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/The_Hex_%28Quest%29); introduced Update 38 (December 2024) |
| `quest_the_hex_finale` | The Hex Finale | Quests | The Hex: All Six Members Liked | — | — | Fables & Frontiers: Running Late | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/The_Hex_%28Quest%29); introduced Update 38 (December 2024) |
| `quest_tau_prologue_series` | Tau Prologue Quest Series | Quests | The Hex, The Old Peace | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/44-1-2); introduced Update 44.1.2 (October 15, 2026) |
| `quest_howl_of_the_kubrow` | Howl of the Kubrow | SideQuests | Junction: Venus → Mercury | — | — | Kubrow Breeding, Orbiter: Incubator Segment | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_stolen_dreams` | Stolen Dreams | SideQuests | Junction: Mars → Phobos | — | — | The New Strange | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_sayas_vigil` | Saya's Vigil | SideQuests | Cetus (Plains of Eidolon) Access | — | — | Focus Schools Fully Accessible | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_vox_solaris` | Vox Solaris | SideQuests | Fortuna (Orb Vallis) Access | — | — | Junction: Venus → Mercury, MOA Companion Assembly, Solaris United: Rank 5 (Old Mate), The Waverider, Thermia Fractures, Vox Solaris: Rank 1 (Operative) | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_heart_of_deimos` | Heart of Deimos | SideQuests | Junction: Earth → Mars | — | — | Junction: Deimos → Jupiter, Kavat Breeding, Necralisk (Deimos) Access, Necramech: System Unlocked, Whispers in the Walls | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_rising_tide` | Rising Tide | SideQuests | The War Within | — | — | Junction: Eris → Sedna, Kuva Lich System, Railjack: Ship Constructed | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/Rising_Tide); release not tagged |
| `quest_veilbreaker` | Veilbreaker | SideQuests | The New War | — | — | Helminth Segment: Archon Shards | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_call_of_the_tempestarii` | Call of the Tempestarii | SideQuests | Railjack: Ship Constructed, The Deadlock Protocol | — | Mastery Rank 4 | Railjack: Corpus Proxima Access, Sisters of Parvos System, Void Storms | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_deadlock_protocol` | The Deadlock Protocol | SideQuests | Junction: Europa → Saturn | — | Mastery Rank 4 | Call of the Tempestarii | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_new_strange` | The New Strange | SideQuests | Stolen Dreams, Junction: Jupiter → Europa | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_limbo_theorem` | The Limbo Theorem | SideQuests | The Archwing, Junction: Jupiter → Europa | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_silver_grove` | The Silver Grove | SideQuests | The Second Dream | — | Mastery Rank 7 | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_sands_of_inaros` | Sands of Inaros | SideQuests | Any Relay Access | — | Mastery Rank 5 | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_octavias_anthem` | Octavia's Anthem | SideQuests | The Second Dream | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_jordas_precept` | The Jordas Precept | SideQuests | Junction: Pluto → Eris | — | — | — | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/The_Jordas_Precept); release not tagged |
| `quest_the_glast_gambit` | The Glast Gambit | SideQuests | The War Within, Any Relay Access | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_mask_of_the_revenant` | Mask of the Revenant | SideQuests | Cetus (Plains of Eidolon) Access, The Quills: Rank 2 (Observer) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_hidden_messages` | Hidden Messages | SideQuests | Junction: Eris → Sedna | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_the_waverider` | The Waverider | SideQuests | Vox Solaris | — | Mastery Rank 3 | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `quest_patient_zero` | Patient Zero | SideQuests | Once Awake, Junction: Pluto → Eris | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `junction_mercury_venus` | Junction: Venus → Mercury | Systems | Vox Solaris | — | Complete Jackal at Fossa (Venus) | Howl of the Kubrow, Once Awake | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `junction_venus_earth` | Junction: Earth → Venus | Systems | The Teacher | — | — | Fortuna (Orb Vallis) Access | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/40-0-0); release not tagged |
| `junction_earth_mars` | Junction: Earth → Mars | Systems | Once Awake | — | — | Heart of Deimos, Junction: Mars → Ceres, Junction: Mars → Phobos, Orbiter: Void Relic Segment, The Archwing | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `junction_mars_phobos` | Junction: Mars → Phobos | Systems | Junction: Earth → Mars | — | — | Defection Missions, Stolen Dreams | derived from matching Star Chart junction node | release not tagged |
| `junction_mars_ceres` | Junction: Mars → Ceres | Systems | Junction: Earth → Mars | — | — | — | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `junction_mars_deimos` | Deimos Access | Systems | — | — | Complete War mission on Mars | Junction: Deimos → Jupiter | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/Deimos); [wiki](https://wiki.warframe.com/w/Junctions); release not tagged |
| `junction_ceres_jupiter` | Junction: Deimos → Jupiter | Systems | Deimos Access, Heart of Deimos | — | — | Junction: Jupiter → Europa, Ropalolyst Assassination | derived from matching Star Chart junction node | [wiki](https://wiki.warframe.com/w/Deimos); [official](https://www.warframe.com/en/patch-notes/pc/38-5-0); [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `junction_jupiter_europa` | Junction: Jupiter → Europa | Systems | Junction: Deimos → Jupiter | — | — | Junction: Europa → Saturn, The Limbo Theorem, The New Strange | derived from matching Star Chart junction node | release not tagged |
| `junction_europa_saturn` | Junction: Europa → Saturn | Systems | Junction: Jupiter → Europa, The Archwing | — | — | Junction: Saturn → Uranus, The Deadlock Protocol | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/38-5-0); release not tagged |
| `junction_saturn_uranus` | Junction: Saturn → Uranus | Systems | Junction: Europa → Saturn | — | — | Junction: Uranus → Neptune, The Duviri Paradox | derived from matching Star Chart junction node | release not tagged |
| `junction_uranus_neptune` | Junction: Uranus → Neptune | Systems | Junction: Saturn → Uranus, Natah | — | — | Junction: Neptune → Pluto, The Index, The Second Dream | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `junction_neptune_pluto` | Junction: Neptune → Pluto | Systems | Junction: Uranus → Neptune, The Second Dream | — | — | Eris Junction: Equip a Focus Lens, Junction: Pluto → Eris, The War Within | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `junction_pluto_sedna` | Junction: Pluto → Eris | Systems | Junction: Neptune → Pluto, The War Within, Eris Junction: Equip a Focus Lens | — | — | Junction: Eris → Sedna, Patient Zero, The Jordas Precept | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); introduced Update 39 (June 25, 2025; junction path revision) |
| `system_eris_junction_focus_lens` | Eris Junction: Equip a Focus Lens | Systems | Junction: Neptune → Pluto | — | — | Arbitrations Access, Junction: Pluto → Eris | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); introduced Update 39 (June 25, 2025; Arbitrations unlock revision) |
| `junction_sedna_eris` | Junction: Eris → Sedna | Systems | Junction: Pluto → Eris, Rising Tide | — | Complete Sover Strait (Earth Proxima) | Hidden Messages | derived from matching Star Chart junction node | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); introduced Update 39 (June 25, 2025; junction path revision) |
| `junction_earth_lua` | Lua Access | Systems | The Second Dream | — | — | — | derived from Star Chart or quest progression | [wiki](https://wiki.warframe.com/w/Star_Chart); release not tagged |
| `junction_eris_kuva_fortress` | Kuva Fortress Access | Systems | The War Within | — | — | — | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/The_War_Within); release not tagged |
| `hub_relay` | Any Relay Access | Hubs | Vor's Prize | — | — | Abyssal Zone Access, Sands of Inaros, Teshin's Steel Path Honors, The Glast Gambit, The Steel Path Unlocked | manual `state.prereqs.completed` checkbox | release not tagged |
| `hub_cetus` | Cetus (Plains of Eidolon) Access | Hubs | The Teacher | — | — | Mask of the Revenant, Saya's Vigil, Visited Quill Onkko | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/The_Teacher); [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `hub_fortuna` | Fortuna (Orb Vallis) Access | Hubs | Junction: Earth → Venus | — | — | Vox Solaris | manual `state.prereqs.completed` checkbox | release not tagged |
| `hub_necralisk` | Necralisk (Deimos) Access | Hubs | Heart of Deimos | — | — | Entrati: Rank 3 (Associate), Helminth Segment (Base), Necramech: System Unlocked, Predasite Companion Access, Sanctum Anatomica Access, Vulpaphyla Companion Access | manual `state.prereqs.completed` checkbox | release not tagged |
| `hub_zariman` | Zariman (Chrysalith) Access | Hubs | Angels of the Zariman | — | — | The Holdfasts: Rank 1 (Fallen) | manual `state.prereqs.completed` checkbox | release not tagged |
| `hub_sanctum_anatomica` | Sanctum Anatomica Access | Hubs | Whispers in the Walls, Necralisk (Deimos) Access | — | — | Cavia: Rank 2 (Researcher), Helminth Segment: Coalescent, Netracells | manual `state.prereqs.completed` checkbox | release not tagged |
| `hub_hollvania` | Höllvania Central Mall Access | Hubs | The Hex | — | — | Amir Chemistry: Close, The Hex: Rank 5 (Pizza Party) | manual `state.prereqs.completed` checkbox | release not tagged |
| `hub_yuvan_peak` | Yuvan Peak Access | Hubs | Angels of the Zariman, Whispers in the Walls | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/44-0-0); introduced Update 44 (September 23, 2026) |
| `hub_pontis_tower` | Pontis Tower Access | Hubs | Uranus Proxima Access | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/43-0-0); introduced Update 43 (June 17, 2026) |
| `hub_la_cathedrale` | La Cathédrale Access | Hubs | The Old Peace | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/41-0-0); introduced Update 41 (December 10, 2025) |
| `hub_drifters_camp` | Drifter's Camp Access | Hubs | The New War | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_clan_dojo_access` | Clan Dojo Access | Systems | Vor's Prize | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_steel_path` | The Steel Path Unlocked | Systems | Any Relay Access | — | Steel Path Star Chart node set complete | Teshin's Steel Path Honors, The Steel Path Circuit | derived from Star Chart node completion | [wiki](https://wiki.warframe.com/w/Steel_Path); release not tagged |
| `activity_steel_path_honors` | Teshin's Steel Path Honors | Systems | The Steel Path Unlocked, Any Relay Access | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_circuit_steel_path` | The Steel Path Circuit | Systems | The Duviri Paradox, The Steel Path Unlocked | — | — | The Steel Path Circuit (Alias) | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_circuit_sp` | The Steel Path Circuit (Alias) | Systems | The Steel Path Circuit | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_nightwave` | Nightwave Access | Systems | Vor's Prize | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_sorties` | Sorties | Systems | The War Within, Sortie / Arbitration Warframe Eligibility | — | Complete Oro (Earth) | — | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/Sortie); release not tagged |
| `activity_void_fissures` | Void Fissures | Systems | Orbiter: Void Relic Segment | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_void_storms` | Void Storms | Systems | Railjack: Ship Constructed, Call of the Tempestarii | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_the_circuit` | The Circuit | Systems | The Duviri Paradox | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_netracells` | Netracells | Systems | Sanctum Anatomica Access | — | — | Deep Archimedea | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_deep_archimedea` | Deep Archimedea | Systems | Whispers in the Walls, Cavia: Rank 5 (Illuminate), Netracells | — | — | Elite Deep Archimedea Unlocked | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_elite_deep_archimedea` | Elite Deep Archimedea Unlocked | Systems | Deep Archimedea | — | — | The Icebind | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/Elite_Deep_Archimedea); introduced Update 35.5 (March 2024) |
| `activity_temporal_archimedea` | Temporal Archimedea | Systems | The Hex, The Hex: Rank 5 (Pizza Party) | — | — | Elite Temporal Archimedea Unlocked | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/Update_38); introduced Update 38 (December 2024) |
| `activity_elite_temporal_archimedea` | Elite Temporal Archimedea Unlocked | Systems | Temporal Archimedea | — | — | The Icebind | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/psn/38-5-0); introduced Update 38 (December 2024) |
| `activity_icebind` | The Icebind | Systems | Angels of the Zariman, Whispers in the Walls | Elite Deep Archimedea Unlocked OR Elite Temporal Archimedea Unlocked | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/44-1-0); introduced Update 44.1 (October 7, 2026) |
| `activity_follies_hunt` | Follie's Hunt | Systems | Chains of Harrow | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/42-0-0); introduced Update 42 (March 26, 2026) |
| `activity_aspirant_zorba_vendor` | Aspirant Zorba Access | Systems | Chains of Harrow | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/42-0-0); introduced Update 42 (March 26, 2026) |
| `system_uranus_proxima` | Uranus Proxima Access | Railjack | Jade Shadows: Constellations | — | — | Pontis Tower Access, Scoria's Angel, The Kuva Wytch | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/43-0-0); introduced Update 43 (June 17, 2026) |
| `activity_kuva_wytch` | The Kuva Wytch | Systems | Uranus Proxima Access | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/43-0-0); introduced Update 43 (June 17, 2026) |
| `activity_scorias_angel` | Scoria's Angel | Systems | Uranus Proxima Access | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/43-0-0); introduced Update 43 (June 17, 2026) |
| `system_devils_triad_kim` | Devil's Triad KIM Access | Systems | The Old Peace | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/41-0-0); introduced Update 41 (December 10, 2025) |
| `system_dark_refractory_preview` | Opt into Dark Refractory Mission Preview | Systems | The Teacher | — | — | Dark Refractory Access | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/41-0-0); introduced Update 41 (December 10, 2025) |
| `activity_dark_refractory` | Dark Refractory Access | Systems | — | The Old Peace OR Opt into Dark Refractory Mission Preview | — | The Descendia, The Perita Rebellion | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/41-0-0); introduced Update 41 (December 10, 2025) |
| `activity_descendia` | The Descendia | Systems | Dark Refractory Access | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/41-0-0); introduced Update 41 (December 10, 2025) |
| `activity_perita_rebellion` | The Perita Rebellion | Systems | Dark Refractory Access | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/41-0-0); introduced Update 41 (December 10, 2025) |
| `system_amir_chemistry_close` | Amir Chemistry: Close | Systems | Höllvania Central Mall Access | — | — | Fables & Frontiers: Running Late | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/43-5-0); introduced Update 43.5 (August 12, 2026) |
| `activity_fables_frontiers` | Fables & Frontiers: Running Late | Systems | The Hex, The Hex Finale, The Hex: Rank 5 (Pizza Party), Amir Chemistry: Close | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/43-5-0); introduced Update 43.5 (August 12, 2026) |
| `activity_epoch_operation_taubound` | Operation: Taubound (Limited Event) | Systems | Vor's Prize | — | Available 2026-10-15 through 2026-11-17 | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/news/epoch-operation-taubound); introduced Update 44.1.2 (October 15, 2026) |
| `activity_kuva_lich` | Kuva Lich System | Systems | The War Within, Rising Tide | — | Mastery Rank 5 | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `activity_sister_of_parvos` | Sisters of Parvos System | Systems | The War Within, Call of the Tempestarii | — | Mastery Rank 5 | Hound Companion Access | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_abyssal_zone` | Abyssal Zone Access | Systems | Any Relay Access | — | — | — | any syndicate rank 2 | release not tagged |
| `activity_arbitrations` | Arbitrations Access | Systems | Eris Junction: Equip a Focus Lens, Sortie / Arbitration Warframe Eligibility | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); [wiki](https://wiki.warframe.com/w/Arbitrations); release not tagged |
| `activity_nightmare_missions` | Nightmare Missions Unlocked | Systems | Vor's Prize | — | Nightmare eligible planet node set complete | — | derived from Star Chart node completion | [wiki](https://wiki.warframe.com/w/Nightmare_Mode); release not tagged |
| `activity_thermia_fractures` | Thermia Fractures | Systems | Vox Solaris | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_invasions` | Invasions Available | Systems | Vor's Prize | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/news/vors-prize-guide); [wiki](https://wiki.warframe.com/w/Invasion); release not tagged |
| `activity_the_index` | The Index | Systems | Junction: Uranus → Neptune | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_ropalolyst` | Ropalolyst Assassination | Systems | Chimera Prologue, Junction: Deimos → Jupiter | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_defection` | Defection Missions | Systems | Junction: Mars → Phobos | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `activity_technocyte_coda` | Technocyte Coda System | Systems | The Hex, Railjack: Ship Constructed | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_personal_quarters` | Orbiter: Personal Quarters Segment | Segments | The War Within | — | — | Apostasy Prologue | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_arsenal` | Orbiter: Arsenal Segment | Segments | Vor's Prize | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_communications` | Orbiter: Communications Segment | Segments | Vor's Prize | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_codex_scanner` | Orbiter: Codex Scanner Segment | Segments | Vor's Prize | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_foundry` | Orbiter: Foundry Segment | Segments | Vor's Prize | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_modding_table` | Orbiter: Modding Segment | Segments | Vor's Prize | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_void_relic` | Orbiter: Void Relic Segment | Segments | Junction: Earth → Mars | — | — | Void Fissures | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_incubator` | Orbiter: Incubator Segment | Segments | Howl of the Kubrow | — | — | Helminth Charger Companion, Kavat Breeding, Kubrow Breeding | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_melee_upgrade` | Orbiter: Melee Upgrade Segment | Segments | Whispers in the Walls | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_helminth` | Helminth Segment (Base) | Segments | Necralisk (Deimos) Access, Entrati: Rank 3 (Associate) | — | Mastery Rank 8 | Helminth Charger Companion, Helminth Segment: Archon Shards, Helminth Segment: Invigorations | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_helminth_invigoration` | Helminth Segment: Invigorations | Segments | Helminth Segment (Base), Entrati: Rank 5 (Family) | — | Mastery Rank 8 | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_helminth_archon_shard` | Helminth Segment: Archon Shards | Segments | Helminth Segment (Base), Veilbreaker | — | — | Helminth Segment: Coalescent | manual `state.prereqs.completed` checkbox | release not tagged |
| `segment_helminth_coalescent` | Helminth Segment: Coalescent | Segments | Helminth Segment: Archon Shards, Sanctum Anatomica Access, Cavia: Rank 2 (Researcher) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_necramech_unlocked` | Necramech: System Unlocked | Necramech | Heart of Deimos, Necralisk (Deimos) Access | — | — | Necramech: Bonewidow Built, Necramech: Voidrig Built | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_necramech_voidrig` | Necramech: Voidrig Built | Necramech | Necramech: System Unlocked | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_necramech_bonewidow` | Necramech: Bonewidow Built | Necramech | Necramech: System Unlocked | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_railjack_constructed` | Railjack: Ship Constructed | Railjack | Rising Tide | — | — | Call of the Tempestarii, Nautilus Companion Access, Railjack: Intrinsics Unlocked, Technocyte Coda System, The New War, Void Storms | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_railjack_intrinsics` | Railjack: Intrinsics Unlocked | Railjack | Railjack: Ship Constructed | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_railjack_corpus_nodes` | Railjack: Corpus Proxima Access | Railjack | Call of the Tempestarii | — | — | Railjack: Void Storm Access | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_railjack_void_storms` | Railjack: Void Storm Access | Railjack | Railjack: Corpus Proxima Access | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `system_onkko_visited` | Visited Quill Onkko | Systems | The War Within, Cetus (Plains of Eidolon) Access | — | — | Chains of Harrow, Focus Schools Fully Accessible, Mote Amp Owned, The Quills: Rank 1 (Mote), Vox Solaris: Rank 1 (Operative) | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/35-5-0); [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `amp_mote` | Mote Amp Owned | Systems | Visited Quill Onkko | — | — | — | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); [official](https://www.warframe.com/en/patch-notes/pc/33-5-0); release not tagged |
| `system_operator_amp_owned` | Operator Amp Owned | Systems | — | — | — | The New War | manual `state.prereqs.completed` checkbox | [official](https://www.warframe.com/en/patch-notes/pc/33-5-0); [wiki](https://wiki.warframe.com/w/The_New_War); release not tagged |
| `system_rank30_warframe_eligible` | Sortie / Arbitration Warframe Eligibility | Systems | — | — | — | Arbitrations Access, Sorties | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/Sortie); [wiki](https://wiki.warframe.com/w/Arbitrations); release not tagged |
| `focus_system_unlocked` | Focus System Unlocked | Systems | The Second Dream | — | — | Focus School: Madurai, Focus School: Naramon, Focus School: Unairu, Focus School: Vazarin, Focus School: Zenurik | manual `state.prereqs.completed` checkbox | release not tagged |
| `focus_full_trees_unlocked` | Focus Schools Fully Accessible | Systems | Visited Quill Onkko, Saya's Vigil | — | — | — | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/Focus); release not tagged |
| `focus_school_zenurik` | Focus School: Zenurik | Systems | Focus System Unlocked | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `focus_school_vazarin` | Focus School: Vazarin | Systems | Focus System Unlocked | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `focus_school_naramon` | Focus School: Naramon | Systems | Focus System Unlocked | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `focus_school_unairu` | Focus School: Unairu | Systems | Focus System Unlocked | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `focus_school_madurai` | Focus School: Madurai | Systems | Focus System Unlocked | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_sirocco` | Operator: Sirocco Acquired | Systems | The New War | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_tier1_parts` | Amp Parts: Tier 1 | Systems | The Quills: Rank 1 (Mote) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_tier2_parts` | Amp Parts: Tier 2 | Systems | The Quills: Rank 2 (Observer) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_tier3_parts` | Amp Parts: Tier 3 | Systems | The Quills: Rank 3 (Adherent) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_tier4_parts` | Amp Parts: Tier 4 | Systems | The Quills: Rank 4 (Instrument) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_tier5_parts` | Amp Parts: Tier 5 | Systems | Vox Solaris: Rank 1 (Operative) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_tier6_parts` | Amp Parts: Tier 6 | Systems | Vox Solaris: Rank 2 (Agent) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_tier7_parts` | Amp Parts: Tier 7 | Systems | Vox Solaris: Rank 3 (Hand) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `amp_gilding_unlocked` | Amp Gilding Unlocked | Systems | — | The Quills: Rank 3 (Adherent) OR Vox Solaris: Rank 3 (Hand) | — | — | manual `state.prereqs.completed` checkbox | [wiki](https://wiki.warframe.com/w/Amp); release not tagged |
| `companion_kubrow_breeding` | Kubrow Breeding | Systems | Howl of the Kubrow, Orbiter: Incubator Segment | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `companion_kavat_breeding` | Kavat Breeding | Systems | Orbiter: Incubator Segment, Heart of Deimos | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `companion_helminth_charger` | Helminth Charger Companion | Systems | Orbiter: Incubator Segment, Helminth Segment (Base) | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `companion_moa` | MOA Companion Assembly | Systems | Vox Solaris | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `companion_hound` | Hound Companion Access | Systems | Sisters of Parvos System | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `companion_predasite` | Predasite Companion Access | Systems | Necralisk (Deimos) Access | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `companion_vulpaphyla` | Vulpaphyla Companion Access | Systems | Necralisk (Deimos) Access | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `companion_nautilus` | Nautilus Companion Access | Systems | Railjack: Ship Constructed | — | — | — | manual `state.prereqs.completed` checkbox | release not tagged |
| `syndicate_quills_rank1` | The Quills: Rank 1 (Mote) | Syndicates | Visited Quill Onkko | — | — | Amp Parts: Tier 1, The Quills: Rank 2 (Observer) | syndicate syndicate_quills rank 1 | [official](https://www.warframe.com/en/patch-notes/pc/39-0-0); release not tagged |
| `syndicate_quills_rank2` | The Quills: Rank 2 (Observer) | Syndicates | The Quills: Rank 1 (Mote) | — | — | Amp Parts: Tier 2, Mask of the Revenant, The Quills: Rank 3 (Adherent) | syndicate syndicate_quills rank 2 | [wiki](https://wiki.warframe.com/w/The_Quills); release not tagged |
| `syndicate_quills_rank3` | The Quills: Rank 3 (Adherent) | Syndicates | The Quills: Rank 2 (Observer) | — | — | Amp Gilding Unlocked, Amp Parts: Tier 3, The Quills: Rank 4 (Instrument) | syndicate syndicate_quills rank 3 | [wiki](https://wiki.warframe.com/w/The_Quills); release not tagged |
| `syndicate_quills_rank4` | The Quills: Rank 4 (Instrument) | Syndicates | The Quills: Rank 3 (Adherent) | — | — | Amp Parts: Tier 4, The Quills: Rank 5 (Architect) | syndicate syndicate_quills rank 4 | [wiki](https://wiki.warframe.com/w/The_Quills); release not tagged |
| `syndicate_quills_rank5` | The Quills: Rank 5 (Architect) | Syndicates | The Quills: Rank 4 (Instrument) | — | — | — | syndicate syndicate_quills rank 5 | [wiki](https://wiki.warframe.com/w/The_Quills); release not tagged |
| `syndicate_holdfasts_rank1` | The Holdfasts: Rank 1 (Fallen) | Syndicates | Zariman (Chrysalith) Access | — | — | The Holdfasts: Rank 2 (Watcher) | syndicate syndicate_holdfasts rank 1 | release not tagged |
| `syndicate_holdfasts_rank2` | The Holdfasts: Rank 2 (Watcher) | Syndicates | The Holdfasts: Rank 1 (Fallen) | — | — | The Holdfasts: Rank 3 (Guardian) | syndicate syndicate_holdfasts rank 2 | release not tagged |
| `syndicate_holdfasts_rank3` | The Holdfasts: Rank 3 (Guardian) | Syndicates | The Holdfasts: Rank 2 (Watcher) | — | — | The Holdfasts: Rank 4 (Seraph) | syndicate syndicate_holdfasts rank 3 | release not tagged |
| `syndicate_holdfasts_rank4` | The Holdfasts: Rank 4 (Seraph) | Syndicates | The Holdfasts: Rank 3 (Guardian) | — | — | The Holdfasts: Rank 5 (Angel) | syndicate syndicate_holdfasts rank 4 | release not tagged |
| `syndicate_holdfasts_rank5` | The Holdfasts: Rank 5 (Angel) | Syndicates | The Holdfasts: Rank 4 (Seraph) | — | — | — | syndicate syndicate_holdfasts rank 5 | release not tagged |
| `syndicate_solaris_united_rank5` | Solaris United: Rank 5 (Old Mate) | Syndicates | Vox Solaris | — | — | — | syndicate syndicate_solaris_united rank 5 | release not tagged |
| `syndicate_vox_rank1` | Vox Solaris: Rank 1 (Operative) | Syndicates | Vox Solaris, Visited Quill Onkko | — | — | Amp Parts: Tier 5, Vox Solaris: Rank 2 (Agent) | syndicate syndicate_vox_solaris rank 1 | [wiki](https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29); release not tagged |
| `syndicate_vox_rank2` | Vox Solaris: Rank 2 (Agent) | Syndicates | Vox Solaris: Rank 1 (Operative) | — | — | Amp Parts: Tier 6, Vox Solaris: Rank 3 (Hand) | syndicate syndicate_vox_solaris rank 2 | [wiki](https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29); release not tagged |
| `syndicate_vox_rank3` | Vox Solaris: Rank 3 (Hand) | Syndicates | Vox Solaris: Rank 2 (Agent) | — | — | Amp Gilding Unlocked, Amp Parts: Tier 7, Vox Solaris: Rank 4 (Instrument) | syndicate syndicate_vox_solaris rank 3 | [wiki](https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29); release not tagged |
| `syndicate_vox_rank4` | Vox Solaris: Rank 4 (Instrument) | Syndicates | Vox Solaris: Rank 3 (Hand) | — | — | Vox Solaris: Rank 5 (Shadow) | syndicate syndicate_vox_solaris rank 4 | [wiki](https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29); release not tagged |
| `syndicate_vox_rank5` | Vox Solaris: Rank 5 (Shadow) | Syndicates | Vox Solaris: Rank 4 (Instrument) | — | — | — | syndicate syndicate_vox_solaris rank 5 | [wiki](https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29); release not tagged |
| `syndicate_entrati_rank3` | Entrati: Rank 3 (Associate) | Syndicates | Necralisk (Deimos) Access | — | — | Entrati: Rank 4 (Friend), Helminth Segment (Base) | syndicate syndicate_entrati rank 3 | [wiki](https://wiki.warframe.com/w/Entrati); [official](https://www.warframe.com/en/patch-notes/pc/41-0-3); release not tagged |
| `syndicate_entrati_rank4` | Entrati: Rank 4 (Friend) | Syndicates | Entrati: Rank 3 (Associate) | — | — | Entrati: Rank 5 (Family) | syndicate syndicate_entrati rank 4 | [wiki](https://wiki.warframe.com/w/Entrati); release not tagged |
| `syndicate_entrati_rank5` | Entrati: Rank 5 (Family) | Syndicates | Entrati: Rank 4 (Friend) | — | — | Helminth Segment: Invigorations | syndicate syndicate_entrati rank 5 | [wiki](https://wiki.warframe.com/w/Entrati); [official](https://www.warframe.com/en/patch-notes/pc/41-0-3); release not tagged |
| `syndicate_cavia_rank2` | Cavia: Rank 2 (Researcher) | Syndicates | Sanctum Anatomica Access | — | — | Cavia: Rank 5 (Illuminate), Helminth Segment: Coalescent | syndicate syndicate_cavia rank 2 | release not tagged |
| `syndicate_cavia_rank5` | Cavia: Rank 5 (Illuminate) | Syndicates | Cavia: Rank 2 (Researcher) | — | — | Deep Archimedea | syndicate syndicate_cavia rank 5 | release not tagged |
| `syndicate_hex_rank5` | The Hex: Rank 5 (Pizza Party) | Syndicates | Höllvania Central Mall Access | — | — | Fables & Frontiers: Running Late, Temporal Archimedea | syndicate syndicate_hex_1999 rank 5 | release not tagged |
| `mastery_rank_5` | Mastery Rank 5 | Systems | Vor's Prize | — | — | — | mastery rank 5 | release not tagged |
| `mastery_rank_8` | Mastery Rank 8 | Systems | Vor's Prize | — | — | — | mastery rank 8 | release not tagged |
| `mastery_rank_10` | Mastery Rank 10 | Systems | Vor's Prize | — | — | — | mastery rank 10 | release not tagged |
| `mastery_rank_15` | Mastery Rank 15 | Systems | Vor's Prize | — | — | — | mastery rank 15 | release not tagged |
| `mastery_rank_30` | Mastery Rank 30 | Systems | Vor's Prize | — | — | — | mastery rank 30 | release not tagged |
