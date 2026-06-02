/**
 * 问题域语义比对 — DeepSeek API
 */
(function () {
  const DOMAIN_MATCH_SYSTEM_PROMPT =
    "判断以下问题域中，哪些在本质上是同一类社会问题（即不同学者试图回答的是同一个核心问题，只是表述不同）。" +
    "不要基于关键词重合，要基于问题的实质内容。" +
    '只返回JSON数组，格式：[{"a":"问题域A","b":"问题域B","same":true/false}]' +
    "只返回 same=true 的配对，不要返回 same=false 的项。";

  let fullSyncStarted = false;

  function getApiConfig() {
    const config = window.ReadingCosmosConfig;
    if (!config?.apiKey || config.apiKey === "YOUR_API_KEY") {
      throw new Error("请先在 app.js 中配置 API Key");
    }
    return config;
  }

  function loadIdeaBooks() {
    try {
      const raw = localStorage.getItem("reading_cosmos_books");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  function collectUniqueProblemDomains(books) {
    const domains = new Set();
    books.forEach((book) => {
      if (window.ReadingCosmosIdeaBook?.ideaBookHasContent(book)) {
        const domain = ReadingCosmosIdeaBook.ideaBookProblemDomain(book);
        if (domain) domains.add(domain);
      } else if (book?.route === "idea") {
        const domain = String(book.problem_domain ?? "").trim();
        if (domain) domains.add(domain);
      }
    });
    return Array.from(domains);
  }

  function parseDomainMatchJson(text) {
    const trimmed = String(text ?? "").trim();
    let parsed;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlock) {
        parsed = JSON.parse(codeBlock[1].trim());
      } else {
        const start = trimmed.indexOf("[");
        const end = trimmed.lastIndexOf("]");
        if (start === -1 || end <= start) {
          throw new Error("无法解析问题域比对 JSON 数组");
        }
        parsed = JSON.parse(trimmed.slice(start, end + 1));
      }
    }

    if (!Array.isArray(parsed)) {
      throw new Error("问题域比对返回不是数组");
    }

    return parsed
      .map((item) => ({
        a: String(item?.a ?? "").trim(),
        b: String(item?.b ?? "").trim(),
        same: item?.same === true,
      }))
      .filter((item) => item.a && item.b);
  }

  async function callDomainMatchApi(userMessage) {
    const { apiKey, endpoint, model } = getApiConfig();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [
          { role: "system", content: DOMAIN_MATCH_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      const errMsg =
        payload?.error?.message || `问题域比对 API 失败 (${response.status})`;
      throw new Error(errMsg);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("问题域比对 API 未返回有效内容");
    }

    return parseDomainMatchJson(content);
  }

  function formatDomainList(domains) {
    if (!domains.length) return "（无）";
    return domains.map((d) => `- ${d}`).join("\n");
  }

  /**
   * 新书入库：新书 problem_domain 与已有列表批量比对
   */
  async function matchProblemDomains(newDomain, existingDomains) {
    const domain = String(newDomain ?? "").trim();
    const existing = [
      ...new Set(
        (existingDomains || [])
          .map((d) => String(d ?? "").trim())
          .filter((d) => d && d !== domain)
      ),
    ];

    if (!domain || existing.length === 0) {
      return 0;
    }

    const userMessage =
      `新书问题域：${domain}\n` +
      `已有问题域列表：\n${formatDomainList(existing)}`;

    const pairs = await callDomainMatchApi(userMessage);
    const added = window.ReadingCosmosDomainLinks
      ? ReadingCosmosDomainLinks.mergeSamePairs(pairs)
      : 0;

    console.log("[Reading Cosmos] 问题域比对（新书）:", pairs);
    console.log("[Reading Cosmos] 新增等价关系:", added, "条");

    return added;
  }

  /**
   * 页面加载：对全部已有问题域做全量语义比对，补全 domain_links
   */
  async function syncAllProblemDomains() {
    const domains = collectUniqueProblemDomains(loadIdeaBooks());
    if (domains.length < 2) return 0;

    const userMessage =
      `请判断以下问题域列表中，哪些在本质上是同一类社会问题（表述不同但核心问题相同）。\n\n` +
      `问题域列表：\n${formatDomainList(domains)}`;

    const pairs = await callDomainMatchApi(userMessage);
    const added = window.ReadingCosmosDomainLinks
      ? ReadingCosmosDomainLinks.mergeSamePairs(pairs)
      : 0;

    console.log("[Reading Cosmos] 问题域全量比对:", pairs);
    console.log("[Reading Cosmos] 补全等价关系:", added, "条");

    return added;
  }

  function scheduleDomainLinksFullSync() {
    if (fullSyncStarted) return;
    fullSyncStarted = true;

    (async () => {
      try {
        await syncAllProblemDomains();
        if (window.ReadingCosmosGalaxy?.refreshGalaxy) {
          ReadingCosmosGalaxy.refreshGalaxy();
        }
      } catch (err) {
        console.warn("[Reading Cosmos] 问题域全量比对失败:", err);
      }
    })();
  }

  async function matchProblemDomainsForNewBook(newDomain, books) {
    const existing = collectUniqueProblemDomains(books || loadIdeaBooks());

    try {
      return await matchProblemDomains(newDomain, existing);
    } catch (err) {
      console.warn("[Reading Cosmos] 新书问题域比对失败:", err);
      return 0;
    }
  }

  window.ReadingCosmosProblemDomainMatch = {
    matchProblemDomains,
    syncAllProblemDomains,
    matchProblemDomainsForNewBook,
    collectUniqueProblemDomains,
    scheduleDomainLinksFullSync,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleDomainLinksFullSync);
  } else {
    scheduleDomainLinksFullSync();
  }
})();
