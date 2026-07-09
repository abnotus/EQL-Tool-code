# EQL AA Calculator

A talent-calculator-style planner for [EverQuest Legends](https://eqlwiki.com/Alternate_Advancement) Alternate Advancement (AA) builds. Unofficial fan-made tool, not affiliated with the game.

**Live:** https://aacalc.abnotus.com

## Features

- Pick up to 3 classes (EQL's tri-class combo system) and spend points across General, Archetype, Class, and Special AAs
- Prerequisite (including rank-synced prereqs), level, and affordability checks before you can spend a point
- Next-rank preview — see what the next rank upgrades to before you buy it, in the side panel and as an expandable row in Progression
- Global search — highlights matches in the tab you're on and shows match-count badges on other tabs that have matches too
- **Browse All AAs** — a searchable reference independent of your current build
- **Build Summary** — everything you've picked, grouped by category, with running totals shown for flat "N per rank" AAs
- **Progression** tab — tracks the order you spent points in, reorderable, with per-step/running-total cost, add/remove controls, and single-level undo
- Export/import a build as text, or via a shareable URL (open the link, the build loads automatically)
- Auto-granted AAs (free, level-gated abilities, including partially-free abilities) are applied automatically
- Responsive layout, keyboard-accessible AA selection

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Data source

All AA data (costs, effects, ranks, prerequisites) is scraped from [eqlwiki.com/Alternate_Advancement](https://eqlwiki.com/Alternate_Advancement), cross-checked against in-game logs/screenshots where the wiki is silent or wrong. Values marked `?` are undocumented anywhere and treated as 0 until confirmed.

`wiki-sync/scrape_wiki.py` fetches the current AA page via the MediaWiki API and diffs it against a saved snapshot (`wiki-sync/snapshot.json`) to flag what changed on the wiki since the last check. It's run by hand, never on a schedule — see the script's docstring for usage.

## Running locally

No build tools, no server — just open `index.html` in a browser.

## Development

The app logic is authored as real ES modules under `src/` (`state.js`, `logic.js`, `dom.js`, `render.js`, `exportImport.js`, `events.js`, `main.js`). Native ES modules don't work over `file://` in Chrome, and this app is deliberately built to run by just double-clicking `index.html` with no local server — so `build_minify.py` assembles the `src/` modules back into a single classic script and minifies it, which is what `index.html` actually loads.

To make a change:

1. Edit files under `src/` (app logic), `data.src.js` (AA data), or `styles.css`.
2. Run `python build_minify.py`. This regenerates `app.src.js` (assembled, readable — generated, don't edit directly), `app.js`/`data.js` (minified, what ships), and re-stamps `index.html` with a cache-busting version hash.
3. Open `index.html` to test.

## Deployment

Hosted on GitHub Pages, served from `main` on every push.
