// Build export/import: the text format, the share-code encoding, share links, and modal wiring.

import { state, AA_CATEGORY_KEYS, applyLoaded, saveLocal, SAVE_FORMAT_VERSION, serializeRanks, serializePurchaseOrder } from "./state.js";
import { el } from "./dom.js";
import { getList, effectiveRank, labelFor, spentPoints, computeProgressionSteps, clearLastMutation, reconcilePurchaseOrderCounts } from "./logic.js";
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

// purchaseOrder is highly repetitive (one entry per rank bought, not per AA —
// a maxed 6-rank AA repeats the same scope/className/key six times), so
// gzip beats every hand-rolled format short of assigning every AA a stable
// numeric id, which is a bigger change than this one. CompressionStream is
// the standard streams-based API for this; no library needed.
async function gzipCompress(bytes) {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function gzipDecompress(bytes) {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encodeBuildCode() {
  const bytes = new TextEncoder().encode(JSON.stringify(buildCodeObject()));
  return bytesToBase64(await gzipCompress(bytes));
}

async function decodeBuildCode(code) {
  const bytes = base64ToBytes(code);
  let jsonBytes;
  try {
    jsonBytes = await gzipDecompress(bytes);
  } catch (e) {
    // Not a gzip stream - most likely a share code or export text made
    // before compression was added, which was plain UTF-8 JSON straight
    // from base64. Fall back to reading it that way so old links and old
    // exported text both keep working, rather than just failing.
    jsonBytes = bytes;
  }
  return JSON.parse(new TextDecoder().decode(jsonBytes));
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

export async function buildShareUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("build", toBase64Url(await encodeBuildCode()));
  return url.toString();
}

// Builds a " (...)" suffix summarizing anything applyLoaded dropped and/or
// reconcilePurchaseOrderCounts repaired — "" if neither applies. Shared
// wording for the single-action load paths (share link, text import); the
// startup path in main.js assembles its own multi-item notice instead, since
// it can also be reporting on invalidated picks at the same time.
function loadIssuesSuffix(result, repaired) {
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

// Called once on startup. If the URL has a ?build= param, offers to load it — with
// a confirmation if it would clobber an existing non-empty build — then strips the
// param from the address bar either way so a refresh doesn't re-prompt. Returns
// { applied, notice } rather than toasting directly — main.js is the single
// place that decides what to show, so this outcome can be combined with
// other load-time notices into one toast instead of one overwriting another.
//
// localLoadResult is applyLoaded(loadLocal())'s result, from immediately
// before this runs — needed because spentPoints() alone reflects the local
// build *after* pruning any dropped picks. A build that lost every point
// it had to a bad resync would otherwise read as empty, skip the confirm,
// and get silently overwritten here (with an unconditional saveLocal below)
// on the exact load where preserving the original save mattered most.
export async function applySharedBuildFromUrl(localLoadResult) {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("build");
  if (!raw) return { applied: false, notice: null };

  let json = null;
  try {
    json = await decodeBuildCode(fromBase64Url(raw));
  } catch (e) {
    json = null;
  }

  let applied = false;
  let notice = null;
  if (json) {
    const hasExisting = spentPoints() > 0 || (localLoadResult && localLoadResult.droppedRanks > 0);
    const proceed = !hasExisting || confirm("Load the shared build from this link? This will replace your current build. Export your current build first if you want to keep it.");
    if (proceed) {
      const result = applyLoaded(json);
      state.selectedNode = null;
      clearLastMutation();
      const repaired = reconcilePurchaseOrderCounts();
      saveLocal();
      notice = `Loaded shared build from link${loadIssuesSuffix(result, repaired)}`;
      applied = true;
    }
  } else {
    notice = "That share link's build data looks invalid";
  }

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("build");
  window.history.replaceState({}, "", cleanUrl.toString());
  return { applied, notice };
}

export async function buildExportText() {
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

  lines.push(`BUILD_CODE:${await encodeBuildCode()}`);
  return lines.join("\n");
}

export async function openExportModal() {
  el.exportText.value = "Generating…";
  el.shareLinkInput.value = "";
  el.exportModal.classList.remove("hidden");
  const [text, url] = await Promise.all([buildExportText(), buildShareUrl()]);
  el.exportText.value = text;
  el.shareLinkInput.value = url;
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

export async function importBuildFromText(text) {
  const code = extractBuildCode(text);
  if (!code) { showToast("No build code found in that text"); return false; }
  try {
    // fromBase64Url is a no-op on plain base64 (only touches -/_ chars and
    // pads to length%4, which export-text codes already satisfy), so it's
    // safe to always apply regardless of which format `code` came from.
    const json = await decodeBuildCode(fromBase64Url(code));
    const result = applyLoaded(json);
    state.selectedNode = null;
    clearLastMutation();
    const repaired = reconcilePurchaseOrderCounts();
    saveLocal();
    renderAll();
    showToast(`Build imported${loadIssuesSuffix(result, repaired)}`);
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

export async function doImport() {
  const text = el.importText.value.trim();
  if (!text) { showToast("Paste build text first"); return; }
  if (await importBuildFromText(text)) closeImportModal();
}
