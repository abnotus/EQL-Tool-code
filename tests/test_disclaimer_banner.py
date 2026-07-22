# -*- coding: utf-8 -*-
# The disclaimer banner's dismiss key was bumped again (v4 -> v5) when the
# "during beta" framing (the tool isn't in beta anymore) and the "(marked ?)"
# aside were dropped from the wording - someone who already dismissed the v4
# wording should see the updated v5 text; dismissing it should set the v5 key.
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8743/index.html"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)

    # --- Fresh visit: banner shows, mentions the estimate feature. ---
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.goto(BASE)
    page.wait_for_selector("#treeWrap .node")
    banner = page.locator("#disclaimerBanner")
    print("banner visible on fresh visit:", banner.is_visible())
    assert banner.is_visible()
    text = banner.inner_text()
    print("banner text:", text)
    assert "pattern-inferred estimate" in text.lower()
    assert "effect values" in text.lower()
    page.close()

    # --- Simulate someone who already dismissed the OLD (v4) banner wording. ---
    page2 = browser.new_page(viewport={"width": 1400, "height": 900})
    page2.add_init_script("""
        localStorage.setItem('eql_aa_disclaimer_dismissed', '1');
        localStorage.setItem('eql_aa_disclaimer_dismissed_v2', '1');
        localStorage.setItem('eql_aa_disclaimer_dismissed_v3', '1');
        localStorage.setItem('eql_aa_disclaimer_dismissed_v4', '1');
    """)
    page2.goto(BASE)
    page2.wait_for_selector("#treeWrap .node")
    banner2 = page2.locator("#disclaimerBanner")
    print("banner visible for someone who dismissed the OLD (v4) key:", banner2.is_visible())
    assert banner2.is_visible(), "FAIL: a previously-dismissed user should see the updated banner"
    print("PASS: bumping the dismiss key re-surfaces the banner for returning users")

    # Dismiss it now - should set the NEW (v5) key, and hide the banner.
    page2.click("#dismissBannerBtn")
    page2.wait_for_timeout(100)
    print("banner hidden after dismiss:", banner2.is_hidden())
    assert banner2.is_hidden()
    new_key_value = page2.evaluate("localStorage.getItem('eql_aa_disclaimer_dismissed_v5')")
    print("new key value after dismiss:", new_key_value)
    assert new_key_value == "1"
    page2.close()

    # --- Reload after dismissing the new one - stays hidden. ---
    page3 = browser.new_page(viewport={"width": 1400, "height": 900})
    page3.add_init_script("""
        localStorage.setItem('eql_aa_disclaimer_dismissed', '1');
        localStorage.setItem('eql_aa_disclaimer_dismissed_v2', '1');
        localStorage.setItem('eql_aa_disclaimer_dismissed_v3', '1');
        localStorage.setItem('eql_aa_disclaimer_dismissed_v4', '1');
        localStorage.setItem('eql_aa_disclaimer_dismissed_v5', '1');
    """)
    page3.goto(BASE)
    page3.wait_for_selector("#treeWrap .node")
    banner3 = page3.locator("#disclaimerBanner")
    print("banner hidden once the new key is also dismissed:", banner3.is_hidden())
    assert banner3.is_hidden()
    print("PASS: dismissing the new banner keeps it hidden on future visits")

    browser.close()
    print("ALL PASS")
