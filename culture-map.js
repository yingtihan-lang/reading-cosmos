/**
 * Culture Journey — amCharts 5 世界地图
 * chart / root / series 只初始化一次，数据更新仅通过 refreshMapData → setAll
 */
(function () {
  const STORAGE_KEY = "reading_cosmos_books";
  const FILL_DEFAULT = 0x1a2744;
  const FILL_READ = 0x22f0e9;
  const STROKE_CYAN = 0x22f0e9;
  const MERGED_INTO_CN = ["TW", "HK", "MO"];
  const CHINA_GEO_POINT = { longitude: 104, latitude: 35 };
  const CHINA_ZOOM_LEVEL = 3;
  const COUNTRY_FOCUS_ZOOM_LEVEL = 4;
  const COUNTRY_FLASH_DURATION_MS = 800;
  const MAP_WHEEL_SENSITIVITY = 0.3;

  const COUNTRY_ALIASES = {
    "united states": "US",
    "united states of america": "US",
    usa: "US",
    "u.s.a.": "US",
    "u.s.": "US",
    america: "US",
    "united kingdom": "GB",
    "great britain": "GB",
    uk: "GB",
    england: "GB",
    russia: "RU",
    "russian federation": "RU",
    "south korea": "KR",
    "republic of korea": "KR",
    korea: "KR",
    "north korea": "KP",
    "czech republic": "CZ",
    czechia: "CZ",
    "viet nam": "VN",
    vietnam: "VN",
    iran: "IR",
    "islamic republic of iran": "IR",
    tanzania: "TZ",
    "united republic of tanzania": "TZ",
    bolivia: "BO",
    "plurinational state of bolivia": "BO",
    venezuela: "VE",
    "venezuela (bolivarian republic of)": "VE",
    syria: "SY",
    "syrian arab republic": "SY",
    laos: "LA",
    "lao people's democratic republic": "LA",
    moldova: "MD",
    "republic of moldova": "MD",
    brunei: "BN",
    "brunei darussalam": "BN",
    "ivory coast": "CI",
    "côte d'ivoire": "CI",
    "cote d'ivoire": "CI",
    "democratic republic of the congo": "CD",
    "republic of the congo": "CG",
    "burma": "MM",
    myanmar: "MM",
    "east timor": "TL",
    "timor-leste": "TL",
    palestine: "PS",
    "state of palestine": "PS",
    china: "CN",
    "people's republic of china": "CN",
    prc: "CN",
    italy: "IT",
    italian: "IT",
  };

  let mapRoot = null;
  let mapChart = null;
  let mapPolygonSeries = null;
  let mapInitialized = false;
  let mapInitScheduled = false;

  let countryStats = {};
  let nameToId = {};
  let idToName = {};
  let domTooltipEl = null;
  let domTooltipMoveHandler = null;
  let countryFlashAnimations = [];

  function isMapSeriesReady() {
    return mapPolygonSeries && !mapPolygonSeries.isDisposed();
  }

  function isMapChartReady() {
    return mapChart && !mapChart.isDisposed();
  }

  function focusMapOnChina() {
    if (!isMapChartReady()) return;
    mapChart.zoomToGeoPoint(CHINA_GEO_POINT, CHINA_ZOOM_LEVEL, true);
  }

  function resolveCountryGeoPoint(englishName, countryId) {
    const fromTable = window.ReadingCosmosCountryCenters?.getCenterCoords?.(
      englishName
    );
    if (fromTable) {
      return ReadingCosmosCountryCenters.coordsToGeoPoint(fromTable);
    }

    const isoId = countryId === "CN" ? "CN" : countryId;
    if (!isoId || !window.am5geodata_worldLow?.features) return null;

    const feature = am5geodata_worldLow.features.find((f) => f.id === isoId);
    if (!feature?.geometry || typeof am5map?.getGeoBounds !== "function") {
      return null;
    }

    try {
      const bounds = am5map.getGeoBounds(feature.geometry);
      return {
        longitude: (bounds.left + bounds.right) / 2,
        latitude: (bounds.top + bounds.bottom) / 2,
      };
    } catch {
      return null;
    }
  }

  function polygonIdsForStat(statId) {
    if (statId === "CN") return ["CN", "TW", "HK", "MO"];
    return [statId];
  }

  function getMapPolygonsByIds(ids) {
    const wanted = new Set(ids);
    const polygons = [];
    if (!isMapSeriesReady()) return polygons;

    mapPolygonSeries.mapPolygons.each((polygon) => {
      if (!polygon || polygon.isDisposed()) return;
      const id = polygon.dataItem?.get("id");
      if (wanted.has(id)) polygons.push(polygon);
    });

    return polygons;
  }

  function flashCountryOnMap(statId) {
    const stat = countryStats[statId];
    if (!stat || !isMapSeriesReady()) return;

    countryFlashAnimations.forEach((anim) => {
      if (anim && !anim.isDisposed()) anim.dispose();
    });
    countryFlashAnimations = [];

    const polygons = getMapPolygonsByIds(polygonIdsForStat(statId));
    if (!polygons.length) return;

    const readFill = am5.color(FILL_READ);
    const whiteFill = am5.color(0xffffff);
    const fillOpacity = opacityForCount(stat.count);

    polygons.forEach((polygon) => {
      polygon.setAll({
        fill: whiteFill,
        fillOpacity,
      });

      const anim = polygon.animate({
        key: "fill",
        to: readFill,
        duration: COUNTRY_FLASH_DURATION_MS,
        easing: am5.ease.out(am5.ease.cubic),
      });

      if (anim) countryFlashAnimations.push(anim);
    });
  }

  function focusMapOnCountry(englishName, countryId) {
    if (!isMapChartReady()) return false;

    const statId = canonicalMapId(countryId);
    const point = resolveCountryGeoPoint(englishName, statId);
    if (!point) {
      console.warn("[Reading Cosmos] 无法定位国家中心:", englishName, countryId);
      return false;
    }

    hideDomTooltip();
    mapChart.zoomToGeoPoint(point, COUNTRY_FOCUS_ZOOM_LEVEL, true);
    flashCountryOnMap(statId);
    return true;
  }

  function bindMapResetButton() {
    const resetBtn = document.getElementById("culture-map-reset-btn");
    if (!resetBtn || resetBtn.dataset.bound === "true") return;
    resetBtn.dataset.bound = "true";
    resetBtn.addEventListener("click", () => focusMapOnChina());
  }

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function buildNameLookup() {
    nameToId = {};
    idToName = {};

    if (!window.am5geodata_worldLow?.features) return;

    am5geodata_worldLow.features.forEach((feature) => {
      const id = feature.id;
      const name = feature.properties?.name;
      if (!id || !name) return;
      nameToId[normalizeName(name)] = id;
      idToName[id] = name;
    });

    Object.entries(COUNTRY_ALIASES).forEach(([alias, id]) => {
      nameToId[normalizeName(alias)] = id;
    });
  }

  function normalizeStoredCountry(countryName) {
    if (window.ReadingCosmosCountry) {
      return ReadingCosmosCountry.normalizeCountryName(countryName);
    }
    return String(countryName || "").trim();
  }

  function canonicalMapId(isoId) {
    if (window.ReadingCosmosCountry) {
      return ReadingCosmosCountry.canonicalMapCountryId(isoId);
    }
    return isoId;
  }

  function resolveCountryId(countryName) {
    const normalized = normalizeStoredCountry(countryName);
    const key = normalizeName(normalized);
    if (!key) return null;
    if (nameToId[key]) return nameToId[key];

    const entries = Object.entries(nameToId);
    const exactWord = entries.find(([name]) => name === key);
    if (exactWord) return exactWord[1];

    const contains = entries.find(
      ([name]) => name.includes(key) || key.includes(name)
    );
    if (contains) return contains[1];

    console.warn("[Reading Cosmos] 无法匹配国家:", countryName);
    return null;
  }

  function opacityForCount(count) {
    if (count >= 3) return 0.85;
    if (count === 2) return 0.6;
    return 0.4;
  }

  function bookAuthor(book) {
    return String(book.author ?? "").trim();
  }

  function displayCountryName(englishName) {
    if (window.ReadingCosmosCountryNames?.getChineseName) {
      return ReadingCosmosCountryNames.getChineseName(englishName);
    }
    return String(englishName ?? "").trim();
  }

  function formatBookTooltipLine(book) {
    const author = bookAuthor(book);
    if (author) return `《${book.title}》| ${author}`;
    return `《${book.title}》`;
  }

  function buildCountryTooltipHtml(name, books, count) {
    const bookRows = books
      .map(
        (b) =>
          `<div style="line-height:1.8;">${formatBookTooltipLine(b)}</div>`
      )
      .join("");

    return (
      `<div style="color:#22F0E9;text-align:left;font-family:ui-monospace,monospace;">` +
      `<div style="font-size:14px;font-weight:bold;margin-bottom:10px;">${name}</div>` +
      bookRows +
      `<div style="margin-top:10px;font-size:12px;opacity:0.7;">共 ${count} 本</div>` +
      `</div>`
    );
  }

  function rebuildCountryTooltipMap() {
    window.countryTooltipMap = {};

    function addEntry(polygonId, stat, displayName) {
      const englishName = displayName || idToName[polygonId] || stat.name;
      const name = displayCountryName(englishName);
      window.countryTooltipMap[polygonId] = buildCountryTooltipHtml(
        name,
        stat.books,
        stat.count
      );
    }

    Object.entries(countryStats).forEach(([statId, stat]) => {
      addEntry(statId, stat);

      if (statId === "CN") {
        const chinaName = idToName.CN || stat.name;
        MERGED_INTO_CN.forEach((mergedId) => addEntry(mergedId, stat, chinaName));
      }
    });
  }

  function ensureDomTooltip() {
    if (domTooltipEl) return domTooltipEl;

    domTooltipEl = document.createElement("div");
    domTooltipEl.id = "culture-map-tooltip";
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

  function buildCountryStats() {
    const stats = {};

    loadBooks()
      .filter((book) => book.route === "culture" && book.country)
      .forEach((book) => {
        const countryLabel = normalizeStoredCountry(book.country);
        const id = resolveCountryId(countryLabel);
        if (!id) return;

        const statId = canonicalMapId(id);

        if (!stats[statId]) {
          stats[statId] = {
            count: 0,
            books: [],
            name: idToName[statId] || countryLabel,
          };
        }

        stats[statId].count += 1;
        stats[statId].books.push(book);
      });

    countryStats = stats;
    return stats;
  }

  /** 生成 polygonSeries.data：仅颜色与高亮（polygonSettings） */
  function buildMapData() {
    const mapData = [];

    function pushEntry(polygonId, stat) {
      mapData.push({
        id: polygonId,
        polygonSettings: {
          fill: am5.color(FILL_READ),
          fillOpacity: opacityForCount(stat.count),
          interactive: true,
        },
      });
    }

    Object.entries(countryStats).forEach(([statId, stat]) => {
      pushEntry(statId, stat);

      if (statId === "CN") {
        MERGED_INTO_CN.forEach((mergedId) => pushEntry(mergedId, stat));
      }
    });

    return mapData;
  }

  function getCultureBooksByCountry() {
    buildCountryStats();
    const allCulture = loadBooks().filter((b) => b.route === "culture" && b.country);

    const groups = Object.entries(countryStats).map(([statId, stat]) => {
      const books = allCulture.filter((book) => {
        const id = resolveCountryId(normalizeStoredCountry(book.country));
        if (!id) return false;
        return canonicalMapId(id) === statId;
      });

      books.sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));

      return {
        countryId: statId,
        englishName: stat.name,
        countryName: displayCountryName(stat.name),
        books,
      };
    });

    groups.sort((a, b) =>
      a.countryName.localeCompare(b.countryName, "zh-CN")
    );

    return groups;
  }

  function updateSidebar() {
    if (window.ReadingCosmosCultureSidebar?.refresh) {
      ReadingCosmosCultureSidebar.refresh(getCultureBooksByCountry());
    }
  }

  /**
   * 更新颜色数据 + 重建 countryTooltipMap（tooltip 由原生 DOM 显示）
   */
  function refreshMapData() {
    if (!mapPolygonSeries || mapPolygonSeries.isDisposed()) return;

    hideDomTooltip();
    buildCountryStats();
    rebuildCountryTooltipMap();
    mapPolygonSeries.data.setAll(buildMapData());
    updateSidebar();
  }

  function initMapOnce() {
    if (mapInitialized) return;

    const container = document.getElementById("culture-map-chart");
    if (!container) return;

    if (typeof am5 === "undefined" || typeof am5map === "undefined") {
      console.warn("[Reading Cosmos] amCharts 未加载");
      return;
    }

    buildNameLookup();

    mapRoot = am5.Root.new("culture-map-chart");
    if (mapRoot._logo) mapRoot._logo.dispose();

    mapRoot.setThemes([am5themes_Animated.new(mapRoot)]);

    mapRoot.container.set(
      "background",
      am5.Rectangle.new(mapRoot, {
        fill: am5.color(0x000000),
        fillOpacity: 0,
      })
    );

    const projection = am5map.geoNaturalEarth1();
    if (typeof projection.rotate === "function") {
      projection.rotate(0, 0, 0);
    }

    mapChart = mapRoot.container.children.push(
      am5map.MapChart.new(mapRoot, {
        panX: "rotateX",
        panY: "translateY",
        projection,
        homeZoomLevel: 1,
        homeGeoPoint: { longitude: 0, latitude: 0 },
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
      })
    );

    mapChart.setAll({
      dx: 0,
      dy: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      wheelSensitivity: MAP_WHEEL_SENSITIVITY,
    });

    mapPolygonSeries = mapChart.series.push(
      am5map.MapPolygonSeries.new(mapRoot, {
        geoJSON: am5geodata_worldLow,
        exclude: ["AQ"],
      })
    );

    mapPolygonSeries.setAll({
      dx: 0,
      dy: 0,
    });

    mapPolygonSeries.mapPolygons.template.setAll({
      interactive: false,
      fill: am5.color(FILL_DEFAULT),
      stroke: am5.color(STROKE_CYAN),
      strokeWidth: 0.6,
      strokeOpacity: 0.2,
      tooltip: undefined,
      tooltipHTML: "",
      templateField: "polygonSettings",
    });

    mapPolygonSeries.mapPolygons.template.events.on("pointerover", (ev) => {
      if (!isMapSeriesReady()) return;

      const polygon = ev.target;
      if (!polygon || polygon.isDisposed()) return;

      const polygonId = polygon.dataItem?.get("id");
      const html = polygonId ? window.countryTooltipMap?.[polygonId] : null;

      if (!html) {
        hideDomTooltip();
        return;
      }

      const oe = ev.originalEvent;
      const x = oe?.clientX ?? 0;
      const y = oe?.clientY ?? 0;
      showDomTooltip(html, x, y);
    });

    mapPolygonSeries.mapPolygons.template.events.on("pointerout", () => {
      hideDomTooltip();
    });

    mapPolygonSeries.mapPolygons.template.events.on("click", (ev) => {
      if (!isMapSeriesReady()) return;

      const polygon = ev.target;
      if (!polygon || polygon.isDisposed()) return;

      const polygonId = polygon.dataItem?.get("id");
      if (!polygonId) return;

      const statId = canonicalMapId(polygonId);
      const stat = countryStats[statId];
      if (!stat) return;

      hideDomTooltip();

      if (window.ReadingCosmosCultureSidebar?.focusCountryCard) {
        ReadingCosmosCultureSidebar.focusCountryCard(stat.name);
      }
    });

    ensureDomTooltip();
    window.countryTooltipMap = window.countryTooltipMap || {};

    bindMapResetButton();

    mapInitialized = true;
    refreshMapData();
    mapChart.appear(800, 150);
    setTimeout(() => focusMapOnChina(), 850);
  }

  function scheduleMapInit() {
    if (mapInitialized || mapInitScheduled) return;
    mapInitScheduled = true;

    if (typeof am5 === "undefined") return;

    am5.ready(() => {
      initMapOnce();
    });
  }

  window.addEventListener("resize", () => {
    if (mapRoot && !mapRoot.isDisposed()) {
      mapRoot.resize();
    }
  });

  function resizeMap() {
    if (mapRoot && !mapRoot.isDisposed()) {
      mapRoot.resize();
    }
  }

  window.ReadingCosmosMap = {
    init: scheduleMapInit,
    refreshMapData,
    getCultureBooksByCountry,
    focusMapOnChina,
    focusMapOnCountry,
    resizeMap,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleMapInit);
  } else {
    scheduleMapInit();
  }
})();
