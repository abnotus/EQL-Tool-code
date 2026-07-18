# EQL AA Calculator

A talent-calculator-style planner for [EverQuest Legends](https://eqlwiki.com/Alternate_Advancement) Alternate Advancement (AA) builds. Unofficial fan-made tool, not affiliated with the game.

**Live:** https://aacalc.abnotus.com

## Features

- Pick up to 3 classes (EQL's tri-class combo system) and spend points across General, Archetype, Class, and Special AAs
- Prerequisite (including rank-synced prereqs), level, and affordability checks before you can spend a point
- Locked AAs show *why* at a glance, not just that they're locked — a missing prerequisite gets a distinct amber marker from a plain level gate, in both the tree and Browse All AAs
- Next-rank preview — see what the next rank upgrades to before you buy it, in the side panel and as an expandable row in Progression
- Global search — highlights matches in the tab you're on and shows match-count badges on other tabs that have matches too
- **Browse All AAs** — a searchable reference independent of your current build
- **Build Summary** — everything you've picked, grouped by category, with running totals shown for flat "N per rank" AAs
- **Progression** tab — tracks the order you spent points in, drag-and-drop or arrow-key reorderable (with a warning if a drop would leave a step ahead of its own prerequisite), with per-step/running-total cost, add/remove controls, and single-level undo covering adds, removes, and reorders alike
- **Waypoints** — mark a point total worth returning to, with an optional name (e.g. "Level 20") and color, and it renders as a labeled divider wherever your training order actually crosses it. Every colored waypoint's stretch of steps tints simultaneously, so a build can be color-coded into zones at a glance rather than inspected one at a time; click a chip or its divider to edit it. Anchored to a point total rather than a list position, so reordering, undo, and Reset Build never invalidate one — Reset Build keeps waypoints the same way it keeps owned progress, and they travel with the plan (named Builds, export text, share links)
- Mark AAs as **owned** (what you've actually trained in-game, as opposed to just planned) right from the Progression tab — shown with a strikethrough, undoable like any other change, with a running "points owned / to go" total in the toolbar. Owned status is tracked per character, not per plan: it lives independently of whichever build you have open, so switching Builds or loading a share link never touches it on its own. It's left out of export text/share links unless the Export modal's checkbox opts in (for moving it to another browser or sharing it); importing a build that carries owned data asks first, since applying it would overwrite your own, and declining imports just the plan. Reset Build keeps owned AAs by default; a checkbox opts into clearing them too in the same action, and a separate "Clear Owned" button on the Progression toolbar clears owned progress on its own, without touching the plan
- **Builds** — save named snapshots of your current build and switch between them later (comparing class combos, planning alternate paths), stored locally in this browser. Opening a share link or importing text offers to save your current build first if it isn't already backed up, and a share link's build is auto-saved to a reusable "Imported Build" slot so it's still easy to find after you've moved on
- Export a build as text or a shareable URL (open the link, the build loads automatically); import by pasting text directly, pasting a full exported block, or loading a saved `.txt` file
- Undocumented per-rank costs (marked `?` on the wiki) can show a pattern-inferred estimate instead — cross-referenced against other AAs with the same rank count and matching known costs, never extrapolated from one AA's own progression alone, with a color-coded confidence tier (high/medium/low) and a tooltip explaining what it's based on. Purely a display hint: an estimate never substitutes for the real cost in point-spending math, and the moment the wiki documents the real value, the estimate is superseded automatically, not by anyone remembering to remove it
- Auto-granted AAs (free, level-gated abilities, including partially-free abilities) are applied automatically
- Responsive layout, keyboard-accessible AA selection
- Saved builds stay correct even when the underlying AA data changes (a wiki resync reordering/renaming things): a pick that no longer exists gets flagged in a load-time notice instead of silently vanishing, and an AA whose prerequisite no longer resolves is highlighted directly in the tree and side panel

Player-facing version history is in the app itself — click the version tag in the bottom-right corner. For everything else, `git log` is the changelog.

Each entry added to `USER_CHANGELOG` (`src/changelogData.js`) gets a matching annotated git tag (`vX.Y.Z`, e.g. `git tag -a v1.1.0 -m "..."`) on the commit that bumped it, then `git push origin vX.Y.Z`. Lets a reported issue be pinned to a specific version.

## Data source

All AA data (costs, effects, ranks, prerequisites) lives in `data.src.js`, sourced from [eqlwiki.com/Alternate_Advancement](https://eqlwiki.com/Alternate_Advancement) and cross-checked against in-game logs/screenshots where the wiki is silent or wrong. Values marked `?` are undocumented anywhere and treated as 0 until confirmed.

### Checking for wiki changes

```
python wiki-sync/scrape_wiki.py
```

This fetches the AA page's current wikitext straight from eqlwiki's MediaWiki API (one request, no page rendering, no scraping of HTML) and compares it against `wiki-sync/snapshot.json`, the state saved the last time the script ran. It prints any rows that are new, gone, or changed since then, then overwrites the snapshot with the current state.

It's a diagnostic, not an auto-updater — it never touches `data.src.js`. The workflow is: run it, review what it reports changed, cross-check those specific entries against `data.src.js` by hand, apply any confirmed fixes, then rebuild (see below). It's run manually whenever we want to check in on the wiki, never on a schedule.

### Estimating undocumented costs

```
python wiki-sync/guess_costs.py
```

Regenerates `src/costGuesses.js` — pattern-inferred estimates for the AA per-rank costs the wiki hasn't documented yet (`?` in `data.src.js`). For each one, it cross-references *other* fully-known AAs with the same rank count and an exact match at every rank the target AA already has a real number for, rather than ever trusting a single AA's own progression alone — Adamant Will's own `2/4/6/?` looks like a clean doubling sequence that continues to 8, but its real sibling Fear Resistance (same shape, same first three costs) is fully known at `2/4/6/9`, not 8. Confidence is a direct function of how many independent siblings agree (see the script's own docstring for the exact tiers); a bounded gap with no sibling evidence at all (a rank surrounded by two of this same AA's own known costs, not past the last one) can still get a low-confidence interpolated guess — that's a fundamentally safer bet than extrapolating past the end, since the true value is provably between two real numbers either way.

Also just a diagnostic: it rewrites `costGuesses.js` from scratch every run rather than merging, so a guess that no longer has corroborating evidence (or whose slot got a real confirmed value in `data.src.js`) simply stops appearing next time it's run, no manual cleanup needed. Run it by hand after any `data.src.js` change that could plausibly move the picture (a new AA, a confirmed cost that used to be `?`).

For the handful of slots neither sibling matching nor bounded interpolation can reach at all, the script also has a small hand-maintained `MANUAL_GUESSES` dict — curator judgment calls, applied only as an absolute last resort and tagged with their own `"very-low"` confidence tier so the UI never implies they're the same kind of evidence as the algorithmic tiers. They follow the same precedence rule as everything else here: a real cross-AA match at any tier always wins over a manual entry, automatically, the moment the algorithm can produce one.

## Running locally

No build tools, no server — just open `index.html` in a browser.

## Development

The app logic is authored as real ES modules under `src/` (`aaIds.js`, `costGuesses.js`, `keys.js`, `changelogData.js`, `state.js`, `logic.js`, `builds.js`, `dom.js`, `render.js`, `exportImport.js`, `events.js`, `main.js`). Native ES modules don't work over `file://` in Chrome, and this app is deliberately built to run by just double-clicking `index.html` with no local server — so `build_minify.py` assembles the `src/` modules back into a single classic script and minifies it, which is what `index.html` actually loads.

`build_minify.py` also checks a data-integrity invariant before building (see the comment on `check_prereq_disambiguation_invariant`) and fails the build with an explanation if it's violated, rather than shipping AA data that would resolve a prerequisite unpredictably. If a build fails on this, the error message says what to fix.

### Saved builds are keyed by AA name, not array position

`state.ranks` and `purchaseOrder` address AAs by index into `AA_DATA` at runtime (simple, and every render/logic function already works that way). But that index is *not* what gets persisted to localStorage, exported text, or share links — `src/keys.js` derives a stable key from each AA's name instead, so a save survives `data.src.js` being reordered or regenerated by a fresh wiki scrape. Without this, inserting or reordering an AA would silently shift every index-based save onto the wrong ability.

`keys.js` also carries a frozen snapshot of `AA_DATA`'s ordering as of 2026-07-09 (`LEGACY_AA_ORDER`), used only to migrate saves made before this existed. It must never be updated — it's a historical record of what old saves meant, not a reflection of current data — and it can't be deleted once it feels obsolete either: a legacy save that migrates cleanly only gets rewritten in the current format on the user's next actual change, so an old save can sit unmigrated on disk indefinitely.

### Named builds don't replace the always-autosaving current build

`state.js`'s `STORAGE_KEY` keeps meaning exactly what it always has — whatever build you're currently looking at, autosaved on every change, loaded unconditionally on boot. `src/builds.js` adds named snapshots on top of that as a separate concern: saving one copies the current state into its own storage key, loading one overwrites the current state with a saved copy (which then goes on autosaving as normal). The "active build" a loaded/saved slot is associated with is tracked purely for UI display (highlighting it in the list, showing its name near the Builds button) — never trusted for anything beyond that, and explicitly cleared on Reset/Import/a share link, so a later save can't mistake unrelated content for an update to a slot it no longer corresponds to.

### Owned progress lives outside any single build

`state.owned` (the Progression tab's "actually trained in-game" watermark) persists to its own `localStorage` key (`OWNED_STORAGE_KEY`), not inside the autosaving build payload or a named Builds slot. It's loaded once at boot and is never touched by `applyLoaded` — switching Builds, loading a share link, or importing text never adds, removes, or overwrites it on its own, which is what lets owned survive flipping between two saved plans without re-syncing it into each one by hand. A build/share code can still opt into *carrying* owned data (the Export modal's checkbox), for moving your own progress to another browser or handing it to someone else — but on the way back in, `exportImport.js` checks for it explicitly and asks before applying it (`applyImportedOwned`), since silently overwriting someone's real-world progress from an untrusted paste/link is the one case here that isn't easily undone.

### A cost estimate can never outrank a real one, by construction

`src/costGuesses.js` (generated by `wiki-sync/guess_costs.py`, see above) is only ever consulted through `keys.js`'s `costGuessFor` when the real `costs[rankIdx]` is exactly `"?"` — `logic.js`'s `costNum()`/`spentPoints()` never look at it at all, so an estimate can't affect affordability or point totals no matter what. This isn't a convention someone has to remember; it's structural. The moment a real number replaces `"?"` in `data.src.js`, that slot's guess (if the generator even still has one sitting in `costGuesses.js`) is never read again — nothing to flip, nothing to delete first. A regeneration pass will eventually stop emitting the now-unreachable guess entirely, but leaving a stale one in the generated file costs nothing; it's already dead code the moment the real value lands.

To make a change:

1. Edit files under `src/` (app logic), `data.src.js` (AA data), or `styles.css`.
2. Run `python build_minify.py`. This regenerates `app.src.js` (assembled, readable — generated, don't edit directly), `app.js`/`data.js` (minified, what ships), and re-stamps `index.html` with a cache-busting version hash.
3. Open `index.html` to test.

## Deployment

Hosted on GitHub Pages, served from `main` on every push.
