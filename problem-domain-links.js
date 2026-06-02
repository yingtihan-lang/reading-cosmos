/**
 * 问题域等价关系 — localStorage + 并查集分组
 */
(function () {
  const DOMAIN_LINKS_STORAGE_KEY = "reading_cosmos_domain_links";

  function loadDomainLinks() {
    try {
      const raw = localStorage.getItem(DOMAIN_LINKS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => ({
          a: String(item?.a ?? "").trim(),
          b: String(item?.b ?? "").trim(),
        }))
        .filter((item) => item.a && item.b && item.a !== item.b);
    } catch {
      return [];
    }
  }

  function saveDomainLinks(links) {
    localStorage.setItem(DOMAIN_LINKS_STORAGE_KEY, JSON.stringify(links));
  }

  function pairKey(a, b) {
    const left = String(a ?? "").trim();
    const right = String(b ?? "").trim();
    if (!left || !right || left === right) return null;
    return left < right ? `${left}\0${right}` : `${right}\0${left}`;
  }

  /** 合并 API 返回的 same=true 配对 */
  function mergeSamePairs(pairs) {
    if (!Array.isArray(pairs) || pairs.length === 0) return 0;

    const existing = loadDomainLinks();
    const seen = new Set(existing.map((item) => pairKey(item.a, item.b)).filter(Boolean));
    let added = 0;

    pairs.forEach((item) => {
      if (item?.same !== true) return;
      const a = String(item?.a ?? "").trim();
      const b = String(item?.b ?? "").trim();
      const key = pairKey(a, b);
      if (!key || seen.has(key)) return;
      seen.add(key);
      existing.push({ a, b });
      added += 1;
    });

    if (added > 0) saveDomainLinks(existing);
    return added;
  }

  function createUnionFind(domains, linkPairs) {
    const parent = new Map();

    function add(x) {
      const key = String(x ?? "").trim();
      if (!key || parent.has(key)) return key;
      parent.set(key, key);
      return key;
    }

    function find(x) {
      const key = add(x);
      const p = parent.get(key);
      if (p !== key) {
        parent.set(key, find(p));
      }
      return parent.get(key);
    }

    function union(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    }

    domains.forEach((d) => add(d));
    linkPairs.forEach(({ a, b }) => union(a, b));

    return { find, union, parent };
  }

  function areDomainsEquivalent(a, b, linkPairs) {
    const left = String(a ?? "").trim();
    const right = String(b ?? "").trim();
    if (!left || !right) return false;
    if (left === right) return true;
    const uf = createUnionFind([left, right], linkPairs || loadDomainLinks());
    return uf.find(left) === uf.find(right);
  }

  function clearDomainLinks() {
    localStorage.removeItem(DOMAIN_LINKS_STORAGE_KEY);
  }

  window.ReadingCosmosDomainLinks = {
    DOMAIN_LINKS_STORAGE_KEY,
    loadDomainLinks,
    saveDomainLinks,
    mergeSamePairs,
    createUnionFind,
    areDomainsEquivalent,
    clearDomainLinks,
  };
})();
