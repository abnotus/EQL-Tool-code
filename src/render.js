// All DOM rendering. Reads from `state` and the logic layer, writes to `el.*`.

import { state, AA_CATEGORY_KEYS, CLASS_SLOT_KEYS, LAST_SEEN_VERSION_KEY, WAYPOINT_COLORS, MAX_WAYPOINT_PTS } from "./state.js";
import { USER_CHANGELOG } from "./changelogData.js";
import { el } from "./dom.js";
import {
  escapeHtml, iconLetter, highlightRankValue, applyPerRankTotal, labelFor, shortCategoryLabel,
  getList, effectiveRank, structuralLockReason, resolvePrereqTarget, getBlockReason,
  isDependedOn, attemptIncrement, attemptDecrement, countPicked, computeProgressionSteps,
  costNum, spentPoints, undoLastMutation, canUndo, moveEntry, setOwnedRank, performReset,
  aaMatchesQuery, countMatches, heldRankInvalidReason, loadIssuesSuffix,
  hasAnyOwned, computeProgressionTimeline, addOrUpdateWaypoint, removeWaypoint, costGuess, costGuessScoped,
  estimatedExtraPoints, effectGuess, effectGuessScoped, guessTitle
} from "./logic.js";
import {
  listBuilds, getActiveBuildId, loadBuild, renameBuild, deleteBuild,
  saveWithNameCheck, confirmReplaceCurrentBuild, clearActiveBuild
} from "./builds.js";

export function renderAll() {
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
  const spent = spentPoints();

  const extra = estimatedExtraPoints();
  if (extra > 0) {
    // The headline number blends real + estimate for display - a guess is
    // still never added to spentPoints() itself anywhere in real math
    // (nothing gates a purchase on a point total anymore, but spentPoints()
    // is still what the Progression tab's running totals and owned/to-go
    // split are built from), this is purely how the topbar's own number
    // reads. The ~ prefix alone signals "this includes an estimate" (same
    // shorthand every per-rank guess in the app already uses); the
    // breakdown lives in the tooltip rather than a second visible element,
    // matching how every other estimate badge here discloses confidence
    // detail on hover instead of inline.
    el.spentValue.textContent = `~${spent + extra}`;
    el.spentValue.classList.add("is-estimate");
    el.spentValue.title = `${spent} confirmed + ${extra} estimated.`;
  } else {
    el.spentValue.textContent = spent;
    el.spentValue.classList.remove("is-estimate");
    el.spentValue.removeAttribute("title");
  }
  el.browseToggle.classList.toggle("active", state.activeView === "browse");
  const activeId = getActiveBuildId();
  const activeBuild = activeId ? listBuilds().find((b) => b.id === activeId) : null;
  el.buildsBtn.textContent = activeBuild ? `Builds: ${activeBuild.name} ▾` : "Builds ▾";
}

export function populateClassSelects() {
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

// Shared by every place that shows a per-rank cost - the tree node's cost
// badge, the side panel's next-rank box and rank-costs pip strip, Browse's
// per-rank cost list, and the Progression tab's per-step cost pill and its
// own next-rank preview - so they all resolve the same "is this rank's real
// cost known, or are we showing a pattern-inferred estimate" decision one
// way, instead of each reimplementing it (and drifting) slightly
// differently. A guess is display-only: nothing here ever feeds
// costNum()/spentPoints() - those keep treating "?" as 0 exactly like
// before, regardless of whether a guess exists for display.
function formatGuessDisplay(rawCost, guess) {
  if (rawCost !== "?") return { text: escapeHtml(rawCost), isGuess: false };
  if (!guess) return { text: "?", isGuess: false };
  return { text: `~${guess.value}`, isGuess: true, confidence: guess.confidence, basedOn: guess.basedOn, interpolated: !!guess.interpolated, manual: !!guess.manual, title: guessTitle(guess) };
}

// catKey-based lookup - one of the 3 currently-active class slots (or
// general/archetype/special). Used by the tree, side panel, and Progression
// (whose steps are always for an active or formerly-active selection).
function costDisplay(catKey, idx, rankIdx, rawCost) {
  return formatGuessDisplay(rawCost, rawCost === "?" ? costGuess(catKey, idx, rankIdx) : null);
}

// (scope, className)-based lookup, bypassing the active-slot requirement -
// for Browse, which shows every class's AAs regardless of whether that
// class is one of the 3 currently selected.
function costDisplayScoped(scope, className, idx, rankIdx, rawCost) {
  return formatGuessDisplay(rawCost, rawCost === "?" ? costGuessScoped(scope, className, idx, rankIdx) : null);
}

// Builds the (progIdx, rankIdx) => guess|null closure highlightRankValue
// expects, bound to one AA - so every .desc call site just passes
// effectLookup(catKey, idx) instead of repeating the same arrow function.
// catKey-based (one of the 3 active slots), mirrors costDisplay.
function effectLookup(catKey, idx) {
  return (progIdx, rankIdx) => effectGuess(catKey, idx, progIdx, rankIdx);
}

// (scope, className)-based, mirrors costDisplayScoped - for Browse and any
// inactive-class Progression step, same reasoning as costGuessScoped.
function effectLookupScoped(scope, className, idx) {
  return (progIdx, rankIdx) => effectGuessScoped(scope, className, idx, progIdx, rankIdx);
}

export function renderTree(catKey) {
  const list = getList(catKey);

  if (!list.length) {
    el.treeWrap.innerHTML = '<div class="empty" style="margin-top:60px;">No AAs documented for this category yet.</div>';
    return;
  }

  // Selecting a node fully rebuilds this grid, which would otherwise drop keyboard
  // focus back to nowhere — remember whether focus was in the tree so it can be
  // restored to the newly-rendered matching node below.
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
    if (lockReason && lockReason.kind === "prereq") node.classList.add("locked-prereq");
    if (invalidReason) node.classList.add("invalidated");
    if (searching) node.classList.add(aaMatchesQuery(aa, query) ? "search-match" : "search-dim");
    if (invalidReason) node.title = invalidReason;
    else if (autoBelowLevel) node.title = `Automatically granted at level ${aa.levelReq} — no points needed.`;
    else if (lockReason) node.title = lockReason.text;
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
      const disp = costDisplay(catKey, idx, rank, aa.costs[rank]);
      tag.className = disp.isGuess ? `costtag is-estimate tier-${disp.confidence}` : "costtag";
      tag.textContent = disp.text;
      if (disp.isGuess) tag.title = disp.title;
      node.appendChild(tag);
    }
    if (lockReason && lockReason.kind === "prereq") {
      const req = document.createElement("div");
      req.className = "costtag prereq-tag";
      req.textContent = "REQ";
      node.appendChild(req);
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
  html += `<div class="desc">${highlightRankValue(aa.description, rank, effectLookup(sel.category, sel.idx))}</div>`;
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
      const nextDisp = costDisplay(sel.category, sel.idx, rank, aa.costs[rank]);
      const chip = nextDisp.isGuess
        ? ` <span class="confidence-chip tier-${nextDisp.confidence}" title="${escapeHtml(nextDisp.title)}">${nextDisp.confidence}</span>`
        : "";
      html += `<div class="next-rank-box${nextDisp.isGuess ? " is-estimate" : ""}">
        <div class="next-rank-title">Next Rank (${nextRank}/${aa.ranks}) &middot; costs <b class="${nextDisp.isGuess ? "is-estimate" : ""}" title="${nextDisp.isGuess ? escapeHtml(nextDisp.title) : ""}">${nextDisp.text}</b> pt(s)${chip}</div>
        <div class="desc">${highlightRankValue(applyPerRankTotal(aa.description, nextRank), nextRank, effectLookup(sel.category, sel.idx))}</div>
      </div>`;
    }
    html += `<div class="rank-costs">` + aa.costs.map((c, i) => {
      const disp = costDisplay(sel.category, sel.idx, i, c);
      const cls = `pip${i < rank ? " spent" : ""}${disp.isGuess ? ` is-estimate tier-${disp.confidence}` : ""}`;
      const title = disp.isGuess ? ` title="${escapeHtml(disp.title)}"` : "";
      return `<span class="${cls}"${title}>R${i + 1}: ${disp.text}</span>`;
    }).join("") + `</div>`;
    if (aa.costs.some((c) => String(c).trim() === "?")) {
      const anyGuessed = aa.costs.some((c, i) => c === "?" && costGuess(sel.category, sel.idx, i));
      html += `<div class="req-line" style="margin-top:10px; color:#63636a;">Some per-rank costs are undocumented on the wiki source ("?") and are treated as 0 pts until known${anyGuessed ? " &mdash; ranks marked with a ~ show a pattern-inferred estimate instead, for reference only" : ""}.</div>`;
    }
  }

  el.sidePanel.innerHTML = html;
  const incBtn = document.getElementById("incBtn");
  const decBtn = document.getElementById("decBtn");
  if (incBtn) incBtn.addEventListener("click", () => applyAttempt(attemptIncrement(sel.category, sel.idx)));
  if (decBtn) decBtn.addEventListener("click", () => applyAttempt(attemptDecrement(sel.category, sel.idx)));
}

// attemptIncrement/attemptDecrement just report what happened; this decides what
// the UI does about it (toast + re-render), keeping that decision out of logic.js.
function applyAttempt(result) {
  if (result.message) showToast(result.message);
  if (result.changed) renderAll();
}

// Browse lists every class regardless of which 3 are currently selected, but
// structuralLockReason (and everything under it) only knows how to answer
// "is this prereq met" for a category with a real catKey - general/archetype/
// special always have one, but a class only does while it's actually sitting
// in one of the 3 slots. For any other class, catKey is null and the prereq
// line falls back to the old plain-text rendering rather than guessing.
function catKeyForBrowseLabel(catLabel) {
  if (catLabel === "General") return "general";
  if (catLabel === "Archetype") return "archetype";
  if (catLabel === "Special") return "special";
  const slot = state.selectedClasses.indexOf(catLabel);
  return slot >= 0 ? CLASS_SLOT_KEYS[slot] : null;
}

// Cost guesses don't have that same "only while it's in an active slot"
// limitation (costDisplayScoped looks up by scope/className directly), so
// every Browse card can show its per-rank estimates regardless of whether
// its class is currently selected.
function scopeForBrowseLabel(catLabel) {
  if (catLabel === "General") return { scope: "general", className: null };
  if (catLabel === "Archetype") return { scope: "archetype", className: null };
  if (catLabel === "Special") return { scope: "special", className: null };
  return { scope: "class", className: catLabel };
}

export function renderBrowse() {
  const q = state.browseSearch.trim().toLowerCase();
  const filter = state.browseFilter;
  const items = [];

  function pushList(catLabel, list) {
    const catKey = catKeyForBrowseLabel(catLabel);
    list.forEach((aa, idx) => items.push({ cat: catLabel, aa, catKey, idx }));
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
    ? filtered.map(({ cat, aa, catKey, idx }) => {
        let prereqInfo = "";
        if (aa.prereq) {
          // Only "requires an AA you haven't reached yet" should read as a
          // warning here - a level gate isn't a prerequisite, so it's left
          // out of this specific check (structuralLockReason still folds
          // both together, but kind lets this call out the prereq case only).
          const lockReason = catKey ? structuralLockReason(catKey, idx) : null;
          const warn = !!(lockReason && lockReason.kind === "prereq");
          prereqInfo = ` &middot; <span class="prereq-info${warn ? " warn" : ""}">Requires: ${escapeHtml(aa.prereq)}</span>`;
        }
        const { scope, className } = scopeForBrowseLabel(cat);
        const costList = aa.costs.map((c, i) => {
          const disp = costDisplayScoped(scope, className, idx, i, c);
          return disp.isGuess
            ? `<span class="is-estimate tier-${disp.confidence}" title="${escapeHtml(disp.title)}">${disp.text}</span>`
            : disp.text;
        }).join(" / ");
        return `
      <div class="browse-card">
        <div class="top"><span class="name">${escapeHtml(aa.name)}${aa.auto ? ' <span class="auto-badge">(AUTO)</span>' : ""}</span><span class="cat">${escapeHtml(cat)}</span></div>
        <div class="desc">${highlightRankValue(aa.description, null, effectLookupScoped(scope, className, idx))}</div>
        <div class="info">Ranks: ${aa.ranks} &middot; Cost/rank: ${costList} &middot; Level ${escapeHtml(aa.levelReq)}+${prereqInfo}</div>
      </div>`;
      }).join("")
    : '<div class="empty">No AAs match your search.</div>';
}

function renderSummary() {
  const spent = spentPoints();
  el.summaryHeader.innerHTML = `<div class="summary-meta">Classes: <b>${state.selectedClasses.map(escapeHtml).join(" / ")}</b> &middot; Character Level <b>${state.charLevel}</b> &middot; Points Spent: <b>${spent}</b></div>`;

  const sections = AA_CATEGORY_KEYS.map((key) => ({ key, label: shortCategoryLabel(key) }));

  let html = "";
  let anyPicked = false;
  sections.forEach(({ key, label }) => {
    const list = getList(key);
    const picked = list.map((aa, idx) => ({ aa, idx, rank: effectiveRank(key, idx) })).filter((x) => x.rank > 0);
    if (!picked.length) return;
    anyPicked = true;
    html += `<h3 class="summary-section-title">${escapeHtml(label)}</h3>`;
    html += `<div class="browse-grid">` + picked.map(({ aa, idx, rank }) => `
      <div class="browse-card">
        <div class="top"><span class="name">${escapeHtml(aa.name)}${aa.auto ? ' <span class="auto-badge">(AUTO)</span>' : ""}</span><span class="cat">Rank ${rank}/${aa.ranks}</span></div>
        <div class="desc">${highlightRankValue(applyPerRankTotal(aa.description, rank), rank, effectLookup(key, idx))}</div>
      </div>`).join("") + `</div>`;
  });

  el.summaryContent.innerHTML = anyPicked ? html : '<div class="empty">No AAs selected yet &mdash; spend some points in the calculator, then check back here.</div>';
}

// Which progression rows have their next-rank preview open, keyed by AA
// identity + the rank being previewed so it survives reorders sanely. Purely
// transient UI state — not persisted, and reset takes care of itself since a
// removed/changed step just stops matching any key.
const expandedSteps = new Set();
function expandKey(s) { return `${s.category || ""}:${s.idx}:${s.stepRank}`; }

// Waypoint add/edit modal state - which waypoint (by pts, unique per
// sanitizeWaypoints' dedup) is being edited, or null when the modal is
// adding a new one. modalSelectedColor tracks the in-progress swatch pick
// while the modal is open, applied on Save. Both purely transient UI state,
// same spirit as expandedSteps - never touches lastMutation, since editing
// a waypoint is plan annotation, not a plan mutation.
let editingWaypointPts = null;
let modalSelectedColor = null;

// Index (into state.purchaseOrder) of the row currently being dragged, or null
// when no drag is in progress. Module-level since dragstart/dragover/drop fire
// on different row elements that get torn down and rebuilt on every render.
//
// dragSrcIndex alone isn't a safe gate for "is a progression-step drag actually
// in flight": if dragend never fires (detaching the source node mid-drag, e.g.
// via renderProgression, is known to make some browsers skip it), it stays
// non-null after the drag that set it has already ended. A later, unrelated
// drag (a text selection, a file from the OS) over the list would then read as
// a stale reorder instead of being ignored. PROGRESSION_DRAG_TYPE is a custom
// dataTransfer MIME type set only in this module's dragstart, so dragover/drop
// gate on e.dataTransfer.types instead of trusting dragSrcIndex - a foreign
// drag simply won't carry it, no matter what dragSrcIndex last happened to be.
const PROGRESSION_DRAG_TYPE = "application/x-aacalc-progression-step";
let dragSrcIndex = null;
// Total prereqWarn count in the real, un-dragged order, snapshotted at
// dragstart - the baseline dragWouldIntroduceWarn diffs hypothetical
// arrangements against. See that function for why a baseline is needed at all.
let dragBaselineWarnCount = 0;

function clearDragOverMarks() {
  Array.from(el.progressionContent.querySelectorAll(".progression-row")).forEach((r) => {
    r.classList.remove("drag-over-top", "drag-over-bottom", "drag-warn");
  });
}

// Walks back through preceding siblings to the nearest actual
// .progression-row, skipping over any run of divider rows and/or a
// next-rank preview box in between - a divider can end up directly after
// another divider (two waypoints falling in the same gap) or after an
// expanded preview box (the step right before a waypoint boundary has its
// preview open), neither of which is itself a valid "owner row". Returns
// null if there's no row above at all (a divider whose threshold is below
// the very first step's cumulative).
function findPrecedingRow(fromEl) {
  let sib = fromEl.previousElementSibling;
  while (sib && !sib.classList.contains("progression-row")) sib = sib.previousElementSibling;
  return sib;
}

function countPrereqWarns(steps) {
  return steps.reduce((n, s) => n + (s.prereqWarn ? 1 : 0), 0);
}

// Whether dropping the step currently being dragged at `toIndex` (an
// insertion point, same convention as moveProgressionEntryTo) would introduce
// a prereq warning that doesn't already exist - a pure look-ahead for the
// drag indicator, computed against a throwaway copy so it never touches real
// state.
//
// This checks two things, not just the dragged step's own prereq: dragging X
// out from directly above its own dependent Y (order [X, Y] -> drag X below
// Y) leaves X's own prereq perfectly satisfied wherever it lands, so a check
// scoped to X alone reports "fine" right up until the drop, at which point Y
// lights up amber - the indicator would have promised something the drop
// didn't deliver, in the reassuring direction rather than the alarming one.
// Comparing the hypothetical arrangement's total warn count against the real
// order's count (dragBaselineWarnCount) catches that for roughly free, since
// computeProgressionSteps(hypothetical) is already being computed anyway.
//
// A pure count comparison alone would miss a swap that trades one warn for a
// different one (count unchanged, problem moved) - so this keeps the direct
// "does the dragged step's own slot warn" check too, rather than replacing
// it. Between the two, every count-changing case and every own-prereq case
// is covered; only a same-count swap of *which other* step warns (not
// involving the dragged step's own prereq at all) could still slip through,
// and that's an existing-warn-swapping-to-a-different-existing-warn edge
// case rare enough not to be worth a full "diff which steps changed" pass.
function dragWouldIntroduceWarn(toIndex) {
  if (dragSrcIndex === null) return false;
  let insertAt = toIndex > dragSrcIndex ? toIndex - 1 : toIndex;
  if (insertAt === dragSrcIndex) return false; // no-op move, nothing changes
  const hypothetical = state.purchaseOrder.slice();
  const [entry] = hypothetical.splice(dragSrcIndex, 1);
  hypothetical.splice(insertAt, 0, entry);
  const hypoSteps = computeProgressionSteps(hypothetical);
  if (hypoSteps[insertAt].prereqWarn) return true;
  return countPrereqWarns(hypoSteps) > dragBaselineWarnCount;
}

// Renders the waypoint chip row - one pill per state.waypoints entry
// (already sorted ascending by pts), with a color dot if one's assigned.
// Clicking the label opens the edit modal for that waypoint; the &times;
// removes it directly, without opening anything, for a fast delete. Called
// from renderProgression, but unconditionally - see its own comment for why
// this can't wait behind the empty-progression check.
function renderWaypointChips() {
  if (!state.waypoints.length) {
    el.waypointChips.innerHTML = "";
    return;
  }
  el.waypointChips.innerHTML = state.waypoints.map((w) => {
    const dot = w.color ? `<span class="color-dot color-${w.color}"></span>` : "";
    const labelText = w.label ? `${w.pts} pts &middot; ${escapeHtml(w.label)}` : `${w.pts} pts`;
    return `<span class="waypoint-chip" data-pts="${w.pts}">
      <span class="chip-label" data-pts="${w.pts}">${dot}${labelText}</span>
      <button class="chip-remove" data-pts="${w.pts}" title="Remove this waypoint" aria-label="Remove waypoint">&times;</button>
    </span>`;
  }).join("");
  Array.from(el.waypointChips.querySelectorAll(".chip-label")).forEach((labelEl) => {
    labelEl.addEventListener("click", () => {
      openWaypointModal(parseInt(labelEl.getAttribute("data-pts"), 10));
    });
  });
  Array.from(el.waypointChips.querySelectorAll(".chip-remove")).forEach((btn) => {
    btn.addEventListener("click", () => {
      removeWaypoint(parseInt(btn.getAttribute("data-pts"), 10));
      renderProgression();
    });
  });
}

// Populates the color swatch picker inside the waypoint modal - a "none"
// swatch plus one per WAYPOINT_COLORS entry, with modalSelectedColor's match
// shown active. Re-rendered on every pick so the active state updates
// without needing to touch the rest of the modal.
function renderColorSwatches() {
  const noneSwatch = `<button type="button" class="color-swatch none${modalSelectedColor === null ? " active" : ""}" data-color="" title="No color" aria-label="No color"></button>`;
  const colorSwatches = WAYPOINT_COLORS.map((c) =>
    `<button type="button" class="color-swatch color-${c.key}${modalSelectedColor === c.key ? " active" : ""}" data-color="${c.key}" title="${c.key}" aria-label="${c.key}"></button>`
  ).join("");
  el.waypointColorSwatches.innerHTML = noneSwatch + colorSwatches;
  Array.from(el.waypointColorSwatches.querySelectorAll(".color-swatch")).forEach((btn) => {
    btn.addEventListener("click", () => {
      modalSelectedColor = btn.getAttribute("data-color") || null;
      renderColorSwatches();
    });
  });
}

// Opens the add/edit modal. existingPts identifies which waypoint to edit
// (by pts, its stable identity), or null to add a new one prefilled with
// the current spent total.
export function openWaypointModal(existingPts = null) {
  const existing = existingPts !== null ? state.waypoints.find((w) => w.pts === existingPts) : null;
  editingWaypointPts = existingPts;
  modalSelectedColor = existing ? existing.color : null;
  el.waypointModalTitle.textContent = existing ? "Edit Waypoint" : "Add Waypoint";
  el.waypointPtsInput.value = String(existing ? existing.pts : spentPoints());
  el.waypointLabelInput.value = existing && existing.label ? existing.label : "";
  el.deleteWaypointBtn.classList.toggle("hidden", !existing);
  renderColorSwatches();
  el.waypointModal.classList.remove("hidden");
  el.waypointPtsInput.focus();
  el.waypointPtsInput.select();
}

export function closeWaypointModal() {
  el.waypointModal.classList.add("hidden");
}

export function handleSaveWaypoint() {
  const rawPts = parseInt(el.waypointPtsInput.value.trim(), 10);
  if (!Number.isFinite(rawPts) || rawPts < 0) {
    showToast("Enter a point total of 0 or more.");
    return;
  }
  // Clamped the same way sanitizeWaypoints itself will - checking the
  // collision below against the pre-clamp value would miss the case where
  // an enormous typed total lands on an existing waypoint only *after*
  // being clamped to MAX_WAYPOINT_PTS.
  const pts = Math.min(rawPts, MAX_WAYPOINT_PTS);
  // A different waypoint already sitting at this exact total would
  // otherwise be silently overwritten - its label and color just vanish
  // with no trace, the moment this save goes through. Same "ask before
  // clobbering something that already exists" instinct saveWithNameCheck
  // applies to a named Build slot collision.
  const colliding = state.waypoints.find((w) => w.pts === pts && w.pts !== editingWaypointPts);
  if (colliding) {
    const desc = colliding.label ? `"${colliding.label}"` : "the unnamed waypoint";
    if (!confirm(`${desc} is already set at ${pts} pts. Replace it?`)) return;
  }
  // Editing can change the point total itself - that's a different identity
  // (waypoints are keyed by pts), so the old entry has to be explicitly
  // dropped first or both would coexist instead of one replacing the other.
  if (editingWaypointPts !== null && editingWaypointPts !== pts) {
    removeWaypoint(editingWaypointPts);
  }
  addOrUpdateWaypoint(pts, el.waypointLabelInput.value, modalSelectedColor);
  closeWaypointModal();
  renderProgression();
}

export function handleDeleteWaypoint() {
  if (editingWaypointPts !== null) removeWaypoint(editingWaypointPts);
  closeWaypointModal();
  renderProgression();
}

export function renderProgression() {
  el.undoLastBtn.disabled = !canUndo();
  // hasAnyOwned checks state.owned globally, not just the current
  // progression list - owned can hold marks for classes outside the 3
  // active slots, so this has to be set before (and independent of) the
  // empty-purchaseOrder early return below.
  el.clearOwnedBtn.disabled = !hasAnyOwned();
  // Waypoints can reasonably be set up before any picks exist (an
  // aspirational "by 50 pts, get X"), so the chip bar renders unconditionally
  // too, ahead of the empty-progression early return below.
  renderWaypointChips();

  if (!state.purchaseOrder.length) {
    el.progressionContent.innerHTML = '<div class="empty">No AAs picked yet &mdash; your training order will appear here as you spend points, and you can reorder it afterward to plan ahead.</div>';
    el.ownedSummary.textContent = "";
    return;
  }

  const steps = computeProgressionSteps();
  // The number this feature exists to answer: of what's currently planned,
  // how much have you actually trained in-game vs. still have to grind out.
  const ownedPts = steps.reduce((sum, s) => sum + (s.owned ? s.stepCost : 0), 0);
  const togoPts = spentPoints() - ownedPts;
  el.ownedSummary.textContent = `${ownedPts} pt${ownedPts === 1 ? "" : "s"} owned, ${togoPts} to go`;

  // computeProgressionTimeline tags each step with segmentColor (the color
  // of the waypoint whose range it falls under, if any) - every colored
  // waypoint's segment renders simultaneously, not just one selected at a
  // time, since the point of color-coding is seeing the whole plan's zones
  // at a glance.
  const timeline = computeProgressionTimeline(steps);
  const htmlParts = timeline.map((entry) => {
    if (entry.type === "divider") {
      const dot = entry.color ? `<span class="color-dot color-${entry.color}"></span>` : "";
      const labelText = entry.label ? `${escapeHtml(entry.label)} &middot; ` : "";
      return `<div class="progression-divider${entry.unreached ? " unreached" : ""}" data-pts="${entry.pts}" title="Click to edit this waypoint">
        <span class="divider-line"></span>
        ${dot}<span class="divider-label">${labelText}${entry.pts} pts${entry.unreached ? " &middot; not reached yet" : ""}</span>
        <span class="divider-line"></span>
      </div>`;
    }
    const s = entry;
    const canExpand = !!(s.aa && s.stepRank < s.aa.ranks);
    const key = expandKey(s);
    const expanded = canExpand && expandedSteps.has(key);
    const segClass = s.segmentColor ? ` segment-color-${s.segmentColor}` : "";
    // Only meaningful while active (s.category is null otherwise, and an
    // inactive step's stepCost is already forced to 0 regardless of the
    // real cost - see computeProgressionSteps).
    const stepDisp = s.active && s.aa ? costDisplay(s.category, s.idx, s.stepRank - 1, s.aa.costs[s.stepRank - 1]) : { isGuess: false };
    const row = `<div class="progression-row${s.active ? "" : " inactive"}${s.prereqWarn ? " prereq-warn-row" : ""}${segClass}" draggable="true" data-index="${s.index}">
      <span class="drag-handle" title="Drag to reorder" aria-hidden="true">&#8942;&#8942;</span>
      <span class="step-num">${s.index + 1}</span>
      <span class="step-info">
        <span class="step-name${s.owned ? " owned" : ""}">${escapeHtml(s.name)} <span class="step-rank">rank ${s.stepRank}</span></span>
        <span class="step-cat">${escapeHtml(s.label)}${s.active ? "" : " &middot; class not currently selected"}</span>
      </span>
      ${s.prereqWarn ? '<span class="step-warn" title="Prerequisite not yet trained at this point in the sequence">&#9888;</span>' : ""}
      <span class="step-cost">
        <span class="cost-this${stepDisp.isGuess ? ` is-estimate tier-${stepDisp.confidence}` : ""}"${stepDisp.isGuess ? ` title="${escapeHtml(stepDisp.title)}"` : ""}>+${stepDisp.isGuess ? stepDisp.text : s.stepCost} ${stepDisp.isGuess ? "pt(s)" : `pt${s.stepCost === 1 ? "" : "s"}`}</span>
        <span class="cost-total">${s.cumulative} total</span>
      </span>
      <span class="step-controls" draggable="false">
        <button class="step-btn step-own${s.owned ? " active" : ""}" data-scope="${escapeHtml(s.scope)}" data-classname="${escapeHtml(s.className || "")}" data-idx="${s.idx}" data-rank="${s.stepRank}" title="${s.owned ? "Mark as not yet owned" : "Mark as owned — you've actually trained this in-game"}">${s.owned ? "&#10003;" : "&#9675;"}</button>
        <button class="step-btn" data-move="up" data-index="${s.index}" ${s.index === 0 ? "disabled" : ""}>&uarr;</button>
        <button class="step-btn" data-move="down" data-index="${s.index}" ${s.index === steps.length - 1 ? "disabled" : ""}>&darr;</button>
        <button class="step-btn step-expand${expanded ? " active" : ""}" data-key="${key}" ${canExpand ? "" : "disabled"} title="${canExpand ? "Preview next rank" : "Already at max rank"}">${expanded ? "&and;" : "&or;"}</button>
        <button class="step-btn step-add" data-category="${s.category || ""}" data-idx="${s.idx}" ${s.isLast && s.active && s.aa && s.stepRank < s.aa.ranks ? "" : "disabled"} title="${!s.isLast ? "Only this AA's current top rank can be extended here" : s.aa && s.stepRank >= s.aa.ranks ? "Already at max rank" : "Add another rank"}">+</button>
        <button class="step-btn step-remove" data-category="${s.category || ""}" data-idx="${s.idx}" ${s.isLast && s.active ? "" : "disabled"} title="${!s.isLast ? "Remove this AA's highest rank first" : s.stepRank === 1 ? "Remove this AA from your build" : "Remove this rank"}">${s.stepRank === 1 ? "&times;" : "&minus;"}</button>
      </span>
    </div>`;
    if (!expanded) return row;
    const nextRank = s.stepRank + 1;
    const nextRawCost = s.aa.costs[s.stepRank];
    // costDisplayScoped doesn't need an active slot the way costDisplay's
    // catKey does (same reasoning as Browse - see scopeForBrowseLabel), so
    // an inactive-class step still gets its estimate shown here even
    // though its cost pill above stays plain (that one mirrors stepCost,
    // which is real math forced to 0 for an inactive step regardless).
    const nextDisp = s.category
      ? costDisplay(s.category, s.idx, s.stepRank, nextRawCost)
      : costDisplayScoped(s.scope, s.className, s.idx, s.stepRank, nextRawCost);
    const nextChip = nextDisp.isGuess
      ? ` <span class="confidence-chip tier-${nextDisp.confidence}" title="${escapeHtml(nextDisp.title)}">${nextDisp.confidence}</span>`
      : "";
    const nextDescLookup = s.category
      ? effectLookup(s.category, s.idx)
      : effectLookupScoped(s.scope, s.className, s.idx);
    return row + `<div class="next-rank-box progression-next-rank${nextDisp.isGuess ? " is-estimate" : ""}">
        <div class="next-rank-title">Next Rank (${nextRank}/${s.aa.ranks}) &middot; costs <b class="${nextDisp.isGuess ? "is-estimate" : ""}" title="${nextDisp.isGuess ? escapeHtml(nextDisp.title) : ""}">${nextDisp.text}</b> pt(s)${nextChip}</div>
        <div class="desc">${highlightRankValue(applyPerRankTotal(s.aa.description, nextRank), nextRank, nextDescLookup)}</div>
      </div>`;
  });

  el.progressionContent.innerHTML = htmlParts.join("");
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
  // Toggles the owned watermark's boundary at this exact step: marking an
  // unowned step owns it and everything below (you can't have actually
  // trained rank 3 without ranks 1-2), unmarking an owned one drops the
  // watermark to just below it, leaving anything still lower alone.
  Array.from(el.progressionContent.querySelectorAll(".step-own")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const scope = btn.getAttribute("data-scope");
      const className = btn.getAttribute("data-classname") || null;
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      const rank = parseInt(btn.getAttribute("data-rank"), 10);
      const nowOwned = btn.classList.contains("active");
      setOwnedRank(scope, className, idx, nowOwned ? rank - 1 : rank);
      renderProgression();
    });
  });

  Array.from(el.progressionContent.querySelectorAll(".progression-row")).forEach((rowEl) => {
    rowEl.addEventListener("dragstart", (e) => {
      dragSrcIndex = parseInt(rowEl.getAttribute("data-index"), 10);
      dragBaselineWarnCount = countPrereqWarns(computeProgressionSteps());
      rowEl.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      // Firefox won't start the drag at all unless setData is called.
      e.dataTransfer.setData("text/plain", String(dragSrcIndex));
      e.dataTransfer.setData(PROGRESSION_DRAG_TYPE, String(dragSrcIndex));
    });
    rowEl.addEventListener("dragend", () => {
      rowEl.classList.remove("dragging");
      clearDragOverMarks();
      dragSrcIndex = null;
    });
    rowEl.addEventListener("dragover", (e) => {
      if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDragOverMarks();
      const overIndex = parseInt(rowEl.getAttribute("data-index"), 10);
      if (overIndex === dragSrcIndex) return; // dropping onto itself is a no-op, nothing to indicate
      const rect = rowEl.getBoundingClientRect();
      const before = e.clientY - rect.top < rect.height / 2;
      const toIndex = before ? overIndex : overIndex + 1;
      rowEl.classList.add(before ? "drag-over-top" : "drag-over-bottom");
      if (dragWouldIntroduceWarn(toIndex)) rowEl.classList.add("drag-warn");
    });
    rowEl.addEventListener("drop", (e) => {
      if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE)) return;
      e.preventDefault();
      const rect = rowEl.getBoundingClientRect();
      const before = e.clientY - rect.top < rect.height / 2;
      const overIndex = parseInt(rowEl.getAttribute("data-index"), 10);
      moveProgressionEntryTo(dragSrcIndex, before ? overIndex : overIndex + 1);
      dragSrcIndex = null;
    });
  });

  // An expanded next-rank preview is a sibling of its row, not a descendant, and
  // carries no drag handlers of its own - hovering/dropping on one otherwise
  // falls into a dead zone (no row claims it, and the container-level fallback
  // below bails because e.target is the preview box, not the container itself).
  // Treat it as an extension of the row right above it: dropping anywhere on
  // the preview inserts after that row.
  Array.from(el.progressionContent.querySelectorAll(".progression-next-rank")).forEach((boxEl) => {
    const ownerRow = boxEl.previousElementSibling;
    if (!ownerRow || !ownerRow.classList.contains("progression-row")) return;
    boxEl.addEventListener("dragover", (e) => {
      if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDragOverMarks();
      const overIndex = parseInt(ownerRow.getAttribute("data-index"), 10);
      if (overIndex === dragSrcIndex) return;
      ownerRow.classList.add("drag-over-bottom");
      if (dragWouldIntroduceWarn(overIndex + 1)) ownerRow.classList.add("drag-warn");
    });
    boxEl.addEventListener("drop", (e) => {
      if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE)) return;
      e.preventDefault();
      const overIndex = parseInt(ownerRow.getAttribute("data-index"), 10);
      moveProgressionEntryTo(dragSrcIndex, overIndex + 1);
      dragSrcIndex = null;
    });
  });

  // A waypoint divider is the same kind of dead zone as a next-rank preview
  // box (a non-draggable sibling with no handlers of its own) - same fix:
  // treat it as an extension of the row right above it, dropping anywhere on
  // it inserts after that row. A divider with no row above it at all (its
  // threshold is below the very first step's cumulative) maps to "insert at
  // the very start" instead, via the first row's own top-half indicator.
  Array.from(el.progressionContent.querySelectorAll(".progression-divider")).forEach((divEl) => {
    const ownerRow = findPrecedingRow(divEl);
    divEl.addEventListener("click", () => {
      openWaypointModal(parseInt(divEl.getAttribute("data-pts"), 10));
    });
    divEl.addEventListener("dragover", (e) => {
      if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDragOverMarks();
      if (!ownerRow) {
        const firstRow = el.progressionContent.querySelector(".progression-row");
        if (firstRow && parseInt(firstRow.getAttribute("data-index"), 10) !== dragSrcIndex) {
          firstRow.classList.add("drag-over-top");
          if (dragWouldIntroduceWarn(0)) firstRow.classList.add("drag-warn");
        }
        return;
      }
      const overIndex = parseInt(ownerRow.getAttribute("data-index"), 10);
      if (overIndex === dragSrcIndex) return;
      ownerRow.classList.add("drag-over-bottom");
      if (dragWouldIntroduceWarn(overIndex + 1)) ownerRow.classList.add("drag-warn");
    });
    divEl.addEventListener("drop", (e) => {
      if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE)) return;
      e.preventDefault();
      const toIndex = ownerRow ? parseInt(ownerRow.getAttribute("data-index"), 10) + 1 : 0;
      moveProgressionEntryTo(dragSrcIndex, toIndex);
      dragSrcIndex = null;
    });
  });
}

// Reverses whatever the single most recent change was — an add gets removed, a
// remove gets restored to its exact original position in the list, and a
// reorder (drag or arrow) moves the entry back to where it was before.
export function undoLast() {
  applyAttempt(undoLastMutation());
}

function moveProgressionEntry(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= state.purchaseOrder.length) return;
  const a = state.purchaseOrder[index];
  const b = state.purchaseOrder[target];
  const sameAA = a.scope === b.scope && a.idx === b.idx && (a.className || null) === (b.className || null);
  if (sameAA) { showToast("Can't reorder different ranks of the same AA."); return; }
  moveEntry(index, target);
  renderProgression();
}

// Drag-and-drop reorder: pulls the entry at fromIndex out and reinserts it at
// toIndex (an insertion point, i.e. state.purchaseOrder.length is valid and
// means "at the end"). Unlike moveProgressionEntry's adjacent swap, this never
// needs a same-AA guard, including for dragging one rank of an AA past its
// own other rank (which the arrows explicitly block with a toast instead).
// purchaseOrder entries only ever hold {scope, className, idx} - never a rank
// number - so two occurrences of the same AA are structurally identical
// objects, and computeProgressionSteps derives stepRank purely from an
// entry's position among same-key entries. Dragging "rank 2" above "rank 1"
// is therefore indistinguishable from having dragged "rank 1" instead: the
// row you drop simply renders as rank 1 afterward. No corruption either way -
// but this stops being true the moment an entry starts carrying its own rank,
// so revisit this if that ever changes.
function moveProgressionEntryTo(fromIndex, toIndex) {
  if (toIndex > fromIndex) toIndex -= 1; // account for the shift left after removal
  if (fromIndex === toIndex) return;
  moveEntry(fromIndex, toIndex);
  renderProgression();
}

// One-time wiring (called from wireEvents) so dropping below the last row still
// moves the dragged step to the end, instead of doing nothing. Lives here rather
// than inside renderProgression because these elements persist across renders
// (only progressionContent's innerHTML is replaced), so binding it there would
// stack up a fresh listener on every render.
//
// Bound to progressionWrap, not progressionContent: progressionContent has no
// padding/border/overflow of its own, so only the *last* row's bottom margin
// collapses through it - its box ends exactly at the last row's bottom edge,
// and everything below genuinely belongs to the scrollable progressionWrap
// around it. Binding this to progressionContent instead would make the
// fallback unreachable except in the ~8px margin strip right under the last
// row - a strip that doesn't even exist post-collapse. isBelowLastRow's
// remaining job here is filtering progressionWrap's own side padding and the
// toolbar area above the rows, not inter-row gaps: a *middle* row's margin
// does NOT collapse out, so the pointer over one of those still lands on
// progressionContent (see the dedicated listener below), never reaching this
// wrap-level handler at all.
function lastProgressionRow() {
  const rows = el.progressionContent.querySelectorAll(".progression-row");
  return rows.length ? rows[rows.length - 1] : null;
}

function isBelowLastRow(e) {
  const last = lastProgressionRow();
  return !!last && e.clientY >= last.getBoundingClientRect().bottom;
}

export function wireProgressionDropZone() {
  el.progressionWrap.addEventListener("dragover", (e) => {
    if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE) || e.target !== el.progressionWrap) return;
    if (!isBelowLastRow(e)) { clearDragOverMarks(); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearDragOverMarks();
    // Every other valid drop target draws a line; match that here so the
    // append-to-end zone below the last row isn't the one invisible spot.
    const last = lastProgressionRow();
    if (last && parseInt(last.getAttribute("data-index"), 10) !== dragSrcIndex) {
      last.classList.add("drag-over-bottom");
      if (dragWouldIntroduceWarn(state.purchaseOrder.length)) last.classList.add("drag-warn");
    }
  });
  el.progressionWrap.addEventListener("drop", (e) => {
    if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE) || e.target !== el.progressionWrap) return;
    if (!isBelowLastRow(e)) return;
    e.preventDefault();
    moveProgressionEntryTo(dragSrcIndex, state.purchaseOrder.length);
    dragSrcIndex = null;
  });
  // Inter-row gaps land here, not on progressionWrap (see above) - no row
  // claims them and dropping does nothing, so just keep a stale indicator
  // from sitting lit over a zone where a drop wouldn't do anything. No
  // preventDefault: this must stay a non-drop target, not a silent no-op one.
  el.progressionContent.addEventListener("dragover", (e) => {
    if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE) || e.target !== el.progressionContent) return;
    clearDragOverMarks();
  });
}

export function populateStaticControls() {
  el.browseFilter.innerHTML =
    `<option value="all">All Categories</option>` +
    `<option value="general">General</option>` +
    `<option value="archetype">Archetype</option>` +
    `<option value="special">Special</option>` +
    `<optgroup label="Class">` +
    CLASS_LIST.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("") +
    `</optgroup>`;
  // USER_CHANGELOG[0] is the single source of truth for "current version" —
  // the corner tag and the unread-dot comparison both read it from here, so
  // they can't disagree about what the latest version is.
  if (USER_CHANGELOG[0]) el.versionTag.textContent = `v${USER_CHANGELOG[0].version}`;
  updateVersionDot();
}

// Shows a small dot on the version tag when the latest changelog entry is
// newer than whatever the user last saw. A first-ever visit has nothing to
// be "behind" — it seeds the stored version silently instead of showing a
// dot for a changelog the user has no history with.
function updateVersionDot() {
  const current = USER_CHANGELOG[0] && USER_CHANGELOG[0].version;
  if (!current) return;
  let lastSeen = null;
  try { lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY); } catch (e) { /* storage unavailable */ }
  if (lastSeen === null) {
    try { localStorage.setItem(LAST_SEEN_VERSION_KEY, current); } catch (e) { /* storage unavailable */ }
    el.versionTag.classList.remove("unread");
    return;
  }
  el.versionTag.classList.toggle("unread", lastSeen !== current);
}

export function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

// The list has grown enough (several versions, some with multi-paragraph
// entries) that it routinely needs scrolling to read in full, and this
// app's custom scrollbar (see the ::-webkit-scrollbar rules) is thin enough
// - and, on some platforms/browsers, invisible until actively scrolling -
// that a first-time viewer can miss it's there at all and mistake a
// mid-sentence cutoff for the end of the list. updateChangelogFade adds a
// bottom fade while there's more to scroll to, matching the "more content
// below" convention, and removes it once actually scrolled to the end (or
// if everything already fits with no scrolling needed at all - same check
// covers both, since scrollTop+clientHeight >= scrollHeight is true either
// way).
function updateChangelogFade() {
  const el2 = el.changelogContent;
  const atBottom = el2.scrollTop + el2.clientHeight >= el2.scrollHeight - 1;
  el.changelogFade.classList.toggle("hidden", atBottom);
}

export function openChangelogModal() {
  el.changelogContent.innerHTML = USER_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <div class="changelog-version">v${escapeHtml(entry.version)} <span class="changelog-date">${escapeHtml(entry.date)}</span></div>
      <ul>${entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>`).join("") || '<div class="empty">Nothing here yet.</div>';
  el.changelogModal.classList.remove("hidden");
  el.changelogContent.scrollTop = 0;
  updateChangelogFade();
  el.changelogContent.onscroll = updateChangelogFade;
  el.versionTag.classList.remove("unread");
  if (USER_CHANGELOG[0]) {
    try { localStorage.setItem(LAST_SEEN_VERSION_KEY, USER_CHANGELOG[0].version); } catch (e) { /* storage unavailable */ }
  }
}

export function closeChangelogModal() {
  el.changelogModal.classList.add("hidden");
}

function renderBuildsList() {
  const builds = listBuilds();
  const activeId = getActiveBuildId();
  el.buildsList.innerHTML = builds.length
    ? builds.map((b) => `
      <div class="build-row${b.id === activeId ? " active" : ""}">
        <div class="build-info">
          <span class="build-name">${escapeHtml(b.name)}</span>
          <span class="build-meta">${escapeHtml(new Date(b.updatedAt).toLocaleString())}</span>
        </div>
        <div class="build-actions">
          <button class="btn" data-action="load" data-id="${b.id}">Load</button>
          <button class="btn" data-action="rename" data-id="${b.id}">Rename</button>
          <button class="btn danger" data-action="delete" data-id="${b.id}">Delete</button>
        </div>
      </div>`).join("")
    : '<div class="empty">No saved builds yet — save your current build below to get started.</div>';

  Array.from(el.buildsList.querySelectorAll("[data-action]")).forEach((btn) => {
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    btn.addEventListener("click", () => {
      if (action === "load") {
        const build = builds.find((b) => b.id === id);
        const target = `the build "${build ? build.name : "?"}"`;
        if (!confirmReplaceCurrentBuild("load", target)) return;
        const result = loadBuild(id);
        if (!result) { showToast("Couldn't load that build — it may have been removed."); return; }
        closeBuildsModal();
        renderAll();
        showToast(`Build loaded${loadIssuesSuffix({ droppedRanks: result.droppedRanks }, result.repaired)}`);
      } else if (action === "rename") {
        const build = builds.find((b) => b.id === id);
        const name = prompt("Rename build:", build ? build.name : "");
        if (name === null) return;
        const trimmed = name.trim();
        if (!trimmed) { showToast("Name can't be empty."); return; }
        const outcome = renameBuild(id, trimmed);
        if (outcome === "collision") { showToast(`A build named "${trimmed}" already exists.`); return; }
        if (outcome === "missing") { showToast("Couldn't rename — that build may have been removed."); return; }
        renderBuildsList();
        renderTopbar();
      } else if (action === "delete") {
        const build = builds.find((b) => b.id === id);
        if (!confirm(`Delete "${build ? build.name : "this build"}"? This can't be undone.`)) return;
        deleteBuild(id);
        renderBuildsList();
        renderTopbar();
      }
    });
  });
}

export function openBuildsModal() {
  el.buildSaveName.value = "";
  renderBuildsList();
  el.buildsModal.classList.remove("hidden");
  el.buildSaveName.focus();
}

export function closeBuildsModal() {
  el.buildsModal.classList.add("hidden");
}

export function openResetModal() {
  el.resetClearOwnedCheckbox.checked = false;
  el.resetModal.classList.remove("hidden");
}

export function closeResetModal() {
  el.resetModal.classList.add("hidden");
}

export function handleConfirmReset() {
  const clearOwnedToo = el.resetClearOwnedCheckbox.checked;
  performReset(clearOwnedToo);
  clearActiveBuild();
  closeResetModal();
  renderAll();
  showToast(clearOwnedToo ? "Build reset" : "Build reset — owned progress kept");
}

// Snapshots the current build under whatever name is in the input — a new
// slot, or an overwrite (after confirming) if the name matches an existing
// one. Exported for events.js to wire to both the Save button and an Enter
// keypress in the name field.
export function handleBuildSave() {
  const name = el.buildSaveName.value.trim();
  if (!name) { showToast("Enter a name for this build."); return; }
  const id = saveWithNameCheck(name);
  if (id === false) return; // declined the overwrite - not an error, just nothing to report
  if (!id) { showToast("Couldn't save — local storage may be full or unavailable."); return; }
  el.buildSaveName.value = "";
  renderBuildsList();
  renderTopbar();
  showToast(`Saved "${name}"`);
}
