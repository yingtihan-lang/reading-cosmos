/**
 * Idea Galaxy — 书籍字段与图节点 id 工具
 */
(function () {
  function conceptKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase();
  }

  function frameworkNodeId(label) {
    const key = conceptKey(label);
    return key ? `fw:${key}` : "";
  }

  function ideaBookFramework(book) {
    return String(book?.framework ?? "").trim();
  }

  function ideaBookProblemDomain(book) {
    return String(book?.problem_domain ?? "").trim();
  }

  function ideaBookCluster(book) {
    return String(book?.cluster ?? "").trim();
  }

  function ideaBookRelatedFrameworks(book) {
    if (!Array.isArray(book?.related_frameworks)) return [];
    return book.related_frameworks
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  function ideaBookHasContent(book) {
    if (!book || book.route !== "idea") return false;
    if (ideaBookFramework(book)) return true;
    if (!Array.isArray(book.concepts)) return false;
    return book.concepts.some((raw) => String(raw || "").trim());
  }

  /** 从单本书收集用于概念关联分析的显示名（框架 + 相关框架 + 概念） */
  function collectLabelsFromIdeaBook(book) {
    const labels = [];
    const seen = new Set();

    function add(label) {
      const text = String(label ?? "").trim();
      const key = conceptKey(text);
      if (!key || seen.has(key)) return;
      seen.add(key);
      labels.push(text);
    }

    add(ideaBookFramework(book));
    ideaBookRelatedFrameworks(book).forEach(add);
    if (Array.isArray(book.concepts)) {
      book.concepts.forEach(add);
    }

    return labels;
  }

  function resolveGraphNodeId(label, nodeMap) {
    const key = conceptKey(label);
    if (!key) return null;
    if (nodeMap.has(key)) return key;
    const fwId = frameworkNodeId(label);
    if (fwId && nodeMap.has(fwId)) return fwId;
    return null;
  }

  window.ReadingCosmosIdeaBook = {
    conceptKey,
    frameworkNodeId,
    ideaBookFramework,
    ideaBookProblemDomain,
    ideaBookCluster,
    ideaBookRelatedFrameworks,
    ideaBookHasContent,
    collectLabelsFromIdeaBook,
    resolveGraphNodeId,
  };
})();
