/**
 * 国家名标准化（写入 localStorage 前）与地图 ISO 合并（TW / HK / MO → CN）
 */
(function () {
  const CHINA_ALIASES = new Set([
    "taiwan",
    "taiwan, province of china",
    "chinese taipei",
    "republic of china",
    "roc",
    "hong kong",
    "hk",
    "hong kong sar",
    "macao",
    "macau",
    "mo",
    "macao sar",
  ]);

  /** amCharts 多边形 id → 统计用 canonical id */
  const MAP_ID_CANONICAL = {
    TW: "CN",
    HK: "CN",
    MO: "CN",
  };

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function normalizeCountryName(country) {
    const key = normalizeKey(country);
    if (CHINA_ALIASES.has(key)) return "China";
    return String(country || "").trim();
  }

  function canonicalMapCountryId(isoId) {
    if (!isoId) return isoId;
    return MAP_ID_CANONICAL[isoId] || isoId;
  }

  window.ReadingCosmosCountry = {
    normalizeCountryName,
    canonicalMapCountryId,
  };
})();
