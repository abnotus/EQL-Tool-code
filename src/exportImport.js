// Build export/import: the text format, the share-code encoding, share links, and modal wiring.

import { state, AA_CATEGORY_KEYS, applyLoaded, saveLocal, SAVE_FORMAT_VERSION, serializeRanks, serializePurchaseOrder } from "./state.js";
import { el } from "./dom.js";
import { getList, effectiveRank, labelFor, spentPoints, computeProgressionSteps, clearLastMutation, reconcilePurchaseOrderCounts, loadIssuesSuffix } from "./logic.js";
import { clearActiveBuild, activeBuildMatchesCurrent, saveImportedBuild, saveBuildAs } from "./builds.js";
import { renderAll, showToast } from "./render.js";
import { idForKey, entryForId } from "./keys.js";

// Wire-format version for BUILD_CODE specifically (share links, export
// text) — independent of state.js's SAVE_FORMAT_VERSION, which governs
// localStorage only and stays name-keyed on purpose (readable, no size
// pressure there). BUILD_CODE trades that readability for size: numeric AA
// ids from aaIds.js instead of name keys, abbreviated field names, and
// ranks/purchaseOrder as flat arrays instead of nested objects/objects-with-
// repeated-keys. Never used 2 before (history went 3 -> 4), so no collision
// with an old share code's v.
const BUILD_CODE_VERSION = 2;

function buildCodeObject() {
  const serializedRanks = serializeRanks(state.ranks);
  const compactRanks = [];
  const pushRank = (scope, className, key, rank) => {
    const id = idForKey(scope, className, key);
    // An AA missing from aaIds.js shouldn't happen for anything currently
    // pickable (build_minify.py's invariant check + assign_aa_ids.py being
    // run together keep them in sync) - degrades to "dropped" rather than
    // guessed at, same as everywhere else this app handles an unresolved key.
    if (id != null) compactRanks.push([id, rank]);
  };
  ["general", "archetype", "special"].forEach((scope) => {
    const store = serializedRanks[scope] || {};
    Object.keys(store).forEach((key) => pushRank(scope, null, key, store[key]));
  });
  Object.keys(serializedRanks.classes || {}).forEach((className) => {
    const store = serializedRanks.classes[className] || {};
    Object.keys(store).forEach((key) => pushRank("class", className, key, store[key]));
  });

  const compactPurchaseOrder = serializePurchaseOrder(state.purchaseOrder)
    .map((e) => idForKey(e.scope, e.className, e.key))
    .filter((id) => id != null);

  return {
    v: BUILD_CODE_VERSION,
    c: state.selectedClasses.map((name) => CLASS_LIST.indexOf(name)),
    l: state.charLevel,
    t: state.totalPoints,
    r: compactRanks,
    p: compactPurchaseOrder
  };
}

// Reconstructs the verbose, name-keyed shape applyLoaded already understands
// (the same shape a v4 localStorage/legacy payload is in) from a decoded
// BUILD_CODE_VERSION payload, so applyLoaded itself never needs to know the
// compact format exists — only this file and keys.js do. An id that no
// longer resolves (entryForId returns null - the AA was removed since this
// link's ranks were assigned their ids) is dropped, same degrade-gracefully
// philosophy as an unresolved name key elsewhere.
function expandCompactPayload(compact) {
  const ranks = { general: {}, archetype: {}, special: {}, classes: {} };
  (compact.r || []).forEach(([id, rank]) => {
    const entry = entryForId(id);
    if (!entry) return;
    if (entry.scope === "class") {
      ranks.classes[entry.className] = ranks.classes[entry.className] || {};
      ranks.classes[entry.className][entry.key] = rank;
    } else {
      ranks[entry.scope][entry.key] = rank;
    }
  });
  const purchaseOrder = (compact.p || []).map((id) => {
    const entry = entryForId(id);
    return entry ? { scope: entry.scope, className: entry.className, key: entry.key } : null;
  }).filter(Boolean);
  return {
    v: SAVE_FORMAT_VERSION,
    selectedClasses: (compact.c || []).map((i) => CLASS_LIST[i]).filter(Boolean),
    charLevel: compact.l,
    totalPoints: compact.t,
    ranks,
    purchaseOrder
  };
}

// purchaseOrder is highly repetitive (one entry per rank bought, not per AA —
// a maxed 6-rank AA repeats the same scope/className/key six times), so
// gzip beats every hand-rolled format short of assigning every AA a stable
// numeric id, which is a bigger change than this one. CompressionStream is
// the standard streams-based API for this; no library needed. Needs Firefox
// 113+ / Safari 16.4+ (mid-2023) - no feature-detection fallback, since
// that's an old floor for this app's audience; an unsupported browser fails
// on both encode and decode (share links / export text), not just one.
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
  const parsed = JSON.parse(new TextDecoder().decode(jsonBytes));
  // BUILD_CODE_VERSION (compact, id-keyed) needs expanding back to the
  // name-keyed shape applyLoaded understands; anything else (v4 verbose, or
  // an old legacy shape) is already in that shape and passes through as-is -
  // applyLoaded's own v check handles v4-vs-legacy from here.
  return parsed && parsed.v === BUILD_CODE_VERSION ? expandCompactPayload(parsed) : parsed;
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

// Gate in front of anything that's about to fully replace the current working
// state (a share link, a text import) with something else. Three outcomes:
//   - nothing at risk, or the current build already matches a saved slot
//     exactly (activeBuildMatchesCurrent) -> proceed silently, same as always.
//   - there's real content and it isn't backed up anywhere -> offer to save
//     it under a name before proceeding, rather than just warning it'll be
//     lost. Declining the name prompt backs out of the whole operation
//     entirely (nothing lost, nothing replaced) rather than guessing whether
//     an empty/cancelled name means "save it anyway" or "never mind".
//   - offered but explicitly declined saving -> fall back to the plain
//     "this will replace your build" confirmation, so declining to save
//     isn't itself a dead end.
// extraRisk covers a risk source that doesn't fit "spentPoints() > 0" —
// applySharedBuildFromUrl's caller-supplied droppedRanks check, see below.
// verb+target are split (rather than one reusable phrase) so both dialogs
// read as proper sentences - "before loading the shared build" is a gerund,
// "Load the shared build?" is an imperative, and no single phrase is both.
function confirmReplaceCurrentBuild(verb, target, extraRisk = false) {
  if ((spentPoints() <= 0 && !extraRisk) || activeBuildMatchesCurrent()) return true;
  const wantsSave = confirm(`Your current build isn't saved. Save it as a named build before ${verb}ing ${target}?`);
  if (wantsSave) {
    const name = prompt("Name this build:", "");
    if (!name || !name.trim()) return false;
    saveBuildAs(name.trim());
    return true;
  }
  return confirm(`${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${target}? This will replace your current build and can't be undone.`);
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
    const extraRisk = !!(localLoadResult && localLoadResult.droppedRanks > 0);
    const proceed = confirmReplaceCurrentBuild("load", "the shared build from this link", extraRisk);
    if (proceed) {
      const result = applyLoaded(json);
      state.selectedNode = null;
      clearLastMutation();
      clearActiveBuild();
      const repaired = reconcilePurchaseOrderCounts();
      saveLocal();
      saveImportedBuild();
      notice = `Loaded shared build from link — saved as "Imported Build" in Builds${loadIssuesSuffix(result, repaired)}`;
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
  if (compact.length > 20 && /^[A-Za-z0-9_+/-]+={0,2}$/.test(compact)) return compact;
  return null;
}

export async function importBuildFromText(text) {
  const code = extractBuildCode(text);
  if (!code) { showToast("No build code found in that text"); return false; }
  if (!confirmReplaceCurrentBuild("import", "this build")) return false;
  try {
    // fromBase64Url is a no-op on plain base64 (only touches -/_ chars and
    // pads to length%4, which export-text codes already satisfy), so it's
    // safe to always apply regardless of which format `code` came from.
    const json = await decodeBuildCode(fromBase64Url(code));
    const result = applyLoaded(json);
    state.selectedNode = null;
    clearLastMutation();
    clearActiveBuild();
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
