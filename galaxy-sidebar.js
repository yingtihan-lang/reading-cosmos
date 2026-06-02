/**
 * Idea Galaxy — 按书籍分组的概念侧栏
 */
(function () {
  const STORAGE_KEY = "reading_cosmos_books";
  const DOUBAN_SEARCH_BASE =
    "https://search.douban.com/book/subject_search?search_text=";
  const MENU_CLASS = "culture-book-context-menu";
  const MENU_ITEM_CLASS = "culture-book-context-menu__item";

  let contextMenuEl = null;
  let contextMenuOutsideHandler = null;
  let bookEditPanelEl = null;
  let conceptEditPanelEl = null;
  let editBackdropEl = null;
  let activeBookAddedAt = null;
  let activeConceptIndex = null;

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

  function bookAuthor(book) {
    return String(book.author ?? "").trim();
  }

  function bookNoteUrl(book) {
    return String(book.noteUrl ?? "").trim();
  }

  function conceptKey(name) {
    if (window.ReadingCosmosConceptLinks?.conceptKey) {
      return ReadingCosmosConceptLinks.conceptKey(name);
    }
    return String(name || "")
      .trim()
      .toLowerCase();
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function doubanSearchUrl(title) {
    return `${DOUBAN_SEARCH_BASE}${encodeURIComponent(title)}`;
  }

  function formatBookTitleLabel(book) {
    return `《${escapeHtml(book.title)}》`;
  }

  function ideaBookHasContent(book) {
    if (window.ReadingCosmosIdeaBook?.ideaBookHasContent) {
      return ReadingCosmosIdeaBook.ideaBookHasContent(book);
    }
    return (
      book?.route === "idea" &&
      Array.isArray(book.concepts) &&
      book.concepts.length > 0
    );
  }

  function bookProblemDomain(book) {
    if (window.ReadingCosmosIdeaBook?.ideaBookProblemDomain) {
      return ReadingCosmosIdeaBook.ideaBookProblemDomain(book);
    }
    return String(book?.problem_domain ?? "").trim();
  }

  function bookClusterLabel(book) {
    if (window.ReadingCosmosIdeaBook?.ideaBookCluster) {
      return ReadingCosmosIdeaBook.ideaBookCluster(book);
    }
    return String(book?.cluster ?? "").trim();
  }

  function bookFramework(book) {
    if (window.ReadingCosmosIdeaBook?.ideaBookFramework) {
      return ReadingCosmosIdeaBook.ideaBookFramework(book);
    }
    return String(book?.framework ?? "").trim();
  }

  function getIdeaBooks() {
    return loadBooks()
      .filter((b) => ideaBookHasContent(b))
      .sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
  }

  function findBook(addedAt) {
    return loadBooks().find((b) => b.addedAt === addedAt);
  }

  function countUniqueGraphNodes() {
    const keys = new Set();
    getIdeaBooks().forEach((book) => {
      const fw = bookFramework(book);
      if (fw) {
        const fwId = window.ReadingCosmosIdeaBook?.frameworkNodeId(fw);
        keys.add(fwId || `fw:${conceptKey(fw)}`);
      }
      if (!Array.isArray(book.concepts)) return;
      book.concepts.forEach((raw) => {
        const key = conceptKey(raw);
        if (key) keys.add(key);
      });
    });
    return keys.size;
  }

  function conceptExistsGlobally(label) {
    const key = conceptKey(label);
    if (!key) return false;
    return getIdeaBooks().some((book) =>
      book.concepts.some((c) => conceptKey(c) === key)
    );
  }

  function closeContextMenu(clearActive = true) {
    if (!contextMenuEl) return;
    contextMenuEl.hidden = true;
    if (clearActive) {
      activeBookAddedAt = null;
      activeConceptIndex = null;
    }
    if (contextMenuOutsideHandler) {
      document.removeEventListener("click", contextMenuOutsideHandler, true);
      document.removeEventListener("contextmenu", contextMenuOutsideHandler, true);
      contextMenuOutsideHandler = null;
    }
  }

  function setConceptContextMenuItems() {
    contextMenuEl.innerHTML = `
      <button type="button" class="${MENU_ITEM_CLASS}" data-action="edit-concept">✎ 编辑</button>
      <button type="button" class="${MENU_ITEM_CLASS}" data-action="delete">✕ 删除</button>
    `;

    contextMenuEl.querySelector('[data-action="edit-concept"]').onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const book = activeBookAddedAt ? findBook(activeBookAddedAt) : null;
      const left = parseFloat(contextMenuEl.style.left) || 0;
      const top = parseFloat(contextMenuEl.style.top) || 0;
      closeContextMenu(false);
      if (book && activeConceptIndex != null) {
        openConceptEditPanel(book, activeConceptIndex, left, top);
      }
    };

    contextMenuEl.querySelector('[data-action="delete"]').onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeBookAddedAt == null || activeConceptIndex == null) return;
      removeConceptFromBook(activeBookAddedAt, activeConceptIndex);
      closeContextMenu();
      hideEditPanels();
      refreshGalaxy();
    };
  }

  function setBookContextMenuItems(book) {
    const noteUrl = bookNoteUrl(book);
    let html = `<button type="button" class="${MENU_ITEM_CLASS}" data-action="edit-book">✎ 编辑</button>`;

    if (noteUrl) {
      html += `<button type="button" class="${MENU_ITEM_CLASS}" data-action="open-note">↗ 打开笔记</button>`;
    }

    html += `<button type="button" class="${MENU_ITEM_CLASS}" data-action="delete">✕ 删除</button>`;
    contextMenuEl.innerHTML = html;

    contextMenuEl.querySelector('[data-action="edit-book"]').onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const left = parseFloat(contextMenuEl.style.left) || 0;
      const top = parseFloat(contextMenuEl.style.top) || 0;
      closeContextMenu(false);
      openBookEditPanel(book, left, top);
    };

    const openNoteBtn = contextMenuEl.querySelector('[data-action="open-note"]');
    if (openNoteBtn) {
      openNoteBtn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(noteUrl, "_blank", "noopener,noreferrer");
        closeContextMenu();
      };
    }

    contextMenuEl.querySelector('[data-action="delete"]').onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!activeBookAddedAt) return;
      deleteIdeaBook(activeBookAddedAt);
      closeContextMenu();
      hideEditPanels();
      refreshGalaxy();
    };
  }

  function ensureContextMenu() {
    if (contextMenuEl) return contextMenuEl;

    contextMenuEl = document.createElement("div");
    contextMenuEl.id = "galaxy-concept-context-menu";
    contextMenuEl.className = MENU_CLASS;
    contextMenuEl.hidden = true;
    document.body.appendChild(contextMenuEl);
    contextMenuEl.addEventListener("click", (e) => e.stopPropagation());

    return contextMenuEl;
  }

  function openContextMenu(mode, clientX, clientY, book) {
    const menu = ensureContextMenu();
    hideEditPanels();

    if (mode === "book" && book) {
      activeBookAddedAt = book.addedAt;
      activeConceptIndex = null;
      setBookContextMenuItems(book);
    } else {
      setConceptContextMenuItems();
    }

    menu.hidden = false;
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    const rect = menu.getBoundingClientRect();
    let left = clientX;
    let top = clientY;

    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = window.innerHeight - rect.height - 8;
    }

    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;

    if (contextMenuOutsideHandler) {
      document.removeEventListener("click", contextMenuOutsideHandler, true);
      document.removeEventListener("contextmenu", contextMenuOutsideHandler, true);
    }

    contextMenuOutsideHandler = (e) => {
      if (menu.contains(e.target)) return;
      closeContextMenu();
    };

    requestAnimationFrame(() => {
      document.addEventListener("click", contextMenuOutsideHandler, true);
      document.addEventListener("contextmenu", contextMenuOutsideHandler, true);
    });
  }

  function ensureEditBackdrop() {
    if (editBackdropEl) return editBackdropEl;

    editBackdropEl = document.createElement("div");
    editBackdropEl.id = "galaxy-edit-backdrop";
    editBackdropEl.className = "culture-book-panel-backdrop";
    editBackdropEl.hidden = true;
    editBackdropEl.addEventListener("click", (event) => {
      if (event.target !== editBackdropEl) return;
      hideEditPanels();
    });
    document.body.appendChild(editBackdropEl);
    return editBackdropEl;
  }

  function positionEditPanel(panel, clientX, clientY) {
    const panelRect = panel.getBoundingClientRect();
    let left = clientX;
    let top = clientY;

    if (left + panelRect.width > window.innerWidth - 12) {
      left = window.innerWidth - panelRect.width - 12;
    }
    if (top + panelRect.height > window.innerHeight - 12) {
      top = clientY - panelRect.height - 8;
    }

    panel.style.left = `${Math.max(12, left)}px`;
    panel.style.top = `${Math.max(12, top)}px`;
  }

  function ensureBookEditPanel() {
    if (bookEditPanelEl) return bookEditPanelEl;

    ensureEditBackdrop();

    bookEditPanelEl = document.createElement("div");
    bookEditPanelEl.id = "galaxy-book-edit-panel";
    bookEditPanelEl.className = "culture-book-panel";
    bookEditPanelEl.hidden = true;
    bookEditPanelEl.innerHTML = `
      <p class="culture-book-panel__heading">编辑书名 / 作者</p>
      <label class="culture-book-panel__field-label" for="galaxy-book-edit-title">书名</label>
      <input id="galaxy-book-edit-title" class="culture-book-panel__input" type="text" placeholder="书名" />
      <label class="culture-book-panel__field-label" for="galaxy-book-edit-author">作者（可选）</label>
      <input id="galaxy-book-edit-author" class="culture-book-panel__input" type="text" placeholder="作者名" />
      <label class="culture-book-panel__field-label" for="galaxy-book-edit-note-url">笔记链接（可选）</label>
      <input id="galaxy-book-edit-note-url" class="culture-book-panel__input" type="text" placeholder="" />
      <label class="culture-book-panel__field-label" for="galaxy-book-edit-cluster">议题群落</label>
      <input id="galaxy-book-edit-cluster" class="culture-book-panel__input" type="text" placeholder="议题群落" />
      <p class="culture-book-panel__hint">如 AI 归类有误可在此手动修改</p>
      <label class="culture-book-panel__field-label" for="galaxy-book-edit-route">归类</label>
      <select id="galaxy-book-edit-route" class="culture-book-panel__select">
        <option value="idea">🌌 思想星系</option>
        <option value="culture">🌍 文化旅行</option>
      </select>
      <div class="culture-book-panel__edit-actions">
        <button type="button" id="galaxy-book-confirm-btn" class="culture-book-panel__btn">确认</button>
        <button type="button" id="galaxy-book-cancel-btn" class="culture-book-panel__btn culture-book-panel__btn--ghost">取消</button>
      </div>
    `;
    document.body.appendChild(bookEditPanelEl);

    const titleInput = bookEditPanelEl.querySelector("#galaxy-book-edit-title");
    const authorInput = bookEditPanelEl.querySelector("#galaxy-book-edit-author");
    const noteInput = bookEditPanelEl.querySelector("#galaxy-book-edit-note-url");
    const clusterInput = bookEditPanelEl.querySelector("#galaxy-book-edit-cluster");
    const routeSelect = bookEditPanelEl.querySelector("#galaxy-book-edit-route");
    const confirmBtn = bookEditPanelEl.querySelector("#galaxy-book-confirm-btn");
    const cancelBtn = bookEditPanelEl.querySelector("#galaxy-book-cancel-btn");

    cancelBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideEditPanels();
    };

    confirmBtn.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const newTitle = titleInput.value.trim();
      const newAuthor = authorInput.value.trim();
      const newNoteUrl = noteInput.value.trim();
      const newCluster = clusterInput?.value.trim() ?? "";
      const newRoute = routeSelect?.value || "idea";
      const addedAt = activeBookAddedAt;
      if (!newTitle || !addedAt) return;

      const bookBefore = findBook(addedAt);
      const wasIdea = bookBefore?.route === "idea";

      updateIdeaBook(addedAt, {
        title: newTitle,
        author: newAuthor,
        noteUrl: newNoteUrl,
        cluster: newRoute === "idea" ? newCluster : undefined,
      });
      hideEditPanels();

      if (newRoute === "culture" && wasIdea) {
        if (!window.ReadingCosmosBooks?.convertIdeaBookToCulture) {
          showRouteChangeError("归类功能未加载，请刷新页面后重试");
          refreshAfterRouteChange();
          return;
        }

        setBookEditPanelBusy(true);
        try {
          await ReadingCosmosBooks.convertIdeaBookToCulture(addedAt);
        } catch (err) {
          console.error("[Idea Galaxy] 转为文化旅行失败:", err);
          showRouteChangeError(err.message || "转为文化旅行失败，请重试");
          refreshAfterRouteChange();
        } finally {
          setBookEditPanelBusy(false);
        }
        return;
      }

      refreshGalaxy();
    };

    [titleInput, authorInput, noteInput, clusterInput].forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmBtn.click();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          hideEditPanels();
        }
      });
    });

    bookEditPanelEl.addEventListener("mousedown", (e) => e.stopPropagation());
    bookEditPanelEl.addEventListener("click", (e) => e.stopPropagation());

    return bookEditPanelEl;
  }

  function ensureConceptEditPanel() {
    if (conceptEditPanelEl) return conceptEditPanelEl;

    ensureEditBackdrop();

    conceptEditPanelEl = document.createElement("div");
    conceptEditPanelEl.id = "galaxy-concept-edit-panel";
    conceptEditPanelEl.className = "culture-book-panel";
    conceptEditPanelEl.hidden = true;
    conceptEditPanelEl.innerHTML = `
      <p class="culture-book-panel__heading">编辑概念名</p>
      <label class="culture-book-panel__field-label" for="galaxy-concept-edit-input">概念</label>
      <input id="galaxy-concept-edit-input" class="culture-book-panel__input" type="text" placeholder="概念名" />
      <div class="culture-book-panel__edit-actions">
        <button type="button" id="galaxy-concept-confirm-btn" class="culture-book-panel__btn">确认</button>
        <button type="button" id="galaxy-concept-cancel-btn" class="culture-book-panel__btn culture-book-panel__btn--ghost">取消</button>
      </div>
    `;
    document.body.appendChild(conceptEditPanelEl);

    const input = conceptEditPanelEl.querySelector("#galaxy-concept-edit-input");
    const confirmBtn = conceptEditPanelEl.querySelector("#galaxy-concept-confirm-btn");
    const cancelBtn = conceptEditPanelEl.querySelector("#galaxy-concept-cancel-btn");

    cancelBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideEditPanels();
    };

    confirmBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const newLabel = input.value.trim();
      if (!newLabel || activeBookAddedAt == null || activeConceptIndex == null) return;
      renameConceptInBook(activeBookAddedAt, activeConceptIndex, newLabel);
      hideEditPanels();
      refreshGalaxy();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmBtn.click();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        hideEditPanels();
      }
    });

    conceptEditPanelEl.addEventListener("mousedown", (e) => e.stopPropagation());
    conceptEditPanelEl.addEventListener("click", (e) => e.stopPropagation());

    return conceptEditPanelEl;
  }

  function hideEditPanels() {
    if (editBackdropEl) {
      editBackdropEl.hidden = true;
      editBackdropEl.style.display = "none";
    }
    if (bookEditPanelEl) {
      bookEditPanelEl.hidden = true;
      bookEditPanelEl.style.display = "none";
    }
    if (conceptEditPanelEl) {
      conceptEditPanelEl.hidden = true;
      conceptEditPanelEl.style.display = "none";
    }
    activeConceptIndex = null;
  }

  function showEditBackdrop() {
    if (editBackdropEl) {
      editBackdropEl.hidden = false;
      editBackdropEl.style.display = "block";
    }
  }

  function openBookEditPanel(book, clientX, clientY) {
    const panel = ensureBookEditPanel();
    activeBookAddedAt = book.addedAt;
    activeConceptIndex = null;

    panel.querySelector("#galaxy-book-edit-title").value = book.title;
    panel.querySelector("#galaxy-book-edit-author").value = bookAuthor(book);
    panel.querySelector("#galaxy-book-edit-note-url").value = bookNoteUrl(book);

    const clusterInput = panel.querySelector("#galaxy-book-edit-cluster");
    if (clusterInput) {
      clusterInput.value = bookClusterLabel(book);
    }

    const routeSelect = panel.querySelector("#galaxy-book-edit-route");
    if (routeSelect) {
      routeSelect.value = book.route === "culture" ? "culture" : "idea";
      routeSelect.disabled = false;
    }

    const confirmBtn = panel.querySelector("#galaxy-book-confirm-btn");
    if (confirmBtn) confirmBtn.disabled = false;

    if (bookEditPanelEl) {
      bookEditPanelEl.hidden = false;
      bookEditPanelEl.style.display = "flex";
    }
    if (conceptEditPanelEl) {
      conceptEditPanelEl.hidden = true;
      conceptEditPanelEl.style.display = "none";
    }
    showEditBackdrop();

    positionEditPanel(panel, clientX, clientY);

    requestAnimationFrame(() => {
      const input = panel.querySelector("#galaxy-book-edit-title");
      input.focus();
      input.select();
    });
  }

  function openConceptEditPanel(book, conceptIndex, clientX, clientY) {
    const conceptLabel = String(book.concepts[conceptIndex] ?? "").trim();
    if (!conceptLabel) return;

    const panel = ensureConceptEditPanel();
    activeBookAddedAt = book.addedAt;
    activeConceptIndex = conceptIndex;

    panel.querySelector("#galaxy-concept-edit-input").value = conceptLabel;

    if (conceptEditPanelEl) {
      conceptEditPanelEl.hidden = false;
      conceptEditPanelEl.style.display = "flex";
    }
    if (bookEditPanelEl) {
      bookEditPanelEl.hidden = true;
      bookEditPanelEl.style.display = "none";
    }
    showEditBackdrop();

    positionEditPanel(panel, clientX, clientY);

    requestAnimationFrame(() => {
      const input = panel.querySelector("#galaxy-concept-edit-input");
      input.focus();
      input.select();
    });
  }

  function updateIdeaBook(addedAt, { title, author, noteUrl, cluster }) {
    const books = loadBooks();
    const book = books.find((b) => b.addedAt === addedAt);
    if (!book) return;

    book.title = title;
    book.author = author;
    book.noteUrl = String(noteUrl ?? "").trim();
    if (cluster !== undefined && book.route === "idea") {
      book.cluster = String(cluster ?? "").trim();
    }
    saveBooks(books);
  }

  function showRouteChangeError(message) {
    if (window.ReadingCosmosBooks?.showInlineFeedback) {
      ReadingCosmosBooks.showInlineFeedback(message);
      return;
    }
    console.warn("[Idea Galaxy]", message);
  }

  function setBookEditPanelBusy(busy) {
    const panel = bookEditPanelEl;
    const confirmBtn = panel?.querySelector("#galaxy-book-confirm-btn");
    const cancelBtn = panel?.querySelector("#galaxy-book-cancel-btn");
    const routeSelect = panel?.querySelector("#galaxy-book-edit-route");
    const clusterInput = panel?.querySelector("#galaxy-book-edit-cluster");
    [
      confirmBtn,
      cancelBtn,
      routeSelect,
      clusterInput,
      panel?.querySelector("#galaxy-book-edit-title"),
      panel?.querySelector("#galaxy-book-edit-author"),
      panel?.querySelector("#galaxy-book-edit-note-url"),
    ].forEach((el) => {
      if (el) el.disabled = busy;
    });
  }

  function refreshAfterRouteChange() {
    if (window.ReadingCosmosMap?.refreshMapData) {
      ReadingCosmosMap.refreshMapData();
    }
    refreshGalaxy();
    if (window.ReadingCosmosGalaxySidebar?.refresh) {
      ReadingCosmosGalaxySidebar.refresh();
    }
  }

  function deleteIdeaBook(addedAt) {
    const book = findBook(addedAt);
    if (!book || !Array.isArray(book.concepts)) {
      saveBooks(loadBooks().filter((b) => b.addedAt !== addedAt));
      return;
    }

    const labels = [...book.concepts];
    saveBooks(loadBooks().filter((b) => b.addedAt !== addedAt));

    if (window.ReadingCosmosConceptLinks?.removeLinksForConcept) {
      labels.forEach((label) => {
        if (!conceptExistsGlobally(label)) {
          ReadingCosmosConceptLinks.removeLinksForConcept(label);
        }
      });
    }
  }

  function removeConceptFromBook(addedAt, conceptIndex) {
    const books = loadBooks();
    const book = books.find((b) => b.addedAt === addedAt);
    if (!book || !Array.isArray(book.concepts)) return;

    const removed = String(book.concepts[conceptIndex] ?? "").trim();
    book.concepts = book.concepts.filter((_, i) => i !== conceptIndex);
    saveBooks(books);

    if (
      removed &&
      !conceptExistsGlobally(removed) &&
      window.ReadingCosmosConceptLinks?.removeLinksForConcept
    ) {
      ReadingCosmosConceptLinks.removeLinksForConcept(removed);
    }
  }

  function renameConceptInBook(addedAt, conceptIndex, newLabel) {
    const books = loadBooks();
    const book = books.find((b) => b.addedAt === addedAt);
    if (!book || !Array.isArray(book.concepts)) return;

    const oldLabel = String(book.concepts[conceptIndex] ?? "").trim();
    const nextLabel = String(newLabel).trim();
    if (!oldLabel || !nextLabel) return;

    book.concepts[conceptIndex] = nextLabel;
    saveBooks(books);

    const oldStillUsed = getIdeaBooks().some((b) =>
      b.concepts.some((c) => String(c).trim() === oldLabel)
    );

    if (
      !oldStillUsed &&
      oldLabel !== nextLabel &&
      window.ReadingCosmosConceptLinks?.renameConceptInLinks
    ) {
      ReadingCosmosConceptLinks.renameConceptInLinks(oldLabel, nextLabel);
    }
  }

  let galaxyFocusTimer = null;

  function focusBookCard(addedAt) {
    const safeId =
      typeof CSS !== "undefined" && CSS.escape
        ? CSS.escape(addedAt)
        : String(addedAt).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const card = document.querySelector(
      `.galaxy-book-card[data-book-added-at="${safeId}"]`
    );
    if (!card) return;

    const listEl = document.getElementById("galaxy-concepts-list");
    if (listEl) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    clearTimeout(galaxyFocusTimer);
    card.classList.add("is-galaxy-focused");
    galaxyFocusTimer = setTimeout(() => {
      card.classList.remove("is-galaxy-focused");
    }, 1500);
  }

  function focusConceptInGalaxy(label) {
    const key = conceptKey(label);
    if (!key || !window.ReadingCosmosGalaxy?.selectConceptById) return;
    window.ReadingCosmosGalaxy.selectConceptById(key, { focus: true });
  }

  function refreshGalaxy() {
    if (window.ReadingCosmosGalaxy?.refreshGalaxy) {
      ReadingCosmosGalaxy.refreshGalaxy({ preserveSelection: true });
    } else {
      refresh({ conceptCount: countUniqueGraphNodes() });
    }
  }

  function renderBookList() {
    const listEl = document.getElementById("galaxy-concepts-list");
    if (!listEl) return;

    closeContextMenu();
    hideEditPanels();

    const books = getIdeaBooks();
    if (books.length === 0) {
      listEl.innerHTML = `<p class="galaxy-concepts__empty">尚无概念</p>`;
      return;
    }

    listEl.innerHTML = books
      .map((book) => {
        const addedAt = escapeHtml(book.addedAt);
        const href = escapeHtml(doubanSearchUrl(book.title));
        const titleLabel = formatBookTitleLabel(book);
        const problemDomainRaw = bookProblemDomain(book);
        const problemDomain = problemDomainRaw
          ? escapeHtml(problemDomainRaw)
          : "";
        const framework = escapeHtml(bookFramework(book));
        const conceptItems = Array.isArray(book.concepts) ? book.concepts : [];
        const concepts = conceptItems
          .map((raw, index) => {
            const label = escapeHtml(String(raw || "").trim());
            if (!label) return "";
            return `<li class="galaxy-concept-item">
              <button
                type="button"
                class="galaxy-concept-link"
                data-book-added-at="${addedAt}"
                data-concept-index="${index}"
              ># ${label}</button>
            </li>`;
          })
          .filter(Boolean)
          .join("");

        return `<article
          class="galaxy-book-card"
          data-book-added-at="${addedAt}"
          role="button"
          tabindex="0"
          aria-label="高亮该书在星系图中的概念"
        >
          <h4 class="galaxy-book-card__title">
            <a
              class="galaxy-book-title-link"
              href="${href}"
              target="_blank"
              rel="noopener noreferrer"
              title="豆瓣搜索"
            >${titleLabel}</a>
          </h4>
          ${
            problemDomain
              ? `<p class="galaxy-book-card__meta galaxy-book-card__meta--domain">问题域：${problemDomain}</p>`
              : ""
          }
          <p class="galaxy-book-card__meta galaxy-book-card__meta--framework">框架：${framework || "—"}</p>
          <ul class="galaxy-book-card__concepts">${concepts || '<li class="galaxy-concepts__empty">（无概念）</li>'}</ul>
        </article>`;
      })
      .join("");

    listEl.querySelectorAll(".galaxy-concept-link").forEach((btn) => {
      const bookAddedAt = btn.dataset.bookAddedAt;
      const conceptIndex = Number(btn.dataset.conceptIndex);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const book = findBook(bookAddedAt);
        if (!book) return;
        if (!Array.isArray(book.concepts)) return;
        const label = String(book.concepts[conceptIndex] ?? "").trim();
        if (!label) return;
        focusConceptInGalaxy(label);
      });

      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        activeBookAddedAt = bookAddedAt;
        activeConceptIndex = conceptIndex;
        openContextMenu("concept", e.clientX, e.clientY);
      });
    });

    listEl.querySelectorAll(".galaxy-book-card").forEach((card) => {
      const bookAddedAt = card.dataset.bookAddedAt;
      if (!bookAddedAt) return;

      const triggerHighlight = () => {
        if (window.ReadingCosmosGalaxy?.toggleBookHighlightInGalaxy) {
          ReadingCosmosGalaxy.toggleBookHighlightInGalaxy(bookAddedAt);
        }
      };

      card.addEventListener("click", (e) => {
        if (e.target.closest(".galaxy-book-title-link")) return;
        if (e.target.closest(".galaxy-concept-link")) return;
        triggerHighlight();
      });

      card.addEventListener("keydown", (e) => {
        if (e.target.closest(".galaxy-book-title-link")) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        triggerHighlight();
      });
    });

    listEl.querySelectorAll(".galaxy-book-title-link").forEach((link) => {
      const card = link.closest(".galaxy-book-card");
      const bookAddedAt = card?.dataset.bookAddedAt;
      if (!bookAddedAt) return;

      link.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      link.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const book = findBook(bookAddedAt);
        if (!book) return;
        activeBookAddedAt = bookAddedAt;
        activeConceptIndex = null;
        openContextMenu("book", e.clientX, e.clientY, book);
      });
    });
  }

  function setHighlightedBookCard(addedAt) {
    document.querySelectorAll(".galaxy-book-card").forEach((card) => {
      const active = addedAt != null && card.dataset.bookAddedAt === addedAt;
      card.classList.toggle("is-galaxy-highlighted", active);
    });
  }

  function updateSummary(conceptCount) {
    const summary = document.getElementById("galaxy-concepts-summary");
    if (!summary) return;

    const books = getIdeaBooks();
    const totalConcepts =
      typeof conceptCount === "number" ? conceptCount : countUniqueGraphNodes();

    if (books.length === 0 && totalConcepts === 0) {
      summary.textContent = "共 0 个概念 / 0 本书";
      summary.className = "glass-card__summary galaxy-concepts__stats";
      return;
    }

    summary.className = "glass-card__summary galaxy-concepts__stats";
    summary.textContent = `共 ${totalConcepts} 个概念 / ${books.length} 本书`;
  }

  function refresh(options = {}) {
    updateSummary(options.conceptCount);
    renderBookList();
  }

  window.ReadingCosmosGalaxySidebar = {
    refresh,
    focusBookCard,
    setHighlightedBookCard,
    countUniqueConcepts: countUniqueGraphNodes,
  };
})();
