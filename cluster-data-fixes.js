/**
 * Idea Galaxy — 一次性/启动时 localStorage 数据修正
 */
(function () {
  const STORAGE_KEY = "reading_cosmos_books";
  const CONCEPT_NEEDLE = "乡绅精神";
  const WRONG_CLUSTER = "性别与身体";
  /** 乡绅/乡土议题与性别无关，归入新群落 */
  const CORRECT_CLUSTER = "乡土与传统";

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

  function bookHasConcept(book, needle) {
    if (!book || !Array.isArray(book.concepts)) return false;
    return book.concepts.some((c) => String(c || "").includes(needle));
  }

  function applyXiangshenClusterFix() {
    const books = loadBooks();
    let changed = 0;
    const audited = [];

    books.forEach((book) => {
      if (!bookHasConcept(book, CONCEPT_NEEDLE)) return;

      const cluster = String(book.cluster ?? "").trim();
      audited.push({
        title: book.title,
        author: book.author,
        clusterBefore: cluster || "(空)",
      });

      if (cluster !== WRONG_CLUSTER) return;

      book.cluster = CORRECT_CLUSTER;
      changed += 1;
      audited[audited.length - 1].clusterAfter = CORRECT_CLUSTER;
    });

    if (changed > 0) {
      saveBooks(books);
    }

    return { changed, audited };
  }

  function runFixes() {
    return applyXiangshenClusterFix();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runFixes);
  } else {
    runFixes();
  }

  window.ReadingCosmosClusterDataFixes = {
    runFixes,
    auditXiangshenCluster: applyXiangshenClusterFix,
  };
})();
