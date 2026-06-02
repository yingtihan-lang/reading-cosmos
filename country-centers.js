/**
 * 国家英文名 → [经度, 纬度]（地图 zoomToGeoPoint 用）
 */
(function () {
  const countryCenters = {
    China: [104, 35],
    Japan: [138, 36],
    "South Korea": [128, 36],
    "United States": [-98, 38],
    "United Kingdom": [-2, 54],
    France: [2, 46],
    Germany: [10, 51],
    Italy: [12, 42],
    Russia: [90, 60],
    Brazil: [-53, -10],
    Colombia: [-74, 4],
    Afghanistan: [67, 33],
    Malaysia: [110, 4],
    Uruguay: [-56, -33],
    Spain: [-4, 40],
    India: [78, 22],
    Mexico: [-102, 23],
    Argentina: [-64, -34],
    Iran: [53, 32],
    Iraq: [44, 33],
    Egypt: [30, 26],
    Nigeria: [8, 9],
    "South Africa": [25, -29],
    Australia: [133, -25],
    Canada: [-106, 56],
    Sweden: [18, 62],
    Norway: [9, 62],
    Denmark: [10, 56],
    Netherlands: [5, 52],
    Switzerland: [8, 47],
    Austria: [14, 47],
    Poland: [20, 52],
    "Czech Republic": [15, 50],
    Greece: [22, 39],
    Turkey: [35, 39],
    Israel: [35, 31],
    Pakistan: [69, 30],
    Bangladesh: [90, 24],
    Vietnam: [108, 16],
    Thailand: [101, 15],
    Indonesia: [113, -2],
    Philippines: [122, 12],
    Chile: [-71, -35],
    Peru: [-75, -10],
    Cuba: [-79, 22],
    Portugal: [-8, 39],
    Singapore: [103.8, 1.35],
    Myanmar: [96, 22],
    Cambodia: [105, 13],
    Laos: [103, 18],
    Mongolia: [103, 46],
    Nepal: [84, 28],
    "Sri Lanka": [81, 7],
    Kazakhstan: [68, 48],
    Ukraine: [32, 49],
    Romania: [25, 46],
    Hungary: [19, 47],
    Finland: [26, 64],
    Belgium: [4, 50],
    Morocco: [-6, 32],
    Ethiopia: [40, 9],
    Kenya: [38, 0],
    Tanzania: [35, -6],
    Ghana: [-1, 8],
    Senegal: [-14, 14],
    Algeria: [3, 28],
    Tunisia: [9, 34],
    Libya: [17, 27],
    Sudan: [30, 15],
    "Saudi Arabia": [45, 24],
    "United Arab Emirates": [54, 24],
    Jordan: [36, 31],
    Lebanon: [36, 34],
    Syria: [38, 35],
    Yemen: [48, 15],
    Venezuela: [-66, 7],
    Ecuador: [-78, -2],
    Bolivia: [-64, -17],
    Paraguay: [-58, -23],
    "New Zealand": [174, -41],
    Iceland: [-19, 65],
    Ireland: [-8, 53],
    Scotland: [-4, 57],
    Croatia: [16, 45],
    Serbia: [21, 44],
    Bulgaria: [25, 43],
    Slovakia: [19, 48],
    Lithuania: [24, 55],
    Latvia: [25, 57],
    Estonia: [26, 59],
    Taiwan: [121, 24],
    "Hong Kong": [114.2, 22.3],
    Macao: [113.5, 22.2],
    "North Korea": [127, 40],
    "Democratic Republic of the Congo": [23, -3],
    "Republic of the Congo": [15, -1],
    Angola: [18, -12],
    Mozambique: [35, -18],
    Zimbabwe: [30, -19],
    Zambia: [28, -15],
    Uganda: [32, 1],
    Rwanda: [30, -2],
    Cameroon: [12, 6],
    "Ivory Coast": [-5, 7],
    Mali: [-3, 17],
    Niger: [9, 17],
    Chad: [19, 15],
    Oman: [56, 21],
    Kuwait: [48, 29],
    Qatar: [51, 25],
    Bahrain: [50.5, 26],
    Azerbaijan: [48, 40],
    Georgia: [44, 42],
    Armenia: [45, 40],
    Belarus: [28, 53],
    Moldova: [29, 47],
    Albania: [20, 41],
    "North Macedonia": [21.5, 41.5],
    Bosnia: [18, 44],
    Slovenia: [15, 46],
    Luxembourg: [6, 49],
    Panama: [-80, 9],
    "Costa Rica": [-84, 10],
    Guatemala: [-90, 15],
    Honduras: [-87, 15],
    Nicaragua: [-85, 13],
    "El Salvador": [-89, 14],
    "Dominican Republic": [-70, 19],
    Haiti: [-72, 19],
    Jamaica: [-77, 18],
    "Puerto Rico": [-66, 18],
    Brunei: [115, 4.5],
    "East Timor": [125, -8.8],
  };

  /** amCharts / 存储变体 → countryCenters 键 */
  const centerAliases = {
    "united states of america": "United States",
    usa: "United States",
    "u.s.a.": "United States",
    "russian federation": "Russia",
    "south korea": "South Korea",
    "republic of korea": "South Korea",
    korea: "South Korea",
    "north korea": "North Korea",
    "democratic people's republic of korea": "North Korea",
    "viet nam": "Vietnam",
    czechia: "Czech Republic",
    burma: "Myanmar",
    "united kingdom of great britain and northern ireland": "United Kingdom",
    england: "United Kingdom",
    "great britain": "United Kingdom",
    "people's republic of china": "China",
    prc: "China",
    "republic of china": "Taiwan",
    taiwan: "Taiwan",
    "hong kong sar": "Hong Kong",
    macau: "Macao",
    "côte d'ivoire": "Ivory Coast",
    "cote d'ivoire": "Ivory Coast",
    "lao people's democratic republic": "Laos",
    "timor-leste": "East Timor",
    "east timor": "East Timor",
    "plurinational state of bolivia": "Bolivia",
    "syrian arab republic": "Syria",
    "islamic republic of iran": "Iran",
    "united republic of tanzania": "Tanzania",
    "venezuela (bolivarian republic of)": "Venezuela",
    "brunei darussalam": "Brunei",
    brunei: "Brunei",
    "republic of moldova": "Moldova",
    "state of palestine": "Palestine",
    palestine: [35, 31],
  };

  function normalizeLookupKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function resolveCenterKey(englishName) {
    const raw = String(englishName ?? "").trim();
    if (!raw) return null;
    if (countryCenters[raw]) return raw;

    const alias = centerAliases[normalizeLookupKey(raw)];
    if (typeof alias === "string" && countryCenters[alias]) return alias;
    if (Array.isArray(alias)) return null;

    const lower = normalizeLookupKey(raw);
    for (const key of Object.keys(countryCenters)) {
      if (normalizeLookupKey(key) === lower) return key;
    }

    const aliasKey = centerAliases[lower];
    if (typeof aliasKey === "string") return aliasKey;

    return null;
  }

  function getCenterCoords(englishName) {
    const key = resolveCenterKey(englishName);
    if (key && countryCenters[key]) return countryCenters[key];

    const alias = centerAliases[normalizeLookupKey(englishName)];
    if (Array.isArray(alias)) return alias;

    return null;
  }

  function coordsToGeoPoint(coords) {
    if (!coords || coords.length < 2) return null;
    return { longitude: coords[0], latitude: coords[1] };
  }

  window.ReadingCosmosCountryCenters = {
    countryCenters,
    getCenterCoords,
    coordsToGeoPoint,
    resolveCenterKey,
  };
})();
