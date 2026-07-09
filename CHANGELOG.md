# Changelog

Notable changes to the EQL AA Calculator. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] - 2026-07-09

Baseline release — everything built up to this point, bundled as a starting version. Prior work wasn't versioned individually; this entry is the sum of it.

### Added
- Tri-class selection (3 dropdowns, always showing all 16 classes; picking a class already in another slot swaps the two)
- AA tree view per category (General, Archetype, 3x Class, Special) with side panel for details and rank spending
- Prerequisite, level, and affordability checks before a point can be spent, including rank-synced prereqs (e.g. Destructive Cascade needing the matching Critical Affliction rank, not just its max rank)
- Next-rank preview: side panel and an expandable row in Progression both show what the next rank upgrades to before you buy it
- **Browse All AAs** — searchable reference independent of the current build
- **Build Summary** — everything picked, grouped by category; shows running totals for flat "N per rank" AAs alongside the per-rank note
- **Progression** tab — tracks the order points were spent in, reorderable, with per-step/running-total cost, add/remove controls, and single-level undo
- Global search — highlights matches in the active tab and shows match-count badges on other tabs so matches elsewhere are visible without switching
- Export/import a build as text, or via a shareable `?build=` URL (opening the link loads the build automatically)
- Auto-granted AAs (free, level-gated, including partially-free "autoRanks" abilities like Symphonic Aura) applied automatically
- Responsive layout, keyboard-accessible AA selection
- `wiki-sync/` tool: fetches AA data from eqlwiki.com via the MediaWiki API and diffs against a saved snapshot, to catch future wiki changes without a full manual re-scrape

### Data
- AA dataset sourced from [eqlwiki.com/Alternate_Advancement](https://eqlwiki.com/Alternate_Advancement), cross-checked against in-game logs and screenshots where the wiki was silent or wrong. Values still undocumented anywhere are marked `?` and treated as 0 until confirmed.

### Architecture
- App logic authored as real ES modules under `src/`, assembled and minified into a single `app.js` by `build_minify.py` (native ES modules don't work over `file://`, and the app is meant to run by double-clicking `index.html` with no server)
- Explicit, acyclic module dependency graph: `state`/`dom` -> `logic` -> `render` -> `exportImport`/`events` -> `main`
