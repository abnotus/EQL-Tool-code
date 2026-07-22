# -*- coding: utf-8 -*-
# The topbar's "Points Spent" headline number blends real + estimated costs
# (colored blue, ~199 instead of 193) when the build includes at least one
# purchased-but-unconfirmed rank with a guess - the ~ prefix and color are
# the only visible cue; the confirmed/estimated breakdown lives in the
# title tooltip only, same hover-to-disclose pattern as every other
# estimate badge in the app (no separate visible note element anymore -
# topbar is glanceable-density territory). Progression's own running total
# blends the exact same way now (it used to stay strictly real while the
# topbar blended, but a cumulative frozen through a step whose own pill
# shows a nonzero ~N estimate read as "the estimate isn't doing anything" -
# see logic.js's computeProgressionSteps for blendedCumulative). What's
# still guaranteed: spentPoints()/affordability math itself never reads a
# guess - "?" still costs exactly 0 there - proven here by the real/
# estimated split staying separately trackable (the "193 confirmed" portion
# of the tooltip) rather than the two numbers ever being silently merged
# into one indistinguishable figure.
#
# This is the exact scenario the guessed-total-freezing bug was originally
# reported against, and the user's own real build (Paladin/Monk/Shaman) -
# kept as the live fixture here specifically to keep an eye on it as future
# wiki scrapes confirm more of its still-undocumented ranks. Packrat trained
# to rank 10, its last 6 ranks (5-10) all carrying the same flat "~1" manual
# guess, mixed in with plenty of real, fully-confirmed ranks earlier in the
# click order.
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8743/index.html"
BUILD = "H4sIAAAAAAAACn2OsQ4CMQxD_yWzh0vStL3-SpWJlQExsCD-HSW9EwwI5UmuJdfJkx40BHShMXc0sDroSsM20J3GnBXqmA3FMXu-hdOIgrfQCg5p6I6pnE5LRtWWrBLdU8qW_03SmaKGrBaOVnfQjUYkTCAVpl8IlCHtNyvTjqk5PScWiCKWn8RZifCHOHJRTuxA9A_-egN0VogmSwEAAA"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("dialog", lambda d: d.accept())

    # --- Fresh page, nothing purchased: plain real number, red, no note. ---
    page.goto(BASE)
    page.wait_for_selector("#treeWrap .node")
    sv0 = page.locator("#spentValue")
    print("fresh spentValue text/class:", sv0.inner_text(), sv0.get_attribute("class"))
    assert sv0.inner_text() == "0"
    assert sv0.get_attribute("class") is None
    color0 = sv0.evaluate("el => getComputedStyle(el).color")
    assert color0 == "rgb(217, 76, 76)", f"FAIL: expected real 'spent' red, got {color0}"
    assert sv0.get_attribute("title") is None
    print("PASS: no guesses purchased -> plain real number, red, no tooltip")

    # --- Load the real build. ---
    page.goto(f"{BASE}?build={BUILD}")
    page.wait_for_selector("#treeWrap .node")
    page.wait_for_timeout(200)

    sv = page.locator("#spentValue")
    print("spentValue:", sv.inner_text(), sv.get_attribute("title"))
    assert sv.inner_text() == "~199"
    assert "is-estimate" in sv.get_attribute("class")
    color = sv.evaluate("el => getComputedStyle(el).color")
    print("spentValue computed color:", color)
    assert color == "rgb(90, 169, 230)", f"FAIL: blended headline should render blue, got {color}"
    assert sv.get_attribute("title") == "193 confirmed + 6 estimated."
    print("PASS: headline blends to ~199 in blue, full breakdown lives only in the tooltip")

    # --- Progression's own running total now blends the same way the
    # topbar does - the last row's total must match the headline exactly
    # (~199), with the same "193 confirmed + 6 estimated." breakdown in its
    # own tooltip, proving the two displays agree rather than showing two
    # different numbers for the same underlying build. ---
    page.click('button[data-tab="progression"]')
    page.wait_for_timeout(150)
    prog_total_el = page.locator(".progression-row .cost-total").last
    prog_total = prog_total_el.inner_text()
    prog_title = prog_total_el.get_attribute("title")
    print("Progression's blended running total (must match the topbar's ~199):", prog_total, "|", prog_title)
    assert prog_total == "~199 total", f"FAIL: expected Progression's total to blend to ~199 like the topbar, got {prog_total}"
    assert "is-estimate" in prog_total_el.get_attribute("class")
    assert prog_title == "193 confirmed + 6 estimated.", f"FAIL: unexpected breakdown tooltip: {prog_title}"
    print("PASS: Progression's running total blends in estimates exactly like the topbar headline does, agreeing on both the figure and its breakdown")

    # --- Packrat rank-by-rank: ranks 1-4 are its own real ranks (riding on
    # top of whatever blend, if any, is already live earlier in the click
    # order - currently none, so these render as PLAIN numbers); ranks 5-10
    # are each independently guessed. Every one of the 10 must show a total
    # exactly 1 higher than the row before it - before the blendedCumulative
    # fix, every one of Packrat's guessed-rank rows showed the SAME frozen
    # total instead, even though each row's own pill showed a nonzero ~1
    # estimate. ---
    packrat_rows = page.locator(".progression-row", has=page.locator(".step-name", has_text="Packrat"))
    totals = [packrat_rows.nth(i).locator(".cost-total").inner_text() for i in range(packrat_rows.count())]
    print("Packrat rank 1-10's running totals in order:", totals)
    expected = [f"{n} total" for n in range(190, 194)] + [f"~{n} total" for n in range(194, 200)]
    assert totals == expected, \
        f"FAIL: Packrat's running total must climb by exactly 1 every rank, real or guessed - got {totals}"
    print("PASS: the running total climbs through Packrat's real ranks and its guessed ones alike, never freezing")

    print("ERRORS:", errors)
    assert not errors
    browser.close()
    print("ALL PASS")
