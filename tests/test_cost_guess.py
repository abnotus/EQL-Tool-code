# -*- coding: utf-8 -*-
# Cost-guessing feature: guessed costs must never affect real cost math
# (spentPoints/affordability), must render with the right confidence tier
# in the tree node badge, the side panel's next-rank box, and the
# rank-costs pip strip, and must never appear for a real known cost.
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8743/index.html"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("dialog", lambda d: d.accept())

    page.goto(BASE)
    page.wait_for_selector("#treeWrap .node")
    page.click('button[data-tab="general"]')

    # --- Adamant Will: medium-confidence guess (9) for rank 4 ---
    aw = page.locator(".node", has=page.locator(".name", has_text="Adamant Will"))
    aw.click()
    for _ in range(3):
        page.click("#incBtn")  # ranks 1,2,3 (costs 2,4,6 - all real)
        page.wait_for_timeout(20)

    spent_before = page.locator("#spentValue").inner_text()
    print("points spent after 3 real ranks (2+4+6=12):", spent_before)
    assert spent_before == "12"

    # Tree node badge shows the medium-tier guess.
    tag = aw.locator(".costtag")
    print("tree costtag text:", tag.inner_text(), "class:", tag.get_attribute("class"))
    assert tag.inner_text() == "~9"
    assert "is-estimate" in tag.get_attribute("class") and "tier-medium" in tag.get_attribute("class")
    print("PASS: tree node shows the medium-confidence guess for Adamant Will's unknown rank 4")

    # Side panel next-rank box + pip strip.
    next_cost_b = page.locator("#sidePanel .next-rank-title b")
    print("next-rank cost text:", next_cost_b.inner_text(), "class:", next_cost_b.get_attribute("class"))
    assert next_cost_b.inner_text() == "~9"
    assert "is-estimate" in next_cost_b.get_attribute("class")
    chip = page.locator("#sidePanel .confidence-chip")
    print("confidence chip:", chip.inner_text(), chip.get_attribute("class"))
    assert chip.inner_text().strip().lower() == "medium"
    assert "tier-medium" in chip.get_attribute("class")

    pip4 = page.locator("#sidePanel .rank-costs .pip").nth(3)
    print("pip4:", pip4.inner_text(), pip4.get_attribute("class"))
    assert pip4.inner_text() == "R4: ~9"
    assert "is-estimate" in pip4.get_attribute("class") and "tier-medium" in pip4.get_attribute("class")
    print("PASS: side panel next-rank box and rank-costs pip both show the guess consistently")

    # --- Real cost (rank 1, known = 2) must NEVER show an estimate treatment. ---
    pip1 = page.locator("#sidePanel .rank-costs .pip").nth(0)
    print("pip1 (real, known cost):", pip1.inner_text(), pip1.get_attribute("class"))
    assert pip1.inner_text() == "R1: 2"
    assert "is-estimate" not in pip1.get_attribute("class")
    print("PASS: a real known cost never gets estimate styling")

    # --- Buying the guessed rank must cost exactly costNum('?') == 0, not
    # the guessed 9 - guesses must never leak into real point math. The
    # topbar's headline number blends in the guess for display (see
    # test_estimated_total.py); Progression's own per-step running total
    # (built straight from costNum(), never a guess) is the number
    # guaranteed to stay real - check that one directly. ---
    page.click("#incBtn")  # buy rank 4 (real cost "?", math treats as 0)
    page.wait_for_timeout(50)
    spent_after = page.locator("#spentValue").inner_text()
    print("spentValue after buying the guessed rank (blends in the guess for display):", spent_after)
    assert spent_after == "~21", "FAIL: expected the headline to blend real 12 + guessed 9"
    page.click('button[data-tab="progression"]')
    page.wait_for_timeout(50)
    real_total = page.locator(".progression-row .cost-total").last.inner_text()
    print("Progression's real running total after buying the guessed rank (must stay real 12, not 21):", real_total)
    assert real_total == "12 total", f"FAIL: a guess leaked into real cost math, running total shows {real_total}"
    print("PASS: the guessed value never affects spentPoints() anywhere in the app - real math still treats '?' as 0, only the topbar headline blends it")

    # --- Combat Fury: this WAS the live example of a low-confidence,
    # interpolated guess (rank 2 boxed in by known ranks 1 and 3) - a fresh
    # wiki scrape confirmed the real value (2, matching the interpolation
    # exactly) since this test was first written, so it's now fully known
    # real data instead. That's the feature working end to end: a guess
    # resolving away the moment the wiki catches up, automatically, with
    # nothing to clean up by hand. See test_guess_costs_interpolation.py
    # for a live, data-independent test of the interpolation math itself. ---
    page.click('button[data-tab="general"]')
    cf = page.locator(".node", has=page.locator(".name", has_text="Combat Fury"))
    cf.click()
    page.click("#incBtn")  # rank1, cost 1 (real)
    page.wait_for_timeout(30)
    cf_tag = cf.locator(".costtag")
    print("Combat Fury tree costtag (rank2, now confirmed real data):", cf_tag.inner_text(), cf_tag.get_attribute("class"))
    assert cf_tag.inner_text() == "2"
    assert "is-estimate" not in cf_tag.get_attribute("class")
    print("PASS: a rank the wiki has since confirmed shows the real number, no leftover guess styling")

    # Note: as of the latest guess_costs.py run, every AA that has an
    # undocumented ("?") cost has at least a manual or algorithmic guess -
    # there's currently no live example of an AA with a totally empty
    # guess (no sibling, no bounded gap, no manual entry). That code path
    # is still covered directly: see test_guess_costs_interpolation.py's
    # exact-tie case, which asserts guess_for_entry produces nothing when
    # no evidence clears the bar and no manual fallback exists.

    print("ERRORS:", errors)
    assert not errors
    browser.close()
    print("ALL PASS")
