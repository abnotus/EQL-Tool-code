// App-wide constants, the mutable state object, and localStorage persistence.
// Nothing here touches the DOM — that's render.js / dom.js.

import { keyForIdx, idxForKey, currentIdxForLegacyIdx, aaAt } from "./keys.js";

// A build's totalPoints is a planning input the user sets themselves, but it's
// also read from untrusted sources (a pasted share link isn't something we
// generated), so it still gets an upper bound — generous enough that no real
// build ever approaches it, tight enough that a bogus value doesn't produce
// nonsense in the UI.
export const MAX_TOTAL_POINTS = 100000;

// Bumped whenever the persisted shape changes. v4 introduced name-based keys
// for ranks/purchaseOrder (see keys.js) — anything below that is index-based
// against the frozen LEGACY_AA_ORDER snapshot and gets migrated on load.
export const SAVE_FORMAT_VERSION = 4;

export const STORAGE_KEY = "eql_aa_builder_v1";
// Owned status lives in its own key, deliberately separate from the build
// payload above - it's character-global real-world truth, not part of any
// one plan, so it must survive switching between builds/slots/share links
// untouched by any of that (see loadAndApplyOwned/saveOwned below).
export const OWNED_STORAGE_KEY = "eql_aa_owned_v1";
export const DISCLAIMER_DISMISSED_KEY = "eql_aa_disclaimer_dismissed";
export const LAST_SEEN_VERSION_KEY = "eql_aa_last_seen_version";
export const CLASS_SLOT_KEYS = ["classSlot0", "classSlot1", "classSlot2"];
// Canonical display/iteration order for the 6 real AA categories (excludes the
// Summary/Progression meta-views, which aren't AA categories).
export const AA_CATEGORY_KEYS = ["general", "archetype", ...CLASS_SLOT_KEYS, "special"];

export let state = {
  selectedClasses: [CLASS_LIST[0], CLASS_LIST[1], CLASS_LIST[2]],
  charLevel: 50,
  totalPoints: 1000,
  ranks: { general: {}, archetype: {}, special: {}, classes: {} },
  purchaseOrder: [], // [{ scope: 'general'|'archetype'|'special'|'class', className?: string, idx: number }, ...] in click order
  // Real-world "I've actually trained this" watermark, same shape as ranks
  // (idx -> highest owned rank) and deliberately identity-keyed by
  // scope/className rather than anything slot-relative, same reasoning as
  // purchaseOrder entries - it shouldn't matter which of the 3 class slots
  // a class currently occupies. Independent of ranks/purchaseOrder (the
  // *plan*): owned tracks what's actually true in-game, which is why Reset
  // Build keeps it by default instead of wiping it along with the plan, and
  // why it's persisted under its own storage key (OWNED_STORAGE_KEY) rather
  // than inside any one build's payload - loading a different build/slot/
  // share link must never overwrite or wipe it, since it isn't part of "the
  // build" at all. See loadAndApplyOwned/saveOwned.
  owned: { general: {}, archetype: {}, special: {}, classes: {} },
  // Named point-total markers ({ pts, label, color }), sorted ascending by
  // pts and deduped by pts. Unlike owned, these describe the PLAN itself ("get these
  // by 75 pts" is a statement about this ordering), so they live inside the
  // build payload/slots/share codes, not a separate global key. Anchored to
  // a point total rather than a list position or step reference on purpose -
  // a position would break under reorder/undo/reset the same way an
  // AA-identity reference would; a point total just gets re-derived against
  // whatever the current order happens to be, with zero interaction with
  // moveEntry or any of its invariants.
  waypoints: [],
  activeView: "calculator", // 'calculator' | 'browse' | 'summary' | 'progression'
  activeTab: "general", // 'general' | 'archetype' | 'classSlot0' | 'classSlot1' | 'classSlot2' | 'special'
  selectedNode: null, // { category, idx }
  browseSearch: "",
  browseFilter: "all"
};

// --- ranks/purchaseOrder <-> persisted-shape conversion -------------------
// Runtime state always addresses AAs by index into AA_DATA (simple, and every
// other module already works that way). Only these functions know that saved
// data instead uses name keys (v4+) or, for anything saved before keys.js
// existed, indexes against the frozen LEGACY_AA_ORDER snapshot.

export function serializeRanks(ranks) {
  const out = { general: {}, archetype: {}, special: {}, classes: {} };
  ["general", "archetype", "special"].forEach((scope) => {
    const store = ranks[scope] || {};
    Object.keys(store).forEach((idxStr) => {
      const key = keyForIdx(scope, null, parseInt(idxStr, 10));
      if (key) out[scope][key] = store[idxStr];
    });
  });
  const classes = ranks.classes || {};
  Object.keys(classes).forEach((className) => {
    const store = classes[className] || {};
    const outStore = {};
    Object.keys(store).forEach((idxStr) => {
      const key = keyForIdx("class", className, parseInt(idxStr, 10));
      if (key) outStore[key] = store[idxStr];
    });
    if (Object.keys(outStore).length) out.classes[className] = outStore;
  });
  return out;
}

// Saved rank values come from localStorage, pasted text, or a URL — none of
// which are guaranteed to have gone through this app. Coerce to an integer
// and clamp to the AA's real rank range so a bogus value (huge, negative,
// non-numeric) can't produce a broken-looking build or a costly loop
// somewhere downstream that assumes ranks are always small and sane.
function clampRankValue(scope, className, idx, rawValue) {
  const aa = aaAt(scope, className, idx);
  if (!aa) return 0;
  const n = parseInt(rawValue, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(aa.ranks, n));
}

// Returns { ranks, dropped } — `dropped` is how many saved rank entries had a
// key that no longer resolves to any current AA (renamed/removed since the
// save was made). Every key here represents at least one spent point
// (changeRank deletes a store entry the moment it hits 0), so a drop always
// means real invested points just vanished from the build — worth telling
// the user about instead of leaving them to notice a lower total on their own.
function deserializeRanks(saved, resolveIdx) {
  const out = { general: {}, archetype: {}, special: {}, classes: {} };
  let dropped = 0;
  if (!saved || typeof saved !== "object") return { ranks: out, dropped };
  ["general", "archetype", "special"].forEach((scope) => {
    const store = saved[scope] || {};
    Object.keys(store).forEach((k) => {
      const idx = resolveIdx(scope, null, k);
      if (idx >= 0) out[scope][idx] = clampRankValue(scope, null, idx, store[k]);
      else dropped++;
    });
  });
  const classes = saved.classes || {};
  Object.keys(classes).forEach((className) => {
    const store = classes[className] || {};
    const outStore = {};
    Object.keys(store).forEach((k) => {
      const idx = resolveIdx("class", className, k);
      if (idx >= 0) outStore[idx] = clampRankValue("class", className, idx, store[k]);
      else dropped++;
    });
    if (Object.keys(outStore).length) out.classes[className] = outStore;
  });
  return { ranks: out, dropped };
}

export function serializePurchaseOrder(purchaseOrder) {
  return (purchaseOrder || []).map((e) => {
    const key = keyForIdx(e.scope, e.className || null, e.idx);
    return key ? { scope: e.scope, className: e.className || null, key } : null;
  }).filter(Boolean);
}

// Unlike deserializeRanks, a dropped purchaseOrder entry isn't its own
// user-facing signal — reconcilePurchaseOrderCounts (logic.js) checks
// purchaseOrder's entry count against each AA's actual held rank directly
// after load and repairs any mismatch, which catches this and every other
// way the two could end up disagreeing, not just this one cause.
function deserializePurchaseOrder(saved, entryIdOf, resolveIdx) {
  return (Array.isArray(saved) ? saved : []).map((e) => {
    if (!e || typeof e !== "object" || typeof e.scope !== "string") return null;
    const id = entryIdOf(e);
    if (id == null) return null;
    const idx = resolveIdx(e.scope, e.className || null, id);
    return idx >= 0 ? { scope: e.scope, className: e.className || null, idx } : null;
  }).filter(Boolean);
}

// Generous enough that no real user approaches it, tight enough that a
// hostile pasted code/link can't inject an unbounded array (same spirit as
// MAX_TOTAL_POINTS above).
const MAX_WAYPOINTS = 200;

// Curated palette rather than a free color picker - a handful of
// distinguishable, pre-tuned-for-the-dark-theme options is enough to color
// code a build's steps, and keeps every colored segment/swatch/divider
// dot readable without needing per-color contrast checking against
// arbitrary user-chosen hex values. key is what's actually stored on a
// waypoint and round-tripped through save/export; hex is only for the
// swatch-picker UI (render.js) - the segment/divider tints themselves are
// plain CSS classes keyed off it (styles.css).
export const WAYPOINT_COLORS = [
  { key: "red", hex: "#d94c4c" },
  { key: "orange", hex: "#d98a3d" },
  { key: "yellow", hex: "#d9c23d" },
  { key: "green", hex: "#4c8c52" },
  { key: "teal", hex: "#3da6a0" },
  { key: "blue", hex: "#4c7fd9" },
  { key: "purple", hex: "#9c4cd9" }
];
const WAYPOINT_COLOR_KEYS = new Set(WAYPOINT_COLORS.map((c) => c.key));

// Waypoints don't reference any AA identity (unlike ranks/purchaseOrder), so
// there's no name-key resolution here - just validating/clamping untrusted
// input from localStorage, a pasted build code, or a share link into the
// { pts, label, color } shape state.waypoints actually uses. Accepts either
// that verbose shape or the compact [pts, label, color] triple
// exportImport.js's `w` field uses, so this one function can sanitize both
// sources. Duplicate pts values collapse to the last one seen (an explicit
// re-set should win over an earlier stale entry, not silently create two
// markers at the same total). An unrecognized color (a stale/hand-edited
// value, or a future palette entry an older client doesn't know) degrades
// to no color rather than being kept as an opaque string render.js would
// have no matching CSS class for.
export function sanitizeWaypoints(list) {
  if (!Array.isArray(list)) return [];
  const byPts = new Map();
  list.forEach((entry) => {
    let rawPts, rawLabel, rawColor;
    if (Array.isArray(entry)) [rawPts, rawLabel, rawColor] = entry;
    else if (entry && typeof entry === "object") { rawPts = entry.pts; rawLabel = entry.label; rawColor = entry.color; }
    else return;
    const pts = parseInt(rawPts, 10);
    if (!Number.isFinite(pts) || pts < 0) return;
    const clamped = Math.min(pts, MAX_TOTAL_POINTS);
    const label = typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim().slice(0, 60) : null;
    const color = typeof rawColor === "string" && WAYPOINT_COLOR_KEYS.has(rawColor) ? rawColor : null;
    byPts.set(clamped, { label, color });
  });
  return Array.from(byPts.entries())
    .map(([pts, { label, color }]) => ({ pts, label, color }))
    .sort((a, b) => a.pts - b.pts)
    .slice(0, MAX_WAYPOINTS);
}

export function saveLocal() {
  try {
    const payload = {
      v: SAVE_FORMAT_VERSION,
      selectedClasses: state.selectedClasses,
      charLevel: state.charLevel,
      totalPoints: state.totalPoints,
      ranks: serializeRanks(state.ranks),
      purchaseOrder: serializePurchaseOrder(state.purchaseOrder),
      waypoints: state.waypoints
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) { /* storage unavailable, ignore */ }
}

// Persists owned separately from the build payload above (see
// OWNED_STORAGE_KEY) - called by setOwnedRank/performReset in logic.js
// whenever owned itself changes, independent of saveLocal.
export function saveOwned() {
  try {
    localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify({ v: SAVE_FORMAT_VERSION, owned: serializeRanks(state.owned) }));
  } catch (e) { /* storage unavailable, ignore */ }
}

function loadOwnedStorage() {
  try {
    const raw = localStorage.getItem(OWNED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) { return null; }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (e) { return null; }
}

// Returns { droppedRanks } — how many saved rank entries had a key that no
// longer resolves to a current AA. Callers use this to tell the user
// something vanished, instead of a build that's just quietly smaller than
// they left it.
export function applyLoaded(loaded) {
  if (!loaded) return { droppedRanks: 0 };
  if (
    Array.isArray(loaded.selectedClasses) &&
    loaded.selectedClasses.length === 3 &&
    loaded.selectedClasses.every((c) => CLASS_LIST.includes(c)) &&
    new Set(loaded.selectedClasses).size === 3
  ) {
    state.selectedClasses = loaded.selectedClasses.slice();
  }
  if (typeof loaded.charLevel === "number" && !isNaN(loaded.charLevel)) {
    state.charLevel = Math.max(1, Math.min(50, loaded.charLevel));
  }
  if (typeof loaded.totalPoints === "number" && !isNaN(loaded.totalPoints)) {
    state.totalPoints = Math.max(0, Math.min(MAX_TOTAL_POINTS, loaded.totalPoints));
  }
  // v4+ saves store name keys, resolved straight against today's AA_DATA.
  // Anything older stored raw indexes against the ordering AA_DATA happened
  // to have at save time — resolved instead through the frozen snapshot, so
  // reordering/regenerating the wiki data doesn't quietly reattach old points
  // to the wrong ability. Either way, an AA that no longer resolves is
  // dropped rather than guessed at.
  const isLegacy = !(typeof loaded.v === "number" && loaded.v >= 4);
  let droppedRanks = 0;
  if (loaded.ranks && typeof loaded.ranks === "object") {
    const result = isLegacy
      ? deserializeRanks(loaded.ranks, (scope, cls, idxStr) => currentIdxForLegacyIdx(scope, cls, parseInt(idxStr, 10)))
      : deserializeRanks(loaded.ranks, (scope, cls, key) => idxForKey(scope, cls, key));
    state.ranks = result.ranks;
    droppedRanks = result.dropped;
  }
  if (Array.isArray(loaded.purchaseOrder)) {
    state.purchaseOrder = isLegacy
      ? deserializePurchaseOrder(loaded.purchaseOrder, (e) => (typeof e.idx === "number" ? e.idx : null), (scope, cls, legacyIdx) => currentIdxForLegacyIdx(scope, cls, legacyIdx))
      : deserializePurchaseOrder(loaded.purchaseOrder, (e) => (typeof e.key === "string" ? e.key : null), (scope, cls, key) => idxForKey(scope, cls, key));
  }
  // owned is deliberately NOT handled here - it lives outside the build
  // payload entirely now (see OWNED_STORAGE_KEY/loadAndApplyOwned) and must
  // survive loading any build/slot/share link untouched, so applyLoaded
  // never reads or writes state.owned regardless of whether `loaded` has an
  // owned field (an old payload saved during this feature's brief window of
  // embedding it there, or a share code that once carried it, both just get
  // ignored here as an unrecognized extra field).
  //
  // Unlike ranks/purchaseOrder (left as-is if the field is simply missing -
  // a malformed-partial-payload tolerance, not a deliberate merge), waypoints
  // always get reset here, present or not - they ARE part of "the build"
  // being loaded, same reasoning owned used to need before it moved to its
  // own key: a build saved/shared before this feature has no waypoints
  // field at all, and loading it must actually clear whatever waypoints the
  // *previous* build in memory had, not silently carry them over onto an
  // unrelated build that never had them.
  state.waypoints = sanitizeWaypoints(loaded.waypoints);
  return { droppedRanks };
}

// Owned is character-global, loaded once at boot from its own storage key -
// independent of whichever build ends up active (local save, a share link,
// an import). rawMainPayload is the raw object loadLocal() returned, needed
// for exactly one purpose: a one-time migration for saves made while this
// feature briefly stored owned inside the main build payload instead of its
// own key. Once OWNED_STORAGE_KEY exists, rawMainPayload is never consulted
// again. Returns { droppedOwned } in the same spirit as applyLoaded's
// droppedRanks, so main.js can fold it into the same load-time notice.
export function loadAndApplyOwned(rawMainPayload) {
  const stored = loadOwnedStorage();
  if (stored && stored.owned && typeof stored.owned === "object") {
    const result = deserializeRanks(stored.owned, (scope, cls, key) => idxForKey(scope, cls, key));
    state.owned = result.ranks;
    return { droppedOwned: result.dropped };
  }
  if (rawMainPayload && rawMainPayload.owned && typeof rawMainPayload.owned === "object") {
    // owned only ever existed in the main payload under SAVE_FORMAT_VERSION
    // 4 (it shipped well after v4 became name-keyed) - no legacy index-based
    // form to handle here, unlike ranks/purchaseOrder above.
    const result = deserializeRanks(rawMainPayload.owned, (scope, cls, key) => idxForKey(scope, cls, key));
    state.owned = result.ranks;
    saveOwned();
    return { droppedOwned: result.dropped };
  }
  state.owned = { general: {}, archetype: {}, special: {}, classes: {} };
  return { droppedOwned: 0 };
}

// Whether a name-keyed owned payload (the shape loadLocal/decodeBuildCode
// hand around, before deserializeRanks turns it into idx-keyed state.owned)
// actually has anything in it - used by exportImport.js to decide whether an
// imported build is even carrying owned data worth asking about, without
// needing to deserialize it first just to find out it's empty.
export function payloadOwnedHasContent(owned) {
  if (!owned || typeof owned !== "object") return false;
  if (Object.keys(owned.general || {}).length || Object.keys(owned.archetype || {}).length || Object.keys(owned.special || {}).length) return true;
  const classes = owned.classes || {};
  return Object.keys(classes).some((className) => Object.keys(classes[className] || {}).length > 0);
}

// Deliberate overwrite of the GLOBAL owned store from untrusted external
// content (a pasted build code or share link that opted into carrying owned
// data) - unlike loadAndApplyOwned (boot-time load from this app's own
// storage), this is only ever called after the user has been warned via
// exportImport.js's import flow and explicitly chosen to bring the incoming
// progress in, since it overwrites whatever owned data already exists.
export function applyImportedOwned(ownedField) {
  const result = deserializeRanks(ownedField, (scope, cls, key) => idxForKey(scope, cls, key));
  state.owned = result.ranks;
  saveOwned();
  return { dropped: result.dropped };
}
