// Curated, user-facing changelog — features and dataset changes worth telling
// players about. Internal refactors/architecture/bug-fixes-that-were-never-
// visible don't belong here; git log is the record for those. Newest first;
// add a new entry at the top whenever a user-relevant change ships.
export const USER_CHANGELOG = [
  {
    version: "1.5.0",
    date: "2026-07-18",
    items: [
      "New: Waypoints on the Progression tab — mark a point total worth returning to (with an optional name, like \"Level 20\" or \"Turn-in gear\") and it shows up as a labeled divider right where your training order crosses it. Give it a color to have that stretch of steps stand out at a glance — every colored waypoint's stretch shows at once, so you can color-code the whole plan into zones instead of looking at one at a time. Click a chip or its divider to edit it, including changing its color or point total later.",
      "Waypoints are anchored to a point total, not a position in the list, so they hold up under reordering, undo, and Reset Build without needing to be redone — Reset Build keeps them the same way it keeps owned progress. They travel with the plan: included in named Builds and share links/export codes."
    ]
  },
  {
    version: "1.4.1",
    date: "2026-07-18",
    items: [
      "Fixed: on the Summary and Progression tabs, the version tag in the bottom-right corner could end up sitting right on top of the last card/row instead of having its own clear space."
    ]
  },
  {
    version: "1.4.0",
    date: "2026-07-18",
    items: [
      "New: mark AAs as owned on the Progression tab (the checkmark next to a step) to track what you've actually trained in-game, separate from what you're just planning — owned steps show a strikethrough, and marking/unmarking is undoable. The toolbar shows a running total of points owned vs. still to go.",
      "Reset Build now keeps your owned AAs by default instead of wiping everything, with a checkbox to clear owned progress too if you really want a clean slate. A separate \"Clear Owned\" button on the Progression toolbar clears owned progress on its own, without touching your plan.",
      "Owned progress is tracked per character, not per plan — it's independent of whichever build you're editing, so switching between saved Builds or opening a share link never touches it on its own. It's left out of exported text/share links by default; a checkbox in the Export modal opts in to including it, for moving your own progress to another browser or sharing it with someone. Importing a build that carries owned data now asks first, since it would otherwise overwrite your own — decline to import just the plan."
    ]
  },
  {
    version: "1.3.0",
    date: "2026-07-17",
    items: [
      "New: Builds — save named snapshots of your build and switch between them from the topbar, handy for comparing class combos or planning alternate paths side by side.",
      "Opening a share link or importing text now offers to save your current build first if it isn't already backed up, instead of just warning it'll be replaced. A share link's build is also auto-saved to a reusable \"Imported Build\" slot so it's easy to find again later.",
      "Progression tab: Undo Last now covers reordering too, not just adding/removing a rank — drag or arrow-move a step by mistake and Undo Last puts it back."
    ]
  },
  {
    version: "1.2.1",
    date: "2026-07-16",
    items: [
      "Locked AAs in the tree now show whether they're blocked by a missing prerequisite (amber border + REQ badge) or just a level requirement, instead of looking identical either way.",
      "Browse view now flags a prerequisite you haven't met yet, matching the side panel.",
      "Progression tab: dragging a step shows an amber indicator if that drop would leave its own prerequisite unmet, and out-of-order steps are now dimmed for visibility, not just marked with ⚠."
    ]
  },
  {
    version: "1.2.0",
    date: "2026-07-16",
    items: [
      "Progression tab: drag and drop a row to reorder it, in addition to the existing arrows.",
      "Data corrections from a fresh wiki scrape and in-game confirmation: Fury of Magic, Symphonic Aura (including its unusual per-rank cost/enable pattern), Rapid Feign, Fear Resistance, Holy Steed, and Soul Abrasion."
    ]
  },
  {
    version: "1.1.0",
    date: "2026-07-10",
    items: [
      "Much shorter share links and export codes — a heavily-built character's link is now roughly a tenth of its old length. Links and codes you already have saved or shared still work.",
      "If a data update ever removes or reshapes an AA you'd picked, you'll now see a notice on load explaining what changed, instead of a build that's just quietly different than you left it.",
      "AAs whose prerequisite is no longer met (because of a data update) are now flagged directly in the tree and side panel, not just silently blocked."
    ]
  },
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
