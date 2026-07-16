// All DOM rendering. Reads from `state` and the logic layer, writes to `el.*`.

import { state, AA_CATEGORY_KEYS, saveLocal, LAST_SEEN_VERSION_KEY } from "./state.js";
import { USER_CHANGELOG } from "./changelogData.js";
import { el } from "./dom.js";
import {
  escapeHtml, iconLetter, highlightRankValue, applyPerRankTotal, labelFor, shortCategoryLabel,
  getList, effectiveRank, structuralLockReason, resolvePrereqTarget, getBlockReason,
  isDependedOn, attemptIncrement, attemptDecrement, countPicked, computeProgressionSteps,
  costNum, spentPoints, undoLastMutation, canUndo, clearLastMutation, aaMatchesQuery, countMatches,
  heldRankInvalidReason, findInvalidatedPicks
} from "./logic.js";

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

export function renderTopbar() {
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

export function populateClassSelects() {
  const html = CLASS_LIST.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  el.classSelects.forEach((sel, i) => {
    if (sel.innerHTML !== html) sel.innerHTML = html;
    sel.value = state.selectedClasses[i];
  });
}

export function renderTabs() {
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
      tag.className = "costtag";
      tag.textContent = aa.costs[rank];
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

export function renderSidePanel() {
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

// attemptIncrement/attemptDecrement just report what happened; this decides what
// the UI does about it (toast + re-render), keeping that decision out of logic.js.
function applyAttempt(result) {
  if (result.message) showToast(result.message);
  if (result.changed) renderAll();
}

export function renderBrowse() {
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

export function renderSummary() {
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

// Which progression rows have their next-rank preview open, keyed by AA
// identity + the rank being previewed so it survives reorders sanely. Purely
// transient UI state — not persisted, and reset takes care of itself since a
// removed/changed step just stops matching any key.
const expandedSteps = new Set();
function expandKey(s) { return `${s.category || ""}:${s.idx}:${s.stepRank}`; }

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

function clearDragOverMarks() {
  Array.from(el.progressionContent.querySelectorAll(".progression-row")).forEach((r) => {
    r.classList.remove("drag-over-top", "drag-over-bottom");
  });
}

export function renderProgression() {
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
    const row = `<div class="progression-row${s.active ? "" : " inactive"}" draggable="true" data-index="${s.index}">
      <span class="drag-handle" title="Drag to reorder" aria-hidden="true">&#8942;&#8942;</span>
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
      <span class="step-controls" draggable="false">
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

  Array.from(el.progressionContent.querySelectorAll(".progression-row")).forEach((rowEl) => {
    rowEl.addEventListener("dragstart", (e) => {
      dragSrcIndex = parseInt(rowEl.getAttribute("data-index"), 10);
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
      rowEl.classList.add(before ? "drag-over-top" : "drag-over-bottom");
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
    });
    boxEl.addEventListener("drop", (e) => {
      if (!e.dataTransfer.types.includes(PROGRESSION_DRAG_TYPE)) return;
      e.preventDefault();
      const overIndex = parseInt(ownerRow.getAttribute("data-index"), 10);
      moveProgressionEntryTo(dragSrcIndex, overIndex + 1);
      dragSrcIndex = null;
    });
  });
}

// Reverses whatever the single most recent rank change was — an add gets removed,
// a remove gets restored to its exact original position in the list.
export function undoLast() {
  applyAttempt(undoLastMutation());
}

export function moveProgressionEntry(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= state.purchaseOrder.length) return;
  const a = state.purchaseOrder[index];
  const b = state.purchaseOrder[target];
  const sameAA = a.scope === b.scope && a.idx === b.idx && (a.className || null) === (b.className || null);
  if (sameAA) { showToast("Can't reorder different ranks of the same AA."); return; }
  state.purchaseOrder[index] = b;
  state.purchaseOrder[target] = a;
  clearLastMutation(); // a pending undo's recorded position would now point at the wrong spot
  saveLocal();
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
export function moveProgressionEntryTo(fromIndex, toIndex) {
  if (toIndex > fromIndex) toIndex -= 1; // account for the shift left after removal
  if (fromIndex === toIndex) return;
  const [entry] = state.purchaseOrder.splice(fromIndex, 1);
  state.purchaseOrder.splice(toIndex, 0, entry);
  clearLastMutation();
  saveLocal();
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

export function openChangelogModal() {
  el.changelogContent.innerHTML = USER_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <div class="changelog-version">v${escapeHtml(entry.version)} <span class="changelog-date">${escapeHtml(entry.date)}</span></div>
      <ul>${entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>`).join("") || '<div class="empty">Nothing here yet.</div>';
  el.changelogModal.classList.remove("hidden");
  el.versionTag.classList.remove("unread");
  if (USER_CHANGELOG[0]) {
    try { localStorage.setItem(LAST_SEEN_VERSION_KEY, USER_CHANGELOG[0].version); } catch (e) { /* storage unavailable */ }
  }
}

export function closeChangelogModal() {
  el.changelogModal.classList.add("hidden");
}
