(function () {
"use strict";
const LEGACY_AA_ORDER = {
"general": [
"Adamant Will", "Alchemy Mastery", "Baking Mastery", "Blacksmithing Mastery",
"Brewing Mastery", "Circular Breathing", "Combat Agility", "Combat Fury",
"Combat Stability", "Crafting Mastery", "Fear Resistance", "First Aid",
"Fletching Mastery", "Foraging", "Gather Party", "Innate Eminence",
"Innate Lung Capacity", "Innate Metabolism", "Innate Regeneration",
"Innate Spell Resistance", "Jewel Craft Mastery", "Natural Durability",
"Origin", "Packrat", "Permanent Illusion", "Pottery Mastery", "Quick Buff",
"Steadfast Will", "Stoicism", "Tailoring Mastery"
],
"archetype": [
"Acrobatics", "Ambidexterity", "Burst of Power", "Companion's Discipline",
"Critical Affliction", "Destructive Cascade", "Destructive Fury",
"Double Riposte", "Exodus", "Finishing Blow", "Fury of Magic",
"Healing Adept", "Healing Boon", "Healing Gift", "Improved Bash",
"Innate Camouflage", "Innate Invis to Undead", "Intimidation",
"Mass Group Buff", "Master of All", "Mastery of the Past", "Mend Companion",
"Mental Clarity", "Mnemonic Retention", "Persistent Casting", "Pet Affinity",
"Physical Enhancement", "Quick Damage", "Rampage", "Spell Casting Deftness",
"Spell Casting Mastery", "Spell Casting Reinforcement",
"Spell Casting Subtlety", "Thief's Intuition"
],
"special": ["Banestrike"],
"classes": {
"Bard": ["Instrument Mastery", "Jam Fest", "Reaching Notes", "Scribble Notes", "Singing Mastery", "Symphonic Aura"],
"Beastlord": ["Frenzy of Spirit", "Hobble of Spirits", "Paragon of Spirit", "Playing Possum"],
"Berserker": ["Blood Rune", "Innate Power Strike", "Tireless Spirit", "Unbound Fury"],
"Cleric": ["Divine Aura", "Divine Aura", "Bestow Divine Aura", "Purify Soul", "Turn Undead", "Unbound Boon"],
"Druid": ["Enhanced Root", "Quick Evacuation", "Unbound Nature"],
"Enchanter": ["Unbound Clarity"],
"Magician": ["Companion's Fury", "Conjurer's Efficiency", "Elemental Form", "Turn Summoned", "Unbound Companion"],
"Monk": ["Dragon Force", "Improved Mend", "Purify Body", "Rapid Feign"],
"Necromancer": ["Dead Mesmerization", "Fear Storm", "Flesh to Bone", "Life Burn", "Unbound Affliction"],
"Paladin": ["Act of Valor", "Divine Stun", "Holy Steed", "Lay on Hands", "Slay Undead", "Valiant Steed"],
"Ranger": ["Hunter's Attack Power", "Innate Called Shot", "Unbounded Strikethrough", "Weapon Mastery of the Scout"],
"Rogue": ["Chaotic Stab", "Escape", "Innate Sneakiness", "Purge Poison", "Shroud of Stealth"],
"Shadow Knight": ["Unholy Steed", "Abyssal Steed", "Harm Touch", "Leech Touch", "Soul Abrasion"],
"Shaman": ["Cannibalization", "Unbound Cascade"],
"Warrior": ["Area Taunt", "Heroic Leap", "Innate Fighters Tenacity", "Unbound Wrath", "War Cry", "Warrior's Endurance"],
"Wizard": ["Improved Familiar", "Mana Burn", "Quick Evacuation", "Strong Root", "Unbound Destruction"]
}
};
function slugify(name) {
return String(name || "")
.toLowerCase()
.replace(/'/g, "")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "");
}
function keyForNameIdx(names, idx) {
const name = names[idx];
if (name == null) return null;
const base = slugify(name);
let dup = 0;
for (let i = 0; i < idx; i++) {
if (slugify(names[i]) === base) dup++;
}
return dup === 0 ? base : `${base}-${dup + 1}`;
}
function idxForNameKey(names, key) {
for (let i = 0; i < names.length; i++) {
if (keyForNameIdx(names, i) === key) return i;
}
return -1;
}
function currentList(scope, className) {
return scope === "class" ? (AA_DATA.classes[className] || []) : (AA_DATA[scope] || []);
}
function currentNames(scope, className) {
return currentList(scope, className).map((aa) => aa.name);
}
function aaAt(scope, className, idx) {
return currentList(scope, className)[idx] || null;
}
function legacyNames(scope, className) {
return scope === "class" ? (LEGACY_AA_ORDER.classes[className] || []) : (LEGACY_AA_ORDER[scope] || []);
}
function keyForIdx(scope, className, idx) {
return keyForNameIdx(currentNames(scope, className), idx);
}
function idxForKey(scope, className, key) {
return idxForNameKey(currentNames(scope, className), key);
}
function currentIdxForLegacyIdx(scope, className, legacyIdx) {
const names = legacyNames(scope, className);
if (legacyIdx < 0 || legacyIdx >= names.length) return -1;
const key = keyForNameIdx(names, legacyIdx);
if (!key) return -1;
return idxForNameKey(currentNames(scope, className), key);
}
const USER_CHANGELOG = [
{
version: "1.0.0",
date: "2026-07-09",
items: [
"Next-rank preview: see what the next rank upgrades to before you buy it, in the side panel and as an expandable row in the Progression tab.",
"Global search: highlights matches in the tab you're on and shows match-count badges on other tabs that have matches too.",
"Progression tab: reorderable purchase history with per-step and running-total cost, add/remove controls, and single-level undo.",
"Shareable build links, plus text export/import (paste text, paste a share link, or load a saved .txt file).",
"Fixed a prerequisite bug: some prereqs (like Destructive Cascade needing Critical Affliction) now unlock rank-by-rank instead of requiring the target's max rank just to buy rank 1.",
"Data corrections from in-game confirmation and a fresh wiki scrape: Unbound Companion, Hunter's Attack Power, Fury of Magic, Soul Abrasion, and others."
]
}
];
const MAX_TOTAL_POINTS = 100000;
const SAVE_FORMAT_VERSION = 4;
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
function serializeRanks(ranks) {
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
function serializePurchaseOrder(purchaseOrder) {
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
function saveLocal() {
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
state.totalPoints = Math.max(0, Math.min(MAX_TOTAL_POINTS, loaded.totalPoints));
}
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
function applyPerRankTotal(text, rank) {
if (!rank || rank < 2) return text;
return text.replace(/(\d+(?:\.\d+)?)(%)?\s*(points?|seconds?)?\s*(chance)?\s*\(?per rank\)?/gi,
(match, numStr, pct, unit, chanceWord) => {
const num = parseFloat(numStr);
const total = num * rank;
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
let unitLabel = "";
if (pct) unitLabel = "%";
else if (unit) {
const singular = unit.replace(/s$/i, "");
unitLabel = " " + (total === 1 ? singular : singular + "s");
}
const chancePart = chanceWord ? " chance" : "";
return `${fmt(total)}${unitLabel}${chancePart} (${fmt(num)}${pct ? "%" : ""} per rank)`;
});
}
function aaMatchesQuery(aa, query) {
if (!query) return false;
const q = query.trim().toLowerCase();
if (!q) return false;
return aa.name.toLowerCase().includes(q) || aa.description.toLowerCase().includes(q);
}
function countMatches(catKey, query) {
if (!query || !query.trim()) return 0;
return getList(catKey).filter((aa) => aaMatchesQuery(aa, query)).length;
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
const purchased = store[idx] || 0;
if (aa && aa.autoRanks) {
const levelReq = parseInt(aa.levelReq, 10) || 1;
const freeRanks = state.charLevel >= levelReq ? Math.min(aa.autoRanks, aa.ranks) : 0;
return Math.max(freeRanks, purchased);
}
return purchased;
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
const [entry] = state.purchaseOrder.splice(i, 1);
return { entry, position: i };
}
}
return null;
}
function clearClassData(className) {
delete state.ranks.classes[className];
state.purchaseOrder = state.purchaseOrder.filter((e) => !(e.scope === "class" && e.className === className));
lastMutation = null;
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
const m = text.match(/^Requires\s+(.+?)\s+(?:rank|(?:at\s+)?level)\s+(\d+(?:\/\d+)*)\s*$/i);
if (!m) return null;
const ranks = m[2].split("/").map((n) => parseInt(n, 10));
return ranks.length > 1
? { name: m[1].trim(), synced: true, ranks }
: { name: m[1].trim(), synced: false, rank: ranks[0] };
}
function resolvePrereqTarget(text, sourceCategory) {
const parsed = parsePrereqText(text);
if (!parsed) return null;
const order = [];
const seen = new Set();
[sourceCategory, "general", "archetype", "special"].forEach((k) => {
if (!seen.has(k)) { seen.add(k); order.push(k); }
});
for (const key of order) {
const list = getList(key);
let foundIdx = -1;
list.forEach((aa, i) => {
if (aa.name.toLowerCase() !== parsed.name.toLowerCase()) return;
if (foundIdx < 0) { foundIdx = i; return; }
if (list[foundIdx].auto && !aa.auto) foundIdx = i;
});
if (foundIdx >= 0) {
return {
category: key,
idx: foundIdx,
forRank(sourceRank) {
if (!parsed.synced) return parsed.rank;
const i = Math.min(Math.max(sourceRank, 1), parsed.ranks.length) - 1;
return parsed.ranks[i];
}
};
}
}
return null;
}
function tryResolvePrereq(text, sourceCategory) {
const parsed = parsePrereqText(text);
if (!parsed) return { ok: false, malformed: true };
const resolved = resolvePrereqTarget(text, sourceCategory);
if (!resolved) return { ok: false, malformed: false, name: parsed.name };
return { ok: true, resolved };
}
function unresolvedPrereqMessage(text, attempt) {
return attempt.malformed
? `Prerequisite text "${text}" isn't in a recognized format — this needs fixing in the data, not the wiki.`
: `Requires "${attempt.name}", which no longer resolves to an existing ability.`;
}
function structuralLockReason(catKey, idx) {
const aa = getList(catKey)[idx];
const levelReq = parseInt(aa.levelReq, 10) || 1;
if (state.charLevel < levelReq) return `Requires character level ${levelReq}.`;
if (aa.prereq) {
const attempt = tryResolvePrereq(aa.prereq, catKey);
if (!attempt.ok) return unresolvedPrereqMessage(aa.prereq, attempt);
const resolved = attempt.resolved;
const sourceRank = effectiveRank(catKey, idx) + 1;
const requiredRank = resolved.forRank(sourceRank);
const targetRank = effectiveRank(resolved.category, resolved.idx);
if (targetRank < requiredRank) {
const targetAA = getList(resolved.category)[resolved.idx];
return `Requires ${targetAA ? targetAA.name : "prerequisite"} rank ${requiredRank}.`;
}
}
return null;
}
function heldRankInvalidReason(catKey, idx) {
const aa = getList(catKey)[idx];
if (!aa || !aa.prereq || aa.auto) return null;
const purchased = getRanksStore(catKey)[idx] || 0;
if (purchased <= 0) return null;
const attempt = tryResolvePrereq(aa.prereq, catKey);
if (!attempt.ok) return unresolvedPrereqMessage(aa.prereq, attempt);
const resolved = attempt.resolved;
const targetRank = effectiveRank(resolved.category, resolved.idx);
for (let r = 1; r <= purchased; r++) {
const required = resolved.forRank(r);
if (targetRank < required) {
const targetAA = getList(resolved.category)[resolved.idx];
return `Rank ${r} requires ${targetAA ? targetAA.name : "a prerequisite"} rank ${required}, which you no longer have.`;
}
}
return null;
}
function findInvalidatedPicks() {
const results = [];
AA_CATEGORY_KEYS.forEach((catKey) => {
getList(catKey).forEach((aa, idx) => {
const reason = heldRankInvalidReason(catKey, idx);
if (reason) results.push({ category: catKey, idx, name: aa.name, reason });
});
});
return results;
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
const aaRank = effectiveRank(catKey, i);
if (aaRank <= 0) continue;
const r = resolvePrereqTarget(aa.prereq, catKey);
if (r && r.category === category && r.idx === idx && newRank < r.forRank(aaRank)) return true;
}
}
return false;
}
let lastMutation = null;
function clearLastMutation() {
lastMutation = null;
}
function canUndo() {
return !!lastMutation;
}
function changeRank(category, idx, delta) {
const store = getRanksStore(category);
const aa = getList(category)[idx];
const floor = aa.autoRanks ? Math.min(aa.autoRanks, aa.ranks) : 0;
const cur = aa.autoRanks ? effectiveRank(category, idx) : (store[idx] || 0);
const next = cur + delta;
if (next < floor || next > aa.ranks) return false;
if (next === 0) delete store[idx]; else store[idx] = next;
if (delta > 0) {
pushPurchase(category, idx);
lastMutation = { type: "add", category, idx };
} else {
const popped = popLastPurchase(category, idx);
lastMutation = popped ? { type: "remove", entry: popped.entry, position: popped.position } : null;
}
saveLocal();
return true;
}
function undoLastMutation() {
const m = lastMutation;
if (!m) return { changed: false, message: "Nothing to undo." };
lastMutation = null;
if (m.type === "add") {
const rank = effectiveRank(m.category, m.idx);
if (rank <= 0) return { changed: false, message: "Nothing to undo." };
if (isDependedOn(m.category, m.idx, rank)) {
return { changed: false, message: "Can't undo — another AA now depends on this rank." };
}
return { changed: changeRank(m.category, m.idx, -1), message: null };
}
const category = resolveEntryCategory(m.entry);
if (!category) return { changed: false, message: "Can't undo — that class isn't currently selected." };
const aa = getList(category)[m.entry.idx];
if (!aa) return { changed: false, message: "Can't undo — that AA is no longer available." };
const store = getRanksStore(category);
const cur = store[m.entry.idx] || 0;
if (cur >= aa.ranks) return { changed: false, message: "Can't undo — already at max rank." };
store[m.entry.idx] = cur + 1;
const pos = Math.min(m.position, state.purchaseOrder.length);
state.purchaseOrder.splice(pos, 0, m.entry);
saveLocal();
return { changed: true, message: null };
}
function attemptIncrement(category, idx) {
const aa = getList(category)[idx];
if (aa.auto) return { changed: false, message: `${aa.name} is automatically granted — no points needed.` };
const rank = effectiveRank(category, idx);
if (rank >= aa.ranks) return { changed: false, message: null };
const reason = getBlockReason(category, idx);
if (reason) return { changed: false, message: reason };
return { changed: changeRank(category, idx, 1), message: null };
}
function attemptDecrement(category, idx) {
const aa = getList(category)[idx];
if (aa.auto) return { changed: false, message: `${aa.name} is automatically granted and can't be removed.` };
const rank = effectiveRank(category, idx);
if (rank <= 0) return { changed: false, message: null };
if (aa.autoRanks && rank <= Math.min(aa.autoRanks, aa.ranks)) {
const plural = aa.autoRanks === 1 ? "rank is" : "ranks are";
return { changed: false, message: `${aa.name}'s first ${aa.autoRanks} ${plural} automatically granted and can't be removed.` };
}
if (isDependedOn(category, idx, rank)) {
return { changed: false, message: "Can't lower this — another AA depends on the current rank." };
}
return { changed: changeRank(category, idx, -1), message: null };
}
function countPicked() {
let n = 0;
AA_CATEGORY_KEYS.forEach((catKey) => {
getList(catKey).forEach((aa, idx) => { if (effectiveRank(catKey, idx) > 0) n++; });
});
return n;
}
function computeProgressionSteps() {
const totalCounts = {};
state.purchaseOrder.forEach((entry) => {
const key = entryKey(entry.scope, entry.className, entry.idx);
totalCounts[key] = (totalCounts[key] || 0) + 1;
});
const counts = {};
let cumulative = 0;
return state.purchaseOrder.map((entry, i) => {
const key = entryKey(entry.scope, entry.className, entry.idx);
const category = resolveEntryCategory(entry);
const active = category !== null;
const aa = entry.scope === "class" ? (AA_DATA.classes[entry.className] || [])[entry.idx] : (AA_DATA[entry.scope] || [])[entry.idx];
const purchaseCount = (counts[key] || 0) + 1;
const autoOffset = aa && aa.autoRanks ? Math.min(aa.autoRanks, aa.ranks) : 0;
const stepRank = purchaseCount + autoOffset;
let prereqWarn = false;
if (active && aa && aa.prereq) {
const attempt = tryResolvePrereq(aa.prereq, category);
if (!attempt.ok) {
prereqWarn = true;
} else {
const t = categoryToScopeClassName(attempt.resolved.category);
const targetKey = entryKey(t.scope, t.className, attempt.resolved.idx);
if ((counts[targetKey] || 0) < attempt.resolved.forRank(stepRank)) prereqWarn = true;
}
}
counts[key] = purchaseCount;
const isLast = purchaseCount === totalCounts[key];
const stepCost = active && aa ? costNum(aa.costs[stepRank - 1]) : 0;
cumulative += stepCost;
const label = entry.scope === "class" ? `${entry.className} AA` : labelFor(entry.scope);
const name = aa ? aa.name : "(unknown AA)";
return { index: i, aa, idx: entry.idx, category, active, stepRank, stepCost, cumulative, prereqWarn, label, name, isLast };
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
el.totalDisplayValue = document.getElementById("totalDisplayValue");
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
el.shareLinkInput = document.getElementById("shareLinkInput");
el.copyShareLinkBtn = document.getElementById("copyShareLinkBtn");
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
el.undoLastBtn = document.getElementById("undoLastBtn");
el.treeWrap = document.getElementById("treeWrap");
el.sidePanel = document.getElementById("sidePanel");
el.globalSearch = document.getElementById("globalSearch");
el.clearSearchBtn = document.getElementById("clearSearchBtn");
el.browseFilter = document.getElementById("browseFilter");
el.browseGrid = document.getElementById("browseGrid");
el.toast = document.getElementById("toast");
el.disclaimerBanner = document.getElementById("disclaimerBanner");
el.dismissBannerBtn = document.getElementById("dismissBannerBtn");
el.versionTag = document.getElementById("versionTag");
el.changelogModal = document.getElementById("changelogModal");
el.changelogContent = document.getElementById("changelogContent");
el.closeChangelogBtn = document.getElementById("closeChangelogBtn");
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
el.totalDisplayValue.textContent = state.totalPoints;
el.remainingValue.textContent = `(${remaining} remaining)`;
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
const query = state.browseSearch;
el.tabs.innerHTML = tabDefs.map((t) => {
const isView = t.key === "summary" || t.key === "progression";
const count = t.key === "summary" ? countPicked() : t.key === "progression" ? state.purchaseOrder.length : getList(t.key).length;
const isActive = isView ? state.activeView === t.key : (state.activeView === "calculator" && state.activeTab === t.key);
const matchCount = isView ? 0 : countMatches(t.key, query);
const badge = matchCount > 0 ? `<span class="search-badge" title="${matchCount} match${matchCount === 1 ? "" : "es"} for &quot;${escapeHtml(query.trim())}&quot;">${matchCount}</span>` : "";
return `<button data-tab="${t.key}" class="${isActive ? "active" : ""}${isView ? " summary-tab" : ""}">${escapeHtml(t.label)}<span class="count">(${count})</span>${badge}</button>`;
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
const query = state.browseSearch;
const searching = !!query.trim();
list.forEach((aa, idx) => {
const rank = effectiveRank(catKey, idx);
const autoBelowLevel = aa.auto && rank < aa.ranks;
const lockReason = !aa.auto && rank < aa.ranks ? structuralLockReason(catKey, idx) : null;
const locked = !!lockReason || autoBelowLevel;
const invalidReason = rank > 0 ? heldRankInvalidReason(catKey, idx) : null;
const node = document.createElement("div");
node.className = "node";
node.tabIndex = 0;
node.setAttribute("role", "button");
node.setAttribute("aria-label", `${aa.name}, rank ${rank} of ${aa.ranks}`);
node.dataset.idx = String(idx);
if (aa.auto && !autoBelowLevel) node.classList.add("auto");
else if (!aa.auto && rank >= aa.ranks) node.classList.add("maxed");
if (locked) node.classList.add("locked");
if (invalidReason) node.classList.add("invalidated");
if (searching) node.classList.add(aaMatchesQuery(aa, query) ? "search-match" : "search-dim");
if (invalidReason) node.title = invalidReason;
else if (autoBelowLevel) node.title = `Automatically granted at level ${aa.levelReq} — no points needed.`;
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
if (invalidReason) {
const warn = document.createElement("div");
warn.className = "costtag invalid-tag";
warn.textContent = "⚠";
node.appendChild(warn);
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
const invalidReason = rank > 0 ? heldRankInvalidReason(sel.category, sel.idx) : null;
let html = `<h2>${escapeHtml(aa.name)}</h2>`;
html += `<div class="meta">${escapeHtml(labelFor(sel.category))} &middot; Level ${escapeHtml(aa.levelReq)}+</div>`;
html += `<div class="desc">${highlightRankValue(aa.description, rank)}</div>`;
if (invalidReason) {
html += `<div class="req-line warn">&#9888; No longer valid: ${escapeHtml(invalidReason)}</div>`;
}
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
const nextRank = rank + 1;
html += `<div class="next-rank-box">
        <div class="next-rank-title">Next Rank (${nextRank}/${aa.ranks}) &middot; costs <b>${escapeHtml(aa.costs[rank])}</b> pt(s)</div>
        <div class="desc">${highlightRankValue(applyPerRankTotal(aa.description, nextRank), nextRank)}</div>
      </div>`;
}
html += `<div class="rank-costs">` + aa.costs.map((c, i) => `<span class="pip ${i < rank ? "spent" : ""}">R${i + 1}: ${escapeHtml(c)}</span>`).join("") + `</div>`;
if (aa.costs.some((c) => String(c).trim() === "?")) {
html += `<div class="req-line" style="margin-top:10px; color:#63636a;">Some per-rank costs are undocumented on the wiki source ("?") and are treated as 0 pts until known.</div>`;
}
}
el.sidePanel.innerHTML = html;
const incBtn = document.getElementById("incBtn");
const decBtn = document.getElementById("decBtn");
if (incBtn) incBtn.addEventListener("click", () => applyAttempt(attemptIncrement(sel.category, sel.idx)));
if (decBtn) decBtn.addEventListener("click", () => applyAttempt(attemptDecrement(sel.category, sel.idx)));
}
function applyAttempt(result) {
if (result.message) showToast(result.message);
if (result.changed) renderAll();
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
const filtered = q ? items.filter(({ aa }) => aaMatchesQuery(aa, q)) : items;
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
        <div class="desc">${highlightRankValue(applyPerRankTotal(aa.description, rank), rank)}</div>
      </div>`).join("") + `</div>`;
});
el.summaryContent.innerHTML = anyPicked ? html : '<div class="empty">No AAs selected yet &mdash; spend some points in the calculator, then check back here.</div>';
}
const expandedSteps = new Set();
function expandKey(s) { return `${s.category || ""}:${s.idx}:${s.stepRank}`; }
function renderProgression() {
el.undoLastBtn.disabled = !canUndo();
if (!state.purchaseOrder.length) {
el.progressionContent.innerHTML = '<div class="empty">No AAs picked yet &mdash; your training order will appear here as you spend points, and you can reorder it afterward to plan ahead.</div>';
return;
}
const steps = computeProgressionSteps();
const rows = steps.map((s) => {
const canExpand = !!(s.aa && s.stepRank < s.aa.ranks);
const key = expandKey(s);
const expanded = canExpand && expandedSteps.has(key);
const row = `<div class="progression-row${s.active ? "" : " inactive"}">
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
        <button class="step-btn step-expand${expanded ? " active" : ""}" data-key="${key}" ${canExpand ? "" : "disabled"} title="${canExpand ? "Preview next rank" : "Already at max rank"}">${expanded ? "&and;" : "&or;"}</button>
        <button class="step-btn step-add" data-category="${s.category || ""}" data-idx="${s.idx}" ${s.isLast && s.active && s.aa && s.stepRank < s.aa.ranks ? "" : "disabled"} title="${!s.isLast ? "Only this AA's current top rank can be extended here" : s.aa && s.stepRank >= s.aa.ranks ? "Already at max rank" : "Add another rank"}">+</button>
        <button class="step-btn step-remove" data-category="${s.category || ""}" data-idx="${s.idx}" ${s.isLast && s.active ? "" : "disabled"} title="${!s.isLast ? "Remove this AA's highest rank first" : s.stepRank === 1 ? "Remove this AA from your build" : "Remove this rank"}">${s.stepRank === 1 ? "&times;" : "&minus;"}</button>
      </span>
    </div>`;
if (!expanded) return row;
const nextRank = s.stepRank + 1;
return row + `<div class="next-rank-box progression-next-rank">
        <div class="next-rank-title">Next Rank (${nextRank}/${s.aa.ranks}) &middot; costs <b>${escapeHtml(s.aa.costs[s.stepRank])}</b> pt(s)</div>
        <div class="desc">${highlightRankValue(applyPerRankTotal(s.aa.description, nextRank), nextRank)}</div>
      </div>`;
});
el.progressionContent.innerHTML = rows.join("");
Array.from(el.progressionContent.querySelectorAll(".step-btn[data-move]")).forEach((btn) => {
if (btn.disabled) return;
btn.addEventListener("click", () => {
const idx = parseInt(btn.getAttribute("data-index"), 10);
const dir = btn.getAttribute("data-move") === "up" ? -1 : 1;
moveProgressionEntry(idx, dir);
});
});
Array.from(el.progressionContent.querySelectorAll(".step-expand")).forEach((btn) => {
if (btn.disabled) return;
btn.addEventListener("click", () => {
const key = btn.getAttribute("data-key");
if (expandedSteps.has(key)) expandedSteps.delete(key);
else expandedSteps.add(key);
renderProgression();
});
});
Array.from(el.progressionContent.querySelectorAll(".step-add")).forEach((btn) => {
if (btn.disabled) return;
btn.addEventListener("click", () => {
const category = btn.getAttribute("data-category");
const idx = parseInt(btn.getAttribute("data-idx"), 10);
applyAttempt(attemptIncrement(category, idx));
});
});
Array.from(el.progressionContent.querySelectorAll(".step-remove")).forEach((btn) => {
if (btn.disabled) return;
btn.addEventListener("click", () => {
const category = btn.getAttribute("data-category");
const idx = parseInt(btn.getAttribute("data-idx"), 10);
applyAttempt(attemptDecrement(category, idx));
});
});
}
function undoLast() {
applyAttempt(undoLastMutation());
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
clearLastMutation();
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
function openChangelogModal() {
el.changelogContent.innerHTML = USER_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <div class="changelog-version">v${escapeHtml(entry.version)} <span class="changelog-date">${escapeHtml(entry.date)}</span></div>
      <ul>${entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>`).join("") || '<div class="empty">Nothing here yet.</div>';
el.changelogModal.classList.remove("hidden");
}
function closeChangelogModal() {
el.changelogModal.classList.add("hidden");
}
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
function toBase64Url(b64) {
return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(b64url) {
let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
while (b64.length % 4) b64 += "=";
return b64;
}
function buildShareUrl() {
const url = new URL(window.location.href);
url.search = "";
url.hash = "";
url.searchParams.set("build", toBase64Url(encodeBuildCode()));
return url.toString();
}
function applySharedBuildFromUrl() {
const params = new URLSearchParams(window.location.search);
const raw = params.get("build");
if (!raw) return;
let json = null;
try {
json = decodeBuildCode(fromBase64Url(raw));
} catch (e) {
json = null;
}
if (json) {
const hasExisting = spentPoints() > 0;
const proceed = !hasExisting || confirm("Load the shared build from this link? This will replace your current build. Export your current build first if you want to keep it.");
if (proceed) {
applyLoaded(json);
state.selectedNode = null;
clearLastMutation();
saveLocal();
showToast("Loaded shared build from link");
}
} else {
showToast("That share link's build data looks invalid");
}
const cleanUrl = new URL(window.location.href);
cleanUrl.searchParams.delete("build");
window.history.replaceState({}, "", cleanUrl.toString());
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
lines.push(`BUILD_CODE:${encodeBuildCode()}`);
return lines.join("\n");
}
function openExportModal() {
el.exportText.value = buildExportText();
el.shareLinkInput.value = buildShareUrl();
el.exportModal.classList.remove("hidden");
el.exportText.focus();
el.exportText.select();
}
function closeExportModal() {
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
function copyExportText() {
copyFrom(el.exportText, el.exportText.value);
}
function copyShareLink() {
copyFrom(el.shareLinkInput, el.shareLinkInput.value);
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
const urlMatch = trimmed.match(/[?&]build=([^&\s]+)/);
if (urlMatch) return urlMatch[1];
const compact = trimmed.replace(/\s+/g, "");
if (compact.length > 20 && /^[A-Za-z0-9_-]+={0,2}$/.test(compact)) return compact;
return null;
}
function importBuildFromText(text) {
const code = extractBuildCode(text);
if (!code) { showToast("No build code found in that text"); return false; }
try {
const json = decodeBuildCode(fromBase64Url(code));
applyLoaded(json);
state.selectedNode = null;
clearLastMutation();
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
el.copyShareLinkBtn.addEventListener("click", copyShareLink);
el.saveExportBtn.addEventListener("click", saveExportAsTxt);
el.closeExportBtn.addEventListener("click", closeExportModal);
el.exportModal.addEventListener("click", (e) => { if (e.target === el.exportModal) closeExportModal(); });
document.addEventListener("keydown", (e) => {
if (e.key !== "Escape") return;
if (!el.exportModal.classList.contains("hidden")) closeExportModal();
if (!el.importModal.classList.contains("hidden")) closeImportModal();
if (!el.changelogModal.classList.contains("hidden")) closeChangelogModal();
});
el.versionTag.addEventListener("click", openChangelogModal);
el.closeChangelogBtn.addEventListener("click", closeChangelogModal);
el.changelogModal.addEventListener("click", (e) => { if (e.target === el.changelogModal) closeChangelogModal(); });
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
clearLastMutation();
saveLocal();
renderAll();
showToast("Build reset");
});
el.dismissBannerBtn.addEventListener("click", () => {
el.disclaimerBanner.classList.add("hidden");
try { localStorage.setItem(DISCLAIMER_DISMISSED_KEY, "1"); } catch (e) { /* storage unavailable, ignore */ }
});
el.undoLastBtn.addEventListener("click", undoLast);
el.globalSearch.addEventListener("input", () => {
state.browseSearch = el.globalSearch.value;
renderAll();
});
el.clearSearchBtn.addEventListener("click", () => {
state.browseSearch = "";
el.globalSearch.value = "";
el.globalSearch.focus();
renderAll();
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
applySharedBuildFromUrl();
wireEvents();
try {
if (!localStorage.getItem(DISCLAIMER_DISMISSED_KEY)) el.disclaimerBanner.classList.remove("hidden");
} catch (e) {
el.disclaimerBanner.classList.remove("hidden");
}
const invalidated = findInvalidatedPicks();
if (invalidated.length) {
const n = invalidated.length;
showToast(`${n} pick${n === 1 ? "" : "s"} in your build no longer meet${n === 1 ? "s" : ""} its prerequisite — check the highlighted AAs`);
}
renderAll();
}
document.addEventListener("DOMContentLoaded", init);
})();
