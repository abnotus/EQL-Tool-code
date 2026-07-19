# -*- coding: utf-8 -*-
# Manual/curator guesses (guess_costs.py's MANUAL_GUESSES, lowest-priority
# fallback for a slot neither sibling-matching nor bounded interpolation
# could reach): must render as a distinct "very-low" confidence tier, with
# manual-specific tooltip wording, and must never affect real point math -
# same guarantees as the algorithmic tiers, just a different evidence
# source and a strictly lower confidence label.
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

    # --- Crafting Mastery: costs = [3, ?, ?, ?, ?, ?], MANUAL_GUESSES gives
    # rank2 (index 1) a value of 4, tagged very-low/manual. ---
    cm = page.locator(".node", has=page.locator(".name", has_text="Crafting Mastery"))
    cm.click()
    page.click("#incBtn")  # buy rank1, real cost 3
    page.wait_for_timeout(30)

    spent_before = page.locator("#spentValue").inner_text()
    print("points spent after rank1 (real cost 3):", spent_before)
    assert spent_before == "3"

    tag = cm.locator(".costtag")
    print("tree costtag text:", tag.inner_text(), "class:", tag.get_attribute("class"))
    assert tag.inner_text() == "~4"
    cls = tag.get_attribute("class")
    assert "is-estimate" in cls and "tier-very-low" in cls
    title = tag.get_attribute("title")
    print("tooltip:", title)
    assert "hand-picked" in title and "not derived from other AAs" in title
    print("PASS: manual guess renders very-low tier with manual-specific tooltip wording in the tree")

    # Side panel next-rank box + confidence chip + pip strip.
    next_cost_b = page.locator("#sidePanel .next-rank-title b")
    print("next-rank cost text:", next_cost_b.inner_text(), "class:", next_cost_b.get_attribute("class"))
    assert next_cost_b.inner_text() == "~4"
    chip = page.locator("#sidePanel .confidence-chip")
    print("confidence chip:", chip.inner_text(), chip.get_attribute("class"))
    assert chip.inner_text().strip().lower() == "very-low"
    assert "tier-very-low" in chip.get_attribute("class")

    pip2 = page.locator("#sidePanel .rank-costs .pip").nth(1)
    print("pip2:", pip2.inner_text(), pip2.get_attribute("class"))
    assert pip2.inner_text() == "R2: ~4"
    assert "is-estimate" in pip2.get_attribute("class") and "tier-very-low" in pip2.get_attribute("class")
    print("PASS: side panel next-rank box, confidence chip, and rank-costs pip all show very-low consistently")

    # --- Buying the manually-guessed rank must cost costNum('?') == 0, not
    # the guessed 4 - manual guesses must never leak into real point math,
    # same structural guarantee as algorithmic guesses. The headline
    # spentValue blends in the guess for display (test_estimated_total.py);
    # Progression's own running total (built straight from costNum(), never
    # a guess) is the number guaranteed to stay real - check that directly. ---
    page.click("#incBtn")  # buy rank2 (real cost "?", math treats as 0)
    page.wait_for_timeout(50)
    spent_after = page.locator("#spentValue").inner_text()
    print("spentValue after buying the manually-guessed rank (blends in the guess for display):", spent_after)
    assert spent_after == "~7", "FAIL: expected the headline to blend real 3 + guessed 4"
    page.click('button[data-tab="progression"]')
    page.wait_for_timeout(50)
    real_total = page.locator(".progression-row .cost-total").last.inner_text()
    print("Progression's real running total after buying the manually-guessed rank (must stay real 3, not 7):", real_total)
    assert real_total == "3 total", f"FAIL: a manual guess leaked into real cost math, running total shows {real_total}"
    print("PASS: the manual guess never affects spentPoints() anywhere in the app - real math still treats '?' as 0, only the topbar headline blends it")
    page.click('button[data-tab="general"]')

    # --- Innate Spell Resistance: costs = [2, ?, ?, ?, ?], only rank1 known
    # (less signal than any other manual AA) - MANUAL_GUESSES gives rank2
    # (index 1) a flat +1/rank continuation, value 3, very-low/manual. ---
    isr = page.locator(".node", has=page.locator(".name", has_text="Innate Spell Resistance"))
    isr.click()
    page.click("#incBtn")  # rank1, real cost 2
    page.wait_for_timeout(30)
    isr_tag = isr.locator(".costtag")
    print("Innate Spell Resistance rank2 tag:", isr_tag.inner_text(), isr_tag.get_attribute("class"))
    assert isr_tag.inner_text() == "~3"
    isr_cls = isr_tag.get_attribute("class")
    assert "is-estimate" in isr_cls and "tier-very-low" in isr_cls
    print("PASS: Innate Spell Resistance's manual guess renders as very-low, same as any other manual entry")

    print("ERRORS:", errors)
    assert not errors
    browser.close()
    print("ALL PASS")
