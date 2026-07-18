#!/usr/bin/env python3
"""
Maintains src/costGuesses.js — pattern-inferred estimates for AA per-rank
costs the wiki hasn't documented yet ("?" in data.src.js). Run by hand
whenever data.src.js changes:

    python wiki-sync/guess_costs.py

For each AA with at least one undocumented cost, this cross-references
OTHER fully-known AAs (same rank count, exact cost match at every rank this
AA already has a real number for) rather than ever extrapolating a single
AA's own progression alone — one AA's own numbers can look like a clean
arithmetic sequence and still be wrong (see the docstring below on why
Adamant Will's own 2/4/6/? pattern is a worse guide than its sibling Fear
Resistance's fully-known 2/4/6/9). Confidence is a direct function of how
many independent siblings corroborate the same value, never a stylistic
guess:

    high    2+ matching siblings, unanimous agreement
    medium  exactly 1 matching sibling, OR 2+ with a clear (>=66%) majority
    low     2+ matching siblings with a weak majority (50-66%), OR no
            sibling evidence at all but the gap sits BETWEEN two ranks this
            same AA already has real numbers for (interpolate_bounded_gaps)
            — bounded interpolation is a fundamentally safer bet than
            trailing extrapolation past the last known rank, since the true
            value is provably between two real numbers either way, so it's
            attempted even with zero corroborating siblings; still capped
            at "low", since it has no external evidence behind it at all
    very-low  MANUAL_GUESSES only (see below) — a human-judgment fallback
            for a slot neither of the above could reach at all, lowest
            priority of everything here
    (none)  zero matching siblings, no bounded gap, and no manual entry —
            a bad guess is worse than an honest "?"

MANUAL_GUESSES below is the one hand-maintained exception to "never a
single AA's own progression, never a stylistic guess": a short, explicit
list of curator judgment calls for the handful of slots where the
algorithm found no sibling evidence and no bounded gap at all (checked
2026-07-18 against the 11 AAs that came up empty - see the project's own
history for that review). Every entry here is ONLY ever applied as a last
resort, after guess_for_entry has already tried and failed for that exact
rank - real cross-AA evidence at ANY tier always outranks a manual guess,
and always will, even if a future data change lets the algorithm find
something for a slot listed here. Written to costGuesses.js tagged
confidence "very-low" (a real, distinct tier from the algorithm's own
high/medium/low, not a re-use of "low") specifically so the UI never
implies this came from the same kind of evidence the others did. Update
this dict by hand; nothing regenerates it.

A "matching sibling" also has to be a normal, non-decreasing cost curve —
Natural Durability's real, fully-known costs are (2,4,6,2), a cost DROP at
the final rank that's nowhere else in the dataset outside the explicitly-
documented Symphonic Aura toggle mechanic. Treating an unexplained anomaly
like that as an equally-valid reference would corrupt otherwise-solid
matches, so non-monotonic and autoRanks-toggle AAs are excluded from the
reference pool entirely (they can still be *guess targets* themselves, just
never a source other guesses lean on).

This is a diagnostic/generator, not an auto-updater of data.src.js itself:
it never touches costs — see costGuesses.js's own header for how the app
guarantees a real confirmed value always wins over a stale guess.
"""
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_SRC = HERE.parent / "data.src.js"
OUT_FILE = HERE.parent / "src" / "costGuesses.js"

DATA_CATEGORY_START = re.compile(r'^(general|archetype|special):\s*\[')
DATA_CLASS_START = re.compile(r'^"([^"]+)":\s*\[')
DATA_ENTRY_NAME = re.compile(r'name:\s*"((?:[^"\\]|\\.)*)"')
DATA_ENTRY_RANKS = re.compile(r'\branks:\s*(\d+)')
DATA_ENTRY_COSTS = re.compile(r'\bcosts:\s*\[([^\]]*)\]')
DATA_ENTRY_AUTO = re.compile(r'\bauto:\s*true')
DATA_ENTRY_AUTORANKS = re.compile(r'\bautoRanks:\s*\d+')

HIGH_MIN_SIBLINGS = 2
MEDIUM_MAJORITY = 2.0 / 3.0
LOW_MAJORITY = 0.5

# Hand-maintained fallback for slots the algorithm has no evidence for at
# all (no matching sibling, no bounded gap either) - see the module
# docstring for the ground rules. Keyed by AA name (unique across the
# current dataset - see wiki-sync/guess_costs.py's own tests/history if
# that ever stops being true and a name collides across classes) mapping
# to {rank_index (0-based, matching costs[]): value}. Only ever applied to
# a rank guess_for_entry itself produced nothing for.
MANUAL_GUESSES = {
    "Crafting Mastery": {1: 4, 2: 5, 3: 6, 4: 7, 5: 8},
    "First Aid": {1: 2, 2: 3, 3: 4, 4: 5, 5: 6},
    "Innate Eminence": {3: 3, 4: 3},
    "Innate Regeneration": {5: 4, 6: 5},
    "Packrat": {4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1},
    "Stoicism": {1: 3, 2: 4, 3: 5, 4: 6},
    "Spell Casting Subtlety": {1: 3, 2: 4, 3: 5, 4: 6, 5: 7},
    "Reaching Notes": {3: 8, 4: 10, 5: 12},
    "Blood Rune": {2: 4},
    "Conjurer's Efficiency": {1: 4, 2: 5, 3: 6, 4: 7},
}


def slugify(name):
    s = name.lower().replace("'", "")
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s


def parse_costs(raw):
    return [c.strip().strip('"') for c in raw.split(",") if c.strip()]


def parse_data_src():
    """Returns list of dicts: scope, className, name, ranks, costs (list of
    str, '?' for unknown), auto, autoRanks — in AA_DATA order."""
    text = DATA_SRC.read_text(encoding="utf-8")
    current_cat = None
    out = []
    for line in text.split("\n"):
        s = line.strip()
        m = DATA_CATEGORY_START.match(s)
        if m:
            current_cat = (m.group(1), None)
            continue
        m = DATA_CLASS_START.match(s)
        if m:
            current_cat = ("class", m.group(1))
            continue
        if s.startswith("classes:") or not s.startswith("{ name:"):
            continue
        nm = DATA_ENTRY_NAME.search(s)
        rk = DATA_ENTRY_RANKS.search(s)
        ct = DATA_ENTRY_COSTS.search(s)
        if not (nm and rk and ct and current_cat):
            continue
        scope, className = current_cat
        out.append({
            "scope": scope,
            "className": className,
            "name": nm.group(1),
            "ranks": int(rk.group(1)),
            "costs": parse_costs(ct.group(1)),
            "auto": bool(DATA_ENTRY_AUTO.search(s)),
            "autoRanks": bool(DATA_ENTRY_AUTORANKS.search(s)),
        })
    return out


def slug_key_for(entries, i):
    """Same auto-vs-non-auto disambiguation keys.js/assign_aa_ids.py use for
    a repeated name within one (scope, className) bucket."""
    scope, className = entries[i]["scope"], entries[i]["className"]
    bucket = [j for j, e in enumerate(entries) if e["scope"] == scope and e["className"] == className]
    names = [entries[j]["name"] for j in bucket]
    slugs = [slugify(n) for n in names]
    pos = bucket.index(i)
    base = slugs[pos]
    same = [p for p, s in enumerate(slugs) if s == base]
    if len(same) <= 1 or not entries[bucket[pos]]["auto"]:
        return base
    auto_siblings = [p for p in same if entries[bucket[p]]["auto"]]
    auto_pos = auto_siblings.index(pos)
    return f"{base}-auto" if auto_pos == 0 else f"{base}-auto-{auto_pos + 1}"


def is_monotonic(values):
    return all(values[i] <= values[i + 1] for i in range(len(values) - 1))


def interpolate_bounded_gaps(known, unknown):
    """A DIFFERENT, weaker kind of evidence than sibling matching: for an
    unknown rank strictly between two ranks THIS SAME AA already has real
    numbers for, linearly interpolate against those two anchors and floor to
    an integer - e.g. Combat Fury's (1, ?, 4, 6) has no ranks=4 sibling
    starting at 1 to corroborate against, but rank 2 is still boxed in on
    both sides by real numbers (1 and 4), floor(1 + (4-1)*0.5) = 2.

    Deliberately only for a gap with a known value on BOTH sides - bounded
    interpolation and open-ended extrapolation are not the same risk.
    Adamant Will's own (2, 4, 6, ?) has nothing after the gap to bound it;
    guessing from its own trend alone is exactly the mistake this whole
    script exists to avoid (see the module docstring) - a trailing/leading
    gap past every known value is left alone here, only sibling matching
    (or nothing) applies to it. Never returns a confidence above "low": zero
    external corroboration, purely this AA's own two endpoints."""
    if not known:
        return {}
    known_idxs = sorted(known.keys())
    result = {}
    for i in unknown:
        below = max((k for k in known_idxs if k < i), default=None)
        above = min((k for k in known_idxs if k > i), default=None)
        if below is None or above is None:
            continue
        v_below, v_above = known[below], known[above]
        frac = (i - below) / (above - below)
        result[i] = {
            "value": v_below + math.floor((v_above - v_below) * frac),
            "confidence": "low",
            "basedOn": [],
            "interpolated": True,
        }
    return result


def guess_for_entry(entry, reference_pool):
    """reference_pool: list of {ranks, values (list[int]), monotonic} for
    every OTHER fully-known, non-auto, non-autoRanks AA. Returns
    {rank_idx: {"value": int, "confidence": str, "basedOn": [names]}} for
    whichever unknown ranks got a confident-enough guess (possibly empty).
    A rank neither sibling-matching nor bounded interpolation could reach
    falls through to MANUAL_GUESSES as an absolute last resort, tagged
    confidence "very-low" with manual: True."""
    ranks = entry["ranks"]
    costs = entry["costs"]
    known = {i: int(c) for i, c in enumerate(costs) if c != "?" and i < ranks}
    unknown = [i for i, c in enumerate(costs) if c == "?" and i < ranks]
    if not unknown or not known:
        return {}

    same_rank_siblings = [r for r in reference_pool if r["ranks"] == ranks]
    monotonic_pool = [r for r in same_rank_siblings if r["monotonic"]]
    # Fall back to the non-monotonic pool only if nothing normal is
    # available at all - better than nothing, but never preferred.
    pool = monotonic_pool if monotonic_pool else same_rank_siblings

    matching = [r for r in pool if all(r["values"][i] == v for i, v in known.items())]

    result = {}
    for i in unknown:
        confidence = None
        top_value = None
        based_on = []

        if matching:
            votes = Counter(r["values"][i] for r in matching)
            top_value, top_count = votes.most_common(1)[0]
            share = top_count / len(matching)
            if len(matching) >= HIGH_MIN_SIBLINGS and top_count == len(matching):
                confidence = "high"
            elif len(matching) == 1 or share >= MEDIUM_MAJORITY:
                confidence = "medium"
            elif share > LOW_MAJORITY:
                confidence = "low"
            # else: exact tie or worse - sibling evidence doesn't clear the
            # bar, fall through to the interpolation attempt below instead
            # of giving up on this rank entirely.
            if confidence:
                based_on = sorted({r["name"] for r in matching if r["values"][i] == top_value})

        if confidence is None:
            interp = interpolate_bounded_gaps(known, [i]).get(i)
            if interp:
                top_value, confidence = interp["value"], interp["confidence"]

        manual_entry = False
        if confidence is None:
            manual = MANUAL_GUESSES.get(entry.get("name"), {})
            if i in manual:
                top_value, confidence = manual[i], "very-low"
                manual_entry = True

        if confidence is None:
            continue

        # A guess must not contradict this AA's own already-known shape:
        # never below the previous rank's (known or already-guessed) value,
        # never above the next rank's if that one's already known.
        prev_val = known.get(i - 1, result.get(i - 1, {}).get("value"))
        next_val = known.get(i + 1)
        if prev_val is not None and top_value < prev_val:
            continue
        if next_val is not None and top_value > next_val:
            continue

        entry_out = {"value": top_value, "confidence": confidence, "basedOn": based_on}
        if not based_on and confidence == "low":
            entry_out["interpolated"] = True
        if manual_entry:
            entry_out["manual"] = True
        result[i] = entry_out
    return result


def id_key(scope, className, key):
    return f"{scope}:{className or ''}:{key}"


def js_string(s):
    return json.dumps(s)


def write_output(table, stats):
    lines = []
    for idk in sorted(table.keys()):
        guesses = table[idk]
        parts = []
        for rank_idx in sorted(guesses.keys()):
            g = guesses[rank_idx]
            based_on = ", ".join(js_string(n) for n in g["basedOn"])
            interp = ", interpolated: true" if g.get("interpolated") else ""
            manual = ", manual: true" if g.get("manual") else ""
            parts.append(
                f'"{rank_idx}": {{ value: {g["value"]}, confidence: {js_string(g["confidence"])}, '
                f'basedOn: [{based_on}]{interp}{manual} }}'
            )
        lines.append(f'  {js_string(idk)}: {{ {", ".join(parts)} }}')
    body = ",\n".join(lines)
    content = (
        "// Pattern-inferred cost estimates for AAs the wiki hasn't documented\n"
        "// yet, generated by wiki-sync/guess_costs.py - see that script's\n"
        "// docstring for the actual methodology (cross-referenced sibling AAs,\n"
        "// never a single AA's own progression alone). DO NOT hand-edit; rerun\n"
        "// the generator instead, which recomputes this file from scratch every\n"
        "// time rather than merging - a guess that no longer has corroborating\n"
        "// evidence (or whose slot got confirmed in data.src.js) simply won't\n"
        "// reappear.\n"
        "//\n"
        "// Keyed exactly like aaIds.js's AA_ID_TABLE (scope:className:key), each\n"
        "// entry mapping a rank INDEX (as a string, matching that AA's costs\n"
        "// array position) to a guess. Only ever consulted by the app when the\n"
        "// real costs[i] is still \"?\" - keys.js's costGuessFor is the only\n"
        "// reader, and logic.js only calls that for a rank whose real cost\n"
        "// string is exactly \"?\". A guess never substitutes for a real cost in\n"
        "// spentPoints()/affordability math anywhere - purely a display hint.\n"
        "export const COST_GUESS_TABLE = {\n"
        f"{body}\n"
        "};\n"
    )
    with open(OUT_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


def main():
    entries = parse_data_src()

    reference_pool = []
    for i, e in enumerate(entries):
        if e["auto"] or e["autoRanks"]:
            continue
        if any(c == "?" for c in e["costs"][:e["ranks"]]):
            continue
        values = [int(c) for c in e["costs"][:e["ranks"]]]
        reference_pool.append({
            "name": e["name"],
            "ranks": e["ranks"],
            "values": values,
            "monotonic": is_monotonic(values),
        })

    table = {}
    tier_counts = Counter()
    targets = 0
    for i, e in enumerate(entries):
        if e["auto"] or e["autoRanks"]:
            continue
        if not any(c == "?" for c in e["costs"][:e["ranks"]]):
            continue
        targets += 1
        # Reference pool must exclude the entry's own OTHER ranks-matches to
        # itself, but since this entry itself has a "?" it was never added
        # to reference_pool above, so no self-exclusion needed here.
        guesses = guess_for_entry(e, reference_pool)
        if not guesses:
            continue
        key = slug_key_for(entries, i)
        idk = id_key(e["scope"], e["className"], key)
        table[idk] = guesses
        for g in guesses.values():
            tier_counts[g["confidence"]] += 1

    write_output(table, tier_counts)

    print(f"Parsed {len(entries)} AA entries, {targets} have at least one undocumented cost")
    print(f"Reference pool: {len(reference_pool)} fully-known AAs "
          f"({sum(1 for r in reference_pool if r['monotonic'])} monotonic)")
    print(f"Wrote guesses for {len(table)} AAs, {sum(len(g) for g in table.values())} individual ranks")
    print(f"  high: {tier_counts['high']}  medium: {tier_counts['medium']}  low: {tier_counts['low']}  "
          f"very-low (manual): {tier_counts['very-low']}")
    unguessed = targets - len(table)
    if unguessed:
        print(f"{unguessed} AA(s) with a \"?\" cost got no guess at all (no matching sibling, no bounded gap, no manual entry)")


if __name__ == "__main__":
    sys.exit(main())
