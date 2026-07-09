// Entry point: wires everything together and boots the app on DOMContentLoaded.

import { loadLocal, applyLoaded, saveLocal, DISCLAIMER_DISMISSED_KEY } from "./state.js";
import { cacheDom, el } from "./dom.js";
import { populateStaticControls, renderAll, showToast } from "./render.js";
import { findInvalidatedPicks, reconcilePurchaseOrderCounts } from "./logic.js";
import { wireEvents } from "./events.js";
import { applySharedBuildFromUrl } from "./exportImport.js";

async function init() {
  cacheDom();
  populateStaticControls();
  const localResult = applyLoaded(loadLocal());
  // If a share link applies, it replaces whatever localStorage just loaded -
  // so the local load's result no longer describes the build actually in
  // front of the user. Neither path toasts directly; this function is the
  // one place that assembles and shows a load-time notice, so several
  // simultaneous issues combine into one toast instead of each overwriting
  // the last.
  const shared = await applySharedBuildFromUrl(localResult);
  wireEvents();
  try {
    if (!localStorage.getItem(DISCLAIMER_DISMISSED_KEY)) el.disclaimerBanner.classList.remove("hidden");
  } catch (e) {
    el.disclaimerBanner.classList.remove("hidden");
  }

  const notices = [];
  if (shared.notice) notices.push(shared.notice);
  if (!shared.applied && localResult.droppedRanks) {
    const n = localResult.droppedRanks;
    notices.push(`${n} saved pick${n === 1 ? "" : "s"} no longer exist${n === 1 ? "s" : ""} in the current data and ${n === 1 ? "was" : "were"} skipped`);
  }
  // purchaseOrder can end up with a different entry count than the rank
  // actually held for an AA (see reconcilePurchaseOrderCounts) - repair it
  // before the first render, since computeProgressionSteps would otherwise
  // display a rank number that disagrees with the tree/side panel.
  const repaired = reconcilePurchaseOrderCounts();
  if (repaired) {
    notices.push(`${repaired} pick${repaired === 1 ? "'s" : "s'"} purchase history was out of sync and ${repaired === 1 ? "was" : "were"} repaired`);
  }
  // Persisting a repair is safe — it's a lossless normalization of state
  // that's already in memory, and it's why the toast above stops recurring
  // once it's saved. Persisting a drop is not: localStorage is this path's
  // *only* copy of the build (unlike a share link or pasted import text,
  // where the source survives on its own), so writing back a build with a
  // dropped AA missing risks turning a recoverable loss into a permanent
  // one. So: only persist when something was actually repaired, and never
  // on the same load a drop happened — the drop notice recurs every visit
  // until the data is fixed, which is the point. (Also incidentally means a
  // brand-new visitor with nothing saved yet — repaired is always 0 for
  // them — no longer writes a default payload to storage for no reason.)
  //
  // This only protects against the load itself overwriting the save. It's
  // not a durable "your original build is safe until the data is fixed"
  // guarantee — any normal interaction afterward (changeRank, an import,
  // accepting a share link — see applySharedBuildFromUrl's own hasExisting
  // check) still calls saveLocal() as usual and persists whatever's in
  // memory at that point, dropped picks included. This buys the user a
  // chance to notice and export/back up before that happens; it doesn't
  // guarantee they will.
  if (!shared.applied && repaired > 0 && !localResult.droppedRanks) saveLocal();
  // Data can drift out from under a saved build (a resync renaming/reshaping a
  // prereq target, say) — catch it once on load rather than leaving the user
  // to discover a quietly-broken pick on their own.
  const invalidated = findInvalidatedPicks();
  if (invalidated.length) {
    const n = invalidated.length;
    notices.push(`${n} pick${n === 1 ? "" : "s"} no longer meet${n === 1 ? "s" : ""} its prerequisite — check the highlighted AAs`);
  }
  if (notices.length) {
    showToast(notices.join("; "));
  }
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
