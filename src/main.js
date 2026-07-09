// Entry point: wires everything together and boots the app on DOMContentLoaded.

import { loadLocal, applyLoaded, DISCLAIMER_DISMISSED_KEY } from "./state.js";
import { cacheDom, el } from "./dom.js";
import { populateStaticControls, renderAll, showToast } from "./render.js";
import { findInvalidatedPicks } from "./logic.js";
import { wireEvents } from "./events.js";
import { applySharedBuildFromUrl } from "./exportImport.js";

function init() {
  cacheDom();
  populateStaticControls();
  const localResult = applyLoaded(loadLocal());
  // If a share link applies, it replaces whatever localStorage just loaded
  // (and shows its own toast, including its own drop count) - so the local
  // load's result no longer describes the build actually in front of the user.
  const sharedApplied = applySharedBuildFromUrl();
  wireEvents();
  try {
    if (!localStorage.getItem(DISCLAIMER_DISMISSED_KEY)) el.disclaimerBanner.classList.remove("hidden");
  } catch (e) {
    el.disclaimerBanner.classList.remove("hidden");
  }
  // One consolidated notice rather than stacking toasts — several firing on
  // first paint reads as breakage even when each one is just informational.
  const notices = [];
  if (!sharedApplied && localResult.droppedRanks) {
    const n = localResult.droppedRanks;
    notices.push(`${n} saved pick${n === 1 ? "" : "s"} no longer exist${n === 1 ? "s" : ""} in the current data and ${n === 1 ? "was" : "were"} skipped`);
  }
  // Data can drift out from under a saved build (a resync renaming/reshaping a
  // prereq target, say) — catch it once on load rather than leaving the user
  // to discover a quietly-broken pick on their own.
  const invalidated = findInvalidatedPicks();
  if (invalidated.length) {
    const n = invalidated.length;
    notices.push(`${n} pick${n === 1 ? "" : "s"} no longer meet${n === 1 ? "s" : ""} its prerequisite`);
  }
  if (notices.length) {
    showToast(`${notices.join("; ")} — check the highlighted AAs`);
  }
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
