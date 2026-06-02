/**
 * Reading Cosmos
 */

(function () {
  const DEEPSEEK_API_KEY = "sk-36ae370aee96455cb834506e379f5a4d";
  const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
  const DEEPSEEK_MODEL = "deepseek-chat";
  const STORAGE_KEY = "reading_cosmos_books";

  window.ReadingCosmosConfig = {
    apiKey: DEEPSEEK_API_KEY,
    endpoint: DEEPSEEK_ENDPOINT,
    model: DEEPSEEK_MODEL,
  };
  const CULTURE_COUNTRY_GUIDANCE = `culture 路由的 country 判断标准：这本书主要描写、呈现、反映哪个国家或地区的文化、社会、历史和人民，即文化归属地。不是书中批评或分析的对象国，不是作者国籍，不是出版国。例如《拉丁美洲被切开的血管》的文化归属地是拉丁美洲/乌拉圭，不是美国。`;

  const ROUTING_GUIDANCE = `路由判断标准：作者的核心目的是「提出解释框架」还是「呈现某种文化面貌」？

特别注意：社会学、教育学、经济学、心理学等学术研究类书籍，
即使以某个国家或群体为研究对象，也应归类为 idea，
因为作者的核心目的是提出分析框架和理论解释，而不是呈现某种文化。
例如：《不平等的童年》→ idea（阶级再生产理论）
      《乡土中国》→ idea（差序格局分析框架）
      《菊与刀》→ culture（呈现日本文化）`;

  const IDEA_FIELDS_GUIDANCE = `对于每本理论类书籍，请识别并填入 JSON：

1. framework：作者提出或使用的核心分析框架（2-5个词，填一个最核心的）
2. cluster：该书所属的议题群落（2-6字中文标签），代表分析框架所属的思想群落。
   例如："阶级不平等"、"权力与治理"、"性别与身体"、"现代性理论"、"消费与文化"、"组织与制度"
   判断标准：同一 cluster 的书试图理解的是同一类社会领域的问题。宁可归入已有 cluster，不要随意新建。
3. problem_domain：该框架试图回答的核心社会问题，必须是一个标准化的问题句（疑问句）。
   要求：同类问题必须用完全相同的表述，例如：
   - "阶级不平等如何在代际间再生产？"
   - "现代社会的权力如何运作？"
   - "个体行动与社会结构如何相互塑造？"
   不要描述学派、不要提作者名、不要罗列分析关键词。

4. related_frameworks：其他相关框架（可为空数组）
5. concepts：可迁移的理论视角、解释模型、分析工具（下列标准仍适用）

concepts 提取优先级（从高到低）：
1. 分析框架 2. 理论视角 3. 解释模型

明确不放入 concepts：具体历史事件或人物、书中案例或数据、常识性概念（如"社会""文化""历史"）、书名或作者名。

判断标准：该概念能否被用户迁移到其他情境理解新问题？能迁移 → 提取。`;

  const SYSTEM_PROMPT = `你是一个书籍分析助手。用户输入书名后，判断这本书属于哪种类型并提取信息。

${ROUTING_GUIDANCE}

如果这本书主要帮助理解某个国家/地区/文化（小说、纪实、以呈现文化面貌为主的人类学等），返回：
${CULTURE_COUNTRY_GUIDANCE}
{"route":"culture","country":"英文国家名","region":"英文大区名","author":"作者中文名"}
如果这本书主要帮助理解某种理论或思想框架，返回 idea 路由 JSON。

idea 路由${IDEA_FIELDS_GUIDANCE}

返回格式（只返回 JSON，不要任何其他文字）：
{"route":"idea","author":"作者中文名","cluster":"阶级不平等","problem_domain":"阶级不平等如何在代际间再生产？","framework":"阶级再生产","related_frameworks":["相关框架1"],"concepts":["可迁移的理论视角1","解释模型2"]}

作者名规则：若用户消息中已明确提供作者名，JSON 的 author 必须原样使用该作者名，不要修改或猜测。若用户未提供作者名，请根据书名推断作者中文名填入 author，不要填「未知」或留空。
只返回 JSON，不要任何其他文字。`;

  const IDEA_EXTRACTION_PROMPT = `你是一个书籍思想框架分析助手。用户已确认该书属于 idea 类型（思想星系），请提取分析框架与可迁移概念，不要判断 route。

${IDEA_FIELDS_GUIDANCE}

返回格式（只返回 JSON，不要任何其他文字）：
{"route":"idea","author":"作者中文名","cluster":"权力与治理","problem_domain":"现代社会的权力如何运作？","framework":"规训权力","related_frameworks":[],"concepts":["可迁移的理论视角1"]}

作者名规则：若用户消息中已明确提供作者名，JSON 的 author 必须原样使用该作者名，不要修改或猜测。若用户未提供作者名，请根据书名推断作者中文名填入 author，不要填「未知」或留空。
只返回 JSON，不要任何其他文字。`;

  /* ── Tab 切换 ── */
  const tabButtons = document.querySelectorAll(".tab-nav__btn");
  const panels = document.querySelectorAll(".tab-panel");
  const indicator = document.querySelector(".tab-nav__indicator");

  function moveIndicator(activeBtn) {
    if (!indicator || !activeBtn) return;
    indicator.style.width = `${activeBtn.offsetWidth}px`;
    indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
  }

  function activateTab(tabId) {
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === tabId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });

    const activeBtn = document.querySelector(`.tab-nav__btn[data-tab="${tabId}"]`);
    moveIndicator(activeBtn);

    if (window.ReadingCosmosPanelResizer?.onTabActivated) {
      ReadingCosmosPanelResizer.onTabActivated(tabId);
    } else {
      if (tabId === "culture" && window.ReadingCosmosMap?.resizeMap) {
        requestAnimationFrame(() => ReadingCosmosMap.resizeMap());
      }
      if (tabId === "galaxy" && window.ReadingCosmosGalaxy?.refreshGalaxy) {
        requestAnimationFrame(() => ReadingCosmosGalaxy.refreshGalaxy());
      }
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  window.addEventListener("resize", () => {
    const active = document.querySelector(".tab-nav__btn.is-active");
    moveIndicator(active);
  });

  activateTab("culture");

  /* ── 使用说明模态框 ── */
  const usageGuideBtn = document.getElementById("usage-guide-btn");
  const usageGuideModal = document.getElementById("usage-guide-modal");
  const usageGuideBackdrop = usageGuideModal?.querySelector(
    ".usage-guide-modal__backdrop"
  );
  const usageGuideClose = usageGuideModal?.querySelector(
    ".usage-guide-modal__close"
  );

  function openUsageGuide() {
    if (!usageGuideModal) return;
    usageGuideModal.hidden = false;
    document.body.classList.add("usage-guide-open");
    usageGuideClose?.focus();
  }

  function closeUsageGuide() {
    if (!usageGuideModal) return;
    usageGuideModal.hidden = true;
    document.body.classList.remove("usage-guide-open");
    usageGuideBtn?.focus();
  }

  usageGuideBtn?.addEventListener("click", openUsageGuide);
  usageGuideBackdrop?.addEventListener("click", closeUsageGuide);
  usageGuideClose?.addEventListener("click", closeUsageGuide);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && usageGuideModal && !usageGuideModal.hidden) {
      closeUsageGuide();
    }
  });

  /* ── 书籍分析 & localStorage ── */
  const bookInput = document.getElementById("book-title");
  const bookSubmit = document.getElementById("book-submit");
  const bookFeedback = document.getElementById("book-feedback");
  const statusToast = document.getElementById("status-toast");
  const statusAnalyzing = document.getElementById("status-analyzing");
  const statusSuccess = document.getElementById("status-success");
  const statusSuccessText = document.getElementById("status-success-text");
  let feedbackTimer = null;
  let statusTimers = [];

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

  function saveBook(entry) {
    const books = loadBooks();
    books.push(entry);
    saveBooks(books);
    return books;
  }

  function parseAIJson(text) {
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      /* continue */
    }

    const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlock) {
      return JSON.parse(codeBlock[1].trim());
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error("无法解析 AI 返回的 JSON");
  }

  /** 书名比对：去空格、去书名号、全半角统一（NFKC） */
  function normalizeBookTitleKey(title) {
    return String(title || "")
      .trim()
      .replace(/[《》〈〉「」『』【】\[\]]/g, "")
      .normalize("NFKC");
  }

  function isDuplicateBookTitle(title) {
    const key = normalizeBookTitleKey(title);
    if (!key) return false;

    return loadBooks().some(
      (book) => normalizeBookTitleKey(book.title) === key
    );
  }

  /** 最后一个空格前为书名，后为作者（可选） */
  function parseBookInput(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return { title: "", author: "" };

    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace === -1) {
      return { title: trimmed, author: "" };
    }

    return {
      title: trimmed.slice(0, lastSpace).trim(),
      author: trimmed.slice(lastSpace + 1).trim(),
    };
  }

  function buildAnalysisUserMessage(title, userAuthor) {
    if (userAuthor) {
      return `书名：${title}\n作者：${userAuthor}`;
    }
    return `书名：${title}`;
  }

  function resolveAuthor(aiAuthor, userAuthor) {
    if (userAuthor) return userAuthor.trim();
    const inferred = String(aiAuthor ?? "").trim();
    if (!inferred || inferred === "未知") {
      throw new Error("无法识别作者，请在输入框用空格分隔补充作者名");
    }
    return inferred;
  }

  function normalizeResult(data, options = {}) {
    if (!data || typeof data !== "object") {
      throw new Error("AI 返回格式无效");
    }

    const author = resolveAuthor(data.author, options.userAuthor);

    if (data.route === "culture") {
      if (!data.country || !data.region) {
        throw new Error("culture 路由缺少 country 或 region");
      }
      const country = window.ReadingCosmosCountry
        ? ReadingCosmosCountry.normalizeCountryName(data.country)
        : String(data.country).trim();

      return {
        route: "culture",
        country,
        region: String(data.region).trim(),
        author,
      };
    }

    if (data.route === "idea") {
      return normalizeIdeaFields(data, author);
    }

    throw new Error(`未知 route: ${data.route}`);
  }

  function normalizeIdeaFields(data, author) {
    const concepts = Array.isArray(data.concepts)
      ? data.concepts.map((c) => String(c).trim()).filter(Boolean)
      : [];
    const framework = String(data.framework ?? "").trim();
    const cluster = String(data.cluster ?? "").trim();
    const problem_domain = String(data.problem_domain ?? "").trim();
    const related_frameworks = Array.isArray(data.related_frameworks)
      ? data.related_frameworks.map((f) => String(f).trim()).filter(Boolean)
      : [];

    if (concepts.length === 0 && !framework) {
      throw new Error("idea 提取缺少 framework 或 concepts");
    }

    return {
      route: "idea",
      author,
      cluster,
      problem_domain,
      framework,
      related_frameworks,
      concepts,
    };
  }

  function normalizeIdeaResult(data, options = {}) {
    if (!data || typeof data !== "object") {
      throw new Error("AI 返回格式无效");
    }
    const author = resolveAuthor(data.author, options.userAuthor);
    return normalizeIdeaFields(data, author);
  }

  function applyIdeaFieldsToBook(book, ideaFields) {
    book.route = "idea";
    book.author = ideaFields.author;
    book.problem_domain = ideaFields.problem_domain;
    book.cluster = ideaFields.cluster;
    book.framework = ideaFields.framework;
    book.related_frameworks = ideaFields.related_frameworks;
    book.concepts = ideaFields.concepts;
    delete book.country;
    delete book.region;
  }

  function refreshCultureAndGalaxy(options = {}) {
    if (window.ReadingCosmosMap?.refreshMapData) {
      ReadingCosmosMap.refreshMapData();
    }
    if (window.ReadingCosmosGalaxy?.refreshGalaxy) {
      ReadingCosmosGalaxy.refreshGalaxy(options);
    }
    if (window.ReadingCosmosGalaxySidebar?.refresh) {
      ReadingCosmosGalaxySidebar.refresh();
    }
  }

  function showBookFeedback(message, variant, hideAfterMs) {
    if (!bookFeedback) return;

    clearTimeout(feedbackTimer);
    bookFeedback.hidden = false;
    bookFeedback.textContent = message;
    bookFeedback.className = `book-feedback book-feedback--${variant}`;

    feedbackTimer = setTimeout(() => {
      bookFeedback.hidden = true;
      bookFeedback.textContent = "";
      bookFeedback.className = "book-feedback";
    }, hideAfterMs);
  }

  function showInlineFeedback(message) {
    showBookFeedback(message, "error", 3200);
  }

  function showDuplicateBookFeedback() {
    showBookFeedback("书籍已录入哦", "duplicate", 2000);
  }

  function clearStatusTimers() {
    statusTimers.forEach((id) => clearTimeout(id));
    statusTimers = [];
  }

  function hideStatusToast() {
    clearStatusTimers();
    if (!statusToast) return;

    statusToast.style.display = "none";
    statusToast.style.opacity = "1";
    statusToast.classList.remove("is-fading", "is-analyzing", "is-success");
    if (statusSuccessText) statusSuccessText.classList.remove("is-glitching");
  }

  function statusSuccessMessage(title, route) {
    const book = `《${title}》`;
    if (route === "idea") return `${book}已加入星系`;
    return `${book}已加入地图`;
  }

  function showStatusAnalyzing() {
    if (!statusToast) return;

    clearStatusTimers();
    statusToast.classList.remove("is-fading", "is-success");
    statusToast.classList.add("is-analyzing");
    if (statusAnalyzing) statusAnalyzing.hidden = false;
    if (statusSuccess) statusSuccess.hidden = true;
    if (statusSuccessText) statusSuccessText.classList.remove("is-glitching");

    statusToast.style.display = "flex";
    statusToast.style.opacity = "1";
  }

  function showStatusSuccess(title, route) {
    if (!statusToast) return;

    statusToast.classList.remove("is-analyzing");
    statusToast.classList.add("is-success");
    if (statusAnalyzing) statusAnalyzing.hidden = true;
    if (statusSuccess) statusSuccess.hidden = false;

    if (statusSuccessText) {
      statusSuccessText.textContent = statusSuccessMessage(title, route);
      statusSuccessText.classList.remove("is-glitching");
      void statusSuccessText.offsetWidth;
      statusSuccessText.classList.add("is-glitching");
    }

    statusTimers.push(
      setTimeout(() => {
        statusToast.classList.add("is-fading");
      }, 3000),
      setTimeout(() => {
        hideStatusToast();
      }, 3500)
    );
  }

  async function callDeepSeekChat(systemContent, userMessage) {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      const errMsg =
        payload?.error?.message || `API 请求失败 (${response.status})`;
      throw new Error(errMsg);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("API 未返回有效内容");
    }

    return { payload, content };
  }

  async function callDeepSeek(title, userAuthor) {
    const userMessage = buildAnalysisUserMessage(title, userAuthor);
    return callDeepSeekChat(SYSTEM_PROMPT, userMessage);
  }

  async function callDeepSeekIdeaExtract(title, userAuthor) {
    const userMessage = buildAnalysisUserMessage(title, userAuthor);
    return callDeepSeekChat(IDEA_EXTRACTION_PROMPT, userMessage);
  }

  async function convertCultureBookToIdea(addedAt) {
    if (DEEPSEEK_API_KEY === "YOUR_API_KEY") {
      throw new Error("请先在 app.js 中配置 API Key");
    }

    const books = loadBooks();
    const book = books.find((b) => b.addedAt === addedAt);
    if (!book) {
      throw new Error("未找到该书籍");
    }
    if (book.route === "idea") {
      return book;
    }

    const userAuthor = String(book.author ?? "").trim();
    showStatusAnalyzing();

    try {
      const { content } = await callDeepSeekIdeaExtract(book.title, userAuthor);
      const ideaFields = normalizeIdeaResult(parseAIJson(content), { userAuthor });
      applyIdeaFieldsToBook(book, ideaFields);
      saveBooks(books);

      showStatusSuccess(book.title, "idea");
      refreshCultureAndGalaxy({ highlightNew: true });
      return book;
    } catch (err) {
      hideStatusToast();
      throw err;
    }
  }

  async function handleBookSubmit() {
    if (!bookInput || bookInput.disabled) return;

    const { title, author: userAuthor } = parseBookInput(bookInput.value);
    if (!title) {
      showInlineFeedback("请输入书名");
      return;
    }

    if (DEEPSEEK_API_KEY === "YOUR_API_KEY") {
      showInlineFeedback("请先在 app.js 中配置 API Key");
      console.warn("[Reading Cosmos] 请将 DEEPSEEK_API_KEY 替换为真实密钥");
      return;
    }

    if (isDuplicateBookTitle(title)) {
      showDuplicateBookFeedback();
      return;
    }

    bookInput.disabled = true;
    if (bookSubmit) bookSubmit.disabled = true;
    bookInput.classList.add("is-busy");
    showStatusAnalyzing();

    try {
      const { payload, content } = await callDeepSeek(title, userAuthor);
      const parsed = normalizeResult(parseAIJson(content), { userAuthor });

      const entry = {
        title,
        ...parsed,
        addedAt: new Date().toISOString(),
      };

      const allBooks = saveBook(entry);

      console.log("[Reading Cosmos] API 完整响应:", payload);
      console.log("[Reading Cosmos] 解析结果:", parsed);
      console.log("[Reading Cosmos] 已保存条目:", entry);
      console.log("[Reading Cosmos] localStorage 全部书籍:", allBooks);

      showStatusSuccess(title, parsed.route);
      if (parsed.route === "culture") {
        refreshCultureAndGalaxy();
      } else if (parsed.route === "idea") {
        refreshCultureAndGalaxy({ highlightNew: true });
      }
      bookInput.value = "";
    } catch (err) {
      console.error("[Reading Cosmos] 分析失败:", err);
      hideStatusToast();
      showInlineFeedback(err.message || "分析失败，请重试");
    } finally {
      bookInput.disabled = false;
      if (bookSubmit) bookSubmit.disabled = false;
      bookInput.classList.remove("is-busy");
      bookInput.focus();
    }
  }

  if (bookInput) {
    bookInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleBookSubmit();
      }
    });
  }

  if (bookSubmit) {
    bookSubmit.addEventListener("click", () => handleBookSubmit());
  }

  window.ReadingCosmosBooks = {
    convertCultureBookToIdea,
    backfillAllClusters:
      window.ReadingCosmosClusterBackfill?.backfillAllClusters,
    showInlineFeedback,
    showStatusAnalyzing,
    hideStatusToast,
  };
})();
