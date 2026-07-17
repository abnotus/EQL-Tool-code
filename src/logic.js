// Business logic: everything that reads or derives from `state` and AA_DATA,
// plus the mutation functions for spending/refunding points. No HTML/DOM here.
// Depends only on state.js — never on render.js — so the dependency graph stays
// one-directional (render depends on logic, not the other way around).

import { state, CLASS_SLOT_KEYS, AA_CATEGORY_KEYS, saveLocal } from "./state.js";

export function costNum(c) {
  const n = parseInt(c, 10);
  return isNaN(n) ? 0 : n;
}

export function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function iconLetter(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

// Highlights the value matching the current rank inside slash-separated progressions
// in a description, e.g. "20/40/60%" at rank 2 -> "20/<mark>40</mark>/60%".
export function highlightRankValue(text, rank) {
  const escaped = escapeHtml(text);
  if (!rank || rank < 1) return escaped;
  return escaped.replace(/\d+(?:\.\d+)?%?(?:\/(?:\d+(?:\.\d+)?%?|\?)){1,}/g, (match) => {
    const parts = match.split("/");
    const idx = rank - 1;
    if (idx < 0 || idx >= parts.length) return match;
    parts[idx] = `<span class="rank-highlight">${parts[idx]}</span>`;
    return parts.join("/");
  });
}

// For descriptions phrased as a flat "N per rank" (e.g. "4 points per rank"),
// shows the total at the current rank with the per-rank amount noted alongside,
// e.g. "24 points (4 per rank)" at rank 6. Left untouched at rank <= 1, where
// total and per-rank are the same number.
export function applyPerRankTotal(text, rank) {
  if (!rank || rank < 2) return text;
  return text.replace(/(\d+(?:\.\d+)?)(%)?\s*(points?|seconds?)?\s*(chance)?\s*\(?per rank\)?/gi,
    (match, numStr, pct, unit, chanceWord) => {
      const num = parseFloat(numStr);
      const total = num * rank;
      const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
      let unitLabel = "";
      if (pct) unitLabel = "%";
      else if (unit) {
        const singular = unit.replace(/s$/i, "");
        unitLabel = " " + (total === 1 ? singular : singular + "s");
      }
      const chancePart = chanceWord ? " chance" : "";
      return `${fmt(total)}${unitLabel}${chancePart} (${fmt(num)}${pct ? "%" : ""} per rank)`;
    });
}

// Shared by the tree view, tab match badges, and Browse All — one search box,
// same matching rule everywhere it's used.
export function aaMatchesQuery(aa, query) {
  if (!query) return false;
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return aa.name.toLowerCase().includes(q) || aa.description.toLowerCase().includes(q);
}

// Count of AAs in a category matching the current search, for tab badges.
export function countMatches(catKey, query) {
  if (!query || !query.trim()) return 0;
  return getList(catKey).filter((aa) => aaMatchesQuery(aa, query)).length;
}

export function classSlotIndex(catKey) {
  const i = CLASS_SLOT_KEYS.indexOf(catKey);
  return i;
}

export function labelFor(catKey) {
  if (catKey === "general") return "General AA";
  if (catKey === "archetype") return "Archetype AA";
  if (catKey === "special") return "Special AA";
  const slot = classSlotIndex(catKey);
  if (slot >= 0) return state.selectedClasses[slot] + " AA";
  return catKey;
}

// Short form used for tab labels and Summary section headers (no " AA" suffix).
export function shortCategoryLabel(catKey) {
  if (catKey === "general") return "General";
  if (catKey === "archetype") return "Archetype";
  if (catKey === "special") return "Special";
  const slot = classSlotIndex(catKey);
  if (slot >= 0) return state.selectedClasses[slot];
  return catKey;
}

export function getList(catKey) {
  const slot = classSlotIndex(catKey);
  if (slot >= 0) return AA_DATA.classes[state.selectedClasses[slot]] || [];
  return AA_DATA[catKey] || [];
}

// Auto-granted AAs (0-cost on the wiki) are trained automatically as the character levels, no points spent.
// The wiki documents a single unlock level per ability, not per-rank breakpoints, so once unlocked these
// sit at max rank rather than trickling in one rank at a time.
//
// A separate, rarer pattern is `autoRanks: N` — only the first N ranks are free
// (e.g. Symphonic Aura: rank 1 is granted for free, rank 2+ cost real points).
// effectiveRank is the greater of the free baseline and whatever's been manually
// purchased, so the free rank(s) never need a purchaseOrder entry of their own.
export function effectiveRank(catKey, idx) {
  const aa = getList(catKey)[idx];
  if (aa && aa.auto) {
    const levelReq = parseInt(aa.levelReq, 10) || 1;
    return state.charLevel >= levelReq ? aa.ranks : 0;
  }
  const store = getRanksStore(catKey);
  const purchased = store[idx] || 0;
  if (aa && aa.autoRanks) {
    const levelReq = parseInt(aa.levelReq, 10) || 1;
    const freeRanks = state.charLevel >= levelReq ? Math.min(aa.autoRanks, aa.ranks) : 0;
    return Math.max(freeRanks, purchased);
  }
  return purchased;
}

export function getRanksStore(catKey) {
  const slot = classSlotIndex(catKey);
  if (slot >= 0) {
    const className = state.selectedClasses[slot];
    if (!state.ranks.classes[className]) state.ranks.classes[className] = {};
    return state.ranks.classes[className];
  }
  return state.ranks[catKey];
}

// Purchase-order entries key AA picks by class NAME (not slot position), since class
// names are already unique and stable — swapping which slot a class occupies shouldn't
// orphan its place in the progression list.
export function scopeForCategory(category) {
  const slot = classSlotIndex(category);
  return slot >= 0 ? "class" : category;
}

export function classNameForCategory(category) {
  const slot = classSlotIndex(category);
  return slot >= 0 ? state.selectedClasses[slot] : null;
}

export function categoryToScopeClassName(category) {
  const slot = classSlotIndex(category);
  return slot >= 0 ? { scope: "class", className: state.selectedClasses[slot] } : { scope: category, className: null };
}

export function entryKey(scope, className, idx) {
  return `${scope}|${className || ""}|${idx}`;
}

// Which category key currently displays this entry's class, or null if that class
// isn't in any of the 3 active slots right now.
export function resolveEntryCategory(entry) {
  if (entry.scope !== "class") return entry.scope;
  const slot = state.selectedClasses.indexOf(entry.className);
  return slot >= 0 ? CLASS_SLOT_KEYS[slot] : null;
}

export function pushPurchase(category, idx) {
  state.purchaseOrder.push({ scope: scopeForCategory(category), className: classNameForCategory(category), idx });
}

// Returns the removed entry and the array position it was removed from (needed to
// restore it to the same spot later), or null if no matching entry was found.
export function popLastPurchase(category, idx) {
  const scope = scopeForCategory(category);
  const className = classNameForCategory(category);
  for (let i = state.purchaseOrder.length - 1; i >= 0; i--) {
    const e = state.purchaseOrder[i];
    if (e.scope === scope && e.idx === idx && (e.className || null) === (className || null)) {
      const [entry] = state.purchaseOrder.splice(i, 1);
      return { entry, position: i };
    }
  }
  return null;
}

export function clearClassData(className) {
  delete state.ranks.classes[className];
  state.purchaseOrder = state.purchaseOrder.filter((e) => !(e.scope === "class" && e.className === className));
  lastMutation = null;
}

export function spentPoints() {
  let total = 0;
  AA_CATEGORY_KEYS.forEach((catKey) => {
    const list = getList(catKey);
    const store = getRanksStore(catKey);
    list.forEach((aa, idx) => {
      if (aa.auto) return; // automatically granted, doesn't draw from the point pool
      const r = store[idx] || 0;
      for (let i = 0; i < r; i++) total += costNum(aa.costs[i]);
    });
  });
  return total;
}

// Plain "Requires X rank N" gates the whole ability behind a fixed target rank.
// "Requires X rank 1/2/3" (matching the wiki's own phrasing for rank-synced
// prereqs, e.g. Destructive Cascade needing the matching Critical Affliction
// rank) instead requires source rank K to be gated on target rank K.
export function parsePrereqText(text) {
  if (!text) return null;
  const m = text.match(/^Requires\s+(.+?)\s+(?:rank|(?:at\s+)?level)\s+(\d+(?:\/\d+)*)\s*$/i);
  if (!m) return null;
  const ranks = m[2].split("/").map((n) => parseInt(n, 10));
  return ranks.length > 1
    ? { name: m[1].trim(), synced: true, ranks }
    : { name: m[1].trim(), synced: false, rank: ranks[0] };
}

export function resolvePrereqTarget(text, sourceCategory) {
  const parsed = parsePrereqText(text);
  if (!parsed) return null;
  // Only the source's own category plus the shared trees — a class AA's
  // prereq should never resolve against whichever *other* class happens to
  // be sitting in another slot right now. Every prereq in the data today
  // already points within its own class or at general/archetype/special;
  // widening this to the other class slots would make resolution depend on
  // which classes are currently selected, not just on the AA itself.
  const order = [];
  const seen = new Set();
  [sourceCategory, "general", "archetype", "special"].forEach((k) => {
    if (!seen.has(k)) { seen.add(k); order.push(k); }
  });
  for (const key of order) {
    const list = getList(key);
    let foundIdx = -1;
    list.forEach((aa, i) => {
      if (aa.name.toLowerCase() !== parsed.name.toLowerCase()) return;
      if (foundIdx < 0) { foundIdx = i; return; }
      // Duplicate name in this category (e.g. Cleric's two "Divine Aura"
      // rows) — prefer whichever one actually costs points over an
      // auto-granted one, since gating something behind an ability you get
      // for free regardless isn't a meaningful prerequisite. Otherwise keep
      // the first match, so resolution doesn't quietly flip if the data gets
      // reordered by a resync.
      if (list[foundIdx].auto && !aa.auto) foundIdx = i;
    });
    if (foundIdx >= 0) {
      return {
        category: key,
        idx: foundIdx,
        // Required target rank for the source AA to hold `sourceRank`. Fixed
        // prereqs ignore sourceRank; synced ones look up the matching entry
        // (clamped to the list, so a too-high/low sourceRank still resolves).
        forRank(sourceRank) {
          if (!parsed.synced) return parsed.rank;
          const i = Math.min(Math.max(sourceRank, 1), parsed.ranks.length) - 1;
          return parsed.ranks[i];
        }
      };
    }
  }
  return null;
}

// Resolves a prereq, distinguishing *why* it failed: text that doesn't match
// the expected "Requires X rank/level N" shape at all (a bug in our own
// data.src.js entry, since we write every prereq string ourselves) from text
// that parses fine but names a target that no longer exists under this
// category (the target was renamed/removed, e.g. by a resync). Both must
// block — an unverifiable prereq isn't the same as no prereq — but callers
// want different wording, since one is "fix the data" and the other is
// "the wiki/data changed."
function tryResolvePrereq(text, sourceCategory) {
  const parsed = parsePrereqText(text);
  if (!parsed) return { ok: false, malformed: true };
  const resolved = resolvePrereqTarget(text, sourceCategory);
  if (!resolved) return { ok: false, malformed: false, name: parsed.name };
  return { ok: true, resolved };
}

function unresolvedPrereqMessage(text, attempt) {
  return attempt.malformed
    ? `Prerequisite text "${text}" isn't in a recognized format — this needs fixing in the data, not the wiki.`
    : `Requires "${attempt.name}", which no longer resolves to an existing ability.`;
}

// Structural reasons (level / prerequisite) that permanently block a rank regardless of points.
// Returns { kind: "level" | "prereq", text } rather than a bare string so callers that render
// (not just report) a lock reason can tell a level-gate apart from a prerequisite-gate - the two
// need different treatment in the tree, since "level too low" is self-evidently solved by playing,
// while "needs another AA" requires the user to notice and go buy something specific elsewhere.
export function structuralLockReason(catKey, idx) {
  const aa = getList(catKey)[idx];
  const levelReq = parseInt(aa.levelReq, 10) || 1;
  if (state.charLevel < levelReq) return { kind: "level", text: `Requires character level ${levelReq}.` };
  if (aa.prereq) {
    const attempt = tryResolvePrereq(aa.prereq, catKey);
    if (!attempt.ok) return { kind: "prereq", text: unresolvedPrereqMessage(aa.prereq, attempt) };
    const resolved = attempt.resolved;
    const sourceRank = effectiveRank(catKey, idx) + 1; // the rank about to be purchased
    const requiredRank = resolved.forRank(sourceRank);
    const targetRank = effectiveRank(resolved.category, resolved.idx);
    if (targetRank < requiredRank) {
      const targetAA = getList(resolved.category)[resolved.idx];
      return { kind: "prereq", text: `Requires ${targetAA ? targetAA.name : "prerequisite"} rank ${requiredRank}.` };
    }
  }
  return null;
}

// Whether a rank the user already holds still satisfies its prerequisite
// under today's AA_DATA. Unlike structuralLockReason (which checks whether
// the NEXT rank is purchasable), this checks every rank already held — so it
// catches drift where the prereq target itself changed shape (renamed,
// resolved differently, had its own rank requirement adjusted) since the
// pick was made, even though this AA's own prereq text never changed. No
// saved history needed: it's purely a function of current state + current
// data, so it naturally clears itself once the gap is closed.
export function heldRankInvalidReason(catKey, idx) {
  const aa = getList(catKey)[idx];
  // Only ranks the user actually chose to buy are worth flagging. A fully
  // auto-granted AA has no purchased ranks at all; an autoRanks AA's raw
  // store value excludes its free floor (changeRank stores the blended
  // effective rank only once the user buys beyond that floor — see
  // changeRank), so an untouched free rank reads as 0 here, not >0. Flagging
  // something the user has no way to remove isn't actionable.
  if (!aa || !aa.prereq || aa.auto) return null;
  const purchased = getRanksStore(catKey)[idx] || 0;
  if (purchased <= 0) return null;
  const attempt = tryResolvePrereq(aa.prereq, catKey);
  if (!attempt.ok) return unresolvedPrereqMessage(aa.prereq, attempt);
  const resolved = attempt.resolved;
  const targetRank = effectiveRank(resolved.category, resolved.idx);
  for (let r = 1; r <= purchased; r++) {
    const required = resolved.forRank(r);
    if (targetRank < required) {
      const targetAA = getList(resolved.category)[resolved.idx];
      return `Rank ${r} requires ${targetAA ? targetAA.name : "a prerequisite"} rank ${required}, which you no longer have.`;
    }
  }
  return null;
}

// Every currently-held pick that fails heldRankInvalidReason, across all
// categories — for a one-time notice on load.
export function findInvalidatedPicks() {
  const results = [];
  AA_CATEGORY_KEYS.forEach((catKey) => {
    getList(catKey).forEach((aa, idx) => {
      const reason = heldRankInvalidReason(catKey, idx);
      if (reason) results.push({ category: catKey, idx, name: aa.name, reason });
    });
  });
  return results;
}

// For every AA the user holds a rank in, purchaseOrder should contain exactly
// (held rank - any free autoRanks floor, which never goes through
// purchaseOrder) entries for it, and *no* entries for an AA that isn't held
// at all (rank 0, or auto-granted). computeProgressionSteps walks
// state.purchaseOrder directly — resolving each entry's AA from AA_DATA and
// costing it — without ever consulting effectiveRank or the rank store, so
// either direction of mismatch renders wrong: a held AA with too few/many
// entries shows the wrong rank number in the Progression tab and export
// text; an orphan entry (no matching held rank at all) renders as a
// completely fabricated step, with its cost added to the running total, even
// though nothing was ever actually bought. Reachable from a crafted
// ?build= link, same threat model clampRankValue exists for.
//
// Checked directly rather than inferred from a drop count, since this can
// arise from more than just deserialization dropping something. Repairs by
// adding/removing entries for a held AA until its count matches (added at
// the end / removed from the end, so earlier purchases keep their relative
// order), and by dropping every entry for an AA that isn't held at all.
// state.ranks — the actual points spent — is never touched here; only which
// rank number a step displays and its position in the sequence can change.
export function reconcilePurchaseOrderCounts() {
  function countFor(scope, className, idx) {
    let n = 0;
    for (const e of state.purchaseOrder) {
      if (e.scope === scope && (e.className || null) === (className || null) && e.idx === idx) n++;
    }
    return n;
  }
  function expectedFor(aa, held) {
    const autoOffset = aa.autoRanks ? Math.min(aa.autoRanks, aa.ranks) : 0;
    return Math.max(0, held - autoOffset);
  }
  function key(scope, className, idx) {
    return `${scope}|${className || ""}|${idx}`;
  }

  // aa.auto entries are excluded from targets: nothing ever legitimately
  // writes a purchaseOrder entry for one (attemptIncrement refuses them
  // before changeRank runs), so they fall into the "not held" case below
  // rather than getting a count to satisfy.
  const targets = [];
  const targetKeys = new Set();
  ["general", "archetype", "special"].forEach((scope) => {
    const list = AA_DATA[scope] || [];
    Object.keys(state.ranks[scope] || {}).forEach((idxStr) => {
      const idx = parseInt(idxStr, 10);
      const aa = list[idx];
      if (aa && !aa.auto) {
        targets.push({ scope, className: null, idx, aa, held: state.ranks[scope][idxStr] });
        targetKeys.add(key(scope, null, idx));
      }
    });
  });
  Object.keys(state.ranks.classes || {}).forEach((className) => {
    const list = AA_DATA.classes[className] || [];
    Object.keys(state.ranks.classes[className] || {}).forEach((idxStr) => {
      const idx = parseInt(idxStr, 10);
      const aa = list[idx];
      if (aa && !aa.auto) {
        targets.push({ scope: "class", className, idx, aa, held: state.ranks.classes[className][idxStr] });
        targetKeys.add(key("class", className, idx));
      }
    });
  });

  let repaired = 0;

  const orphanKeys = new Set();
  state.purchaseOrder.forEach((e) => {
    const k = key(e.scope, e.className || null, e.idx);
    if (!targetKeys.has(k)) orphanKeys.add(k);
  });
  if (orphanKeys.size) {
    state.purchaseOrder = state.purchaseOrder.filter((e) => targetKeys.has(key(e.scope, e.className || null, e.idx)));
    repaired += orphanKeys.size;
  }

  targets.forEach(({ scope, className, idx, aa, held }) => {
    const expected = expectedFor(aa, held);
    const actual = countFor(scope, className, idx);
    if (expected === actual) return;
    repaired++;
    if (actual > expected) {
      let toRemove = actual - expected;
      for (let i = state.purchaseOrder.length - 1; i >= 0 && toRemove > 0; i--) {
        const e = state.purchaseOrder[i];
        if (e.scope === scope && (e.className || null) === (className || null) && e.idx === idx) {
          state.purchaseOrder.splice(i, 1);
          toRemove--;
        }
      }
    } else {
      for (let i = 0; i < expected - actual; i++) {
        state.purchaseOrder.push({ scope, className, idx });
      }
    }
  });
  return repaired;
}

// Builds a " (...)" suffix summarizing anything applyLoaded dropped and/or
// reconcilePurchaseOrderCounts repaired — "" if neither applies. Shared
// wording for the single-action load paths (share link, text import, loading
// a named build slot); the startup path in main.js assembles its own
// multi-item notice instead, since it can also be reporting on invalidated
// picks at the same time. Lives here rather than in exportImport.js (which
// first needed this) so builds.js can use it too without exportImport.js and
// builds.js importing each other.
export function loadIssuesSuffix(result, repaired) {
  const parts = [];
  if (result.droppedRanks) {
    const n = result.droppedRanks;
    parts.push(`${n} pick${n === 1 ? "" : "s"} no longer exist${n === 1 ? "s" : ""} in the current data and ${n === 1 ? "was" : "were"} skipped`);
  }
  if (repaired) {
    parts.push(`${repaired} pick${repaired === 1 ? "'s" : "s'"} purchase history was out of sync and ${repaired === 1 ? "was" : "were"} repaired`);
  }
  return parts.length ? ` (${parts.join("; ")})` : "";
}

// Full reason a rank can't be purchased right now, including affordability.
export function getBlockReason(catKey, idx) {
  const structural = structuralLockReason(catKey, idx);
  if (structural) return structural.text;
  const aa = getList(catKey)[idx];
  const rank = effectiveRank(catKey, idx);
  const nextCost = costNum(aa.costs[rank]);
  const remaining = state.totalPoints - spentPoints();
  if (remaining < nextCost) return `Not enough AA points remaining (need ${nextCost}).`;
  return null;
}

export function isDependedOn(category, idx, currentRank) {
  const newRank = currentRank - 1;
  for (const catKey of AA_CATEGORY_KEYS) {
    const list = getList(catKey);
    for (let i = 0; i < list.length; i++) {
      const aa = list[i];
      if (!aa.prereq) continue;
      const aaRank = effectiveRank(catKey, i);
      if (aaRank <= 0) continue;
      const r = resolvePrereqTarget(aa.prereq, catKey);
      if (r && r.category === category && r.idx === idx && newRank < r.forRank(aaRank)) return true;
    }
  }
  return false;
}

// Single-level undo: remembers only the most recent changeRank or moveEntry
// call, in enough detail to reverse it exactly (including restoring a removed
// entry to its original position). Overwritten by every subsequent changeRank/
// moveEntry call - including the reversal itself, so undoing twice in a row
// toggles back and forth between the two most recent arrangements rather than
// walking further back; there's no deeper history than that. Explicitly
// cleared by anything that mutates ranks/purchaseOrder without going through
// either (class swap wipe, Reset Build, Import).
let lastMutation = null;

export function clearLastMutation() {
  lastMutation = null;
}

export function canUndo() {
  return !!lastMutation;
}

// Pure state mutation, same spirit as changeRank: moves the entry at fromIdx to
// array position toIdx (both real positions, already resolved - not a drag's
// "insertion point"; render.js's callers translate drag/arrow intent into
// these first). Reversing this exact move is just calling it again with the
// two positions swapped, which is also how undoLastMutation's "reorder" case
// restores the original arrangement.
export function moveEntry(fromIdx, toIdx) {
  const [entry] = state.purchaseOrder.splice(fromIdx, 1);
  state.purchaseOrder.splice(toIdx, 0, entry);
  lastMutation = { type: "reorder", from: fromIdx, to: toIdx };
  saveLocal();
}

// The level-gated floor for an autoRanks AA: the free ranks it grants once the
// character has actually reached the level that grants them (matching
// effectiveRank's own gating), 0 below that since nothing is free yet. Shared by
// changeRank (what a refund can't go below) and attemptDecrement (the UI-facing
// gate in front of it) so the two can't drift apart the way they did before -
// changeRank alone being level-gated is invisible if the layer above it still
// blocks the refund unconditionally.
function autoFloor(aa) {
  if (!aa.autoRanks) return 0;
  const levelReq = parseInt(aa.levelReq, 10) || 1;
  return state.charLevel >= levelReq ? Math.min(aa.autoRanks, aa.ranks) : 0;
}

// Pure state mutation — no rendering, no user feedback. Returns whether a change
// actually happened, so callers (the UI layer) decide what to do about it.
export function changeRank(category, idx, delta) {
  const store = getRanksStore(category);
  const aa = getList(category)[idx];
  // For an autoRanks AA, the free ranks are a floor you can never buy below (they're
  // not "purchased" at all) — step from the current effective rank, not the raw stored
  // one. See autoFloor for why the floor itself is level-gated.
  const floor = autoFloor(aa);
  const cur = aa.autoRanks ? effectiveRank(category, idx) : (store[idx] || 0);
  const next = cur + delta;
  if (next < floor || next > aa.ranks) return false;
  // At or below the floor there's nothing left that counts as an actual purchase (the
  // floor===0 case, i.e. every non-autoRanks AA, already worked this way at next===0) -
  // without this, refunding an autoRanks AA back down to exactly its floor left a
  // phantom store entry sitting at the floor's own value forever, e.g. buying and then
  // refunding Symphonic Aura's rank 2 left store=1 persisted instead of cleared.
  if (next <= floor) delete store[idx]; else store[idx] = next;
  if (delta > 0) {
    pushPurchase(category, idx);
    // Stored as {scope, className, idx} - the same shape as a "remove" record's
    // entry - rather than the raw category (slot key). A slot key means
    // "whatever class currently occupies this slot", which stops meaning the
    // class that was actually here at purchase time the moment slots 0-2 get
    // swapped around; resolveEntryCategory below re-resolves through the
    // *current* slot assignment by className, same as undo already does for
    // "remove" records.
    const { scope, className } = categoryToScopeClassName(category);
    lastMutation = { type: "add", entry: { scope, className, idx } };
  } else {
    const popped = popLastPurchase(category, idx);
    lastMutation = popped ? { type: "remove", entry: popped.entry, position: popped.position } : null;
  }
  saveLocal();
  return true;
}

// Reverses whatever changeRank or moveEntry last did. Consumes the record
// either way, so pressing this twice in a row toggles between the last two
// arrangements rather than walking back further - see the lastMutation comment.
export function undoLastMutation() {
  const m = lastMutation;
  if (!m) return { changed: false, message: "Nothing to undo." };
  lastMutation = null;

  if (m.type === "add") {
    const category = resolveEntryCategory(m.entry);
    if (!category) return { changed: false, message: "Can't undo — that class isn't currently selected." };
    const rank = effectiveRank(category, m.entry.idx);
    if (rank <= 0) return { changed: false, message: "Nothing to undo." };
    if (isDependedOn(category, m.entry.idx, rank)) {
      return { changed: false, message: "Can't undo — another AA now depends on this rank." };
    }
    return { changed: changeRank(category, m.entry.idx, -1), message: null };
  }

  if (m.type === "reorder") {
    // The array may have changed shape since (an add/remove would have overwritten
    // this record via changeRank, but check anyway rather than trust it blindly).
    if (m.from < 0 || m.from >= state.purchaseOrder.length || m.to < 0 || m.to >= state.purchaseOrder.length) {
      return { changed: false, message: "Can't undo — the list has changed too much." };
    }
    moveEntry(m.to, m.from);
    return { changed: true, message: null };
  }

  // m.type === "remove": restore the entry to its original array position and
  // bump that AA's rank back up by one.
  const category = resolveEntryCategory(m.entry);
  if (!category) return { changed: false, message: "Can't undo — that class isn't currently selected." };
  const aa = getList(category)[m.entry.idx];
  if (!aa) return { changed: false, message: "Can't undo — that AA is no longer available." };
  const store = getRanksStore(category);
  const cur = store[m.entry.idx] || 0;
  if (cur >= aa.ranks) return { changed: false, message: "Can't undo — already at max rank." };
  store[m.entry.idx] = cur + 1;
  const pos = Math.min(m.position, state.purchaseOrder.length);
  state.purchaseOrder.splice(pos, 0, m.entry);
  saveLocal();
  return { changed: true, message: null };
}

// attemptIncrement/attemptDecrement report the outcome instead of triggering a
// render or toast themselves, so this module has no dependency on the render layer —
// dependencies only flow one way: render.js depends on logic.js, never the reverse.
export function attemptIncrement(category, idx) {
  const aa = getList(category)[idx];
  if (aa.auto) return { changed: false, message: `${aa.name} is automatically granted — no points needed.` };
  const rank = effectiveRank(category, idx);
  if (rank >= aa.ranks) return { changed: false, message: null };
  const reason = getBlockReason(category, idx);
  if (reason) return { changed: false, message: reason };
  return { changed: changeRank(category, idx, 1), message: null };
}

export function attemptDecrement(category, idx) {
  const aa = getList(category)[idx];
  if (aa.auto) return { changed: false, message: `${aa.name} is automatically granted and can't be removed.` };
  const rank = effectiveRank(category, idx);
  if (rank <= 0) return { changed: false, message: null };
  if (aa.autoRanks && rank <= autoFloor(aa)) {
    const plural = aa.autoRanks === 1 ? "rank is" : "ranks are";
    return { changed: false, message: `${aa.name}'s first ${aa.autoRanks} ${plural} automatically granted and can't be removed.` };
  }
  if (isDependedOn(category, idx, rank)) {
    return { changed: false, message: "Can't lower this — another AA depends on the current rank." };
  }
  return { changed: changeRank(category, idx, -1), message: null };
}

export function countPicked() {
  let n = 0;
  AA_CATEGORY_KEYS.forEach((catKey) => {
    getList(catKey).forEach((aa, idx) => { if (effectiveRank(catKey, idx) > 0) n++; });
  });
  return n;
}

// Shared by the Progression tab and the export text, so both always agree on
// step ranks, per-step cost, and the running cumulative total. Takes an
// explicit order (defaulting to the real state.purchaseOrder) so a caller can
// also ask "what would this look like" for a hypothetical arrangement -
// e.g. the drag-and-drop prereq indicator - without touching real state.
export function computeProgressionSteps(order = state.purchaseOrder) {
  // Total occurrences of each AA, so a step can tell whether it's the topmost
  // (and therefore the only one that can be removed without leaving a rank gap).
  const totalCounts = {};
  order.forEach((entry) => {
    const key = entryKey(entry.scope, entry.className, entry.idx);
    totalCounts[key] = (totalCounts[key] || 0) + 1;
  });

  const counts = {};
  let cumulative = 0;
  return order.map((entry, i) => {
    const key = entryKey(entry.scope, entry.className, entry.idx);
    const category = resolveEntryCategory(entry);
    const active = category !== null;
    const aa = entry.scope === "class" ? (AA_DATA.classes[entry.className] || [])[entry.idx] : (AA_DATA[entry.scope] || [])[entry.idx];
    // purchaseCount tracks how many times THIS purchase has been made (for isLast/
    // reordering bookkeeping); stepRank is the true effective rank it represents,
    // offset by any free autoRanks that never went through purchaseOrder at all.
    const purchaseCount = (counts[key] || 0) + 1;
    const autoOffset = aa && aa.autoRanks ? Math.min(aa.autoRanks, aa.ranks) : 0;
    const stepRank = purchaseCount + autoOffset;

    let prereqWarn = false;
    if (active && aa && aa.prereq) {
      const attempt = tryResolvePrereq(aa.prereq, category);
      if (!attempt.ok) {
        prereqWarn = true; // malformed or unresolvable - same "unmet" signal as elsewhere
      } else {
        const targetAA = getList(attempt.resolved.category)[attempt.resolved.idx];
        // A fully-auto target never goes through purchaseOrder at all (attemptIncrement
        // refuses to touch one), and an autoRanks target's free floor doesn't either
        // (see pushPurchase/changeRank) - counts[targetKey] alone would under- or
        // never-count it, unlike effectiveRank elsewhere in the app
        // (structuralLockReason, heldRankInvalidReason), which both fold the free
        // floor in. Mirrors the source step's own autoOffset a few lines up rather
        // than reusing effectiveRank directly, since effectiveRank reports the
        // CURRENT total rank, not "how much had been trained at this point in the
        // sequence" - purchases still need the sequence-aware count.
        const targetAutoFloor = targetAA && targetAA.auto ? targetAA.ranks
          : targetAA && targetAA.autoRanks ? Math.min(targetAA.autoRanks, targetAA.ranks)
          : 0;
        const t = categoryToScopeClassName(attempt.resolved.category);
        const targetKey = entryKey(t.scope, t.className, attempt.resolved.idx);
        const targetHeld = (counts[targetKey] || 0) + targetAutoFloor;
        if (targetHeld < attempt.resolved.forRank(stepRank)) prereqWarn = true;
      }
    }

    counts[key] = purchaseCount;
    const isLast = purchaseCount === totalCounts[key];

    const stepCost = active && aa ? costNum(aa.costs[stepRank - 1]) : 0;
    cumulative += stepCost;

    const label = entry.scope === "class" ? `${entry.className} AA` : labelFor(entry.scope);
    const name = aa ? aa.name : "(unknown AA)";

    return { index: i, aa, idx: entry.idx, category, active, stepRank, stepCost, cumulative, prereqWarn, label, name, isLast };
  });
}
