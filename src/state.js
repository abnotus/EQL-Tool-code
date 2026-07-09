// App-wide constants, the mutable state object, and localStorage persistence.
// Nothing here touches the DOM — that's render.js / dom.js.

import { keyForIdx, idxForKey, currentIdxForLegacyIdx, aaAt } from "./keys.js";

// A build's totalPoints is a planning input the user sets themselves, but it's
// also read from untrusted sources (a pasted share link isn't something we
// generated), so it still gets an upper bound — generous enough that no real
// build ever approaches it, tight enough that a bogus value doesn't produce
// nonsense in the UI.
const MAX_TOTAL_POINTS = 100000;

// Bumped whenever the persisted shape changes. v4 introduced name-based keys
// for ranks/purchaseOrder (see keys.js) — anything below that is index-based
// against the frozen LEGACY_AA_ORDER snapshot and gets migrated on load.
export const SAVE_FORMAT_VERSION = 4;

export const STORAGE_KEY = "eql_aa_builder_v1";
export const DISCLAIMER_DISMISSED_KEY = "eql_aa_disclaimer_dismissed";
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

function deserializeRanks(saved, resolveIdx) {
  const out = { general: {}, archetype: {}, special: {}, classes: {} };
  if (!saved || typeof saved !== "object") return out;
  ["general", "archetype", "special"].forEach((scope) => {
    const store = saved[scope] || {};
    Object.keys(store).forEach((k) => {
      const idx = resolveIdx(scope, null, k);
      if (idx >= 0) out[scope][idx] = clampRankValue(scope, null, idx, store[k]);
    });
  });
  const classes = saved.classes || {};
  Object.keys(classes).forEach((className) => {
    const store = classes[className] || {};
    const outStore = {};
    Object.keys(store).forEach((k) => {
      const idx = resolveIdx("class", className, k);
      if (idx >= 0) outStore[idx] = clampRankValue("class", className, idx, store[k]);
    });
    if (Object.keys(outStore).length) out.classes[className] = outStore;
  });
  return out;
}

export function serializePurchaseOrder(purchaseOrder) {
  return (purchaseOrder || []).map((e) => {
    const key = keyForIdx(e.scope, e.className || null, e.idx);
    return key ? { scope: e.scope, className: e.className || null, key } : null;
  }).filter(Boolean);
}

function deserializePurchaseOrder(saved, entryIdOf, resolveIdx) {
  return (Array.isArray(saved) ? saved : []).map((e) => {
    if (!e || typeof e !== "object" || typeof e.scope !== "string") return null;
    const id = entryIdOf(e);
    if (id == null) return null;
    const idx = resolveIdx(e.scope, e.className || null, id);
    return idx >= 0 ? { scope: e.scope, className: e.className || null, idx } : null;
  }).filter(Boolean);
}

export function saveLocal() {
  try {
    const payload = {
      v: SAVE_FORMAT_VERSION,
      selectedClasses: state.selectedClasses,
      charLevel: state.charLevel,
      totalPoints: state.totalPoints,
      ranks: serializeRanks(state.ranks),
      purchaseOrder: serializePurchaseOrder(state.purchaseOrder)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) { /* storage unavailable, ignore */ }
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

export function applyLoaded(loaded) {
  if (!loaded) return;
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
  if (loaded.ranks && typeof loaded.ranks === "object") {
    state.ranks = isLegacy
      ? deserializeRanks(loaded.ranks, (scope, cls, idxStr) => currentIdxForLegacyIdx(scope, cls, parseInt(idxStr, 10)))
      : deserializeRanks(loaded.ranks, (scope, cls, key) => idxForKey(scope, cls, key));
  }
  if (Array.isArray(loaded.purchaseOrder)) {
    state.purchaseOrder = isLegacy
      ? deserializePurchaseOrder(loaded.purchaseOrder, (e) => (typeof e.idx === "number" ? e.idx : null), (scope, cls, legacyIdx) => currentIdxForLegacyIdx(scope, cls, legacyIdx))
      : deserializePurchaseOrder(loaded.purchaseOrder, (e) => (typeof e.key === "string" ? e.key : null), (scope, cls, key) => idxForKey(scope, cls, key));
  }
}
