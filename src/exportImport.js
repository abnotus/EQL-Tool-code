// Build export/import: the text format, the share-code encoding, share links, and modal wiring.

import { state, AA_CATEGORY_KEYS, applyLoaded, saveLocal, SAVE_FORMAT_VERSION, serializeRanks, serializePurchaseOrder } from "./state.js";
import { el } from "./dom.js";
import { getList, effectiveRank, labelFor, spentPoints, computeProgressionSteps, clearLastMutation } from "./logic.js";
import { renderAll, showToast } from "./render.js";

function buildCodeObject() {
  return {
    v: SAVE_FORMAT_VERSION,
    selectedClasses: state.selectedClasses,
    charLevel: state.charLevel,
    totalPoints: state.totalPoints,
    ranks: serializeRanks(state.ranks),
    purchaseOrder: serializePurchaseOrder(state.purchaseOrder)
  };
}

function encodeBuildCode() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(buildCodeObject()))));
}

function decodeBuildCode(code) {
  return JSON.parse(decodeURIComponent(escape(atob(code))));
}

// Standard base64 (as used in BUILD_CODE) uses +, /, and = padding, which are legal
// in a URL query value but get percent-encoded and look ugly, and occasionally get
// mangled by chat apps that "helpfully" reformat long links. Base64url (RFC 4648 §5)
// swaps those for -, _ and drops padding, so the shared link stays plain alphanumeric.
function toBase64Url(b64) {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return b64;
}

export function buildShareUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("build", toBase64Url(encodeBuildCode()));
  return url.toString();
}

// "N picks from that save no longer exist in the current data and were
// skipped", or "" if nothing was dropped. Shared wording for every place
// applyLoaded's result gets surfaced to the user.
function droppedPicksSuffix(result) {
  const n = result.droppedRanks;
  if (!n) return "";
  return ` (${n} pick${n === 1 ? "" : "s"} no longer exist${n === 1 ? "s" : ""} in the current data and ${n === 1 ? "was" : "were"} skipped)`;
}

// Called once on startup. If the URL has a ?build= param, offers to load it — with
// a confirmation if it would clobber an existing non-empty build — then strips the
// param from the address bar either way so a refresh doesn't re-prompt. Returns
// true if a shared build was actually applied (so callers know local storage's
// load got superseded), false otherwise.
export function applySharedBuildFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("build");
  if (!raw) return false;

  let json = null;
  try {
    json = decodeBuildCode(fromBase64Url(raw));
  } catch (e) {
    json = null;
  }

  let applied = false;
  if (json) {
    const hasExisting = spentPoints() > 0;
    const proceed = !hasExisting || confirm("Load the shared build from this link? This will replace your current build. Export your current build first if you want to keep it.");
    if (proceed) {
      const result = applyLoaded(json);
      state.selectedNode = null;
      clearLastMutation();
      saveLocal();
      showToast(`Loaded shared build from link${droppedPicksSuffix(result)}`);
      applied = true;
    }
  } else {
    showToast("That share link's build data looks invalid");
  }

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("build");
  window.history.replaceState({}, "", cleanUrl.toString());
  return applied;
}

export function buildExportText() {
  const spent = spentPoints();
  const lines = [];
  lines.push("EverQuest Legends - AA Build");
  lines.push(`Classes: ${state.selectedClasses.join(" / ")}`);
  lines.push(`Points Spent: ${spent} / ${state.totalPoints}`);
  lines.push(`Exported: ${new Date().toLocaleString()}`);
  lines.push("");

  AA_CATEGORY_KEYS.forEach((catKey) => {
    const list = getList(catKey);
    const spentAAs = list.map((aa, idx) => ({ aa, rank: effectiveRank(catKey, idx) })).filter((x) => x.rank > 0);
    if (!spentAAs.length) return;
    lines.push(`== ${labelFor(catKey)} ==`);
    spentAAs.forEach(({ aa, rank }) => lines.push(`  ${aa.name}: rank ${rank}/${aa.ranks}${aa.auto ? " (auto-granted)" : ""}`));
    lines.push("");
  });

  if (state.purchaseOrder.length) {
    lines.push("== Progression (click order) ==");
    computeProgressionSteps().forEach((s) => {
      const maxRank = s.aa ? `/${s.aa.ranks}` : "";
      const suffix = s.active ? "" : " (class not currently selected)";
      lines.push(`  ${s.index + 1}. ${s.name} rank ${s.stepRank}${maxRank} — ${s.stepCost} pt(s), ${s.cumulative} total${suffix}`);
    });
    lines.push("");
  }

  lines.push(`BUILD_CODE:${encodeBuildCode()}`);
  return lines.join("\n");
}

export function openExportModal() {
  el.exportText.value = buildExportText();
  el.shareLinkInput.value = buildShareUrl();
  el.exportModal.classList.remove("hidden");
  el.exportText.focus();
  el.exportText.select();
}

export function closeExportModal() {
  el.exportModal.classList.add("hidden");
}

function copyFrom(inputEl, text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showToast("Copied to clipboard"),
      () => fallbackCopyFrom(inputEl, text)
    );
  } else {
    fallbackCopyFrom(inputEl, text);
  }
}

function fallbackCopyFrom(inputEl, text) {
  inputEl.value = text;
  inputEl.select();
  try {
    document.execCommand("copy");
    showToast("Copied to clipboard");
  } catch (e) {
    showToast("Couldn't copy automatically — select and copy manually.");
  }
}

export function copyExportText() {
  copyFrom(el.exportText, el.exportText.value);
}

export function copyShareLink() {
  copyFrom(el.shareLinkInput, el.shareLinkInput.value);
}

export function saveExportAsTxt() {
  const blob = new Blob([el.exportText.value], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `eql-aa-build-${state.selectedClasses.join("_").replace(/\s+/g, "_")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast("Saved as .txt");
}

// Accepts the full exported text (with a "BUILD_CODE:" line buried in it), a
// whole pasted share link (?build=... pulled out of it), or just the bare
// code on its own — standard base64 (export text) or base64url (share
// links), so pasting any of the things this app itself produces works.
export function extractBuildCode(text) {
  const trimmed = text.trim();
  const m = trimmed.match(/BUILD_CODE:(\S+)/);
  if (m) return m[1];
  const urlMatch = trimmed.match(/[?&]build=([^&\s]+)/);
  if (urlMatch) return urlMatch[1];
  // Maybe they pasted just the bare code, possibly line-wrapped by whatever they copied
  // it from — strip all embedded whitespace before checking if it looks like base64/base64url.
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length > 20 && /^[A-Za-z0-9_-]+={0,2}$/.test(compact)) return compact;
  return null;
}

export function importBuildFromText(text) {
  const code = extractBuildCode(text);
  if (!code) { showToast("No build code found in that text"); return false; }
  try {
    // fromBase64Url is a no-op on plain base64 (only touches -/_ chars and
    // pads to length%4, which export-text codes already satisfy), so it's
    // safe to always apply regardless of which format `code` came from.
    const json = decodeBuildCode(fromBase64Url(code));
    const result = applyLoaded(json);
    state.selectedNode = null;
    clearLastMutation();
    saveLocal();
    renderAll();
    showToast(`Build imported${droppedPicksSuffix(result)}`);
    return true;
  } catch (e) {
    showToast("Failed to read build text");
    return false;
  }
}

export function openImportModal() {
  el.importText.value = "";
  el.importModal.classList.remove("hidden");
  el.importText.focus();
}

export function closeImportModal() {
  el.importModal.classList.add("hidden");
}

export function doImport() {
  const text = el.importText.value.trim();
  if (!text) { showToast("Paste build text first"); return; }
  if (importBuildFromText(text)) closeImportModal();
}
