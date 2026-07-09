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
  applyLoaded(loadLocal());
  applySharedBuildFromUrl();
  wireEvents();
  try {
    if (!localStorage.getItem(DISCLAIMER_DISMISSED_KEY)) el.disclaimerBanner.classList.remove("hidden");
  } catch (e) {
    el.disclaimerBanner.classList.remove("hidden");
  }
  // Data can drift out from under a saved build (a resync renaming/reshaping a
  // prereq target, say) — catch it once on load rather than leaving the user
  // to discover a quietly-broken pick on their own.
  const invalidated = findInvalidatedPicks();
  if (invalidated.length) {
    const n = invalidated.length;
    showToast(`${n} pick${n === 1 ? "" : "s"} in your build no longer meet${n === 1 ? "s" : ""} its prerequisite — check the highlighted AAs`);
  }
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
