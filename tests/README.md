# Tests

Two kinds, both plain Python scripts (no pytest) — run each file directly and
check its exit code; every one prints `ALL PASS` on success and asserts
loudly on failure.

## Data-independent unit tests

`test_guess_costs_interpolation.py` and `test_guess_effects.py` exercise
`wiki-sync/guess_costs.py`'s and `wiki-sync/guess_effects.py`'s core logic
directly, against synthetic reference pools rather than the live dataset. No
server, no browser — just:

```
python tests/test_guess_costs_interpolation.py
python tests/test_guess_effects.py
```

This is deliberately *not* pinned to any AA's current confidence tier: the
whole point of the guessing feature is that a guess resolves away the moment
the wiki confirms the real value, so a test asserting "AA X is currently
medium-confidence" would break the instant the feature does its job. They
test the algorithms' rules instead (unanimous vs. majority voting,
bounded-vs-trailing interpolation, the manual-guess fallback and its
zero-known edge case, and — for effects specifically — multi-progression
extraction and that sibling-matching only works within an explicitly
declared group, never a coincidental text match) with hand-built inputs that
stay true regardless of what `data.src.js` says on any given day.

## Browser (Playwright) tests

`test_cost_guess.py`, `test_manual_guess.py`, `test_guess_all_tabs.py`,
`test_disclaimer_banner.py`, `test_estimated_total.py`, `test_effect_guess.py`,
`test_build_slot_migration.py`, `test_active_build_match.py`,
`test_class_rank_cap.py` drive the actual app in a real Chrome instance via
[Playwright](https://playwright.dev/python/).

**Prerequisites:**
- `pip install playwright`
- A Chrome/Chromium install on PATH (these launch with `channel="chrome"` —
  the system browser, not a Playwright-managed one, so no `playwright
  install` download step is needed if Chrome is already present)
- The app served locally on port 8743:
  ```
  python -m http.server 8743
  ```
  (run from the repo root, in a separate terminal, before the tests)

Then, from the repo root:

```
python tests/test_cost_guess.py
python tests/test_manual_guess.py
python tests/test_guess_all_tabs.py
python tests/test_disclaimer_banner.py
python tests/test_estimated_total.py
python tests/test_effect_guess.py
python tests/test_build_slot_migration.py
python tests/test_active_build_match.py
python tests/test_class_rank_cap.py
```

A few of these load a hand-crafted or hand-decoded `?build=` share code to
reach a specific scenario (an already-purchased guessed rank, a build with
several unconfirmed-cost ranks already spent, an inactive-class step) rather
than clicking through the UI to build it up live — faster, and pins the
exact scenario being tested instead of leaving it implicit in a sequence of
clicks.

Several of these tests are pinned to specific live AAs as their guessed-value
examples (`test_effect_guess.py`'s Alchemy Mastery, `test_cost_guess.py`'s
Alchemy Mastery and Combat Fury, `test_guess_all_tabs.py`'s Alchemy Mastery,
`test_manual_guess.py`'s Crafting Mastery and Spell Casting Subtlety) — a
future wiki scrape confirming one of those specific ranks will break that
test, same as it's already happened more than once (Adamant Will, Combat
Stability, and Combat Fury's effect value all resolved to real data and had
to be swapped out for a still-live example over the course of this project).
Regenerate `costGuesses.js`/`effectGuesses.js` first, then pick a fresh
example from whichever guess table still has one - see the affected test's
own comments for how the swap played out last time.

None of these are wired into CI; run them by hand after a change that
touches either guessing feature (`wiki-sync/guess_costs.py` or
`wiki-sync/guess_effects.py`, their consumers in `src/keys.js`/
`src/logic.js`/`src/render.js`, the disclaimer banner, the topbar, or
Progression's own blended running total / the plain-text export mirroring
it) before rebuilding and committing.
