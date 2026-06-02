/**
 * Culture Journey / Idea Galaxy — 主区与侧栏可拖动分隔
 * 仅调整侧栏 width；主区靠 flex:1 填充，不设置 left / transform / order
 */
(function () {
  const RESIZER_WIDTH = 4;
  const RIGHT_MIN = 200;
  const DEFAULT_RIGHT_WIDTH = 220;

  const MAIN_CLEAR_PROPS = [
    "width",
    "flex",
    "flex-grow",
    "flex-shrink",
    "flex-basis",
    "left",
    "right",
    "top",
    "bottom",
    "order",
    "transform",
    "margin-left",
    "margin-right",
    "position",
    "float",
  ];

  let savedRightWidth = DEFAULT_RIGHT_WIDTH;
  let activeDrag = null;
  /** @type {Map<string, { stage, resizer, mainPanel, rightPanel, tabId }>} */
  const stageContexts = new Map();

  function refreshVisualizations(tabId) {
    if (!tabId || tabId === "culture") {
      if (window.ReadingCosmosMap?.resizeMap) {
        ReadingCosmosMap.resizeMap();
      }
    }
    if (!tabId || tabId === "galaxy") {
      if (window.ReadingCosmosGalaxy?.ensureGalaxyVisible) {
        ReadingCosmosGalaxy.ensureGalaxyVisible();
      } else if (window.ReadingCosmosGalaxy?.refreshGalaxy) {
        ReadingCosmosGalaxy.refreshGalaxy();
      } else if (window.ReadingCosmosGalaxy?.resizeGraph) {
        ReadingCosmosGalaxy.resizeGraph();
      }
    }
  }

  function clearMainLayoutStyles(mainPanel) {
    MAIN_CLEAR_PROPS.forEach((prop) => {
      mainPanel?.style.removeProperty(prop);
    });
  }

  function clampRightWidth(stage, rightWidth) {
    const containerWidth = stage.clientWidth;
    if (containerWidth <= 0) return null;

    const maxRight = containerWidth / 3;
    return Math.min(
      Math.max(rightWidth, RIGHT_MIN),
      Math.max(RIGHT_MIN, maxRight)
    );
  }

  function applySidebarWidth(stage, mainPanel, rightPanel, rightWidth) {
    const clampedWidth = clampRightWidth(stage, rightWidth);
    if (clampedWidth == null) return savedRightWidth;

    clearMainLayoutStyles(mainPanel);
    rightPanel.style.flex = `0 0 ${clampedWidth}px`;
    rightPanel.style.width = `${clampedWidth}px`;
    rightPanel.style.removeProperty("left");
    rightPanel.style.removeProperty("transform");

    return clampedWidth;
  }

  function getTabIdForStage(stage) {
    const panel = stage.closest(".tab-panel");
    return panel?.dataset?.panel || null;
  }

  function isTabPanelVisible(tabId) {
    const panel = document.getElementById(`panel-${tabId}`);
    return panel && !panel.hidden;
  }

  function applyLayoutToStage(ctx, rightWidth = savedRightWidth) {
    if (!ctx?.stage || !ctx.mainPanel || !ctx.rightPanel) return savedRightWidth;
    const applied = applySidebarWidth(
      ctx.stage,
      ctx.mainPanel,
      ctx.rightPanel,
      rightWidth
    );
    if (applied != null) savedRightWidth = applied;
    return savedRightWidth;
  }

  function onMouseMove(event) {
    if (!activeDrag) return;
    event.preventDefault();

    const rect = activeDrag.stage.getBoundingClientRect();
    const newRightWidth = rect.right - event.clientX;

    applySidebarWidth(
      activeDrag.stage,
      activeDrag.mainPanel,
      activeDrag.rightPanel,
      newRightWidth
    );
  }

  function onMouseUp() {
    if (!activeDrag) return;

    const { rightPanel, resizer, tabId } = activeDrag;
    resizer.classList.remove("is-dragging");
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    const width = rightPanel.getBoundingClientRect().width;
    if (width > 0) savedRightWidth = width;

    activeDrag = null;
    refreshVisualizations(
      tabId || document.querySelector(".tab-panel.is-active")?.dataset?.panel
    );
  }

  function startDrag(event, ctx) {
    if (event.button !== 0) return;
    event.preventDefault();

    activeDrag = ctx;
    ctx.resizer.classList.add("is-dragging");
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function initStage(stage) {
    const resizer = stage.querySelector(".panel-resizer");
    const mainPanel = stage.querySelector(".panel-resize-main");
    const rightPanel = stage.querySelector(".panel-resize-right");
    if (!resizer || !mainPanel || !rightPanel) return;

    const tabId = getTabIdForStage(stage);
    const ctx = { stage, resizer, mainPanel, rightPanel, tabId };
    if (tabId) stageContexts.set(tabId, ctx);

    if (!tabId || isTabPanelVisible(tabId)) {
      applyLayoutToStage(ctx, savedRightWidth);
    }

    resizer.addEventListener("mousedown", (event) => startDrag(event, ctx));
  }

  function onTabActivated(tabId) {
    const ctx = stageContexts.get(tabId);
    if (!ctx) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyLayoutToStage(ctx, savedRightWidth);
        refreshVisualizations(tabId);
      });
    });
  }

  function onWindowResize() {
    const activeTab = document.querySelector(".tab-panel.is-active")?.dataset?.panel;
    stageContexts.forEach((ctx, tabId) => {
      if (!isTabPanelVisible(tabId)) return;
      applyLayoutToStage(ctx, savedRightWidth);
    });
    refreshVisualizations(activeTab);
  }

  function init() {
    document.querySelectorAll("[data-panel-resize]").forEach(initStage);

    window.addEventListener("resize", onWindowResize);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ReadingCosmosPanelResizer = {
    DEFAULT_RIGHT_WIDTH,
    RESIZER_WIDTH,
    getSavedRightWidth: () => savedRightWidth,
    setSavedRightWidth: (width) => {
      savedRightWidth = width;
    },
    applyLayoutToTab: onTabActivated,
    onTabActivated,
    refreshVisualizations,
  };
})();
