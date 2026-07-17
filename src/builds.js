// Named build slots: save/load/rename/delete snapshots of the current build in
// localStorage, independent of state.js's own always-autosaving STORAGE_KEY —
// that key keeps holding "whatever you're currently editing", exactly as it
// did before this existed. A named slot is an explicit snapshot you take of
// that; loading one just overwrites the current working state with it, which
// then goes on autosaving under STORAGE_KEY as normal. No migration needed:
// an existing single-build save is untouched and simply has no active slot.

import { state, saveLocal, serializeRanks, serializePurchaseOrder, applyLoaded, SAVE_FORMAT_VERSION } from "./state.js";
import { clearLastMutation, reconcilePurchaseOrderCounts } from "./logic.js";

const BUILDS_INDEX_KEY = "eql_aa_builds_index_v1";
const BUILD_KEY_PREFIX = "eql_aa_build_";
// Which saved slot (if any) the current working state was last loaded from or
// saved as — purely for UI orientation (highlighting it in the list, showing
// its name near the Builds button). Not part of any build's own payload, and
// never trusted for anything beyond display: loading/saving always resolves
// by id against the index, not the other way around.
const ACTIVE_BUILD_KEY = "eql_aa_active_build_id";

function loadIndex() {
  try {
    const raw = localStorage.getItem(BUILDS_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveIndex(index) {
  try {
    localStorage.setItem(BUILDS_INDEX_KEY, JSON.stringify(index));
  } catch (e) { /* storage unavailable/full - the slot data write already failed first if so */ }
}

function genId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Most-recently-updated first — the one you're most likely to want is at the top.
export function listBuilds() {
  return loadIndex().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveBuildId() {
  try {
    return localStorage.getItem(ACTIVE_BUILD_KEY) || null;
  } catch (e) {
    return null;
  }
}

function setActiveBuildId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_BUILD_KEY, id);
    else localStorage.removeItem(ACTIVE_BUILD_KEY);
  } catch (e) { /* ignore */ }
}

// Called whenever the current working state gets replaced by something other
// than loadBuild — an import, a share link, Reset Build — so a subsequent
// save can't mistake unrelated content for an update to whatever slot used
// to be active.
export function clearActiveBuild() {
  setActiveBuildId(null);
}

function buildPayload() {
  return {
    v: SAVE_FORMAT_VERSION,
    selectedClasses: state.selectedClasses,
    charLevel: state.charLevel,
    totalPoints: state.totalPoints,
    ranks: serializeRanks(state.ranks),
    purchaseOrder: serializePurchaseOrder(state.purchaseOrder)
  };
}

// Snapshots the current build into a named slot — a new one, or an existing
// one if id is given (the caller's "overwrite this slot" path). Returns the
// slot's id, or null if localStorage rejected the write (full/unavailable),
// in which case nothing was changed.
export function saveBuildAs(name, id = null) {
  const targetId = id || genId();
  try {
    localStorage.setItem(BUILD_KEY_PREFIX + targetId, JSON.stringify(buildPayload()));
  } catch (e) {
    return null;
  }
  const index = loadIndex();
  const existing = index.find((b) => b.id === targetId);
  const updatedAt = Date.now();
  if (existing) {
    existing.name = name;
    existing.updatedAt = updatedAt;
  } else {
    index.push({ id: targetId, name, updatedAt });
  }
  saveIndex(index);
  setActiveBuildId(targetId);
  return targetId;
}

// Replaces the current working state with a saved slot's contents — same
// mechanism as loadLocal/applyLoaded on boot, or a text import. Returns
// { droppedRanks, repaired } (see loadIssuesSuffix in logic.js) so the UI can
// surface the same kind of notice an on-load drop already gets, or null if
// the slot doesn't exist / storage failed, in which case nothing changed.
export function loadBuild(id) {
  let parsed;
  try {
    const raw = localStorage.getItem(BUILD_KEY_PREFIX + id);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const result = applyLoaded(parsed);
  state.selectedNode = null;
  clearLastMutation();
  const repaired = reconcilePurchaseOrderCounts();
  setActiveBuildId(id);
  saveLocal();
  return { droppedRanks: result.droppedRanks, repaired };
}

export function renameBuild(id, name) {
  const index = loadIndex();
  const entry = index.find((b) => b.id === id);
  if (!entry) return false;
  entry.name = name;
  saveIndex(index);
  return true;
}

export function deleteBuild(id) {
  saveIndex(loadIndex().filter((b) => b.id !== id));
  try {
    localStorage.removeItem(BUILD_KEY_PREFIX + id);
  } catch (e) { /* ignore */ }
  if (getActiveBuildId() === id) setActiveBuildId(null);
}
