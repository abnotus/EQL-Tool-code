#!/usr/bin/env python3
"""
Maintains src/effectGuesses.js — pattern-inferred estimates for the numeric
values embedded in AA effect descriptions the wiki hasn't documented yet
("?" inside a slash-separated per-rank progression, e.g. the "?" in
"Increases your critical hit chance by 1/?/5/10%."). Run by hand whenever
data.src.js changes:

    python wiki-sync/guess_effects.py

Same methodology, tier system, and never-a-single-AA's-own-progression-alone
founding rule as wiki-sync/guess_costs.py (see that script's own docstring)
— this is the same feature extended from per-rank point COSTS to per-rank
effect MAGNITUDES. Two real differences from the cost version:

1. A description can hold more than one independent progression in the same
   sentence (Adamant Will: "20/40/?/?% chance to resist charm, and 15/30/?/?%
   chance to resist mesmerization spells." is TWO separate progressions).
   Every guess is keyed by (AA, progression index in order of appearance,
   rank index), not just (AA, rank index).

2. Cost-guessing's sibling pool was every OTHER AA with a matching rank
   count - a cost curve recurring by coincidence across genuinely unrelated
   AAs is common (the game reuses cost templates a lot). An effect
   MAGNITUDE recurring across two AAs is not a coincidence worth trusting
   the same way - "10%" appearing in two unrelated descriptions doesn't
   mean anything. So sibling matching here only ever compares AAs within an
   EXPLICITLY hand-declared EFFECT_SIBLING_GROUPS entry - a human confirming
   "these AAs really are the same underlying formula" (e.g. the 8 crafting
   Mastery AAs, all "Reduces the chance of failing X recipes by 10/?/?%.")
   - never an automatic text-similarity guess at which AAs are comparable.
   Within a declared group, matching still requires genuine value
   agreement (same voting rules as costs) before producing anything above
   "very-low" - declaring a group doesn't hand out free confidence, it just
   makes comparison possible at all.

Confidence tiers (identical meaning to guess_costs.py's):

    high    2+ matching group siblings, unanimous agreement
    medium  exactly 1 matching group sibling, OR 2+ with a clear (>=66%) majority
    low     2+ matching group siblings with a weak majority (50-66%), OR no
            sibling evidence at all but the gap sits BETWEEN two ranks this
            same AA's own progression already has real numbers for
            (interpolate_bounded_gaps - same bounded-vs-trailing distinction
            as costs: a trailing gap past the last known rank never gets one)
    very-low  MANUAL_EFFECT_GUESSES only - a human-judgment fallback for a
            slot none of the above could reach, lowest priority of everything
    (none)  zero matching siblings, no bounded gap, no manual entry - a bad
            guess is worse than an honest "?"

No monotonic-exclusion filter here (unlike costs, which specifically
excludes a non-monotonic sibling like Natural Durability's real cost DROP at
its last rank) - that filter existed to reject one specific, confirmed cost
anomaly, and nothing analogous has turned up in effect data. If an anomaly
like that does turn up, add the same kind of filter then, rather than
guarding against a problem that hasn't been observed.

This is a diagnostic/generator, not an auto-updater of data.src.js itself:
it never touches descriptions - see effectGuesses.js's own header for how
the app guarantees a real confirmed value always wins over a stale guess.
"""
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    DATA_SRC, AA_IDS_SRC,
    DATA_ENTRY_NAME, DATA_ENTRY_AUTO, DATA_ENTRY_AUTORANKS,
    HIGH_MIN_SIBLINGS, MEDIUM_MAJORITY, LOW_MAJORITY,
    iter_data_entries, check_parse_sanity, slug_key_for, id_key, js_string,
    interpolate_bounded_gaps,
)

HERE = Path(__file__).resolve().parent
OUT_FILE = HERE.parent / "src" / "effectGuesses.js"

DATA_ENTRY_DESC = re.compile(r'description:\s*"((?:[^"\\]|\\.)*)"')

# Matches the exact same slash-separated progression shape as
# highlightRankValue's own regex in src/logic.js (kept in sync by hand -
# they parse the same text for the same purpose) - one or more numbers
# (optionally decimal, optionally %-suffixed) or "?" placeholders, joined by
# "/". The regex being identical isn't the whole story: this script parses
# data.src.js's RAW description text, while highlightRankValue parses
# escapeHtml's OUTPUT - a different string. escapeHtml uses '&apos;' rather
# than the numeric '&#39;' specifically so that difference can never inject
# a digit sequence next to the progression it's matching (see escapeHtml's
# own comment) - if that ever changes, this comment is the reminder that
# progression indices depend on the two parsers agreeing on more than just
# their regex source.
PROGRESSION_RE = re.compile(r'\d+(?:\.\d+)?%?(?:/(?:\d+(?:\.\d+)?%?|\?)){1,}')

# Explicit, hand-verified groups of AAs whose descriptions are genuinely the
# same underlying formula (confirmed by reading them, not detected by text
# similarity - see the module docstring for why that distinction matters).
# Each entry: a list of AA names. Sibling-matching only ever compares AAs
# within the same group, at the same progression index and slot count.
EFFECT_SIBLING_GROUPS = [
    # "Reduces the chance of failing <craft> recipes by 10/?/?%." - eight
    # crafting-tradeskill AAs, identical template and identical rank-1 value.
    [
        "Alchemy Mastery", "Baking Mastery", "Blacksmithing Mastery", "Brewing Mastery",
        "Fletching Mastery", "Jewel Craft Mastery", "Pottery Mastery", "Tailoring Mastery",
    ],
    # The same AA (Quick Evacuation), present once per class list (Druid and
    # Wizard) with cosmetically different %-placement in the wiki text but
    # otherwise identical wording - genuinely the same ability, not a
    # coincidence.
    ["Quick Evacuation"],
]

# Hand-maintained fallback for slots the algorithm has no evidence for at
# all - same last-resort role as guess_costs.py's MANUAL_GUESSES. Keyed by
# (AA name, progression index) mapping to {rank_index: value}. Curator
# judgment calls made 2026-07-19 against the 14 decision points that came up
# with zero algorithmic evidence (each AA's own known values, no plausible
# sibling or bounded gap) - see the project's own history for that review
# and the 3-option candidates each was chosen from. Same precedence
# guarantee as everywhere else here: a real cross-AA match at any tier
# always outranks a manual entry, automatically, the moment one exists.
MANUAL_EFFECT_GUESSES = {
    ("Adamant Will", 0): {2: 60, 3: 80},
    ("Adamant Will", 1): {2: 45, 3: 60},
    ("Alchemy Mastery", 0): {1: 20, 2: 40},
    ("Baking Mastery", 0): {1: 20, 2: 40},
    ("Blacksmithing Mastery", 0): {1: 20, 2: 40},
    ("Brewing Mastery", 0): {1: 20, 2: 40},
    ("Fletching Mastery", 0): {1: 20, 2: 40},
    ("Jewel Craft Mastery", 0): {1: 20, 2: 40},
    ("Pottery Mastery", 0): {1: 20, 2: 40},
    ("Tailoring Mastery", 0): {1: 20, 2: 40},
    ("Combat Stability", 0): {2: 10},
    ("Innate Eminence", 0): {3: 8, 4: 10},
    ("Innate Lung Capacity", 0): {1: 20, 2: 30},
    ("Innate Metabolism", 0): {2: 140},
    ("Innate Regeneration", 0): {5: 6, 6: 7},
    ("Innate Spell Resistance", 0): {1: 4, 2: 6, 3: 8, 4: 10},
    ("Packrat", 0): {3: 20, 4: 25, 5: 30, 6: 35, 7: 40, 8: 45, 9: 50},
    ("Burst of Power", 0): {2: 15},
    ("Spell Casting Subtlety", 0): {1: 10, 2: 15, 3: 20, 4: 25, 5: 30},
    ("Banestrike", 0): {2: 6, 3: 8},
    ("Jam Fest", 0): {1: 3, 2: 5},
    ("Quick Evacuation", 0): {1: 20, 2: 30},
}


def parse_data_src():
    """Returns list of dicts: scope, className, name, description, auto,
    autoRanks — in AA_DATA order."""
    out = []
    for scope, className, s in iter_data_entries(DATA_SRC):
        nm = DATA_ENTRY_NAME.search(s)
        desc = DATA_ENTRY_DESC.search(s)
        if not (nm and desc):
            continue
        out.append({
            "scope": scope,
            "className": className,
            "name": nm.group(1),
            "description": desc.group(1),
            "auto": bool(DATA_ENTRY_AUTO.search(s)),
            "autoRanks": bool(DATA_ENTRY_AUTORANKS.search(s)),
        })
    return out


def parse_num(slot):
    """'40' -> 40, '40%' -> 40, '2.5' -> 2.5. Percent signs (and any other
    non-numeric suffix, though none has shown up yet) are stripped for
    comparison/interpolation purposes only - see write_output for why a
    guessed slot is written back as a bare number regardless of whether its
    known neighbors happened to carry a '%' of their own."""
    m = re.match(r'(\d+(?:\.\d+)?)', slot)
    v = float(m.group(1))
    return int(v) if v.is_integer() else v


def extract_progressions(description):
    """Returns a list of {"slots": [raw strings], "known": {idx: num},
    "unknown": [idx, ...]} - one entry per progression found in the
    description, in order of appearance (that order IS the progression
    index used everywhere else in this script)."""
    out = []
    for m in PROGRESSION_RE.finditer(description):
        slots = m.group(0).split("/")
        known = {i: parse_num(s) for i, s in enumerate(slots) if s != "?"}
        unknown = [i for i, s in enumerate(slots) if s == "?"]
        out.append({"slots": slots, "known": known, "unknown": unknown})
    return out


def group_for_name(name):
    for group in EFFECT_SIBLING_GROUPS:
        if name in group:
            return group
    return None


def guess_for_progression(name, prog_idx, prog, sibling_progressions):
    """sibling_progressions: list of {"name": str, "values": [num, ...]} for
    every OTHER group member's progression at this same prog_idx, already
    filtered to fully-known and matching slot count. Returns
    {rank_idx: {"value", "confidence", "basedOn"}} - mirrors
    guess_costs.py's guess_for_entry, minus the monotonic-pool distinction
    (see module docstring for why that doesn't carry over)."""
    known = prog["known"]
    unknown = prog["unknown"]
    if not unknown:
        return {}

    matching = []
    if known:
        matching = [r for r in sibling_progressions if all(r["values"][i] == v for i, v in known.items())]

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
            if confidence:
                based_on = sorted({r["name"] for r in matching if r["values"][i] == top_value})

        if confidence is None:
            interp = interpolate_bounded_gaps(known, [i]).get(i)
            if interp:
                top_value, confidence = interp["value"], interp["confidence"]

        manual_entry = False
        if confidence is None:
            manual = MANUAL_EFFECT_GUESSES.get((name, prog_idx), {})
            if i in manual:
                top_value, confidence = manual[i], "very-low"
                manual_entry = True

        if confidence is None:
            continue

        # Same own-shape sanity check as costs: never below the previous
        # rank's value, never above the next rank's, using known or
        # already-guessed neighbors.
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


def write_output(table):
    lines = []
    for idk in sorted(table.keys()):
        by_prog = table[idk]
        prog_parts = []
        for prog_idx in sorted(by_prog.keys()):
            guesses = by_prog[prog_idx]
            rank_parts = []
            for rank_idx in sorted(guesses.keys()):
                g = guesses[rank_idx]
                based_on = ", ".join(js_string(n) for n in g["basedOn"])
                interp = ", interpolated: true" if g.get("interpolated") else ""
                manual = ", manual: true" if g.get("manual") else ""
                rank_parts.append(
                    f'"{rank_idx}": {{ value: {js_string(g["value"])}, confidence: {js_string(g["confidence"])}, '
                    f'basedOn: [{based_on}]{interp}{manual} }}'
                )
            prog_parts.append(f'"{prog_idx}": {{ {", ".join(rank_parts)} }}')
        lines.append(f'  {js_string(idk)}: {{ {", ".join(prog_parts)} }}')
    body = ",\n".join(lines)
    content = (
        "// Pattern-inferred estimates for the numeric values inside AA effect\n"
        "// descriptions the wiki hasn't documented yet, generated by\n"
        "// wiki-sync/guess_effects.py - see that script's docstring for the\n"
        "// actual methodology. DO NOT hand-edit; rerun the generator instead,\n"
        "// which recomputes this file from scratch every time rather than\n"
        "// merging - a guess that no longer has corroborating evidence (or\n"
        "// whose slot got confirmed in data.src.js) simply won't reappear.\n"
        "//\n"
        "// Keyed exactly like aaIds.js's AA_ID_TABLE (scope:className:key), then\n"
        "// by progression index (order the progression appears in the\n"
        "// description, as a string) and rank index (also as a string,\n"
        "// matching that progression's slot position) to a guess. Only ever\n"
        "// consulted by the app when the real slot text is exactly \"?\" - a\n"
        "// guess never substitutes for a real value anywhere descriptions are\n"
        "// otherwise read (search, export text) - purely a display hint.\n"
        "export const EFFECT_GUESS_TABLE = {\n"
        f"{body}\n"
        "};\n"
    )
    with open(OUT_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


def main():
    entries = parse_data_src()
    check_parse_sanity(entries)

    # reference_progressions[(group_id, prog_idx, slot_count)] -> list of
    # {"name", "identity", "values"} for every fully-known progression at
    # that spot within that group. group_id is the group's own list
    # identity (id()), fine since EFFECT_SIBLING_GROUPS is a fixed
    # module-level constant. "identity" is the entry's own index into
    # entries - NOT e["name"] - because a group can (and does: Quick
    # Evacuation's Druid/Wizard copies) contain two different entries that
    # share one name. Excluding a sibling by name would exclude every
    # member of a same-named group from ever matching any other member -
    # the exact pairing that group exists to enable.
    reference_progressions = {}
    for i, e in enumerate(entries):
        if e["auto"] or e["autoRanks"]:
            continue
        group = group_for_name(e["name"])
        if not group:
            continue
        for prog_idx, prog in enumerate(extract_progressions(e["description"])):
            if prog["unknown"]:
                continue
            values = [prog["known"][j] for j in range(len(prog["slots"]))]
            key = (id(group), prog_idx, len(prog["slots"]))
            reference_progressions.setdefault(key, []).append({"name": e["name"], "identity": i, "values": values})

    table = {}
    targets = 0
    tier_counts = Counter()
    for i, e in enumerate(entries):
        if e["auto"] or e["autoRanks"]:
            continue
        progressions = extract_progressions(e["description"])
        if not any(p["unknown"] for p in progressions):
            continue
        targets += 1
        group = group_for_name(e["name"])
        by_prog = {}
        for prog_idx, prog in enumerate(progressions):
            if not prog["unknown"]:
                continue
            sibling_pool = []
            if group:
                key = (id(group), prog_idx, len(prog["slots"]))
                sibling_pool = [r for r in reference_progressions.get(key, []) if r["identity"] != i]
            guesses = guess_for_progression(e["name"], prog_idx, prog, sibling_pool)
            if guesses:
                by_prog[prog_idx] = guesses
                for g in guesses.values():
                    tier_counts[g["confidence"]] += 1
        if not by_prog:
            continue
        key = slug_key_for(entries, i)
        idk = id_key(e["scope"], e["className"], key)
        table[idk] = by_prog

    write_output(table)

    total_ranks = sum(len(g) for by_prog in table.values() for g in by_prog.values())
    print(f"Parsed {len(entries)} AA entries, {targets} have at least one undocumented effect value")
    print(f"Sibling groups: {len(EFFECT_SIBLING_GROUPS)}, reference progressions available: "
          f"{sum(len(v) for v in reference_progressions.values())}")
    print(f"Wrote guesses for {len(table)} AAs, {total_ranks} individual values")
    print(f"  high: {tier_counts['high']}  medium: {tier_counts['medium']}  low: {tier_counts['low']}  "
          f"very-low (manual): {tier_counts['very-low']}")
    unguessed = targets - len(table)
    if unguessed:
        print(f"{unguessed} AA(s) with an undocumented effect value got no guess at all "
              "(no matching sibling, no bounded gap, no manual entry)")


if __name__ == "__main__":
    sys.exit(main())
