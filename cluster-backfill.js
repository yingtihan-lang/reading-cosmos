/**
 * Idea Galaxy — 批量补全 cluster 字段，并清除旧 domain_links
 */
(function () {
  const STORAGE_KEY = "reading_cosmos_books";

  const CLUSTER_BACKFILL_PROMPT =
    "你是一个学术书籍议题分类助手。根据书籍信息，判断该书分析框架所属的思想群落（cluster）。" +
    "cluster 是一个简短中文标签（2-6个字），代表该书试图理解的社会领域类型。" +
    '例如："阶级不平等"、"权力与治理"、"性别与身体"、"现代性理论"、"消费与文化"、"组织与制度"。' +
    "判断标准：同一 cluster 的书试图理解的是同一类社会领域的问题。" +
    "宁可归入已有 cluster，不要随意新建。" +
    '只返回 JSON：{"cluster":"标签"}，不要任何其他文字。';

  let backfillStarted = false;

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

  function saveBooks(books) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  }

  function ideaBookNeedsCluster(book) {
    if (!book || book.route !== "idea") return false;
    if (window.ReadingCosmosIdeaBook?.ideaBookHasContent) {
      if (!ReadingCosmosIdeaBook.ideaBookHasContent(book)) return false;
    } else if (!Array.isArray(book.concepts) || book.concepts.length === 0) {
      if (!String(book.framework ?? "").trim()) return false;
    }
    return !String(book.cluster ?? "").trim();
  }

  function collectExistingClusters(books) {
    const clusters = new Set();
    books.forEach((book) => {
      const cluster = String(book.cluster ?? "").trim();
      if (cluster) clusters.add(cluster);
    });
    return [...clusters];
  }

  function parseClusterJson(text) {
    const trimmed = String(text ?? "").trim();
    let parsed;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlock) {
        parsed = JSON.parse(codeBlock[1].trim());
      } else {
        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");
        if (start === -1 || end <= start) {
          throw new Error("无法解析 cluster JSON");
        }
        parsed = JSON.parse(trimmed.slice(start, end + 1));
      }
    }

    const cluster = String(parsed?.cluster ?? "").trim();
    if (!cluster) throw new Error("cluster 字段为空");
    return cluster;
  }

  async function callClusterApi(userMessage) {
    const config = window.ReadingCosmosConfig;
    if (!config?.apiKey || config.apiKey === "YOUR_API_KEY") {
      throw new Error("请先在 app.js 中配置 API Key");
    }

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "deepseek-chat",
        messages: [
          { role: "system", content: CLUSTER_BACKFILL_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const errMsg =
        payload?.error?.message || `cluster 补全 API 失败 (${response.status})`;
      throw new Error(errMsg);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("cluster 补全 API 未返回有效内容");
    return parseClusterJson(content);
  }

  function buildBookClusterMessage(book, existingClusters) {
    const framework =
      window.ReadingCosmosIdeaBook?.ideaBookFramework(book) ||
      String(book.framework ?? "").trim();
    const problemDomain =
      window.ReadingCosmosIdeaBook?.ideaBookProblemDomain(book) ||
      String(book.problem_domain ?? "").trim();

    let message =
      `书名：《${book.title}》\n` +
      `作者：${String(book.author ?? "").trim() || "未知"}\n` +
      `框架：${framework || "（无）"}\n` +
      `问题域：${problemDomain || "（无）"}\n`;

    if (existingClusters.length > 0) {
      message +=
        "\n已有 cluster 列表（优先归入其中之一，不要随意新建）：\n" +
        existingClusters.map((c) => `- ${c}`).join("\n");
    }

    return message;
  }

  async function inferClusterForBook(book, existingClusters) {
    const cluster = await callClusterApi(
      buildBookClusterMessage(book, existingClusters)
    );
    return String(cluster).trim();
  }

  async function backfillAllClusters() {
    if (window.ReadingCosmosDomainLinks?.clearDomainLinks) {
      ReadingCosmosDomainLinks.clearDomainLinks();
    } else {
      localStorage.removeItem("reading_cosmos_domain_links");
    }

    const books = loadBooks();
    const pending = books.filter(ideaBookNeedsCluster);
    if (pending.length === 0) return 0;

    let updated = 0;
    let existingClusters = collectExistingClusters(books);

    for (const book of pending) {
      try {
        const cluster = await inferClusterForBook(book, existingClusters);
        book.cluster = cluster;
        updated += 1;
        existingClusters = collectExistingClusters(books);
        saveBooks(books);
        console.log("[Reading Cosmos] cluster 补全:", book.title, "→", cluster);
      } catch (err) {
        console.warn("[Reading Cosmos] cluster 补全失败:", book.title, err);
      }
    }

    return updated;
  }

  function scheduleClusterBackfill() {
    if (backfillStarted) return;
    backfillStarted = true;

    (async () => {
      try {
        const count = await backfillAllClusters();
        if (count > 0 && window.ReadingCosmosGalaxy?.refreshGalaxy) {
          ReadingCosmosGalaxy.refreshGalaxy();
        }
      } catch (err) {
        console.warn("[Reading Cosmos] cluster 批量补全失败:", err);
      }
    })();
  }

  window.ReadingCosmosClusterBackfill = {
    backfillAllClusters,
    scheduleClusterBackfill,
    inferClusterForBook,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleClusterBackfill);
  } else {
    scheduleClusterBackfill();
  }
})();
