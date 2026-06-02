/**
 * 概念思想关联 — localStorage 与 D3 连线数据
 */
(function () {
  const LINKS_STORAGE_KEY = "reading_cosmos_links";
  const BOOKS_STORAGE_KEY = "reading_cosmos_books";

  const CONCEPT_LINK_PROMPT_TEMPLATE = `以下是两组概念，请判断哪些概念对之间存在实质性的思想关联（同属一个理论体系、互为上下位概念、或在学术讨论中经常并置）。
新概念：{NEW_CONCEPTS}
已有概念：{EXISTING_CONCEPTS}
只返回 JSON 数组，格式：[{"source":"概念A","target":"概念B"},...]
没有关联则返回空数组 []，不要返回任何其他文字。`;

  function conceptKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase();
  }

  function loadBooks() {
    try {
      const raw = localStorage.getItem(BOOKS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** 从 idea 书籍列表收集去重后的概念/框架显示名 */
  function collectIdeaConceptLabels(books) {
    const map = new Map();

    function addLabel(label) {
      const text = String(label ?? "").trim();
      const key = conceptKey(text);
      if (key && !map.has(key)) map.set(key, text);
    }

    books
      .filter((b) =>
        window.ReadingCosmosIdeaBook
          ? ReadingCosmosIdeaBook.ideaBookHasContent(b)
          : b.route === "idea" && Array.isArray(b.concepts)
      )
      .forEach((book) => {
        if (window.ReadingCosmosIdeaBook) {
          ReadingCosmosIdeaBook.collectLabelsFromIdeaBook(book).forEach(addLabel);
          return;
        }
        book.concepts.forEach((raw) => addLabel(raw));
      });

    return Array.from(map.values());
  }

  function loadLinks() {
    try {
      const raw = localStorage.getItem(LINKS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => ({
          source: String(item?.source ?? "").trim(),
          target: String(item?.target ?? "").trim(),
        }))
        .filter((item) => item.source && item.target);
    } catch {
      return [];
    }
  }

  function saveLinks(links) {
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
  }

  function linkPairId(source, target) {
    const a = conceptKey(source);
    const b = conceptKey(target);
    if (!a || !b || a === b) return null;
    return a < b ? `${a}--${b}` : `${b}--${a}`;
  }

  /** 合并新关联对，按概念 key 去重，返回本次新增条数 */
  function mergeLinks(incoming) {
    const existing = loadLinks();
    const seen = new Set(
      existing.map((l) => linkPairId(l.source, l.target)).filter(Boolean)
    );
    let added = 0;

    incoming.forEach((pair) => {
      const source = String(pair?.source ?? "").trim();
      const target = String(pair?.target ?? "").trim();
      const id = linkPairId(source, target);
      if (!id || seen.has(id)) return;
      seen.add(id);
      existing.push({ source, target });
      added += 1;
    });

    saveLinks(existing);
    return added;
  }

  function buildConceptLinkUserMessage(newConcepts, existingConcepts) {
    const newList = newConcepts.length ? newConcepts.join("、") : "（无）";
    const existingList = existingConcepts.length
      ? existingConcepts.join("、")
      : "（暂无）";

    return CONCEPT_LINK_PROMPT_TEMPLATE.replace("{NEW_CONCEPTS}", `[${newList}]`).replace(
      "{EXISTING_CONCEPTS}",
      `[${existingList}]`
    );
  }

  function parseLinksJson(text) {
    const trimmed = text.trim();
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
          throw new Error("无法解析概念关联 JSON 数组");
        }
        parsed = JSON.parse(trimmed.slice(start, end + 1));
      }
    }

    if (!Array.isArray(parsed)) {
      throw new Error("概念关联返回不是数组");
    }

    return parsed
      .map((item) => ({
        source: String(item?.source ?? "").trim(),
        target: String(item?.target ?? "").trim(),
      }))
      .filter((item) => item.source && item.target);
  }

  /** 将 storage 中的关联转为 D3 forceLink 数据（仅保留两端节点均存在的边） */
  function buildD3Links(conceptMap) {
    const linkList = [];
    const seenIds = new Set();

    const resolveId =
      window.ReadingCosmosIdeaBook?.resolveGraphNodeId ||
      ((label, map) => {
        const key = conceptKey(label);
        return key && map.has(key) ? key : null;
      });

    loadLinks().forEach((link) => {
      const sourceId = resolveId(link.source, conceptMap);
      const targetId = resolveId(link.target, conceptMap);
      if (!sourceId || !targetId) return;

      const id = linkPairId(link.source, link.target);
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      linkList.push({ id, source: sourceId, target: targetId });
    });

    return linkList;
  }

  function renameConceptInLinks(oldLabel, newLabel) {
    const oldTrim = String(oldLabel ?? "").trim();
    const newTrim = String(newLabel ?? "").trim();
    if (!oldTrim || !newTrim || oldTrim === newTrim) return;

    const links = loadLinks();
    let changed = false;
    links.forEach((link) => {
      if (link.source === oldTrim) {
        link.source = newTrim;
        changed = true;
      }
      if (link.target === oldTrim) {
        link.target = newTrim;
        changed = true;
      }
    });
    if (changed) saveLinks(links);
  }

  function removeLinksForConcept(label) {
    const key = conceptKey(label);
    if (!key) return;
    const next = loadLinks().filter(
      (link) =>
        conceptKey(link.source) !== key && conceptKey(link.target) !== key
    );
    saveLinks(next);
  }

  window.ReadingCosmosConceptLinks = {
    LINKS_STORAGE_KEY,
    conceptKey,
    loadBooks,
    collectIdeaConceptLabels,
    loadLinks,
    saveLinks,
    mergeLinks,
    buildConceptLinkUserMessage,
    parseLinksJson,
    buildD3Links,
    renameConceptInLinks,
    removeLinksForConcept,
  };
})();
