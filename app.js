(function () {
"use strict";
const STORAGE_KEY = "eql_aa_builder_v1";
const DISCLAIMER_DISMISSED_KEY = "eql_aa_disclaimer_dismissed";
const CLASS_SLOT_KEYS = ["classSlot0", "classSlot1", "classSlot2"];
const AA_CATEGORY_KEYS = ["general", "archetype", ...CLASS_SLOT_KEYS, "special"];
let state = {
selectedClasses: [CLASS_LIST[0], CLASS_LIST[1], CLASS_LIST[2]],
charLevel: 50,
totalPoints: 1000,
ranks: { general: {}, archetype: {}, special: {}, classes: {} },
purchaseOrder: [],
activeView: "calculator", // 'calculator' | 'browse' | 'summary' | 'progression'
activeTab: "general", // 'general' | 'archetype' | 'classSlot0' | 'classSlot1' | 'classSlot2' | 'special'
selectedNode: null,
browseSearch: "",
browseFilter: "all"
};
function saveLocal() {
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
catch (e) { /* storage unavailable, ignore */ }
}
function loadLocal() {
try {
const raw = localStorage.getItem(STORAGE_KEY);
if (!raw) return null;
const parsed = JSON.parse(raw);
if (!parsed || typeof parsed !== "object") return null;
return parsed;
} catch (e) { return null; }
}
function applyLoaded(loaded) {
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
state.totalPoints = Math.max(0, loaded.totalPoints);
}
if (loaded.ranks && typeof loaded.ranks === "object") {
state.ranks = {
general: loaded.ranks.general || {},
archetype: loaded.ranks.archetype || {},
special: loaded.ranks.special || {},
classes: loaded.ranks.classes || {}
};
}
if (Array.isArray(loaded.purchaseOrder)) {
state.purchaseOrder = loaded.purchaseOrder.filter((e) => e && typeof e === "object" && typeof e.scope === "string" && typeof e.idx === "number");
}
}
function costNum(c) {
const n = parseInt(c, 10);
return isNaN(n) ? 0 : n;
}
function escapeHtml(str) {
return String(str == null ? "" : str)
.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function iconLetter(name) {
return (name || "?").trim().charAt(0).toUpperCase();
}
function highlightRankValue(text, rank) {
const escaped = escapeHtml(text);
if (!rank || rank < 1) return escaped;
return escaped.replace(/\d+(?:\.\d+)?%?(?:\/(?:\d+(?:\.\d+)?%?|\?)){1,}/g, (match) => {
const parts = match.split("/");
const idx = rank - 1;
if (idx < 0 || idx >= parts.length) return match;
parts[idx] = `<span class="rank-highlight">${parts[idx]}</span>`;
return parts.join("/");
});
}
function classSlotIndex(catKey) {
const i = CLASS_SLOT_KEYS.indexOf(catKey);
return i;
}
function labelFor(catKey) {
if (catKey === "general") return "General AA";
if (catKey === "archetype") return "Archetype AA";
if (catKey === "special") return "Special AA";
const slot = classSlotIndex(catKey);
if (slot >= 0) return state.selectedClasses[slot] + " AA";
return catKey;
}
function shortCategoryLabel(catKey) {
if (catKey === "general") return "General";
if (catKey === "archetype") return "Archetype";
if (catKey === "special") return "Special";
const slot = classSlotIndex(catKey);
if (slot >= 0) return state.selectedClasses[slot];
return catKey;
}
function getList(catKey) {
const slot = classSlotIndex(catKey);
if (slot >= 0) return AA_DATA.classes[state.selectedClasses[slot]] || [];
return AA_DATA[catKey] || [];
}
function effectiveRank(catKey, idx) {
const aa = getList(catKey)[idx];
if (aa && aa.auto) {
const levelReq = parseInt(aa.levelReq, 10) || 1;
return state.charLevel >= levelReq ? aa.ranks : 0;
}
const store = getRanksStore(catKey);
return store[idx] || 0;
}
function getRanksStore(catKey) {
const slot = classSlotIndex(catKey);
if (slot >= 0) {
const className = state.selectedClasses[slot];
if (!state.ranks.classes[className]) state.ranks.classes[className] = {};
return state.ranks.classes[className];
}
return state.ranks[catKey];
}
function scopeForCategory(category) {
const slot = classSlotIndex(category);
return slot >= 0 ? "class" : category;
}
function classNameForCategory(category) {
const slot = classSlotIndex(category);
return slot >= 0 ? state.selectedClasses[slot] : null;
}
function categoryToScopeClassName(category) {
const slot = classSlotIndex(category);
return slot >= 0 ? { scope: "class", className: state.selectedClasses[slot] } : { scope: category, className: null };
}
function entryKey(scope, className, idx) {
return `${scope}|${className || ""}|${idx}`;
}
function resolveEntryCategory(entry) {
if (entry.scope !== "class") return entry.scope;
const slot = state.selectedClasses.indexOf(entry.className);
return slot >= 0 ? CLASS_SLOT_KEYS[slot] : null;
}
function pushPurchase(category, idx) {
state.purchaseOrder.push({ scope: scopeForCategory(category), className: classNameForCategory(category), idx });
}
function popLastPurchase(category, idx) {
const scope = scopeForCategory(category);
const className = classNameForCategory(category);
for (let i = state.purchaseOrder.length - 1; i >= 0; i--) {
const e = state.purchaseOrder[i];
if (e.scope === scope && e.idx === idx && (e.className || null) === (className || null)) {
state.purchaseOrder.splice(i, 1);
return;
}
}
}
function clearClassData(className) {
delete state.ranks.classes[className];
state.purchaseOrder = state.purchaseOrder.filter((e) => !(e.scope === "class" && e.className === className));
}
function spentPoints() {
let total = 0;
AA_CATEGORY_KEYS.forEach((catKey) => {
const list = getList(catKey);
const store = getRanksStore(catKey);
list.forEach((aa, idx) => {
if (aa.auto) return;
const r = store[idx] || 0;
for (let i = 0; i < r; i++) total += costNum(aa.costs[i]);
});
});
return total;
}
function parsePrereqText(text) {
if (!text) return null;
const m = text.match(/^Requires\s+(.+?)\s+(?:rank|(?:at\s+)?level)\s+(\d+)\s*$/i);
if (!m) return null;
return { name: m[1].trim(), rank: parseInt(m[2], 10) };
}
function resolvePrereqTarget(text, sourceCategory) {
const parsed = parsePrereqText(text);
if (!parsed) return null;
const order = [];
const seen = new Set();
[sourceCategory, "general", "archetype", "special", ...CLASS_SLOT_KEYS].forEach((k) => {
if (!seen.has(k)) { seen.add(k); order.push(k); }
});
for (const key of order) {
const list = getList(key);
let foundIdx = -1;
list.forEach((aa, i) => { if (aa.name.toLowerCase() === parsed.name.toLowerCase()) foundIdx = i; });
if (foundIdx >= 0) return { category: key, idx: foundIdx, requiredRank: parsed.rank };
}
return null;
}
function structuralLockReason(catKey, idx) {
const aa = getList(catKey)[idx];
const levelReq = parseInt(aa.levelReq, 10) || 1;
if (state.charLevel < levelReq) return `Requires character level ${levelReq}.`;
if (aa.prereq) {
const resolved = resolvePrereqTarget(aa.prereq, catKey);
if (resolved) {
const targetRank = effectiveRank(resolved.category, resolved.idx);
if (targetRank < resolved.requiredRank) {
const targetAA = getList(resolved.category)[resolved.idx];
return `Requires ${targetAA ? targetAA.name : "prerequisite"} rank ${resolved.requiredRank}.`;
}
}
}
return null;
}
function getBlockReason(catKey, idx) {
const structural = structuralLockReason(catKey, idx);
if (structural) return structural;
const aa = getList(catKey)[idx];
const rank = effectiveRank(catKey, idx);
const nextCost = costNum(aa.costs[rank]);
const remaining = state.totalPoints - spentPoints();
if (remaining < nextCost) return `Not enough AA points remaining (need ${nextCost}).`;
return null;
}
function isDependedOn(category, idx, currentRank) {
const newRank = currentRank - 1;
for (const catKey of AA_CATEGORY_KEYS) {
const list = getList(catKey);
for (let i = 0; i < list.length; i++) {
const aa = list[i];
if (!aa.prereq) continue;
if (effectiveRank(catKey, i) <= 0) continue;
const r = resolvePrereqTarget(aa.prereq, catKey);
if (r && r.category === category && r.idx === idx && newRank < r.requiredRank) return true;
}
}
return false;
}
function changeRank(category, idx, delta) {
const store = getRanksStore(category);
const aa = getList(category)[idx];
const cur = store[idx] || 0;
const next = cur + delta;
if (next < 0 || next > aa.ranks) return;
if (next === 0) delete store[idx]; else store[idx] = next;
if (delta > 0) pushPurchase(category, idx);
else popLastPurchase(category, idx);
saveLocal();
renderAll();
}
function attemptIncrement(category, idx) {
const aa = getList(category)[idx];
if (aa.auto) { showToast(`${aa.name} is automatically granted — no points needed.`); return; }
const rank = effectiveRank(category, idx);
if (rank >= aa.ranks) return;
const reason = getBlockReason(category, idx);
if (reason) { showToast(reason); return; }
changeRank(category, idx, 1);
}
function attemptDecrement(category, idx) {
const aa = getList(category)[idx];
if (aa.auto) { showToast(`${aa.name} is automatically granted and can't be removed.`); return; }
const rank = effectiveRank(category, idx);
if (rank <= 0) return;
if (isDependedOn(category, idx, rank)) {
showToast("Can't lower this — another AA depends on the current rank.");
return;
}
changeRank(category, idx, -1);
}
function countPicked() {
let n = 0;
AA_CATEGORY_KEYS.forEach((catKey) => {
getList(catKey).forEach((aa, idx) => { if (effectiveRank(catKey, idx) > 0) n++; });
});
return n;
}
function computeProgressionSteps() {
const counts = {};
let cumulative = 0;
return state.purchaseOrder.map((entry, i) => {
const key = entryKey(entry.scope, entry.className, entry.idx);
const category = resolveEntryCategory(entry);
const active = category !== null;
const aa = entry.scope === "class" ? (AA_DATA.classes[entry.className] || [])[entry.idx] : (AA_DATA[entry.scope] || [])[entry.idx];
const stepRank = (counts[key] || 0) + 1;
let prereqWarn = false;
if (active && aa && aa.prereq) {
const resolved = resolvePrereqTarget(aa.prereq, category);
if (resolved) {
const t = categoryToScopeClassName(resolved.category);
const targetKey = entryKey(t.scope, t.className, resolved.idx);
if ((counts[targetKey] || 0) < resolved.requiredRank) prereqWarn = true;
}
}
counts[key] = stepRank;
const stepCost = active && aa ? costNum(aa.costs[stepRank - 1]) : 0;
cumulative += stepCost;
const label = entry.scope === "class" ? `${entry.className} AA` : labelFor(entry.scope);
const name = aa ? aa.name : "(unknown AA)";
return { index: i, aa, active, stepRank, stepCost, cumulative, prereqWarn, label, name };
});
}
const el = {};
function cacheDom() {
el.classSelects = [
document.getElementById("classSelect0"),
document.getElementById("classSelect1"),
document.getElementById("classSelect2")
];
el.levelInput = document.getElementById("levelInput");
el.totalPointsInput = document.getElementById("totalPointsInput");
el.spentValue = document.getElementById("spentValue");
el.remainingValue = document.getElementById("remainingValue");
el.browseToggle = document.getElementById("browseToggle");
el.exportBtn = document.getElementById("exportBtn");
el.importBtn = document.getElementById("importBtn");
el.importFile = document.getElementById("importFile");
el.importModal = document.getElementById("importModal");
el.importText = document.getElementById("importText");
el.loadImportFileBtn = document.getElementById("loadImportFileBtn");
el.doImportBtn = document.getElementById("doImportBtn");
el.closeImportBtn = document.getElementById("closeImportBtn");
el.resetBtn = document.getElementById("resetBtn");
el.exportModal = document.getElementById("exportModal");
el.exportText = document.getElementById("exportText");
el.copyExportBtn = document.getElementById("copyExportBtn");
el.saveExportBtn = document.getElementById("saveExportBtn");
el.closeExportBtn = document.getElementById("closeExportBtn");
el.tabs = document.getElementById("tabs");
el.calculatorView = document.getElementById("calculatorView");
el.browseView = document.getElementById("browseView");
el.summaryView = document.getElementById("summaryView");
el.summaryHeader = document.getElementById("summaryHeader");
el.summaryContent = document.getElementById("summaryContent");
el.progressionView = document.getElementById("progressionView");
el.progressionContent = document.getElementById("progressionContent");
el.treeWrap = document.getElementById("treeWrap");
el.sidePanel = document.getElementById("sidePanel");
el.browseSearch = document.getElementById("browseSearch");
el.browseFilter = document.getElementById("browseFilter");
el.browseGrid = document.getElementById("browseGrid");
el.toast = document.getElementById("toast");
el.disclaimerBanner = document.getElementById("disclaimerBanner");
el.dismissBannerBtn = document.getElementById("dismissBannerBtn");
}
function renderAll() {
renderTopbar();
renderTabs();
el.calculatorView.classList.add("hidden");
el.browseView.classList.add("hidden");
el.summaryView.classList.add("hidden");
el.progressionView.classList.add("hidden");
if (state.activeView === "browse") {
el.browseView.classList.remove("hidden");
renderBrowse();
} else if (state.activeView === "summary") {
el.summaryView.classList.remove("hidden");
renderSummary();
} else if (state.activeView === "progression") {
el.progressionView.classList.remove("hidden");
renderProgression();
} else {
el.calculatorView.classList.remove("hidden");
renderTree(state.activeTab);
renderSidePanel();
}
}
function renderTopbar() {
populateClassSelects();
el.levelInput.value = state.charLevel;
el.totalPointsInput.value = state.totalPoints;
const spent = spentPoints();
const remaining = state.totalPoints - spent;
el.spentValue.textContent = spent;
el.remainingValue.textContent = remaining;
el.remainingValue.classList.toggle("over", remaining < 0);
el.browseToggle.classList.toggle("active", state.activeView === "browse");
}
function populateClassSelects() {
const html = CLASS_LIST.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
el.classSelects.forEach((sel, i) => {
if (sel.innerHTML !== html) sel.innerHTML = html;
sel.value = state.selectedClasses[i];
});
}
function renderTabs() {
const tabDefs = [
...AA_CATEGORY_KEYS.map((key) => ({ key, label: shortCategoryLabel(key) })),
{ key: "summary", label: "Summary" },
{ key: "progression", label: "Progression" }
];
el.tabs.innerHTML = tabDefs.map((t) => {
const isView = t.key === "summary" || t.key === "progression";
const count = t.key === "summary" ? countPicked() : t.key === "progression" ? state.purchaseOrder.length : getList(t.key).length;
const isActive = isView ? state.activeView === t.key : (state.activeView === "calculator" && state.activeTab === t.key);
return `<button data-tab="${t.key}" class="${isActive ? "active" : ""}${isView ? " summary-tab" : ""}">${escapeHtml(t.label)}<span class="count">(${count})</span></button>`;
}).join("");
Array.from(el.tabs.querySelectorAll("button")).forEach((btn) => {
btn.addEventListener("click", () => {
const key = btn.getAttribute("data-tab");
if (key === "summary" || key === "progression") {
state.activeView = key;
} else {
state.activeView = "calculator";
state.activeTab = key;
state.selectedNode = null;
}
renderAll();
});
});
}
function renderTree(catKey) {
const list = getList(catKey);
if (!list.length) {
el.treeWrap.innerHTML = '<div class="empty" style="margin-top:60px;">No AAs documented for this category yet.</div>';
return;
}
const hadFocusInTree = el.treeWrap.contains(document.activeElement);
const grid = document.createElement("div");
grid.className = "tree-grid";
function selectNode(idx) {
state.selectedNode = { category: catKey, idx };
renderAll();
}
list.forEach((aa, idx) => {
const rank = effectiveRank(catKey, idx);
const autoBelowLevel = aa.auto && rank < aa.ranks;
const lockReason = !aa.auto && rank < aa.ranks ? structuralLockReason(catKey, idx) : null;
const locked = !!lockReason || autoBelowLevel;
const node = document.createElement("div");
node.className = "node";
node.tabIndex = 0;
node.setAttribute("role", "button");
node.setAttribute("aria-label", `${aa.name}, rank ${rank} of ${aa.ranks}`);
node.dataset.idx = String(idx);
if (aa.auto && !autoBelowLevel) node.classList.add("auto");
else if (!aa.auto && rank >= aa.ranks) node.classList.add("maxed");
if (locked) node.classList.add("locked");
if (autoBelowLevel) node.title = `Automatically granted at level ${aa.levelReq} — no points needed.`;
else if (lockReason) node.title = lockReason;
else if (aa.auto) node.title = "Automatically granted — no AA points needed.";
if (state.selectedNode && state.selectedNode.category === catKey && state.selectedNode.idx === idx) {
node.classList.add("selected");
}
node.innerHTML = `
      <div class="icon">${escapeHtml(iconLetter(aa.name))}</div>
      <div class="name">${escapeHtml(aa.name)}</div>
      <div class="rankbar"><div class="fill" style="width:${(rank / aa.ranks) * 100}%"></div></div>
      <div class="ranktext">${rank} / ${aa.ranks}</div>
    `;
if (aa.auto && !autoBelowLevel) {
const tag = document.createElement("div");
tag.className = "costtag auto-tag";
tag.textContent = "AUTO";
node.appendChild(tag);
} else if (aa.auto && autoBelowLevel) {
const tag = document.createElement("div");
tag.className = "costtag";
tag.textContent = `Lv.${aa.levelReq}`;
node.appendChild(tag);
} else if (rank < aa.ranks) {
const tag = document.createElement("div");
tag.className = "costtag";
tag.textContent = aa.costs[rank];
node.appendChild(tag);
}
node.addEventListener("click", () => selectNode(idx));
node.addEventListener("keydown", (e) => {
if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
e.preventDefault();
selectNode(idx);
});
grid.appendChild(node);
});
el.treeWrap.innerHTML = "";
el.treeWrap.appendChild(grid);
if (hadFocusInTree && state.selectedNode && state.selectedNode.category === catKey) {
const focusTarget = grid.querySelector(`[data-idx="${state.selectedNode.idx}"]`);
if (focusTarget) focusTarget.focus();
}
}
function renderSidePanel() {
const sel = state.selectedNode;
if (!sel) {
el.sidePanel.innerHTML = '<div class="empty">Select an AA node to see its details and spend points.</div>';
return;
}
const list = getList(sel.category);
const aa = list[sel.idx];
if (!aa) { state.selectedNode = null; el.sidePanel.innerHTML = '<div class="empty">Select an AA node to see its details.</div>'; return; }
const rank = effectiveRank(sel.category, sel.idx);
const resolved = aa.prereq ? resolvePrereqTarget(aa.prereq, sel.category) : null;
const atMax = rank >= aa.ranks;
const blockReason = atMax ? null : getBlockReason(sel.category, sel.idx);
const nextCost = rank < aa.ranks ? costNum(aa.costs[rank]) : null;
const dependedOn = rank > 0 && isDependedOn(sel.category, sel.idx, rank);
let html = `<h2>${escapeHtml(aa.name)}</h2>`;
html += `<div class="meta">${escapeHtml(labelFor(sel.category))} &middot; Level ${escapeHtml(aa.levelReq)}+</div>`;
html += `<div class="desc">${highlightRankValue(aa.description, rank)}</div>`;
if (aa.prereq) {
html += `<div class="req-line ${resolved ? "" : "warn"}"><b>Requires:</b> ${escapeHtml(aa.prereq)}</div>`;
}
html += `<div class="rank-controls">
    <button id="decBtn" ${rank <= 0 || aa.auto ? "disabled" : ""} class="${dependedOn ? "blocked" : ""}">&minus;</button>
    <span class="current">${rank} / ${aa.ranks}</span>
    <button id="incBtn" ${atMax || aa.auto ? "disabled" : ""} class="${blockReason ? "blocked" : ""}">+</button>
  </div>`;
if (aa.auto) {
const levelReq = parseInt(aa.levelReq, 10) || 1;
if (state.charLevel < levelReq) {
html += `<div class="req-line warn">Automatically granted at level ${levelReq} &mdash; not yet active at level ${state.charLevel}.</div>`;
} else {
html += `<div class="req-line">Automatically granted &mdash; no AA points required, always active once unlocked.</div>`;
if (aa.ranks > 1) {
html += `<div class="req-line" style="color:#63636a;">The wiki doesn't document per-rank level breakpoints for this ability, so it's shown at max rank once level ${levelReq}+ is reached.</div>`;
}
}
} else {
if (blockReason) {
html += `<div class="req-line warn">${escapeHtml(blockReason)}</div>`;
}
if (dependedOn) {
html += `<div class="req-line warn">Another AA depends on this rank &mdash; lower it first.</div>`;
}
if (nextCost !== null) {
html += `<div class="req-line">Next rank cost: <b>${escapeHtml(aa.costs[rank])}</b> pt(s)</div>`;
}
html += `<div class="rank-costs">` + aa.costs.map((c, i) => `<span class="pip ${i < rank ? "spent" : ""}">R${i + 1}: ${escapeHtml(c)}</span>`).join("") + `</div>`;
if (aa.costs.some((c) => String(c).trim() === "?")) {
html += `<div class="req-line" style="margin-top:10px; color:#63636a;">Some per-rank costs are undocumented on the wiki source ("?") and are treated as 0 pts until known.</div>`;
}
}
el.sidePanel.innerHTML = html;
const incBtn = document.getElementById("incBtn");
const decBtn = document.getElementById("decBtn");
if (incBtn) incBtn.addEventListener("click", () => attemptIncrement(sel.category, sel.idx));
if (decBtn) decBtn.addEventListener("click", () => attemptDecrement(sel.category, sel.idx));
}
function renderBrowse() {
const q = state.browseSearch.trim().toLowerCase();
const filter = state.browseFilter;
const items = [];
function pushList(catLabel, list) {
list.forEach((aa) => items.push({ cat: catLabel, aa }));
}
if (filter === "all" || filter === "general") pushList("General", AA_DATA.general);
if (filter === "all" || filter === "archetype") pushList("Archetype", AA_DATA.archetype);
if (filter === "all" || filter === "special") pushList("Special", AA_DATA.special);
if (filter === "all") {
CLASS_LIST.forEach((c) => pushList(c, AA_DATA.classes[c] || []));
} else if (CLASS_LIST.includes(filter)) {
pushList(filter, AA_DATA.classes[filter] || []);
}
const filtered = q
? items.filter(({ aa }) => aa.name.toLowerCase().includes(q) || aa.description.toLowerCase().includes(q))
: items;
el.browseGrid.innerHTML = filtered.length
? filtered.map(({ cat, aa }) => `
      <div class="browse-card">
        <div class="top"><span class="name">${escapeHtml(aa.name)}${aa.auto ? ' <span class="auto-badge">(AUTO)</span>' : ""}</span><span class="cat">${escapeHtml(cat)}</span></div>
        <div class="desc">${escapeHtml(aa.description)}</div>
        <div class="info">Ranks: ${aa.ranks} &middot; Cost/rank: ${aa.costs.map(escapeHtml).join(" / ")} &middot; Level ${escapeHtml(aa.levelReq)}+${aa.prereq ? " &middot; Requires: " + escapeHtml(aa.prereq) : ""}</div>
      </div>`).join("")
: '<div class="empty">No AAs match your search.</div>';
}
function renderSummary() {
const spent = spentPoints();
const remaining = state.totalPoints - spent;
el.summaryHeader.innerHTML = `<div class="summary-meta">Classes: <b>${state.selectedClasses.map(escapeHtml).join(" / ")}</b> &middot; Character Level <b>${state.charLevel}</b> &middot; Points Spent: <b>${spent} / ${state.totalPoints}</b> (${remaining} remaining)</div>`;
const sections = AA_CATEGORY_KEYS.map((key) => ({ key, label: shortCategoryLabel(key) }));
let html = "";
let anyPicked = false;
sections.forEach(({ key, label }) => {
const list = getList(key);
const picked = list.map((aa, idx) => ({ aa, rank: effectiveRank(key, idx) })).filter((x) => x.rank > 0);
if (!picked.length) return;
anyPicked = true;
html += `<h3 class="summary-section-title">${escapeHtml(label)}</h3>`;
html += `<div class="browse-grid">` + picked.map(({ aa, rank }) => `
      <div class="browse-card">
        <div class="top"><span class="name">${escapeHtml(aa.name)}${aa.auto ? ' <span class="auto-badge">(AUTO)</span>' : ""}</span><span class="cat">Rank ${rank}/${aa.ranks}</span></div>
        <div class="desc">${highlightRankValue(aa.description, rank)}</div>
      </div>`).join("") + `</div>`;
});
el.summaryContent.innerHTML = anyPicked ? html : '<div class="empty">No AAs selected yet &mdash; spend some points in the calculator, then check back here.</div>';
}
function renderProgression() {
if (!state.purchaseOrder.length) {
el.progressionContent.innerHTML = '<div class="empty">No AAs picked yet &mdash; your training order will appear here as you spend points, and you can reorder it afterward to plan ahead.</div>';
return;
}
const steps = computeProgressionSteps();
const rows = steps.map((s) => `<div class="progression-row${s.active ? "" : " inactive"}">
      <span class="step-num">${s.index + 1}</span>
      <span class="step-info">
        <span class="step-name">${escapeHtml(s.name)} <span class="step-rank">rank ${s.stepRank}</span></span>
        <span class="step-cat">${escapeHtml(s.label)}${s.active ? "" : " &middot; class not currently selected"}</span>
      </span>
      ${s.prereqWarn ? '<span class="step-warn" title="Prerequisite not yet trained at this point in the sequence">&#9888;</span>' : ""}
      <span class="step-cost">
        <span class="cost-this">+${s.stepCost} pt${s.stepCost === 1 ? "" : "s"}</span>
        <span class="cost-total">${s.cumulative} total</span>
      </span>
      <span class="step-controls">
        <button class="step-btn" data-move="up" data-index="${s.index}" ${s.index === 0 ? "disabled" : ""}>&uarr;</button>
        <button class="step-btn" data-move="down" data-index="${s.index}" ${s.index === steps.length - 1 ? "disabled" : ""}>&darr;</button>
      </span>
    </div>`);
el.progressionContent.innerHTML = rows.join("");
Array.from(el.progressionContent.querySelectorAll(".step-btn")).forEach((btn) => {
if (btn.disabled) return;
btn.addEventListener("click", () => {
const idx = parseInt(btn.getAttribute("data-index"), 10);
const dir = btn.getAttribute("data-move") === "up" ? -1 : 1;
moveProgressionEntry(idx, dir);
});
});
}
function moveProgressionEntry(index, dir) {
const target = index + dir;
if (target < 0 || target >= state.purchaseOrder.length) return;
const a = state.purchaseOrder[index];
const b = state.purchaseOrder[target];
const sameAA = a.scope === b.scope && a.idx === b.idx && (a.className || null) === (b.className || null);
if (sameAA) { showToast("Can't reorder different ranks of the same AA."); return; }
state.purchaseOrder[index] = b;
state.purchaseOrder[target] = a;
saveLocal();
renderProgression();
}
function populateStaticControls() {
el.browseFilter.innerHTML =
`<option value="all">All Categories</option>` +
`<option value="general">General</option>` +
`<option value="archetype">Archetype</option>` +
`<option value="special">Special</option>` +
`<optgroup label="Class">` +
CLASS_LIST.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("") +
`</optgroup>`;
}
function showToast(msg) {
el.toast.textContent = msg;
el.toast.classList.add("show");
clearTimeout(showToast._t);
showToast._t = setTimeout(() => el.toast.classList.remove("show"), 2200);
}
function buildExportText() {
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
const codeObj = {
v: 3,
selectedClasses: state.selectedClasses,
totalPoints: state.totalPoints,
ranks: state.ranks,
purchaseOrder: state.purchaseOrder
};
const code = btoa(unescape(encodeURIComponent(JSON.stringify(codeObj))));
lines.push(`BUILD_CODE:${code}`);
return lines.join("\n");
}
function openExportModal() {
el.exportText.value = buildExportText();
el.exportModal.classList.remove("hidden");
el.exportText.focus();
el.exportText.select();
}
function closeExportModal() {
el.exportModal.classList.add("hidden");
}
function copyExportText() {
const text = el.exportText.value;
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(text).then(
() => showToast("Copied to clipboard"),
() => fallbackCopy(text)
);
} else {
fallbackCopy(text);
}
}
function fallbackCopy(text) {
el.exportText.value = text;
el.exportText.select();
try {
document.execCommand("copy");
showToast("Copied to clipboard");
} catch (e) {
showToast("Couldn't copy automatically — select and copy manually.");
}
}
function saveExportAsTxt() {
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
function extractBuildCode(text) {
const trimmed = text.trim();
const m = trimmed.match(/BUILD_CODE:(\S+)/);
if (m) return m[1];
const compact = trimmed.replace(/\s+/g, "");
if (compact.length > 20 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return compact;
return null;
}
function importBuildFromText(text) {
const code = extractBuildCode(text);
if (!code) { showToast("No build code found in that text"); return false; }
try {
const json = JSON.parse(decodeURIComponent(escape(atob(code))));
applyLoaded(json);
state.selectedNode = null;
saveLocal();
renderAll();
showToast("Build imported");
return true;
} catch (e) {
showToast("Failed to read build text");
return false;
}
}
function openImportModal() {
el.importText.value = "";
el.importModal.classList.remove("hidden");
el.importText.focus();
}
function closeImportModal() {
el.importModal.classList.add("hidden");
}
function doImport() {
const text = el.importText.value.trim();
if (!text) { showToast("Paste build text first"); return; }
if (importBuildFromText(text)) closeImportModal();
}
function wireEvents() {
el.classSelects.forEach((sel, i) => {
sel.addEventListener("change", () => {
const newValue = sel.value;
const oldValue = state.selectedClasses[i];
if (newValue === oldValue) return;
const dupSlot = state.selectedClasses.findIndex((c, j) => j !== i && c === newValue);
if (dupSlot < 0) {
const oldStore = state.ranks.classes[oldValue];
const oldList = AA_DATA.classes[oldValue] || [];
let oldSpent = 0;
if (oldStore) {
Object.keys(oldStore).forEach((key) => {
const aa = oldList[key];
if (!aa) return;
const r = oldStore[key] || 0;
for (let k = 0; k < r; k++) oldSpent += costNum(aa.costs[k]);
});
}
if (oldSpent > 0) {
const ok = confirm(`Switching Class ${i + 1} from ${oldValue} to ${newValue} will remove ${oldValue}'s AA picks (${oldSpent} point${oldSpent === 1 ? "" : "s"} spent) from this build. Continue?`);
if (!ok) { populateClassSelects(); return; }
}
clearClassData(oldValue);
}
state.selectedClasses[i] = newValue;
if (dupSlot >= 0) {
state.selectedClasses[dupSlot] = oldValue;
if (state.activeTab === CLASS_SLOT_KEYS[dupSlot]) state.selectedNode = null;
}
if (state.activeTab === CLASS_SLOT_KEYS[i]) state.selectedNode = null;
saveLocal();
renderAll();
});
});
el.levelInput.addEventListener("change", () => {
const v = parseInt(el.levelInput.value, 10);
state.charLevel = isNaN(v) ? state.charLevel : Math.max(1, Math.min(50, v));
saveLocal();
renderAll();
});
el.totalPointsInput.addEventListener("change", () => {
const v = parseInt(el.totalPointsInput.value, 10);
state.totalPoints = isNaN(v) ? state.totalPoints : Math.max(0, v);
saveLocal();
renderAll();
});
el.browseToggle.addEventListener("click", () => {
state.activeView = state.activeView === "browse" ? "calculator" : "browse";
renderAll();
});
el.exportBtn.addEventListener("click", openExportModal);
el.copyExportBtn.addEventListener("click", copyExportText);
el.saveExportBtn.addEventListener("click", saveExportAsTxt);
el.closeExportBtn.addEventListener("click", closeExportModal);
el.exportModal.addEventListener("click", (e) => { if (e.target === el.exportModal) closeExportModal(); });
document.addEventListener("keydown", (e) => {
if (e.key !== "Escape") return;
if (!el.exportModal.classList.contains("hidden")) closeExportModal();
if (!el.importModal.classList.contains("hidden")) closeImportModal();
});
el.importBtn.addEventListener("click", openImportModal);
el.loadImportFileBtn.addEventListener("click", () => el.importFile.click());
el.importFile.addEventListener("change", () => {
const file = el.importFile.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = () => {
el.importText.value = String(reader.result);
doImport();
};
reader.readAsText(file);
el.importFile.value = "";
});
el.doImportBtn.addEventListener("click", doImport);
el.closeImportBtn.addEventListener("click", closeImportModal);
el.importModal.addEventListener("click", (e) => { if (e.target === el.importModal) closeImportModal(); });
el.resetBtn.addEventListener("click", () => {
if (!confirm("Reset all spent AA points across every category and class? This cannot be undone.")) return;
state.ranks = { general: {}, archetype: {}, special: {}, classes: {} };
state.purchaseOrder = [];
state.selectedNode = null;
saveLocal();
renderAll();
showToast("Build reset");
});
el.dismissBannerBtn.addEventListener("click", () => {
el.disclaimerBanner.classList.add("hidden");
try { localStorage.setItem(DISCLAIMER_DISMISSED_KEY, "1"); } catch (e) { /* storage unavailable, ignore */ }
});
el.browseSearch.addEventListener("input", () => {
state.browseSearch = el.browseSearch.value;
renderBrowse();
});
el.browseFilter.addEventListener("change", () => {
state.browseFilter = el.browseFilter.value;
renderBrowse();
});
window.addEventListener("resize", () => {
if (state.activeView === "calculator") renderTree(state.activeTab);
});
}
function init() {
cacheDom();
populateStaticControls();
applyLoaded(loadLocal());
wireEvents();
try {
if (!localStorage.getItem(DISCLAIMER_DISMISSED_KEY)) el.disclaimerBanner.classList.remove("hidden");
} catch (e) {
el.disclaimerBanner.classList.remove("hidden");
}
renderAll();
}
document.addEventListener("DOMContentLoaded", init);
})();
