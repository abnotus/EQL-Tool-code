// Cached DOM element references, populated once on init.

export const el = {};

export function cacheDom() {
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
  el.includeOwnedCheckbox = document.getElementById("includeOwnedCheckbox");
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
  el.progressionWrap = document.getElementById("progressionWrap");
  el.progressionContent = document.getElementById("progressionContent");
  el.undoLastBtn = document.getElementById("undoLastBtn");
  el.ownedSummary = document.getElementById("ownedSummary");
  el.clearOwnedBtn = document.getElementById("clearOwnedBtn");
  el.addWaypointBtn = document.getElementById("addWaypointBtn");
  el.waypointChips = document.getElementById("waypointChips");
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
  el.buildsBtn = document.getElementById("buildsBtn");
  el.buildsModal = document.getElementById("buildsModal");
  el.buildSaveName = document.getElementById("buildSaveName");
  el.buildSaveBtn = document.getElementById("buildSaveBtn");
  el.buildsList = document.getElementById("buildsList");
  el.closeBuildsBtn = document.getElementById("closeBuildsBtn");
  el.resetModal = document.getElementById("resetModal");
  el.resetClearOwnedCheckbox = document.getElementById("resetClearOwnedCheckbox");
  el.confirmResetBtn = document.getElementById("confirmResetBtn");
  el.cancelResetBtn = document.getElementById("cancelResetBtn");
}
