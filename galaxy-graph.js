/**
 * Idea Galaxy — D3.js v7 概念力导向图（全局）
 */
(function () {
  const STORAGE_KEY = "reading_cosmos_books";
  const NODE_COLOR_FRAMEWORK = "#22F0E9";
  const NODE_COLOR_CONCEPT = "rgba(34, 240, 233, 0.7)";
  const NODE_FILL_OPACITY = 0.85;
  const FRAMEWORK_BASE_RADIUS = 8;
  const CONCEPT_BASE_RADIUS = 6;
  const FRAMEWORK_RADIUS_STEP = 4;
  const CONCEPT_RADIUS_STEP = 4;
  const FRAMEWORK_MAX_RADIUS = 28;
  const CONCEPT_MAX_RADIUS = 28;
  const NODE_KIND_FRAMEWORK = "framework";
  const NODE_KIND_CONCEPT = "concept";
  const LINK_KIND_BOOK = "book";
  const LINK_WIDTH = 1.5;
  const LINK_WIDTH_HOVER = 2;
  const BOOK_LINK_COLOR = "rgba(255,255,255,0.25)";
  const BOOK_LINK_COLOR_HOVER = "rgba(255,255,255,0.55)";
  const DEFAULT_LINK_COLOR = "rgba(34,240,233,0.4)";
  const LINK_OPACITY_HIDDEN = 0;
  const NODE_DIM_OPACITY = 0.3;
  const BOOK_HIGHLIGHT_DIM_OPACITY = 0.2;
  const CLUSTER_ATTRACT_STRENGTH = 0.2;
  const CLUSTER_CHARGE_CROSS = -200;
  const CLUSTER_CHARGE_SAME = -60;
  const CLUSTER_CENTER_SPREAD = 0.6;
  const CLUSTER_COLLISION_PADDING = 25;
  const BOOK_COHESION_STRENGTH = 0.05;
  const FIT_VIEW_PADDING = 60;
  const SIMULATION_ALPHA_DECAY = 0.01;
  const SIMULATION_VELOCITY_DECAY = 0.6;
  const SIMULATION_RESTART_ALPHA = 0.1;
  const CLUSTER_LABEL_FONT_SIZE = 13;
  const CLUSTER_LABEL_COLOR = "rgba(255,255,255,0.35)";
  const LABEL_COLOR = "rgba(255,255,255,0.75)";
  const LABEL_FONT_SIZE = 11;
  const LABEL_GAP = 8;
  const LABEL_MAX_CHARS_PER_LINE = 8;
  const LABEL_COLLISION_SHIFT_PX = 14;
  const LABEL_COLLISION_MAX_SHIFTS = 3;
  const GLOW_BLUR_STD = 4.5;
  const GLOW_BLUR_HIGHLIGHT_STD = 8;
  const ZOOM_SCALE_EXTENT = [0.3, 3];

  let svg = null;
  let gRoot = null;
  let gLinks = null;
  let gNodes = null;
  let simulation = null;
  let zoomBehavior = null;
  let glowFilterId = "galaxy-node-glow";
  let glowFilterStrongId = "galaxy-node-glow-strong";
  let galaxyInitialized = false;
  let knownConceptIds = new Set();
  let domTooltipEl = null;
  let domTooltipMoveHandler = null;
  let newConceptTimer = null;
  let width = 0;
  let height = 0;
  let selectedNodeId = null;
  let adjacencyMap = new Map();
  let pendingFocusNodeId = null;
  let highlightedBookConceptIds = null;
  let highlightedBookAddedAt = null;
  let graphNodes = [];
  let graphLinkData = [];
  let hoveredLinkId = null;
  let clusterCentersMap = new Map();
  let clusterLabelsOverlay = null;
  let pendingAutoFit = false;

  function loadBooks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function conceptKey(name) {
    if (window.ReadingCosmosIdeaBook?.conceptKey) {
      return ReadingCosmosIdeaBook.conceptKey(name);
    }
    return String(name || "")
      .trim()
      .toLowerCase();
  }

  function frameworkNodeId(label) {
    if (window.ReadingCosmosIdeaBook?.frameworkNodeId) {
      return ReadingCosmosIdeaBook.frameworkNodeId(label);
    }
    const key = conceptKey(label);
    return key ? `fw:${key}` : "";
  }

  function ideaBookHasContent(book) {
    if (window.ReadingCosmosIdeaBook?.ideaBookHasContent) {
      return ReadingCosmosIdeaBook.ideaBookHasContent(book);
    }
    return (
      book?.route === "idea" &&
      Array.isArray(book.concepts) &&
      book.concepts.length > 0
    );
  }

  function bookAuthor(book) {
    const author = String(book.author ?? "").trim();
    return author || "未知";
  }

  function bookKey(book) {
    return `${book.title}\0${bookAuthor(book)}`;
  }

  function bookCluster(book) {
    if (window.ReadingCosmosIdeaBook?.ideaBookCluster) {
      return ReadingCosmosIdeaBook.ideaBookCluster(book);
    }
    return String(book?.cluster ?? "").trim();
  }

  function resolveBookCluster(book) {
    return bookCluster(book) || "未分类";
  }

  function pickDominantCluster(clusterCounts) {
    if (!clusterCounts || clusterCounts.size === 0) return "未分类";
    let winner = "未分类";
    let max = 0;
    clusterCounts.forEach((count, cluster) => {
      if (count > max) {
        max = count;
        winner = cluster;
      }
    });
    return winner;
  }

  function computeClusterCenters(clusterIds) {
    const map = new Map();
    const ids = [...new Set(clusterIds.filter(Boolean))].sort();
    if (ids.length === 0) return map;

    const cx = width / 2;
    const cy = height / 2;
    const halfW = (width * CLUSTER_CENTER_SPREAD) / 2;
    const halfH = (height * CLUSTER_CENTER_SPREAD) / 2;
    const left = cx - halfW;
    const right = cx + halfW;
    const top = cy - halfH;
    const bottom = cy + halfH;

    const layoutByCount = {
      1: [[cx, cy]],
      2: [
        [left, cy],
        [right, cy],
      ],
      3: [
        [cx, top],
        [left, bottom],
        [right, bottom],
      ],
      4: [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
      ],
      5: [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
        [cx, cy],
      ],
      6: [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
        [left, cy],
        [right, cy],
      ],
    };

    const preset = layoutByCount[ids.length];
    if (preset) {
      ids.forEach((clusterId, index) => {
        const [x, y] = preset[index] || preset[preset.length - 1];
        map.set(clusterId, { x, y });
      });
      return map;
    }

    const orbitX = halfW;
    const orbitY = halfH;
    ids.forEach((clusterId, index) => {
      const angle = (2 * Math.PI * index) / ids.length - Math.PI / 2;
      map.set(clusterId, {
        x: cx + orbitX * Math.cos(angle),
        y: cy + orbitY * Math.sin(angle),
      });
    });

    return map;
  }

  function forceClusterCenter(centersMap, strength) {
    let nodes = [];

    function force(alpha) {
      for (const node of nodes) {
        if (!node.cluster) continue;
        const center = centersMap.get(node.cluster);
        if (!center || node.x == null || node.y == null) continue;
        node.vx += (center.x - node.x) * strength * alpha;
        node.vy += (center.y - node.y) * strength * alpha;
      }
    }

    force.initialize = (n) => {
      nodes = n;
    };

    return force;
  }

  function forceClusterCharge(strengthCross, strengthSame) {
    let nodes = [];

    function force(alpha) {
      const n = nodes.length;
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.x == null || b.x == null) continue;

          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distSq = dx * dx + dy * dy;
          if (distSq < 1) distSq = 1;
          const dist = Math.sqrt(distSq);
          const sameCluster =
            a.cluster && b.cluster && a.cluster === b.cluster;
          const strength = sameCluster ? strengthSame : strengthCross;
          const forceMag = (strength * alpha) / distSq;
          const fx = (dx / dist) * forceMag;
          const fy = (dy / dist) * forceMag;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    force.initialize = (n) => {
      nodes = n;
    };

    return force;
  }

  function forceBookCohesion(strength) {
    let nodes = [];

    function force(alpha) {
      const sums = new Map();

      for (const node of nodes) {
        if (node.x == null || node.y == null || !node.books?.length) continue;

        const seenBk = new Set();
        for (const ref of node.books) {
          const bk = bookKey(ref);
          if (seenBk.has(bk)) continue;
          seenBk.add(bk);

          if (!sums.has(bk)) {
            sums.set(bk, { x: 0, y: 0, count: 0 });
          }
          const group = sums.get(bk);
          group.x += node.x;
          group.y += node.y;
          group.count += 1;
        }
      }

      const centers = new Map();
      sums.forEach((group, bk) => {
        if (group.count === 0) return;
        centers.set(bk, {
          x: group.x / group.count,
          y: group.y / group.count,
        });
      });

      for (const node of nodes) {
        if (node.x == null || node.y == null || !node.books?.length) continue;

        const seenBk = new Set();
        for (const ref of node.books) {
          const bk = bookKey(ref);
          if (seenBk.has(bk)) continue;
          seenBk.add(bk);

          const center = centers.get(bk);
          if (!center) continue;

          node.vx += (center.x - node.x) * strength * alpha;
          node.vy += (center.y - node.y) * strength * alpha;
        }
      }
    }

    force.initialize = (n) => {
      nodes = n;
    };

    return force;
  }

  function computeClusterCentroids(nodes) {
    const groups = new Map();

    nodes.forEach((node) => {
      if (!node.cluster || node.x == null || node.y == null) return;
      if (!groups.has(node.cluster)) {
        groups.set(node.cluster, { x: 0, y: 0, count: 0 });
      }
      const group = groups.get(node.cluster);
      group.x += node.x;
      group.y += node.y;
      group.count += 1;
    });

    const centroids = new Map();
    groups.forEach((group, cluster) => {
      if (group.count === 0) return;
      centroids.set(cluster, {
        x: group.x / group.count,
        y: group.y / group.count,
      });
    });
    return centroids;
  }

  function ensureClusterLabelsOverlay() {
    if (clusterLabelsOverlay) return clusterLabelsOverlay;

    const container = getGalaxyContainer();
    if (!container) return null;

    clusterLabelsOverlay = document.createElement("div");
    clusterLabelsOverlay.id = "galaxy-cluster-labels-overlay";
    clusterLabelsOverlay.className = "galaxy-cluster-labels-overlay";
    clusterLabelsOverlay.setAttribute("aria-hidden", "true");
    container.appendChild(clusterLabelsOverlay);
    return clusterLabelsOverlay;
  }

  function updateClusterLabels() {
    const overlay = ensureClusterLabelsOverlay();
    if (!overlay || !svg) return;

    const centroids = computeClusterCentroids(
      simulation?.nodes() || graphNodes
    );
    const transform = d3.zoomTransform(svg.node());
    const clusters = [...centroids.keys()];

    const labels = d3
      .select(overlay)
      .selectAll(".galaxy-cluster-label")
      .data(clusters, (d) => d);

    labels
      .enter()
      .append("div")
      .attr("class", "galaxy-cluster-label")
      .merge(labels)
      .style("left", (d) => `${transform.applyX(centroids.get(d).x)}px`)
      .style("top", (d) => `${transform.applyY(centroids.get(d).y)}px`)
      .text((d) => d);

    labels.exit().remove();
  }

  function getIdeaBooks() {
    return loadBooks().filter((b) => ideaBookHasContent(b));
  }

  function buildAdjacency(linkData, nodes) {
    const adj = new Map();
    nodes.forEach((n) => adj.set(n.id, new Set()));

    linkData.forEach((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;
      if (!adj.has(sourceId)) adj.set(sourceId, new Set());
      if (!adj.has(targetId)) adj.set(targetId, new Set());
      adj.get(sourceId).add(targetId);
      adj.get(targetId).add(sourceId);
    });

    return adj;
  }

  function linkEndpointId(endpoint) {
    return typeof endpoint === "object" ? endpoint.id : endpoint;
  }

  function isLinkIncidentTo(link, nodeId) {
    const sourceId = linkEndpointId(link.source);
    const targetId = linkEndpointId(link.target);
    return sourceId === nodeId || targetId === nodeId;
  }

  function clearBookHighlight() {
    highlightedBookConceptIds = null;
    highlightedBookAddedAt = null;
    applySelectionVisuals();
    if (window.ReadingCosmosGalaxySidebar?.setHighlightedBookCard) {
      ReadingCosmosGalaxySidebar.setHighlightedBookCard(null);
    }
  }

  function clearSelection() {
    selectedNodeId = null;
    applySelectionVisuals();
  }

  function toggleNodeSelection(nodeId) {
    if (highlightedBookAddedAt) clearBookHighlight();
    if (selectedNodeId === nodeId) {
      clearSelection();
      return;
    }
    selectConceptById(nodeId, { focus: false });
  }

  function focusPointInView(x, y) {
    if (x == null || y == null || !svg || !zoomBehavior) return;

    const current = d3.zoomTransform(svg.node());
    const targetScale = Math.min(2.2, Math.max(current.k, 1.1));
    const tx = width / 2 - x * targetScale;
    const ty = height / 2 - y * targetScale;

    svg
      .transition()
      .duration(480)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(targetScale));
  }

  function fitGraphToView(padding = FIT_VIEW_PADDING) {
    if (!svg || !zoomBehavior) return;

    const nodes = simulation?.nodes() || graphNodes;
    if (!nodes.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      if (node.x == null || node.y == null) return;
      const pad = (node.radius || 8) + 16;
      minX = Math.min(minX, node.x - pad);
      maxX = Math.max(maxX, node.x + pad);
      minY = Math.min(minY, node.y - pad);
      maxY = Math.max(maxY, node.y + pad);
    });

    if (!Number.isFinite(minX)) return;

    const dx = Math.max(maxX - minX, 1);
    const dy = Math.max(maxY - minY, 1);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const scale = Math.min(
      ZOOM_SCALE_EXTENT[1],
      Math.max(
        ZOOM_SCALE_EXTENT[0],
        0.92 * Math.min((width - 2 * padding) / dx, (height - 2 * padding) / dy)
      )
    );

    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-midX, -midY);

    svg
      .transition()
      .duration(480)
      .call(zoomBehavior.transform, transform);
  }

  function focusNodeInView(node) {
    if (!node || node.x == null || node.y == null) return;
    focusPointInView(node.x, node.y);
  }

  function selectConceptById(nodeId, options = {}) {
    if (!nodeId) return false;
    const shouldFocus = options.focus !== false;

    const run = () => {
      const nodes = simulation?.nodes() || [];
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;

      clearBookHighlight();
      selectedNodeId = nodeId;
      applySelectionVisuals();
      if (shouldFocus) focusNodeInView(node);
      return true;
    };

    if (run()) {
      pendingFocusNodeId = null;
      return true;
    }

    pendingFocusNodeId = shouldFocus ? nodeId : null;
    selectedNodeId = nodeId;
    return false;
  }

  function toggleBookHighlightInGalaxy(addedAt) {
    if (highlightedBookAddedAt === addedAt) {
      clearBookHighlight();
      return;
    }

    const book = loadBooks().find(
      (b) => b.addedAt === addedAt && b.route === "idea"
    );
    if (!book || !ideaBookHasContent(book)) return;

    const conceptIds = new Set();
    const framework =
      window.ReadingCosmosIdeaBook?.ideaBookFramework(book) ||
      String(book.framework ?? "").trim();
    if (framework) {
      const fwId = frameworkNodeId(framework);
      if (fwId) conceptIds.add(fwId);
    }

    if (Array.isArray(book.concepts)) {
      book.concepts.forEach((raw) => {
        const key = conceptKey(raw);
        if (key) conceptIds.add(key);
      });
    }
    if (conceptIds.size === 0) return;

    selectedNodeId = null;
    highlightedBookAddedAt = addedAt;
    highlightedBookConceptIds = conceptIds;
    applySelectionVisuals();

    const nodes = simulation?.nodes() || [];
    const matched = nodes.filter((n) => conceptIds.has(n.id) && n.x != null);
    if (matched.length > 0) {
      focusPointInView(
        d3.mean(matched, (n) => n.x),
        d3.mean(matched, (n) => n.y)
      );
    }

    if (window.ReadingCosmosGalaxySidebar?.setHighlightedBookCard) {
      ReadingCosmosGalaxySidebar.setHighlightedBookCard(addedAt);
    }
  }

  function bookKeysForNode(node) {
    return new Set((node?.books || []).map((b) => bookKey(b)));
  }

  function getSelectionContext() {
    if (!selectedNodeId) return null;
    const node = graphNodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;

    return {
      node,
      bookKeys: bookKeysForNode(node),
    };
  }

  function isLinkVisibleWhenSelected(link, ctx) {
    if (!ctx) return true;
    if (link.kind === LINK_KIND_BOOK) return ctx.bookKeys.has(link.bookKey);
    return false;
  }

  function nodeSharesBookWith(node, bookKeys) {
    return (node?.books || []).some((b) => bookKeys.has(bookKey(b)));
  }

  function applyLinkAppearance(lineSelection, ctx) {
    lineSelection
      .attr("stroke-width", LINK_WIDTH)
      .attr("stroke-opacity", (link) => {
        if (highlightedBookConceptIds) return LINK_OPACITY_HIDDEN;
        if (hoveredLinkId && link.id === hoveredLinkId) return 1;
        if (!ctx) return LINK_OPACITY_HIDDEN;
        return isLinkVisibleWhenSelected(link, ctx) ? 1 : LINK_OPACITY_HIDDEN;
      })
      .attr("stroke", (link) => {
        if (highlightedBookConceptIds) return DEFAULT_LINK_COLOR;
        if (!ctx) return DEFAULT_LINK_COLOR;
        if (!isLinkVisibleWhenSelected(link, ctx)) return DEFAULT_LINK_COLOR;
        if (link.kind === LINK_KIND_BOOK) return BOOK_LINK_COLOR;
        return DEFAULT_LINK_COLOR;
      });
  }

  function applySelectionVisuals() {
    if (!gNodes) return;

    if (highlightedBookConceptIds) {
      gNodes.selectAll("g.node").each(function (d) {
        const group = d3.select(this);
        const match = highlightedBookConceptIds.has(d.id);
        const circle = group.select("circle");

        if (match) {
          group.style("opacity", 1);
          circle
            .attr("fill-opacity", d.kind === NODE_KIND_FRAMEWORK ? 1 : 1)
            .attr("filter", `url(#${glowFilterStrongId})`);
          group.select("text").attr("fill", "rgba(255,255,255,0.95)");
        } else {
          group.style("opacity", BOOK_HIGHLIGHT_DIM_OPACITY);
          applyNodeAppearance(circle, d);
          circle.attr("filter", `url(#${glowFilterId})`);
          group.select("text").attr("fill", LABEL_COLOR);
        }
      });

      if (gLinks) {
        gLinks.selectAll("line").attr("stroke-opacity", LINK_OPACITY_HIDDEN);
      }
      hideDomTooltip();
      return;
    }

    const ctx = getSelectionContext();

    gNodes.selectAll("g.node").each(function (d) {
      const group = d3.select(this);
      group.style("pointer-events", "all");

      if (!selectedNodeId) {
        group.style("opacity", null);
        const circle = group.select("circle");
        applyNodeAppearance(circle, d);
        circle.attr("filter", `url(#${glowFilterId})`);
        group.select("text").attr("fill", LABEL_COLOR);
        return;
      }

      const isSelected = selectedNodeId === d.id;
      const sameBook = ctx ? nodeSharesBookWith(d, ctx.bookKeys) : false;

      if (isSelected || sameBook) {
        group.style("opacity", null);
        group
          .select("circle")
          .attr("fill-opacity", 1)
          .attr("filter", `url(#${glowFilterId})`);
        group.select("text").attr("fill", "rgba(255,255,255,0.95)");
      } else {
        group.style("opacity", NODE_DIM_OPACITY);
        const circle = group.select("circle");
        applyNodeAppearance(circle, d);
        circle.attr("filter", `url(#${glowFilterId})`);
        group.select("text").attr("fill", LABEL_COLOR);
      }
    });

    if (!gLinks) return;
    applyLinkAppearance(gLinks.selectAll("line"), ctx);
  }

  function buildBookLinks(conceptMap) {
    const linkList = [];
    const seenIds = new Set();

    loadBooks()
      .filter((book) => ideaBookHasContent(book))
      .forEach((book) => {
        const bookRef = { title: book.title, author: bookAuthor(book) };
        const bk = bookKey(bookRef);
        const nodeIds = [];

        const framework =
          window.ReadingCosmosIdeaBook?.ideaBookFramework(book) ||
          String(book.framework ?? "").trim();
        if (framework) {
          const fwId = frameworkNodeId(framework);
          if (fwId && conceptMap.has(fwId)) nodeIds.push(fwId);
        }

        if (Array.isArray(book.concepts)) {
          book.concepts.forEach((raw) => {
            const key = conceptKey(raw);
            if (key && conceptMap.has(key)) nodeIds.push(key);
          });
        }

        const uniqueIds = [...new Set(nodeIds)];
        if (uniqueIds.length < 2) return;

        for (let i = 0; i < uniqueIds.length; i += 1) {
          for (let j = i + 1; j < uniqueIds.length; j += 1) {
            const a = uniqueIds[i];
            const b = uniqueIds[j];
            const pair = a < b ? `${a}--${b}` : `${b}--${a}`;
            const id = `book:${bk}:${pair}`;
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            linkList.push({
              id,
              source: a,
              target: b,
              kind: LINK_KIND_BOOK,
              bookKey: bk,
              bookTitle: book.title,
            });
          }
        }
      });

    return linkList;
  }

  function buildLinkTooltipHtml(link) {
    if (link.kind === LINK_KIND_BOOK) {
      const title = String(link.bookTitle ?? "").trim();
      if (!title) return "";
      return (
        `<div style="color:rgba(255,255,255,0.9);text-align:left;font-family:ui-monospace,monospace;font-size:13px;">` +
        `同见于《${title}》` +
        `</div>`
      );
    }
    return "";
  }

  function nodeRadius(node) {
    const count = node.count || 1;
    if (node.kind === NODE_KIND_FRAMEWORK) {
      return Math.min(FRAMEWORK_MAX_RADIUS, FRAMEWORK_BASE_RADIUS + count * FRAMEWORK_RADIUS_STEP);
    }
    return Math.min(
      CONCEPT_MAX_RADIUS,
      CONCEPT_BASE_RADIUS + (count - 1) * CONCEPT_RADIUS_STEP
    );
  }

  function nodeFillColor(node) {
    return node.kind === NODE_KIND_FRAMEWORK
      ? NODE_COLOR_FRAMEWORK
      : NODE_COLOR_CONCEPT;
  }

  function applyNodeAppearance(circle, node) {
    circle
      .attr("fill", nodeFillColor(node))
      .attr(
        "fill-opacity",
        node.kind === NODE_KIND_FRAMEWORK ? 1 : NODE_FILL_OPACITY
      );
  }

  function labelOffsetY(radius) {
    return radius + LABEL_GAP;
  }

  function labelBaseY(d) {
    return labelOffsetY(d.radius) + (d.labelDyExtra || 0);
  }

  function findFirstOpenParenIndex(text) {
    const zh = text.indexOf("（");
    const en = text.indexOf("(");
    if (zh === -1) return en;
    if (en === -1) return zh;
    return Math.min(zh, en);
  }

  function truncateWithEllipsis(text, maxLen = LABEL_MAX_CHARS_PER_LINE) {
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}…`;
  }

  function splitLabelLines(label) {
    const text = String(label || "").trim();
    if (!text) return [""];
    if (text.length <= LABEL_MAX_CHARS_PER_LINE) return [text];

    const parenIdx = findFirstOpenParenIndex(text);
    if (parenIdx > 0) {
      const line1 = text.slice(0, parenIdx);
      const line2 = truncateWithEllipsis(text.slice(parenIdx));
      return line2 ? [line1, line2] : [line1];
    }

    const line1 = text.slice(0, LABEL_MAX_CHARS_PER_LINE);
    const remainder = text.slice(LABEL_MAX_CHARS_PER_LINE);
    if (!remainder) return [line1];

    const line2 = truncateWithEllipsis(remainder);
    return [line1, line2];
  }

  function updateNodeLabel(textSelection) {
    textSelection.each(function (d) {
      const el = d3.select(this);
      const lines = splitLabelLines(d.label);

      el.attr("text-anchor", "middle")
        .attr("x", 0)
        .attr("y", labelBaseY(d))
        .attr("fill", LABEL_COLOR)
        .attr("font-family", "ui-monospace, monospace")
        .attr("font-size", LABEL_FONT_SIZE);

      el.selectAll("tspan").remove();

      if (lines.length === 1) {
        el.attr("dominant-baseline", "hanging").text(lines[0]);
        return;
      }

      el.attr("dominant-baseline", "alphabetic").text(null);
      el.append("tspan")
        .attr("x", 0)
        .attr("dy", "-0.6em")
        .text(lines[0]);
      el.append("tspan")
        .attr("x", 0)
        .attr("dy", "1.2em")
        .text(lines[1]);
    });
  }

  function bboxInRootSvg(element) {
    if (!element || !svg) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const bbox = element.getBBox();
    const ctm = element.getCTM();
    if (!ctm) {
      return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
    }

    const root = svg.node();
    const corners = [
      [bbox.x, bbox.y],
      [bbox.x + bbox.width, bbox.y],
      [bbox.x, bbox.y + bbox.height],
      [bbox.x + bbox.width, bbox.y + bbox.height],
    ];

    const mapped = corners.map(([x, y]) => {
      const pt = root.createSVGPoint();
      pt.x = x;
      pt.y = y;
      return pt.matrixTransform(ctm);
    });

    const xs = mapped.map((p) => p.x);
    const ys = mapped.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);

    return {
      x,
      y,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - y,
    };
  }

  function bboxesOverlap(a, b, padding = 2) {
    return !(
      a.x + a.width + padding < b.x ||
      b.x + b.width + padding < a.x ||
      a.y + a.height + padding < b.y ||
      b.y + b.height + padding < a.y
    );
  }

  function resolveLabelCollisions() {
    if (!gNodes || !svg) return;

    const items = gNodes
      .selectAll("g.node")
      .nodes()
      .map((gEl) => {
        const d = d3.select(gEl).datum();
        const text = gEl.querySelector("text.node-label");
        if (!d || !text) return null;
        return { d, text };
      })
      .filter(Boolean);

    if (items.length < 2) return;

    items.forEach(({ d }) => {
      d.labelDyExtra = 0;
      d.labelDyShiftCount = 0;
    });
    gNodes.selectAll("text.node-label").call(updateNodeLabel);

    const maxPasses = items.length * items.length;

    for (let pass = 0; pass < maxPasses; pass += 1) {
      let shifted = false;

      const measured = items.map((item) => ({
        item,
        box: bboxInRootSvg(item.text),
      }));

      for (let i = 0; i < measured.length; i += 1) {
        for (let j = i + 1; j < measured.length; j += 1) {
          const a = measured[i];
          const b = measured[j];
          if (!bboxesOverlap(a.box, b.box)) continue;

          const lower =
            a.box.y + a.box.height / 2 >= b.box.y + b.box.height / 2 ? a : b;
          const { d } = lower.item;

          if ((d.labelDyShiftCount || 0) >= LABEL_COLLISION_MAX_SHIFTS) continue;

          d.labelDyExtra = (d.labelDyExtra || 0) + LABEL_COLLISION_SHIFT_PX;
          d.labelDyShiftCount = (d.labelDyShiftCount || 0) + 1;
          shifted = true;
        }
      }

      if (shifted) {
        gNodes.selectAll("text.node-label").call(updateNodeLabel);
      } else {
        break;
      }
    }
  }

  function bindSimulationEndHandler() {
    if (!simulation) return;
    simulation.on("end", () => {
      resolveLabelCollisions();
      updateClusterLabels();
      if (pendingAutoFit) {
        pendingAutoFit = false;
        fitGraphToView(FIT_VIEW_PADDING);
      }
      simulation.stop();
    });
  }

  function attachNodeRadii(nodes) {
    nodes.forEach((n) => {
      n.radius = nodeRadius(n);
    });
  }

  function buildGraphModel() {
    const conceptMap = new Map();

    function upsertNode(id, label, kind) {
      if (!id || !label) return null;

      if (!conceptMap.has(id)) {
        conceptMap.set(id, {
          id,
          label,
          kind,
          count: 0,
          books: [],
          bookCounts: new Map(),
          clusterCounts: new Map(),
        });
      }

      const node = conceptMap.get(id);
      if (node.kind !== kind) {
        node.kind = kind;
      }
      return node;
    }

    loadBooks()
      .filter((book) => ideaBookHasContent(book))
      .forEach((book) => {
        const bookRef = {
          title: book.title,
          author: bookAuthor(book),
        };
        const bk = bookKey(bookRef);
        const cluster = resolveBookCluster(book);

        const framework =
          window.ReadingCosmosIdeaBook?.ideaBookFramework(book) ||
          String(book.framework ?? "").trim();
        if (framework) {
          const fwId = frameworkNodeId(framework);
          const fwNode = upsertNode(fwId, framework, NODE_KIND_FRAMEWORK);
          if (fwNode) {
            fwNode.count += 1;
            fwNode.books.push(bookRef);
            fwNode.bookCounts.set(bk, (fwNode.bookCounts.get(bk) || 0) + 1);
            fwNode.clusterCounts.set(
              cluster,
              (fwNode.clusterCounts.get(cluster) || 0) + 1
            );
          }
        }

        if (!Array.isArray(book.concepts)) return;

        book.concepts.forEach((raw) => {
          const label = String(raw || "").trim();
          const key = conceptKey(label);
          if (!key) return;

          const node = upsertNode(key, label, NODE_KIND_CONCEPT);
          if (!node) return;

          node.count += 1;
          node.books.push(bookRef);
          node.bookCounts.set(bk, (node.bookCounts.get(bk) || 0) + 1);
          node.clusterCounts.set(
            cluster,
            (node.clusterCounts.get(cluster) || 0) + 1
          );
        });
      });

    const nodes = Array.from(conceptMap.values());
    nodes.forEach((node) => {
      let primaryBookId = null;
      let maxCount = 0;
      node.bookCounts.forEach((count, bk) => {
        if (count > maxCount) {
          maxCount = count;
          primaryBookId = bk;
        }
      });
      node.primaryBookId = primaryBookId;
      node.cluster = pickDominantCluster(node.clusterCounts);
      delete node.bookCounts;
      delete node.clusterCounts;
    });

    const clusterIds = nodes.map((n) => n.cluster).filter(Boolean);
    clusterCentersMap = computeClusterCenters(clusterIds);

    const bookLinks = buildBookLinks(conceptMap);

    return { nodes, links: bookLinks };
  }

  function buildTooltipHtml(node) {
    const seen = new Set();
    const uniqueBooks = node.books.filter((b) => {
      const k = `${b.title}\0${b.author}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const bookRows = uniqueBooks
      .map((b) => {
        const bk = `${b.title}\0${b.author}`;
        let row = `<div style="line-height:1.8;">《${b.title}》| ${b.author}</div>`;
        if (node.kind === NODE_KIND_FRAMEWORK && node.cluster) {
          row += `<div style="font-size:12px;opacity:0.75;margin:4px 0 8px;">议题群落：${node.cluster}</div>`;
        }
        return row;
      })
      .join("");

    const titleColor =
      node.kind === NODE_KIND_FRAMEWORK ? "#22F0E9" : "rgba(34,240,233,0.9)";

    return (
      `<div style="color:${titleColor};text-align:left;font-family:ui-monospace,monospace;">` +
      `<div style="font-size:14px;font-weight:bold;margin-bottom:10px;">${node.label}</div>` +
      bookRows +
      `<div style="margin-top:10px;font-size:12px;opacity:0.7;">共出现 ${node.count} 次</div>` +
      `</div>`
    );
  }

  function ensureDomTooltip() {
    if (domTooltipEl) return domTooltipEl;

    domTooltipEl = document.createElement("div");
    domTooltipEl.id = "galaxy-concept-tooltip";
    domTooltipEl.className = "culture-map-tooltip";
    domTooltipEl.setAttribute("role", "tooltip");
    domTooltipEl.hidden = true;
    document.body.appendChild(domTooltipEl);
    return domTooltipEl;
  }

  function positionDomTooltip(clientX, clientY) {
    if (!domTooltipEl) return;
    const offset = 14;
    domTooltipEl.style.left = `${clientX + offset}px`;
    domTooltipEl.style.top = `${clientY + offset}px`;
  }

  function showDomTooltip(html, clientX, clientY) {
    const el = ensureDomTooltip();
    el.innerHTML = html;
    el.hidden = false;
    positionDomTooltip(clientX, clientY);

    if (!domTooltipMoveHandler) {
      domTooltipMoveHandler = (e) => positionDomTooltip(e.clientX, e.clientY);
      document.addEventListener("mousemove", domTooltipMoveHandler);
    }
  }

  function hideDomTooltip() {
    if (domTooltipEl) domTooltipEl.hidden = true;
    if (domTooltipMoveHandler) {
      document.removeEventListener("mousemove", domTooltipMoveHandler);
      domTooltipMoveHandler = null;
    }
  }

  function showNewConceptToast(names) {
    const el = document.getElementById("galaxy-new-concept-toast");
    if (!el || names.length === 0) return;

    clearTimeout(newConceptTimer);
    const text =
      names.length > 3
        ? `${names.slice(0, 3).join("、")} 等 ${names.length} 个`
        : names.join("、");
    el.textContent = `🌱 发现新概念：${text}`;
    el.hidden = false;

    newConceptTimer = setTimeout(() => {
      el.hidden = true;
    }, 2000);
  }

  function updateSidebar(nodes) {
    if (window.ReadingCosmosGalaxySidebar?.refresh) {
      ReadingCosmosGalaxySidebar.refresh({ conceptCount: nodes.length });
      return;
    }

    const summary = document.getElementById("galaxy-concepts-summary");
    if (!summary) return;

    if (nodes.length === 0) {
      summary.textContent = "尚无概念";
      summary.className = "glass-card__empty";
      return;
    }

    const ideaBooks = loadBooks().filter((b) => b.route === "idea");
    summary.className = "glass-card__summary galaxy-concepts__stats";
    summary.textContent = `共 ${nodes.length} 个概念 / ${ideaBooks.length} 本书`;
  }

  function getGalaxyContainer() {
    return (
      document.getElementById("idea-main") ||
      document.getElementById("galaxy-graph-container")
    );
  }

  function isGalaxyTabVisible() {
    const panel = document.getElementById("panel-galaxy");
    return panel && !panel.hidden;
  }

  function measureCanvas() {
    const container = getGalaxyContainer();
    if (!container || !svg) return;
    width = container.clientWidth || 600;
    height = container.clientHeight || 400;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
  }

  function preserveNodePositions(nextNodes) {
    if (!simulation) return;

    const prev = new Map(simulation.nodes().map((n) => [n.id, n]));
    nextNodes.forEach((n) => {
      const old = prev.get(n.id);
      if (old) {
        n.x = old.x;
        n.y = old.y;
        n.vx = old.vx;
        n.vy = old.vy;
      } else {
        n.x = width / 2 + (Math.random() - 0.5) * width * 0.25;
        n.y = height / 2 + (Math.random() - 0.5) * height * 0.25;
      }
    });
  }

  function ticked() {
    gLinks
      .selectAll("line")
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    gNodes
      .selectAll("g.node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    updateClusterLabels();
  }

  function configureSimulationForces(linkData) {
    const linkForce =
      linkData.length > 0
        ? d3
            .forceLink(linkData)
            .id((d) => d.id)
            .distance(90)
            .strength(0.25)
        : null;

    return {
      link: linkForce,
      clusterCenter: forceClusterCenter(
        clusterCentersMap,
        CLUSTER_ATTRACT_STRENGTH
      ),
      clusterCharge: forceClusterCharge(
        CLUSTER_CHARGE_CROSS,
        CLUSTER_CHARGE_SAME
      ),
      center: d3.forceCenter(width / 2, height / 2).strength(0.01),
      collision: d3
        .forceCollide()
        .radius((d) => d.radius + CLUSTER_COLLISION_PADDING),
      bookCohesion: forceBookCohesion(BOOK_COHESION_STRENGTH),
    };
  }

  function applySimulationForces(forces) {
    if (!simulation) return;

    simulation.force("link", forces.link);
    simulation.force("similarity", null);
    simulation.force("charge", null);
    simulation.force("clusterCenter", forces.clusterCenter);
    simulation.force("clusterCharge", forces.clusterCharge);
    simulation.force("center", forces.center);
    simulation.force("collision", forces.collision);
    simulation.force("book", forces.bookCohesion);
    simulation.force("bookCluster", null);
    simulation.force("clusterRadial", null);
  }

  function renderGraph(nodes, linkData, options = {}) {
    const animate = options.animate === true;

    attachNodeRadii(nodes);
    nodes.forEach((n) => {
      n.labelDyExtra = 0;
      n.labelDyShiftCount = 0;
    });
    preserveNodePositions(nodes);
    graphNodes = nodes;
    graphLinkData = linkData;
    adjacencyMap = buildAdjacency(linkData, nodes);
    pendingAutoFit = true;

    if (selectedNodeId && !nodes.some((n) => n.id === selectedNodeId)) {
      selectedNodeId = null;
    }

    const t = animate ? d3.transition().duration(600) : null;

    const link = gLinks
      .selectAll("line")
      .data(linkData, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("class", "link-line")
            .attr("stroke", DEFAULT_LINK_COLOR)
            .attr("stroke-width", LINK_WIDTH)
            .attr("stroke-opacity", LINK_OPACITY_HIDDEN)
            .style("pointer-events", "stroke")
            .on("mouseover", function (event, d) {
              const html = buildLinkTooltipHtml(d);
              if (!html) return;

              const ctx = getSelectionContext();
              if (ctx && !isLinkVisibleWhenSelected(d, ctx)) return;

              hoveredLinkId = d.id;
              showDomTooltip(html, event.clientX, event.clientY);
              const line = d3.select(this);
              line.attr("stroke-opacity", 1);
              line.attr("stroke-width", LINK_WIDTH_HOVER);
              line.attr(
                "stroke",
                d.kind === LINK_KIND_BOOK
                  ? BOOK_LINK_COLOR_HOVER
                  : DEFAULT_LINK_COLOR
              );
            })
            .on("mousemove", function (event) {
              positionDomTooltip(event.clientX, event.clientY);
            })
            .on("mouseout", function () {
              hoveredLinkId = null;
              hideDomTooltip();
              applySelectionVisuals();
            }),
        (update) => update.style("pointer-events", "stroke"),
        (exit) => {
          const rem = exit;
          if (t) rem.transition(t).attr("stroke-opacity", 0).remove();
          else rem.remove();
          return rem;
        }
      );

    if (t) {
      link.transition(t).attr("stroke-opacity", LINK_OPACITY_HIDDEN);
    }
    applyLinkAppearance(link, getSelectionContext());

    const node = gNodes
      .selectAll("g.node")
      .data(nodes, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .attr("class", "node")
            .style("cursor", "pointer");

          const circleEnter = g
            .append("circle")
            .attr("class", "node-star")
            .attr("r", (d) => d.radius)
            .attr("stroke", "none")
            .attr("filter", `url(#${glowFilterId})`);
          circleEnter.each(function (d) {
            applyNodeAppearance(d3.select(this), d);
          });

          g.append("text").attr("class", "node-label");

          return g;
        },
        (update) => update,
        (exit) => {
          const rem = exit;
          if (t) rem.transition(t).style("opacity", 0).remove();
          else rem.remove();
          return rem;
        }
      );

    const circle = node.select("circle");
    if (t) {
      circle.transition(t).attr("r", (d) => d.radius);
    } else {
      circle.attr("r", (d) => d.radius);
    }

    circle.attr("stroke", "none").attr("filter", `url(#${glowFilterId})`);
    circle.each(function (d) {
      applyNodeAppearance(d3.select(this), d);
    });

    node.select("text.node-label").call(updateNodeLabel);

    node
      .on("click", function (event, d) {
        event.stopPropagation();
        toggleNodeSelection(d.id);
      })
      .on("mouseover", function (event, d) {
        showDomTooltip(buildTooltipHtml(d), event.clientX, event.clientY);
        if (!selectedNodeId && !highlightedBookConceptIds) {
          d3.select(this).select("circle").attr("fill-opacity", 1);
          d3.select(this).select("text").attr("fill", "rgba(255,255,255,0.95)");
        }
      })
      .on("mousemove", function (event) {
        positionDomTooltip(event.clientX, event.clientY);
      })
      .on("mouseout", function () {
        hideDomTooltip();
        applySelectionVisuals();
      });

    const forces = configureSimulationForces(linkData);

    if (!simulation) {
      simulation = d3
        .forceSimulation(nodes)
        .alphaDecay(SIMULATION_ALPHA_DECAY)
        .velocityDecay(SIMULATION_VELOCITY_DECAY)
        .on("tick", ticked);
      applySimulationForces(forces);
      simulation.alpha(1);
    } else {
      simulation.alphaDecay(SIMULATION_ALPHA_DECAY);
      simulation.velocityDecay(SIMULATION_VELOCITY_DECAY);
      simulation.nodes(nodes);
      applySimulationForces(forces);
      simulation.alpha(SIMULATION_RESTART_ALPHA).restart();
    }

    bindSimulationEndHandler();

    link
      .attr("x1", (d) => d.source?.x ?? 0)
      .attr("y1", (d) => d.source?.y ?? 0)
      .attr("x2", (d) => d.target?.x ?? 0)
      .attr("y2", (d) => d.target?.y ?? 0);

    node.attr(
      "transform",
      (d) => `translate(${d.x ?? width / 2},${d.y ?? height / 2})`
    );

    applySelectionVisuals();

    if (pendingFocusNodeId) {
      const focusId = pendingFocusNodeId;
      pendingFocusNodeId = null;
      requestAnimationFrame(() => selectConceptById(focusId, { focus: true }));
    }
  }

  function initGalaxyOnce() {
    if (galaxyInitialized) return;

    const container = getGalaxyContainer();
    if (!container || typeof d3 === "undefined") {
      console.warn("[Reading Cosmos] D3 未加载或星系容器缺失");
      return;
    }

    svg = d3
      .select("#galaxy-graph")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("role", "img")
      .attr("aria-label", "概念星系图");

    glowFilterId = "galaxy-node-glow";
    glowFilterStrongId = "galaxy-node-glow-strong";
    const defs = svg.append("defs");

    function appendNodeGlowFilter(id, blurStd) {
      const nodeFilter = defs
        .append("filter")
        .attr("id", id)
        .attr("x", "-120%")
        .attr("y", "-120%")
        .attr("width", "340%")
        .attr("height", "340%")
        .attr("color-interpolation-filters", "sRGB");

      nodeFilter
        .append("feGaussianBlur")
        .attr("in", "SourceGraphic")
        .attr("stdDeviation", blurStd)
        .attr("result", "halo");
      const nodeMerge = nodeFilter.append("feMerge");
      nodeMerge.append("feMergeNode").attr("in", "halo");
      nodeMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    appendNodeGlowFilter(glowFilterId, GLOW_BLUR_STD);
    appendNodeGlowFilter(glowFilterStrongId, GLOW_BLUR_HIGHLIGHT_STD);

    gRoot = svg.append("g");
    gLinks = gRoot.append("g").attr("class", "links");
    gNodes = gRoot.append("g").attr("class", "nodes");

    zoomBehavior = d3
      .zoom()
      .scaleExtent(ZOOM_SCALE_EXTENT)
      .on("zoom", (event) => {
        gRoot.attr("transform", event.transform);
        updateClusterLabels();
      });

    svg.call(zoomBehavior).on("dblclick.zoom", null);

    ensureClusterLabelsOverlay();

    svg.on("click", (event) => {
      if (event.target.closest?.(".node")) return;
      clearSelection();
      clearBookHighlight();
    });

    measureCanvas();

    const resizeObserver = new ResizeObserver(() => {
      if (!galaxyInitialized) return;
      measureCanvas();
      const clusterIds = (simulation?.nodes() || graphNodes)
        .map((n) => n.cluster)
        .filter(Boolean);
      clusterCentersMap = computeClusterCenters(clusterIds);
      if (simulation) {
        simulation.force(
          "center",
          d3.forceCenter(width / 2, height / 2).strength(0.01)
        );
        simulation.force(
          "clusterCenter",
          forceClusterCenter(clusterCentersMap, CLUSTER_ATTRACT_STRENGTH)
        );
        simulation.force(
          "clusterCharge",
          forceClusterCharge(CLUSTER_CHARGE_CROSS, CLUSTER_CHARGE_SAME)
        );
        simulation.alpha(SIMULATION_RESTART_ALPHA).restart();
      }
      updateClusterLabels();
    });
    resizeObserver.observe(container);

    ensureDomTooltip();
    galaxyInitialized = true;
  }

  function refreshGalaxy(options = {}) {
    if (typeof d3 === "undefined") return;

    initGalaxyOnce();
    if (!svg || !gNodes || !gLinks) return;

    const container = getGalaxyContainer();
    if (!container || container.clientWidth === 0) return;

    hideDomTooltip();
    measureCanvas();

    const preserveSelection =
      options.preserveSelection && selectedNodeId ? selectedNodeId : null;

    if (!options.preserveSelection) {
      selectedNodeId = null;
      clearBookHighlight();
    }

    const prevKnown = new Set(knownConceptIds);
    const { nodes, links: linkData } = buildGraphModel();

    if (options.highlightNew) {
      const newNames = nodes
        .filter((n) => !prevKnown.has(n.id))
        .map((n) => n.label);
      if (newNames.length > 0) {
        showNewConceptToast(newNames);
      }
    }

    nodes.forEach((n) => knownConceptIds.add(n.id));

    if (nodes.length === 0) {
      gLinks.selectAll("line").remove();
      gNodes.selectAll("g.node").remove();
      if (simulation) simulation.stop();
      updateSidebar([]);
      return;
    }

    renderGraph(nodes, linkData, { animate: false });
    updateSidebar(nodes);

    if (preserveSelection) {
      selectConceptById(preserveSelection, { focus: false });
    }
  }

  function scheduleGalaxyInit() {
    if (typeof d3 === "undefined") return;

    const boot = () => {
      initGalaxyOnce();
      if (isGalaxyTabVisible()) {
        refreshGalaxy();
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  function ensureGalaxyVisible() {
    initGalaxyOnce();
    refreshGalaxy();
    resizeGraph();
  }

  function resizeGraph() {
    if (!galaxyInitialized || !svg) return;

    measureCanvas();
    const clusterIds = (simulation?.nodes() || graphNodes)
      .map((n) => n.cluster)
      .filter(Boolean);
    clusterCentersMap = computeClusterCenters(clusterIds);

    if (simulation) {
      simulation.force(
        "center",
        d3.forceCenter(width / 2, height / 2).strength(0.01)
      );
      simulation.force(
        "clusterCenter",
        forceClusterCenter(clusterCentersMap, CLUSTER_ATTRACT_STRENGTH)
      );
      simulation.force(
        "clusterCharge",
        forceClusterCharge(CLUSTER_CHARGE_CROSS, CLUSTER_CHARGE_SAME)
      );
      simulation.alpha(SIMULATION_RESTART_ALPHA).restart();
    }
    updateClusterLabels();
  }

  window.ReadingCosmosGalaxy = {
    init: scheduleGalaxyInit,
    refreshGalaxy,
    resizeGraph,
    ensureGalaxyVisible,
    selectConceptById,
    toggleBookHighlightInGalaxy,
    clearBookHighlight,
    conceptKey,
  };

  scheduleGalaxyInit();
})();
