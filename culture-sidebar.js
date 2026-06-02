/**
 * Culture Journey — 阅读足迹侧边栏
 */
(function () {
  const STORAGE_KEY = "reading_cosmos_books";
  const DOUBAN_SEARCH_BASE =
    "https://search.douban.com/book/subject_search?search_text=";

  let contextMenuEl = null;
  let contextMenuOutsideHandler = null;
  let editPanelEl = null;
  let editBackdropEl = null;
  let activeBookAddedAt = null;

  function stopPanelEvent(event) {
    event.stopPropagation();
  }

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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBookLinkLabel(book) {
    const title = escapeHtml(book.title);
    const author = bookAuthor(book);
    if (author) return `《${title}》| ${escapeHtml(author)}`;
    return `《${title}》`;
  }

  function noteLinkIconHtml(noteUrl) {
    const url = String(noteUrl ?? "").trim();
    if (!url) return "";

    const href = escapeHtml(url);
    return (
      `<a` +
      ` class="culture-book-note-link"` +
      ` href="${href}"` +
      ` target="_blank"` +
      ` rel="noopener noreferrer"` +
      ` aria-label="打开笔记链接"` +
      ` title="打开笔记"` +
      `>` +
      `<svg class="culture-book-note-icon" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">` +
      `<path d="M16.5 6v11.5a4 4 0 1 1-8 0V7.5a2.5 2.5 0 0 1 5 0V16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>` +
      `</a>`
    );
  }

  function doubanSearchUrl(title) {
    return `${DOUBAN_SEARCH_BASE}${encodeURIComponent(title)}`;
  }

  /** 地图联动：country-card-china（英文名小写、去空格） */
  function countryCardDomId(englishName) {
    const slug = String(englishName ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    return slug ? `country-card-${slug}` : "";
  }

  let mapFocusTimer = null;

  function focusCountryCard(englishName) {
    const id = countryCardDomId(englishName);
    if (!id) return;

    const card = document.getElementById(id);
    if (!card) return;

    const listEl = document.getElementById("culture-footprints-list");
    if (listEl) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    clearTimeout(mapFocusTimer);
    card.classList.add("is-map-focused");
    mapFocusTimer = setTimeout(() => {
      card.classList.remove("is-map-focused");
    }, 1500);
  }

  function findBook(addedAt) {
    return loadBooks().find((b) => b.addedAt === addedAt);
  }

  function closeContextMenu(clearActive = true) {
    if (!contextMenuEl) return;
    contextMenuEl.hidden = true;
    if (clearActive) activeBookAddedAt = null;
    if (contextMenuOutsideHandler) {
      document.removeEventListener("click", contextMenuOutsideHandler, true);
      document.removeEventListener("contextmenu", contextMenuOutsideHandler, true);
      contextMenuOutsideHandler = null;
    }
  }

  function ensureContextMenu() {
    if (contextMenuEl) return contextMenuEl;

    contextMenuEl = document.createElement("div");
    contextMenuEl.id = "culture-book-context-menu";
    contextMenuEl.className = "culture-book-context-menu";
    contextMenuEl.hidden = true;
    contextMenuEl.innerHTML = `
      <button type="button" class="culture-book-context-menu__item" data-action="edit">✎ 编辑</button>
      <button type="button" class="culture-book-context-menu__item" data-action="delete">✕ 删除</button>
    `;
    document.body.appendChild(contextMenuEl);

    contextMenuEl.addEventListener("click", (e) => e.stopPropagation());

    contextMenuEl.querySelector('[data-action="edit"]').addEventListener("click", () => {
      const book = activeBookAddedAt ? findBook(activeBookAddedAt) : null;
      const left = parseFloat(contextMenuEl.style.left) || 0;
      const top = parseFloat(contextMenuEl.style.top) || 0;
      closeContextMenu(false);
      if (book) openEditPanel(book, left, top);
    });

    contextMenuEl.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (!activeBookAddedAt) return;
      deleteBook(activeBookAddedAt);
      closeContextMenu();
      closeEditPanel();
      refreshAfterBookChange();
    });

    return contextMenuEl;
  }

  function openContextMenu(book, clientX, clientY) {
    const menu = ensureContextMenu();
    closeEditPanel();
    activeBookAddedAt = book.addedAt;

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
    editBackdropEl.id = "culture-book-edit-backdrop";
    editBackdropEl.className = "culture-book-panel-backdrop";
    editBackdropEl.hidden = true;
    editBackdropEl.addEventListener("click", (event) => {
      if (event.target !== editBackdropEl) return;
      hideEditPanel();
    });
    document.body.appendChild(editBackdropEl);
    return editBackdropEl;
  }

  function ensureEditPanel() {
    if (editPanelEl) return editPanelEl;

    ensureEditBackdrop();

    editPanelEl = document.createElement("div");
    editPanelEl.id = "culture-book-edit-panel";
    editPanelEl.className = "culture-book-panel";
    editPanelEl.hidden = true;
    editPanelEl.innerHTML = `
      <p class="culture-book-panel__heading">编辑书名 / 作者</p>
      <label class="culture-book-panel__field-label" for="culture-book-edit-title">书名</label>
      <input id="culture-book-edit-title" class="culture-book-panel__input" type="text" placeholder="书名" />
      <label class="culture-book-panel__field-label" for="culture-book-edit-country">所属国家</label>
      <input id="culture-book-edit-country" class="culture-book-panel__input" type="text" placeholder="" />
      <p class="culture-book-panel__hint">如归类有误可在此手动修改，填中文或英文国家名均可</p>
      <label class="culture-book-panel__field-label" for="culture-book-edit-author">作者（可选）</label>
      <input id="culture-book-edit-author" class="culture-book-panel__input" type="text" placeholder="作者名" />
      <label class="culture-book-panel__field-label" for="culture-book-edit-note-url">笔记链接（可选）</label>
      <input id="culture-book-edit-note-url" class="culture-book-panel__input" type="text" placeholder="" />
      <label class="culture-book-panel__field-label" for="culture-book-edit-route">归类</label>
      <select id="culture-book-edit-route" class="culture-book-panel__select">
        <option value="culture">🌍 文化旅行</option>
        <option value="idea">🌌 思想星系</option>
      </select>
      <div class="culture-book-panel__edit-actions">
        <button type="button" id="culture-book-confirm-btn" class="culture-book-panel__btn">确认</button>
        <button type="button" id="culture-book-cancel-btn" class="culture-book-panel__btn culture-book-panel__btn--ghost">取消</button>
      </div>
    `;
    document.body.appendChild(editPanelEl);

    const editTitleInput = editPanelEl.querySelector("#culture-book-edit-title");
    const editCountryInput = editPanelEl.querySelector("#culture-book-edit-country");
    const editAuthorInput = editPanelEl.querySelector("#culture-book-edit-author");
    const editNoteUrlInput = editPanelEl.querySelector("#culture-book-edit-note-url");
    const editRouteSelect = editPanelEl.querySelector("#culture-book-edit-route");
    const confirmBtn = editPanelEl.querySelector("#culture-book-confirm-btn");
    const cancelBtn = editPanelEl.querySelector("#culture-book-cancel-btn");

    cancelBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideEditPanel();
    };

    confirmBtn.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const newTitle = editTitleInput.value.trim();
      const newCountry = editCountryInput?.value.trim() ?? "";
      const newAuthor = editAuthorInput.value.trim();
      const newNoteUrl = editNoteUrlInput.value.trim();
      const newRoute = editRouteSelect?.value || "culture";
      const addedAt = activeBookAddedAt;
      if (!newTitle || !addedAt) return;

      const bookBefore = findBook(addedAt);
      const wasCulture = bookBefore?.route !== "idea";

      updateBook(addedAt, {
        title: newTitle,
        author: newAuthor,
        noteUrl: newNoteUrl,
        country: wasCulture && newRoute === "culture" ? newCountry : undefined,
      });
      hideEditPanel();

      if (newRoute === "idea" && wasCulture) {
        if (!window.ReadingCosmosBooks?.convertCultureBookToIdea) {
          showRouteChangeError("归类功能未加载，请刷新页面后重试");
          refreshAfterBookChange();
          return;
        }

        setEditPanelBusy(true);
        try {
          await ReadingCosmosBooks.convertCultureBookToIdea(addedAt);
        } catch (err) {
          console.error("[Culture Journey] 转为思想星系失败:", err);
          showRouteChangeError(err.message || "转为思想星系失败，请重试");
          refreshAfterBookChange();
        } finally {
          setEditPanelBusy(false);
        }
        return;
      }

      refreshAfterBookChange();
    };

    [editTitleInput, editCountryInput, editAuthorInput, editNoteUrlInput].forEach(
      (input) => {
        if (!input) return;
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmBtn.click();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            hideEditPanel();
          }
        });
      }
    );

    editPanelEl.addEventListener("mousedown", stopPanelEvent);
    editPanelEl.addEventListener("click", stopPanelEvent);

    return editPanelEl;
  }

  function hideEditPanel() {
    if (editBackdropEl) {
      editBackdropEl.hidden = true;
      editBackdropEl.style.display = "none";
    }
    if (editPanelEl) {
      editPanelEl.hidden = true;
      editPanelEl.style.display = "none";
    }
    activeBookAddedAt = null;
  }

  function showEditPanel() {
    if (editBackdropEl) {
      editBackdropEl.hidden = false;
      editBackdropEl.style.display = "block";
    }
    if (editPanelEl) {
      editPanelEl.hidden = false;
      editPanelEl.style.display = "flex";
    }
  }

  function closeEditPanel() {
    hideEditPanel();
  }

  function openEditPanel(book, clientX, clientY) {
    closeContextMenu(false);

    const backdrop = ensureEditBackdrop();
    const panel = ensureEditPanel();
    activeBookAddedAt = book.addedAt;

    panel.querySelector("#culture-book-edit-title").value = book.title;
    panel.querySelector("#culture-book-edit-country").value = String(
      book.country ?? ""
    ).trim();
    panel.querySelector("#culture-book-edit-author").value = bookAuthor(book);
    panel.querySelector("#culture-book-edit-note-url").value = bookNoteUrl(book);

    const routeSelect = panel.querySelector("#culture-book-edit-route");
    if (routeSelect) {
      routeSelect.value = book.route === "idea" ? "idea" : "culture";
      routeSelect.disabled = false;
    }

    const confirmBtn = panel.querySelector("#culture-book-confirm-btn");
    if (confirmBtn) confirmBtn.disabled = false;

    showEditPanel();

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

    requestAnimationFrame(() => {
      panel.querySelector("#culture-book-edit-title").focus();
      panel.querySelector("#culture-book-edit-title").select();
    });
  }

  function deleteBook(addedAt) {
    const books = loadBooks().filter((b) => b.addedAt !== addedAt);
    saveBooks(books);
  }

  function resolveCountryForStorage(input) {
    if (window.ReadingCosmosCountryNames?.resolveCountryForStorage) {
      return ReadingCosmosCountryNames.resolveCountryForStorage(input);
    }
    return String(input ?? "").trim();
  }

  function updateBook(addedAt, { title, author, noteUrl, country }) {
    const books = loadBooks();
    const book = books.find((b) => b.addedAt === addedAt);
    if (!book) return;

    book.title = title;
    book.author = author;
    book.noteUrl = String(noteUrl ?? "").trim();

    if (country !== undefined && book.route === "culture") {
      book.country = resolveCountryForStorage(country);
    }

    saveBooks(books);
  }

  function showRouteChangeError(message) {
    if (window.ReadingCosmosBooks?.showInlineFeedback) {
      ReadingCosmosBooks.showInlineFeedback(message);
      return;
    }
    console.warn("[Culture Journey]", message);
  }

  function setEditPanelBusy(busy) {
    const panel = editPanelEl;
    const confirmBtn = panel?.querySelector("#culture-book-confirm-btn");
    const cancelBtn = panel?.querySelector("#culture-book-cancel-btn");
    const routeSelect = panel?.querySelector("#culture-book-edit-route");
    const countryInput = panel?.querySelector("#culture-book-edit-country");
    [confirmBtn, cancelBtn, routeSelect, countryInput].forEach((el) => {
      if (el) el.disabled = busy;
    });
  }

  function refreshAfterBookChange() {
    if (window.ReadingCosmosMap?.refreshMapData) {
      ReadingCosmosMap.refreshMapData();
    } else if (window.ReadingCosmosCultureSidebar?.refresh) {
      ReadingCosmosCultureSidebar.refresh();
    }
    if (window.ReadingCosmosGalaxy?.refreshGalaxy) {
      ReadingCosmosGalaxy.refreshGalaxy();
    }
  }

  function renderCountryGroups(groups) {
    const listEl = document.getElementById("culture-footprints-list");
    if (!listEl) return;

    closeContextMenu();
    closeEditPanel();

    if (!groups || groups.length === 0) {
      listEl.innerHTML = `<p class="culture-footprints__empty">尚无阅读记录</p>`;
      return;
    }

    listEl.innerHTML = groups
      .map(
        (group) => `
      <article
        id="${escapeHtml(countryCardDomId(group.englishName))}"
        class="culture-country-card"
        data-country-id="${escapeHtml(group.countryId)}"
        data-country-en="${escapeHtml(group.englishName)}"
      >
        <h4 class="culture-country-card__title">${escapeHtml(group.countryName)}</h4>
        <ul class="culture-country-card__books">
          ${group.books
            .map((book) => {
              const addedAt = escapeHtml(book.addedAt);
              const href = escapeHtml(doubanSearchUrl(book.title));
              const noteIcon = noteLinkIconHtml(bookNoteUrl(book));
              return `<li class="culture-book-item">
                <span class="culture-book-row">
                  <a
                    class="culture-book-link"
                    href="${href}"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-added-at="${addedAt}"
                  >${formatBookLinkLabel(book)}</a>${noteIcon}
                </span>
              </li>`;
            })
            .join("")}
        </ul>
      </article>
    `
      )
      .join("");

    listEl.querySelectorAll(".culture-book-link").forEach((link) => {
      const addedAt = link.dataset.addedAt;

      link.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const book = findBook(addedAt);
        if (!book) return;
        openContextMenu(book, e.clientX, e.clientY);
      });
    });

    listEl.querySelectorAll(".culture-book-note-link").forEach((noteLink) => {
      noteLink.addEventListener("click", (e) => e.stopPropagation());
    });

    listEl.querySelectorAll(".culture-country-card").forEach((card) => {
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute(
        "aria-label",
        `在地图上定位 ${card.querySelector(".culture-country-card__title")?.textContent || "该国"}`
      );

      const activateMapFocus = () => {
        const countryId = card.dataset.countryId;
        const englishName = card.dataset.countryEn;
        if (!countryId || !window.ReadingCosmosMap?.focusMapOnCountry) return;

        ReadingCosmosMap.focusMapOnCountry(englishName, countryId);
      };

      const isBookInteractionTarget = (target) =>
        target.closest(".culture-book-link") ||
        target.closest(".culture-book-note-link");

      card.addEventListener("click", (e) => {
        if (isBookInteractionTarget(e.target)) return;
        activateMapFocus();
      });

      card.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (isBookInteractionTarget(e.target)) return;
        e.preventDefault();
        activateMapFocus();
      });
    });
  }

  function updateSummary(groups) {
    const summary = document.getElementById("map-footprints-summary");
    if (!summary) return;

    const bookCount = groups.reduce((sum, g) => sum + g.books.length, 0);
    if (bookCount === 0) {
      summary.textContent = "已标记 0 个国家 / 共 0 本书";
      summary.className = "glass-card__summary culture-footprints__stats";
      return;
    }

    summary.className = "glass-card__summary culture-footprints__stats";
    summary.textContent = `已标记 ${groups.length} 个国家 / 共 ${bookCount} 本书`;
  }

  function refresh(groups) {
    const data =
      groups ||
      (window.ReadingCosmosMap?.getCultureBooksByCountry
        ? ReadingCosmosMap.getCultureBooksByCountry()
        : []);

    updateSummary(data);
    renderCountryGroups(data);
  }

  window.ReadingCosmosCultureSidebar = {
    refresh,
    focusCountryCard,
    countryCardDomId,
  };
})();
