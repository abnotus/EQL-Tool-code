// All DOM rendering. Reads from `state` and the logic layer, writes to `el.*`.

import { state, AA_CATEGORY_KEYS, saveLocal } from "./state.js";
import { el } from "./dom.js";
import {
  escapeHtml, iconLetter, highlightRankValue, labelFor, shortCategoryLabel,
  getList, effectiveRank, structuralLockReason, resolvePrereqTarget, getBlockReason,
  isDependedOn, attemptIncrement, attemptDecrement, countPicked, computeProgressionSteps,
  costNum, spentPoints
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
  el.remainingValue.textContent = remaining;
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
        <div class="desc">${highlightRankValue(aa.description, rank)}</div>
      </div>`).join("") + `</div>`;
  });

  el.summaryContent.innerHTML = anyPicked ? html : '<div class="empty">No AAs selected yet &mdash; spend some points in the calculator, then check back here.</div>';
}

export function renderProgression() {
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

export function moveProgressionEntry(index, dir) {
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

export function populateStaticControls() {
  el.browseFilter.innerHTML =
    `<option value="all">All Categories</option>` +
    `<option value="general">General</option>` +
    `<option value="archetype">Archetype</option>` +
    `<option value="special">Special</option>` +
    `<optgroup label="Class">` +
    CLASS_LIST.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("") +
    `</optgroup>`;
}

export function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.toast.classList.remove("show"), 2200);
}
