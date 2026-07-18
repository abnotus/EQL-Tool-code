# -*- coding: utf-8 -*-
# Direct, data-independent test of wiki-sync/guess_costs.py's core logic -
# doesn't depend on the live dataset staying in any particular confidence
# state (the whole feature's job is to make guesses resolve away as the
# wiki catches up, so pinning a UI test to "AA X is currently low-confidence"
# is inherently fragile; this exercises the algorithm directly instead).
import sys, importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("guess_costs", REPO / "wiki-sync" / "guess_costs.py")
gc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gc)

# --- interpolate_bounded_gaps: bounded gap gets a floor-midpoint guess,
# unbounded (trailing) gap gets nothing at all. ---
known = {0: 1, 2: 4, 3: 6}
result = gc.interpolate_bounded_gaps(known, [1])
print("bounded gap (Combat Fury's actual shape):", result)
assert result[1]["value"] == 2
assert result[1]["confidence"] == "low"
assert result[1]["interpolated"] is True
assert result[1]["basedOn"] == []

known2 = {0: 2, 1: 4, 2: 6}
result2 = gc.interpolate_bounded_gaps(known2, [3])
print("trailing/unbounded gap (Adamant Will's actual shape):", result2)
assert result2 == {}, "FAIL: a trailing gap past every known rank must never get an interpolated guess"
print("PASS: interpolate_bounded_gaps only fills a gap boxed in on both sides, never a trailing one")

# --- guess_for_entry: full pipeline, synthetic reference pool. ---
# Unanimous 2-sibling agreement -> high.
pool = [
    {"name": "Sib A", "ranks": 3, "values": [2, 4, 6], "monotonic": True},
    {"name": "Sib B", "ranks": 3, "values": [2, 4, 6], "monotonic": True},
]
entry = {"ranks": 3, "costs": ["2", "4", "?"]}
g = gc.guess_for_entry(entry, pool)
print("unanimous 2-sibling case:", g)
assert g[2]["value"] == 6 and g[2]["confidence"] == "high"

# Split siblings, clear majority -> medium.
pool2 = [
    {"name": "A", "ranks": 3, "values": [2, 4, 6], "monotonic": True},
    {"name": "B", "ranks": 3, "values": [2, 4, 6], "monotonic": True},
    {"name": "C", "ranks": 3, "values": [2, 4, 5], "monotonic": True},
]
entry2 = {"ranks": 3, "costs": ["2", "4", "?"]}
g2 = gc.guess_for_entry(entry2, pool2)
print("2-of-3 majority case:", g2)
assert g2[2]["value"] == 6 and g2[2]["confidence"] == "medium"

# A non-monotonic sibling must be excluded from the pool when a monotonic
# alternative exists - this is the exact Natural Durability situation.
pool3 = [
    {"name": "Normal sibling", "ranks": 4, "values": [2, 4, 6, 9], "monotonic": True},
    {"name": "Anomaly sibling", "ranks": 4, "values": [2, 4, 6, 2], "monotonic": False},
]
entry3 = {"ranks": 4, "costs": ["2", "4", "6", "?"]}
g3 = gc.guess_for_entry(entry3, pool3)
print("monotonic-preferred case (the real Adamant Will/Fear Resistance/Natural Durability shape):", g3)
assert g3[3]["value"] == 9, f"FAIL: the non-monotonic sibling should have been excluded, got {g3}"
assert "Anomaly sibling" not in g3[3]["basedOn"]
print("PASS: a non-monotonic sibling is excluded from the reference pool when a normal one exists")

# Exact tie -> no guess at all.
pool4 = [
    {"name": "A", "ranks": 3, "values": [2, 4, 6], "monotonic": True},
    {"name": "B", "ranks": 3, "values": [2, 4, 8], "monotonic": True},
]
entry4 = {"ranks": 3, "costs": ["2", "4", "?"]}
g4 = gc.guess_for_entry(entry4, pool4)
print("exact tie case:", g4)
assert 2 not in g4, "FAIL: an exact tie between two siblings must not produce a guess"
print("PASS: an exact tie yields no guess rather than picking one arbitrarily")

# A rank count with a sibling of the SAME rank count, but ONLY a
# non-monotonic one (no normal alternative at all) - must NOT fall back to
# using it as a match. Before this was fixed, the fallback pool would have
# included it (nothing else was available), producing a guess sourced from
# an anomalous curve.
pool5 = [
    {"name": "Only Anomaly", "ranks": 4, "values": [2, 4, 6, 2], "monotonic": False},
]
entry5 = {"ranks": 4, "costs": ["2", "4", "6", "?"]}
g5 = gc.guess_for_entry(entry5, pool5)
print("zero-monotonic-siblings case:", g5)
assert 3 not in g5, f"FAIL: a non-monotonic sibling must never be used even with no monotonic alternative, got {g5}"
print("PASS: a non-monotonic-only pool at this rank count still yields no sibling-sourced guess")

# --- MANUAL_GUESSES must be reachable even for an AA with ZERO known ranks
# of its own (the extreme evidence-free case manual exists for) - a future
# wiki resync un-confirming an AA's own rank-1 cost is exactly this
# scenario. Before this was fixed, guess_for_entry's
# `if not unknown or not known: return {}` early-returned before
# MANUAL_GUESSES was ever consulted, for every rank, unconditionally.
#
# A synthetic MANUAL_GUESSES entry, not a real AA's - pinning this to (say)
# "First Aid" would tie the test's own validity to that entry still
# existing, which is exactly the "breaks the instant the feature does its
# job" failure mode the rest of this file avoids: the day First Aid's costs
# get wiki-confirmed, its manual entry is deleted (as it should be), and a
# test asserting against it would die with a KeyError that has nothing to
# do with what's actually being tested here. Injected for this assertion's
# duration only, removed immediately after. ---
synthetic_manual = {1: 4, 3: 9}
gc.MANUAL_GUESSES["__synthetic test AA__"] = synthetic_manual
try:
    entry6 = {"name": "__synthetic test AA__", "ranks": 4, "costs": ["?", "?", "?", "?"]}
    g6 = gc.guess_for_entry(entry6, [])
    print("zero-known-ranks manual fallback case:", g6)
    assert 0 not in g6 and 2 not in g6, "FAIL: an index with no MANUAL_GUESSES entry shouldn't get one"
    for idx, value in synthetic_manual.items():
        assert g6[idx]["value"] == value and g6[idx]["confidence"] == "very-low" and g6[idx]["manual"] is True, \
            f"FAIL: manual guess for index {idx} not reached with zero known ranks, got {g6.get(idx)}"
    print("PASS: MANUAL_GUESSES is reachable even when the AA has zero known ranks of its own")
finally:
    del gc.MANUAL_GUESSES["__synthetic test AA__"]

# Same zero-known-ranks scenario, but with no MANUAL_GUESSES entry at all -
# must return {} cleanly, not crash and not invent a guess.
entry7 = {"name": "Some Totally Unmapped AA", "ranks": 3, "costs": ["?", "?", "?"]}
g7 = gc.guess_for_entry(entry7, [])
print("zero-known-ranks, no manual entry case:", g7)
assert g7 == {}, "FAIL: zero known ranks and no manual entry must yield nothing, not a crash or an invented guess"
print("PASS: zero known ranks with no manual entry yields nothing, safely")

print("ALL PASS")
