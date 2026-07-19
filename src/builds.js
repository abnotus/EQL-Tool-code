// Named build slots: save/load/rename/delete snapshots of the current build in
// localStorage, independent of state.js's own always-autosaving STORAGE_KEY —
// that key keeps holding "whatever you're currently editing", exactly as it
// did before this existed. A named slot is an explicit snapshot you take of
// that; loading one just overwrites the current working state with it, which
// then goes on autosaving under STORAGE_KEY as normal. No migration needed:
// an existing single-build save is untouched and simply has no active slot.

import { state, saveLocal, serializeRanks, serializePurchaseOrder, applyLoaded, SAVE_FORMAT_VERSION } from "./state.js";
import { spentPoints, clearLastMutation, reconcilePurchaseOrderCounts } from "./logic.js";

const BUILDS_INDEX_KEY = "eql_aa_builds_index_v1";
const BUILD_KEY_PREFIX = "eql_aa_build_";
// The reuse key for an auto-imported share link is this name, not a fixed id
// - see findImportedSlot for why an id can't serve that role once renames
// enter the picture.
const IMPORTED_BUILD_NAME = "Imported Build";
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
    ranks: serializeRanks(state.ranks),
    purchaseOrder: serializePurchaseOrder(state.purchaseOrder),
    // Unlike owned (deliberately NOT part of a slot's snapshot - see
    // OWNED_STORAGE_KEY), waypoints describe the plan itself, so a saved
    // slot captures them same as ranks/purchaseOrder.
    waypoints: state.waypoints
  };
}

// Whether the current working state is byte-for-byte identical to what's
// actually stored under the active slot — not just "there is an active
// slot", since further changes since the last save/load would leave the two
// diverged even with an id still set. Lets a caller about to replace the
// current build (a share link, a text import) skip warning about losing
// something that's already safely backed up, without needing a separate
// "dirty" flag threaded through every mutation path - this just compares
// on demand instead.
function activeBuildMatchesCurrent() {
  const id = getActiveBuildId();
  if (!id) return false;
  try {
    const raw = localStorage.getItem(BUILD_KEY_PREFIX + id);
    return raw != null && raw === JSON.stringify(buildPayload());
  } catch (e) {
    return false;
  }
}

// Snapshots the current build into a named slot — a new one, or an existing
// one if id is given (the caller's "overwrite this slot" path). Returns the
// slot's id, or null if localStorage rejected the write (full/unavailable),
// in which case nothing was changed.
function saveBuildAs(name, id = null) {
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

// Saves under `name`, confirming first if it would silently duplicate an
// existing slot's name — the interactive-save entry point (handleBuildSave
// in render.js, confirmReplaceCurrentBuild's own save-first offer below)
// both fork through here, so "does saving a duplicate name overwrite or
// duplicate" can't drift between the two paths the way it did before this
// existed. Returns the slot's id, false if the user declined the overwrite,
// or null on a storage failure - three outcomes a caller needs to tell apart
// (a decline isn't an error worth a "couldn't save" toast).
export function saveWithNameCheck(name) {
  const existing = listBuilds().find((b) => b.name === name);
  if (existing && !confirm(`A build named "${name}" already exists. Overwrite it?`)) return false;
  return saveBuildAs(name, existing ? existing.id : null);
}

// Gate in front of anything that's about to fully replace the current working
// state (a share link, a text import, loading a different saved slot) with
// something else. Three outcomes:
//   - nothing at risk, or the current build already matches a saved slot
//     exactly (activeBuildMatchesCurrent) -> proceed silently. This is what
//     makes flipping between two already-saved builds nag-free in either
//     direction, which is the whole point of the feature.
//   - there's real content and it isn't backed up anywhere -> offer to save
//     it under a name before proceeding, rather than just warning it'll be
//     lost. Declining the name prompt (or the overwrite confirm inside
//     saveWithNameCheck) backs out of the whole operation entirely rather
//     than guessing whether that meant "save it anyway" or "never mind".
//   - offered but explicitly declined saving -> fall back to the plain
//     "this will replace your build" confirmation, so declining to save
//     isn't itself a dead end.
// extraRisk covers a risk source that doesn't fit "spentPoints() > 0" -
// applySharedBuildFromUrl's caller-supplied droppedRanks check. trustMatch
// lets a caller say the active-slot match itself isn't trustworthy: opening
// a share link when the active slot is the reused "imported" one is about to
// overwrite that exact slot via saveImportedBuild, so treating the match as
// "safely backed up" would be trusting the very copy the operation is
// seconds from destroying.
export function confirmReplaceCurrentBuild(verb, target, { extraRisk = false, trustMatch = true } = {}) {
  const isBackedUp = trustMatch && activeBuildMatchesCurrent();
  if ((spentPoints() <= 0 && !extraRisk) || isBackedUp) return true;
  const wantsSave = confirm(`Your current build isn't saved. Save it as a named build before ${verb}ing ${target}?`);
  if (wantsSave) {
    const name = prompt("Name this build:", "");
    if (!name || !name.trim()) return false;
    const result = saveWithNameCheck(name.trim());
    // saveWithNameCheck's three outcomes need telling apart here, not
    // collapsing to a truthy check: false (declined the overwrite) backs out
    // the same as declining to name it at all - nothing was asked to be
    // saved, so proceeding would silently replace a build the user never
    // agreed to lose. null (storage full/unavailable) is the one case that
    // must NOT proceed either, despite being the exact moment the user
    // affirmatively asked for protection - proceeding anyway on a failed
    // save is data loss precisely when the user did everything right.
    if (result === false) return false;
    if (result === null) {
      alert('Couldn\'t save — local storage may be full or unavailable. Nothing was changed.');
      return false;
    }
    return true;
  }
  return confirm(`${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${target}? This will replace your current build and can't be undone.`);
}

// The slot saveImportedBuild would target on its next call - whichever entry
// is *currently* named "Imported Build", if any, regardless of id. Naming is
// the reuse key, not id: a rename only ever changes an entry's name, so
// whatever id that entry has belongs to the (now renamed/adopted) entry
// forever. A lookup keyed on id - as this used to be, back when a fixed
// "imported" id existed for a first import to claim - would keep finding
// that same permanently-adopted entry after every future rename and
// concluding "adopted" each time, allocating a fresh id per import forever
// after the first adoption: the exact unbounded pile of same-named slots the
// fixed id existed to prevent. A user who saved before that changed may
// still have a slot with the literal id "imported" sitting at the default
// name - this lookup finds and reuses it exactly like any other, since it's
// resolving by name, not by that now-meaningless id.
// isActiveBuildTheImportedSlot and saveImportedBuild both need this exact
// same answer (one to know what it's about to overwrite, one to know what to
// distrust), so it's one predicate rather than two independent lookups that
// could drift the way autoFloor's split into changeRank/attemptDecrement did.
//
// One accepted consequence: naming your own build "Imported Build" opts it
// into being the reuse target - already true before this fix (the id lookup
// couldn't tell a user's own entry from an actually-imported one either), so
// not a regression.
function findImportedSlot() {
  return loadIndex().find((b) => b.name === IMPORTED_BUILD_NAME) || null;
}

// True only while the active slot is the one the next saveImportedBuild()
// call would actually overwrite. Once that slot's been renamed away from the
// default name, findImportedSlot() no longer finds it, so there's nothing
// left to distrust - confirmReplaceCurrentBuild's caller would otherwise
// distrust an activeBuildMatchesCurrent() match that's actually accurate,
// prompting to save content that's already safely sitting under its adopted
// name.
export function isActiveBuildTheImportedSlot() {
  const slot = findImportedSlot();
  return !!slot && slot.id === getActiveBuildId();
}

// A share link is often opened passively (a link in chat), not a deliberate
// "load a build" action the way pasting import text or using the Builds
// modal is - easy to lose track of afterward once it's not the active
// working state anymore. Auto-saves it under one reused slot (found by name,
// see findImportedSlot - not genId()'d fresh every time) so it stays one
// click away in the Builds list even after you've moved on to something
// else, without piling up a fresh "Imported Build" entry per link opened.
export function saveImportedBuild() {
  const existing = findImportedSlot();
  return saveBuildAs(IMPORTED_BUILD_NAME, existing ? existing.id : null);
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

// False on a name collision with a *different* slot, not just "not found" -
// renameBuild doesn't merge or overwrite the other entry (unlike saving,
// where "overwrite it?" has an obvious meaning, two same-named slots would
// leave save-by-name's find() picking one arbitrarily) - the caller is
// expected to tell the two apart and report a clash rather than silently
// treating it as "nothing happened".
export function renameBuild(id, name) {
  const index = loadIndex();
  const entry = index.find((b) => b.id === id);
  if (!entry) return "missing";
  if (index.some((b) => b.id !== id && b.name === name)) return "collision";
  entry.name = name;
  saveIndex(index);
  return "ok";
}

export function deleteBuild(id) {
  saveIndex(loadIndex().filter((b) => b.id !== id));
  try {
    localStorage.removeItem(BUILD_KEY_PREFIX + id);
  } catch (e) { /* ignore */ }
  if (getActiveBuildId() === id) setActiveBuildId(null);
}
