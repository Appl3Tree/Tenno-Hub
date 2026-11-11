# World State API integration

## Audit and live sample

The production source is the public PC endpoint `https://api.warframestat.us/pc?language=en`. I inspected its JSON in the browser on 2026-11-11. That response contained 38 top-level properties, generated at `2026-11-11T14:55:15Z`, with build label `2026.10.28.09.54/8e7dGXr3Omgob8q-e55qeg`.

The committed historical sample at `external/worldstate-sample.json` was generated on March 24, 2026 and has 36 keys. The live response adds `clanWeeklyInitiative` and `descendia`. Current parser documentation also describes optional `questToConquerCancer` and `weeklyChallenges`, but neither was present in the inspected live response. The application does not synthesize either field.

The parser's documented meanings and optional fields are recorded in the [WorldState parser reference](https://wfcd.github.io/warframe-worldstate-parser/classes/lib_WorldState.WorldState.html). The live data is community-served by [WarframeStatus](https://docs.warframestat.us/). Descendia's weekly rotation and reset timing are also described in [Warframe Update 41](https://www.warframe.com/en/patch-notes/pc/41-0-0).

### Previous consumer map

| Consumer | Before | Current source |
| --- | --- | --- |
| `WorldState.tsx` | Local state, its own five-minute interval and refresh path | `useWorldStateSnapshot`; manual refresh calls the shared service |
| Topbar notification bell | Local snapshot, fetch on mount and another five-minute interval | `useWorldStateSnapshot`; reacts to the same published object |
| `WarframeResetTracker.tsx` | Local snapshot and another five-minute interval | `useWorldStateData`; reset boundary can request a forced shared refresh |
| Inventory and Requirements | One forced fetch per hook mount | Reactive `useWorldStateData` subscription |
| Relics and Relic Farming | A separate Vault Trader cache/fetch | Shared World State snapshot; Relic Farming also shows current fissure missions |
| Dashboard | `DashboardWorldState.tsx` was not mounted and had its own fetch implementation | Compact current-opportunities panel on the Dashboard using the shared hook |
| Duplicate cache | `src/worldStateCache.ts` had no imports | Removed after confirming there were no consumers |
| Duplicate trader cache | `src/lib/vaultTraderCache.ts` was reachable only through `useVaultTraderData` | Removed; the hook now selects `vaultTrader` from the shared feed |

## Shared service and freshness rules

`src/lib/worldStateCache.ts` is the one network/cache/normalization service. `src/lib/useWorldStateData.ts` exposes it with `useSyncExternalStore`.

- One timer refreshes the cache at the five-minute TTL while consumers are mounted. Multiple consumers share the same request. Stale data is shown while a refresh runs.
- Manual refresh aborts the prior request and advances a request generation. A late response from an older request cannot replace a newer snapshot.
- Failed refreshes retain the last successful data and publish the error. Failed requests retry on the ordinary five-minute cadence; reconnect and return-to-visible events refresh stale data.
- The API's `timestamp` and build label are distinct from the successful local fetch time. Both World State and Dashboard report local fetch freshness; the World State header also shows the API generation time.
- Countdown displays use local clock ticks and do not issue network requests. Activity availability is rechecked against activation/expiry timestamps while rendering, so an item drops out when its window ends between polls.
- Remote World State data is not written into the user's profile. Only explicit personal completion choices are persisted.

## Completion semantics

Invasion state from the API describes the global invasion. It does not prove that the player ran the mission. The persisted `doneInvasions` list remains a manual personal checklist. Nightwave uses `activeChallenges`; `possibleChallenges` remains available as data but is not rendered as current work.

World Events in the page and bell now select the same persisted completion arrays, so updates rerender both without remounting. Event completion uses `event:<encoded ID>:<encoded activation-or-expiry>`, which scopes a manual completion to one event occurrence. Events without an ID and activation/expiry timestamp remain visible but do not expose a manual completion toggle. The older `doneEvents` IDs are deduplicated and retained for recovery/export, but are not applied to the current event because they do not identify a rotation. The UI labels event-side progress as personal/community API progress and never infers the player's completion from those scores.

The page, Dashboard preview, and notification bell share one expiry-aware activity selector. It uses the same alert/event/Nightwave windows and the same deduplicated, open-invasion list, so activity totals no longer disagree when records expire or the API briefly contains transition duplicates. The reset tracker chooses Baro's current or next visit from the shared `voidTraders` timestamps; it uses the legacy 14-day anchor only when the API provides no usable visit window and labels that display as a prediction.

Persistence is version 9. The migration normalizes existing invasion, Nightwave, legacy event and event-instance arrays while leaving unrelated state intact. Progress Pack validation keeps the old completion fields and accepts the new optional `doneEventInstances` field; older packs without it still load.

## Live API field matrix

The matrix covers every top-level property in the inspected 38-key PC response. “Retained” means the service normalizes or preserves the field for a current feature. Empty upstream collections are handled without placeholder content.

| API field | Use in Tenno-Hub | When content is filtered or omitted |
| --- | --- | --- |
| `alerts` | Mission description, node, type, faction, levels, reward and expiry appear in Activities and the bell. | Current availability is derived from activation/expiry; no personal completion claim is added. |
| `arbitration` | Current arbitration is included in Missions. | Expired or invalid windows are omitted even when the source's `expired` flag is stale. |
| `archimedeas` | Mission variants, modifiers, deviations, risks and end time appear in Missions. | Only the current rotation is shown. |
| `archonHunt` | Hunt boss, faction, missions and expiry appear in Overview and Missions. | The timestamp window is checked at render time. |
| `buildLabel` | Warframe version appears in the World State status hint. | Retained as metadata; not treated as a user-facing activity. |
| `calendar` | 1999 calendar remains available from Overview and the reset tracker. | Only calendar events and known birthdays are presented; unrecognized nested fields are not guessed. |
| `cambionCycle` | Cambion Drift state and expiry in cycle cards. | Missing or invalid cycle objects are omitted. |
| `cetusCycle` | Cetus day/night state and expiry in cycle cards. | Missing or invalid cycle objects are omitted. |
| `clanWeeklyInitiative` | Weekly region, reward thresholds and reward names appear in Overview. | API typo `rewwards` is supported; contribution progress is not shown because the API does not provide the player's/clan's current score. |
| `conclaveChallenges` | Active challenge titles/descriptions and count appear in Overview. | Expired entries are removed and repeated challenge IDs are deduplicated. |
| `constructionProgress` | Fomorian/Razorback construction status remains in Overview. | No event is fabricated when the API reports zero/no active progress. |
| `dailyDeals` | Darvo item, discount, price, stock and expiry remain in Overview. | Expired deals are removed by their timestamp window. |
| `darkSectors` | Normalized and retained for future use. | The inspected live response had an empty array, so no empty panel is rendered. |
| `descendia` | Weekly rotation, all returned floors, challenge names, modifier/spec names and reset time appear in Overview. | Internal level paths and unique names are not displayed. |
| `duviriCycle` | Current Circuit choices and expiry remain in cycle cards. | Only actual `choices` are rendered; unknown cycle values are not inferred. |
| `earthCycle` | Earth day/night state and expiry in cycle cards. | Missing or invalid cycle objects are omitted. |
| `events` | Description, progress, milestones, rewards, location and expiry appear in Activities and the bell. | Event time window is rechecked live. Personal/community flags are displayed separately from manual completion. |
| `faceoffBonus` | Current bonus end or next bonus time appears in Overview. | An expired current window is retained only when a future `next` time exists. |
| `fissures` | Tier, node, mission, enemy, Storm/Steel Path status and expiry appear on the page and in Relic Farming. | Active windows are rechecked during display; no local copy/fetch is used in Relic Farming. |
| `flashSales` | Recent current store offers appear in Traders. | Records must have a valid current window and activation within the last 45 days. The UI does not claim a discount when only a price override is provided. |
| `globalUpgrades` | Current boosters remain in Overview. | Expired entries are removed by dates as well as source flags. |
| `invasions` | Progress, global completion, factions and both rewards appear in Activities and the bell. | API completion remains distinct from personal `doneInvasions`; duplicate transitional records are handled by the shared invasion processor. |
| `kinepage` | A recent message can appear in Overview. | Messages older than seven days are suppressed; the inspected August message was stale and not displayed in November. |
| `kuva` | Current Kuva Siphons/Floods remain in Missions. | Expired entries are removed using activation/expiry windows. |
| `news` | Recent update/Prime/stream headlines and safe external links appear in Overview. | Permanent 1970 informational links and entries outside 30 days are not news cards. Only HTTPS URLs without embedded credentials are linkable. News does not create bell notifications. |
| `nightwave` | Season/phase, active acts, descriptions, rewards and expiries appear in Activities and the bell. | Only `activeChallenges` are rendered, and expiry is rechecked; `possibleChallenges` are not treated as active. |
| `persistentEnemies` | Current Acolytes/persistent enemies remain in Activities. | Empty collections create no panel. |
| `sentientOutposts` | Current mission/location appears in Overview and the bell. | Availability uses timestamps rather than trusting stale `active:true`; the live sample's 2021 window is suppressed. |
| `simaris` | Current synthesis target remains in Overview. | No card when no target is provided. |
| `sortie` | Boss, faction, reward pool, variants and reset remain in Overview and Missions. | Expired or invalid windows are suppressed. |
| `steelPath` | Current Steel Path offering/rotation remains in Overview. | Missing current reward/rotation is handled without placeholders. |
| `syndicateMissions` | Active syndicate boards and job requirements remain in the reset tracker. | Expired boards are removed; no mission is inferred from profile progression. |
| `timestamp` | API-generation time is shown separately from local fetch time. | Invalid timestamps are cleared rather than displayed as “Invalid Date.” |
| `vallisCycle` | Orb Vallis warm/cold state and expiry in cycle cards. | Legacy `valesCycle` is accepted as a fallback alias. |
| `vaultTrader` | Varzia active state, inventory and prices remain in Overview, Traders, Inventory, Requirements and Relics. | All consumers use the shared World State snapshot; active state is recalculated from timestamps. |
| `voidTrader` | Deprecated first-trader alias is accepted for compatibility. | The service prefers `voidTraders` and derives a selected first/current projection; it is not separately fetched. |
| `voidTraders` | Authoritative Baro visits/inventory feed Overview, Traders and the bell. | Multiple entries are normalized in one response; the old singular alias is only a fallback. |
| `zarimanCycle` | Zariman cycle and expiry remain in cycle cards. | Missing or invalid cycle objects are omitted. |

The two parser-documented optional fields missing from the live response (`questToConquerCancer`, `weeklyChallenges`) are intentionally not represented as current UI state. `darkSectors` is currently empty, and legacy permanent News entries plus stale Kinepage content are filtered rather than treated as current activity.

## Automated verification

`src/lib/__tests__/fixtures/world-state-2026-11-11.json` is a realistic, versioned response fixture based on the inspected field shapes. It includes malformed/expired records, duplicate Conclave IDs, the clan `rewwards` spelling, an old Sentient Outpost flag, future alert activation, stale Kinepage, permanent News, an unsafe URL, and an unknown future field.

Coverage includes normalization, active windows, news sanitization, deduplication, optional/malformed data, shared request coalescing, TTL, late-response races, stale-data retention on failure, event occurrence identity, live Baro schedule selection, shared activity totals, store notifications/undo, and Progress Pack migration/import compatibility. The final automated run passed 346 tests across 41 files; the production build and source validator passed.

Browser verification used current live data and confirmed that event, Nightwave, and invasion completion each update in both directions between the page and bell, then undo cleanly. A manual refresh from the page updated the bell to the same fetched-at time. Dashboard and World State both displayed 23 active items from the shared selector. Checks at 390×844, 768×1024, and 1280×720 found no horizontal overflow; the mobile Activities view remained visible, and the browser console had no errors. The Dashboard reset tracker showed Baro's API-reported Friday 14:00 UTC arrival.
