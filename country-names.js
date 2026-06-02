/**
 * 国家英文名 → 中文显示名（仅用于 UI，存储仍用英文）
 */
(function () {
  const countryNameMap = {
    China: "中国",
    Japan: "日本",
    "South Korea": "韩国",
    "United States": "美国",
    "United Kingdom": "英国",
    France: "法国",
    Germany: "德国",
    Italy: "意大利",
    Russia: "俄罗斯",
    Spain: "西班牙",
    India: "印度",
    Brazil: "巴西",
    Colombia: "哥伦比亚",
    Mexico: "墨西哥",
    Argentina: "阿根廷",
    Afghanistan: "阿富汗",
    Iran: "伊朗",
    Iraq: "伊拉克",
    Egypt: "埃及",
    Nigeria: "尼日利亚",
    "South Africa": "南非",
    Australia: "澳大利亚",
    Canada: "加拿大",
    Sweden: "瑞典",
    Norway: "挪威",
    Denmark: "丹麦",
    Netherlands: "荷兰",
    Switzerland: "瑞士",
    Austria: "奥地利",
    Poland: "波兰",
    "Czech Republic": "捷克",
    Greece: "希腊",
    Turkey: "土耳其",
    Israel: "以色列",
    Pakistan: "巴基斯坦",
    Bangladesh: "孟加拉国",
    Vietnam: "越南",
    Thailand: "泰国",
    Indonesia: "印度尼西亚",
    Philippines: "菲律宾",
    Chile: "智利",
    Peru: "秘鲁",
    Cuba: "古巴",
    Portugal: "葡萄牙",
    Malaysia: "马来西亚",
    Singapore: "新加坡",
    Myanmar: "缅甸",
    Cambodia: "柬埔寨",
    Laos: "老挝",
    Mongolia: "蒙古",
    Nepal: "尼泊尔",
    "Sri Lanka": "斯里兰卡",
    Kazakhstan: "哈萨克斯坦",
    Ukraine: "乌克兰",
    Romania: "罗马尼亚",
    Hungary: "匈牙利",
    Finland: "芬兰",
    Belgium: "比利时",
    Morocco: "摩洛哥",
    Ethiopia: "埃塞俄比亚",
    Kenya: "肯尼亚",
    Tanzania: "坦桑尼亚",
    Ghana: "加纳",
    Senegal: "塞内加尔",
    Algeria: "阿尔及利亚",
    Tunisia: "突尼斯",
    Libya: "利比亚",
    Sudan: "苏丹",
    "Saudi Arabia": "沙特阿拉伯",
    "United Arab Emirates": "阿联酋",
    Jordan: "约旦",
    Lebanon: "黎巴嫩",
    Syria: "叙利亚",
    Yemen: "也门",
    Venezuela: "委内瑞拉",
    Ecuador: "厄瓜多尔",
    Bolivia: "玻利维亚",
    Uruguay: "乌拉圭",
    Paraguay: "巴拉圭",
    "New Zealand": "新西兰",
    Iceland: "冰岛",
    Ireland: "爱尔兰",
    Scotland: "苏格兰",
    Croatia: "克罗地亚",
    Serbia: "塞尔维亚",
    Bulgaria: "保加利亚",
    Slovakia: "斯洛伐克",
    Lithuania: "立陶宛",
    Latvia: "拉脱维亚",
    Estonia: "爱沙尼亚",
  };

  /** 常见英文变体 → countryNameMap 键（仅指向已收录国家） */
  const countryAliases = {
    "united states of america": "United States",
    "u.s.a.": "United States",
    usa: "United States",
    "russian federation": "Russia",
    "south korea": "South Korea",
    "republic of korea": "South Korea",
    "lao people's democratic republic": "Laos",
    "viet nam": "Vietnam",
    czechia: "Czech Republic",
    burma: "Myanmar",
  };

  const lookupIndex = new Map(
    Object.entries(countryNameMap).map(([en, zh]) => [
      en.trim().toLowerCase(),
      zh,
    ])
  );

  const reverseCountryMap = Object.fromEntries(
    Object.entries(countryNameMap).map(([en, zh]) => [zh, en])
  );

  /** 用户手动输入的国家名 → 存入 localStorage 的英文键 */
  function resolveCountryForStorage(input) {
    const raw = String(input ?? "").trim();
    if (!raw) return "";

    if (reverseCountryMap[raw]) return reverseCountryMap[raw];
    if (countryNameMap[raw]) return raw;

    const aliasKey = countryAliases[raw.toLowerCase()];
    if (aliasKey) return aliasKey;

    const lower = raw.toLowerCase();
    for (const en of Object.keys(countryNameMap)) {
      if (en.toLowerCase() === lower) return en;
    }

    if (window.ReadingCosmosCountry?.normalizeCountryName) {
      return ReadingCosmosCountry.normalizeCountryName(raw);
    }

    return raw;
  }

  function getChineseName(englishName) {
    const raw = String(englishName ?? "").trim();
    if (!raw) return "";

    if (countryNameMap[raw]) return countryNameMap[raw];

    const aliasKey = countryAliases[raw.toLowerCase()];
    if (aliasKey && countryNameMap[aliasKey]) return countryNameMap[aliasKey];

    const fromIndex = lookupIndex.get(raw.toLowerCase());
    if (fromIndex) return fromIndex;

    return raw;
  }

  window.ReadingCosmosCountryNames = {
    countryNameMap,
    reverseCountryMap,
    getChineseName,
    resolveCountryForStorage,
  };
})();
