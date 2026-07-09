#!/usr/bin/env python3
"""
Manual, on-demand sync check against eqlwiki.com's Alternate Advancement page.
Run by hand (never on a schedule) whenever we want to check for wiki changes:

    python wiki-sync/scrape_wiki.py

Fetches the page's wikitext via the MediaWiki API (one request, no HTML
rendering load), parses every AA table, and diffs it against snapshot.json
(the last time this was run). Reports which abilities changed on the wiki
since that snapshot, then overwrites snapshot.json with the current state.

First run has no prior snapshot, so everything is reported as new baseline
and nothing is treated as a "change".

Refuses to overwrite the snapshot if parsing found 0 rows, or >20% fewer rows
than last time - both usually mean the table parser broke on a wiki markup
change, not that abilities actually vanished. Pass --accept to save anyway
if a drop that size is genuinely expected.

IMPORTANT: this only tracks ranks/costs/description as they appear in the
wiki's table cells. It does NOT track prerequisites or level requirements as
their own fields - data.src.js's `prereq`/`levelReq` are hand-derived by a
human reading the wiki's free-text description prose (e.g. "Requirements:
level 50, Divine Aura at level 1."), not extracted from a dedicated column.
So the only signal this script has for a prereq/level change is a diff in
the `description` text. If a future version of this tool ever filters
description-only diffs out as noise (e.g. to cut down on wording-only
false positives), it needs to keep flagging ones that touch a
"Requirements:" clause specifically - otherwise it goes blind to the exact
kind of drift heldRankInvalidReason (in src/logic.js) exists to catch.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

WIKI_API = "https://eqlwiki.com/api.php"
PAGE_TITLE = "Alternate_Advancement"
USER_AGENT = "EQL-AA-Calculator-DataSync/1.0 (+https://github.com/abnotus/EQL-AA-Calculator; contact: 146918937+abnotus@users.noreply.github.com)"

HERE = Path(__file__).resolve().parent
SNAPSHOT_PATH = HERE / "snapshot.json"

SECTION_MAP = {
    "General AAs": "general",
    "Archetype AAs": "archetype",
    "Special AAs": "special",
}


def fetch_page():
    url = (
        f"{WIKI_API}?action=query&titles={PAGE_TITLE}"
        "&prop=revisions&rvprop=content|ids&rvslots=main&format=json"
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    page = next(iter(data["query"]["pages"].values()))
    if "missing" in page:
        raise RuntimeError(f"Page '{PAGE_TITLE}' is missing/deleted on the wiki.")
    rev = page["revisions"][0]
    if "texthidden" in rev or "suppressed" in rev:
        raise RuntimeError(
            f"Current revision (revid {rev.get('revid', '?')}) of '{PAGE_TITLE}' has its "
            "content hidden/suppressed (RevisionDelete/oversight), so there's no wikitext "
            "to read. Check the page history on the wiki directly."
        )
    return {
        "pageid": page["pageid"],
        "revid": rev["revid"],
        "content": rev["slots"]["main"]["*"],
    }


def parse_table(block):
    rows = []
    for part in re.split(r"\n\|-\s*\n", block):
        part = part.strip()
        if not part:
            continue
        lines = [
            l for l in part.split("\n")
            if not l.startswith("{|") and not l.startswith("|}") and not l.startswith("!")
        ]
        part = "\n".join(lines).strip()
        if not part:
            continue
        if part.startswith("|"):
            part = part[1:]
        cells = [c.strip() for c in part.split("||")]
        if len(cells) >= 4:
            rows.append(cells[:4])
    return rows


def parse_sections(content):
    headers = list(re.finditer(r"^(={2,4})\s*(.+?)\s*\1\s*$", content, re.M))
    wiki = {}
    for i, m in enumerate(headers):
        title = m.group(2).strip()
        start = m.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(content)
        block = content[start:end]
        if "{|" not in block:
            continue
        if title in SECTION_MAP:
            cat = SECTION_MAP[title]
        elif title.endswith("Class AAs"):
            cat = "class:" + title[: -len(" Class AAs")]
        else:
            continue
        bucket = wiki.setdefault(cat, {})
        for name, ranks_s, cost_s, desc in parse_table(block):
            entry = {
                "ranks": ranks_s.strip(),
                "costs": [c.strip() for c in cost_s.split("/")],
                "description": desc,
            }
            bucket.setdefault(name, []).append(entry)
    return wiki


def entry_key(cat, name, idx):
    return f"{cat}::{name}::{idx}"


def flatten(wiki):
    """category:name (+index for duplicate-named rows) -> entry"""
    flat = {}
    for cat, bucket in wiki.items():
        for name, entries in bucket.items():
            for i, e in enumerate(entries):
                flat[entry_key(cat, name, i)] = e
    return flat


def load_snapshot():
    if not SNAPSHOT_PATH.exists():
        return None
    return json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))


def save_snapshot(pageid, revid, flat):
    SNAPSHOT_PATH.write_text(
        json.dumps({"pageid": pageid, "revid": revid, "abilities": flat}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def main():
    accept = "--accept" in sys.argv

    print(f"Fetching '{PAGE_TITLE}' from {WIKI_API} ...")
    page = fetch_page()
    wiki = parse_sections(page["content"])
    flat = flatten(wiki)
    total = sum(len(v) for v in wiki.values())
    print(f"Parsed {total} AA rows across {len(wiki)} categories. pageid={page['pageid']} revid={page['revid']}")

    # A wiki markup change (e.g. cells moving from "||"-separated to one-per-line)
    # can make parse_table silently return nothing instead of erroring. Refusing to
    # save in that case matters more than usual here: save_snapshot is the only copy
    # of "what the wiki said last time," and overwriting it with garbage is a step
    # that can't be undone by re-running the script.
    if total == 0:
        print(
            "\nERROR: parsed 0 AA rows. The page format probably changed and the table "
            "parser needs updating - refusing to overwrite the snapshot with this."
        )
        return 1

    prev = load_snapshot()
    if prev is not None:
        prev_total = len(prev["abilities"])
        if prev_total > 0 and total < prev_total * 0.8 and not accept:
            print(
                f"\nERROR: parsed {total} rows, down from {prev_total} in the last snapshot "
                "(>20% drop). That almost always means the parser broke on a wiki markup "
                "change, not that abilities were actually removed. Refusing to overwrite "
                "the snapshot.\nIf this drop is real and expected, re-run with --accept."
            )
            return 1

    if prev is None:
        print("\nNo prior snapshot found - this run establishes the baseline.")
        added = list(flat.keys())
        changed = []
        removed = []
    else:
        prev_abilities = prev["abilities"]
        added = [k for k in flat if k not in prev_abilities]
        removed = [k for k in prev_abilities if k not in flat]
        changed = [k for k in flat if k in prev_abilities and flat[k] != prev_abilities[k]]
        if prev["revid"] == page["revid"] and not added and not removed and not changed:
            print(f"\nNo change since last snapshot (revid {prev['revid']}).")
        else:
            print(f"\nPrevious snapshot: revid {prev['revid']} -> now revid {page['revid']}")

    if added:
        print(f"\n=== New rows since last snapshot ({len(added)}) ===")
        for k in sorted(added):
            e = flat[k]
            print(f"  {k}: ranks={e['ranks']} costs={'/'.join(e['costs'])}")
    if removed:
        print(f"\n=== Rows gone from the wiki since last snapshot ({len(removed)}) ===")
        for k in sorted(removed):
            print(f"  {k}")
    if changed:
        print(f"\n=== Changed rows since last snapshot ({len(changed)}) ===")
        for k in sorted(changed):
            print(f"  {k}")
            print(f"    was: {prev['abilities'][k]}")
            print(f"    now: {flat[k]}")

    save_snapshot(page["pageid"], page["revid"], flat)
    print(f"\nSnapshot saved to {SNAPSHOT_PATH}")


if __name__ == "__main__":
    sys.exit(main())
