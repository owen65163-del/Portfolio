(() => {
  "use strict";

  // Site root, derived from where portfolio.js lives, so the site works from any URL prefix.
  const siteBase = new URL("./", document.currentScript.src);

  const root = document.documentElement;
  const byId = (id) => document.getElementById(id);
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  const preferenceKey = "hanwen-portfolio-display";
  const defaultPreferences = { theme: "light", textSize: "100", spacing: false, motion: false, layout: "grid" };

  function restorePreferences() {
    try {
      return { ...defaultPreferences, ...JSON.parse(localStorage.getItem(preferenceKey) || "{}") };
    } catch {
      return { ...defaultPreferences };
    }
  }

  const preferences = restorePreferences();
  if (!["light", "dark", "contrast"].includes(preferences.theme)) preferences.theme = "light";
  if (!["100", "115", "130", "150"].includes(preferences.textSize)) preferences.textSize = "100";
  if (!["grid", "list"].includes(preferences.layout)) preferences.layout = "grid";

  function savePreferences() {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    } catch {
      // Settings still apply if this browser blocks storage.
    }
  }

  const settings = byId("display-settings");
  const settingsDialog = byId("display-dialog");
  const settingsButton = byId("display-open");
  const layoutButtons = all("button[data-layout]");
  const grid = byId("project-grid");

  function applyPreferences() {
    root.dataset.theme = preferences.theme;
    root.dataset.motion = preferences.motion ? "reduce" : "system";
    root.dataset.spacing = preferences.spacing ? "spacious" : "standard";
    root.style.fontSize = preferences.textSize + "%";
    if (grid) grid.dataset.layout = preferences.layout;
    for (const button of layoutButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.layout === preferences.layout));
    }
    settings.elements.theme.value = preferences.theme;
    settings.elements.textSize.value = preferences.textSize;
    settings.elements.spacing.checked = preferences.spacing;
    settings.elements.motion.checked = preferences.motion;
  }

  function bindDialog(dialog) {
    dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      const trigger = dialogTriggers.get(dialog);
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
    });
  }

  const dialogTriggers = new WeakMap();
  function showDialog(dialog, trigger) {
    dialogTriggers.set(dialog, trigger);
    dialog.showModal();
  }

  settings.addEventListener("submit", (event) => event.preventDefault());
  settings.addEventListener("change", () => {
    preferences.theme = settings.elements.theme.value;
    preferences.textSize = settings.elements.textSize.value;
    preferences.spacing = settings.elements.spacing.checked;
    preferences.motion = settings.elements.motion.checked;
    applyPreferences();
    savePreferences();
  });
  settings.addEventListener("reset", (event) => {
    event.preventDefault();
    const { layout } = preferences;
    Object.assign(preferences, defaultPreferences, { layout });
    applyPreferences();
    savePreferences();
  });
  if (typeof settingsDialog.showModal === "function") {
    bindDialog(settingsDialog);
    settingsButton.hidden = false;
    settingsButton.addEventListener("click", () => showDialog(settingsDialog, settingsButton));
  }
  for (const button of layoutButtons) {
    button.addEventListener("click", () => {
      preferences.layout = button.dataset.layout;
      applyPreferences();
      savePreferences();
    });
  }
  applyPreferences();

  function setupWork() {
    if (!grid) return;
    const cards = all("[data-project-card]");
    const filterButtons = all("button[data-filter]");
    const search = byId("project-search");
    const year = byId("project-year");
    const projectCount = byId("project-count");
    const emptyProjects = byId("empty-projects");
    let category = "all";

    function filterProjects() {
      const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let visible = 0;
      for (const card of cards) {
        const matchesCategory = category === "all" || card.dataset.category === category;
        const matchesYear = year.value === "all" || card.dataset.year === year.value;
        const searchable = card.dataset.search.toLowerCase();
        card.hidden = !matchesCategory || !matchesYear || terms.some((term) => !searchable.includes(term));
        if (!card.hidden) visible++;
      }
      for (const button of filterButtons) {
        button.setAttribute("aria-pressed", String(button.dataset.filter === category));
      }
      const message = visible === 1 ? "1 project" : visible + " projects";
      if (projectCount.textContent !== message) projectCount.textContent = message;
      emptyProjects.hidden = visible > 0;
    }

    for (const button of filterButtons) {
      button.addEventListener("click", () => {
        category = button.dataset.filter;
        filterProjects();
      });
    }
    search.addEventListener("input", filterProjects);
    year.addEventListener("change", filterProjects);
    byId("reset-filters").addEventListener("click", () => {
      category = "all";
      search.value = "";
      year.value = "all";
      filterProjects();
      search.focus();
    });
    for (const control of all("[data-work-controls]")) control.hidden = false;
    filterProjects();
    setupComparison(cards, search);
  }

  function setupComparison(cards, search) {
    const dialog = byId("compare-dialog");
    if (typeof dialog?.showModal !== "function") return;
    const byKey = new Map(cards.map((card) => [card.dataset.projectCard, card]));
    const toggles = all("[data-compare-project]");
    const open = byId("compare-open");
    const clear = byId("compare-clear");
    const status = byId("compare-status");
    const panels = byId("compare-projects");
    const storageKey = "hanwen-portfolio-comparison";

    let saved = [];
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
      if (Array.isArray(stored)) saved = stored.filter((key) => byKey.has(key)).slice(0, 2);
    } catch {
      // The Work page retains the selection while it is open.
    }
    const selected = new Set(saved);

    function updateComparison() {
      for (const toggle of toggles) {
        toggle.setAttribute("aria-pressed", String(selected.has(toggle.dataset.compareProject)));
      }
      clear.hidden = selected.size === 0;
      open.disabled = selected.size !== 2;
      const ids = Array.from(selected, (key) => key.toUpperCase()).join(" and ");
      status.textContent = selected.size === 2
        ? "Ready to compare " + ids + "."
        : selected.size === 1
          ? ids + " selected. Choose one more project."
          : "Select two projects to compare.";
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(Array.from(selected)));
      } catch {
        // The in-page selection remains available.
      }
    }

    function comparisonPanel(key) {
      const card = byKey.get(key);
      const item = document.createElement("article");
      item.className = "compare-item";
      const heading = document.createElement("h3");
      heading.textContent = key.toUpperCase() + " · " + card.dataset.title;
      const summary = document.createElement("p");
      summary.textContent = card.dataset.summary;
      const facts = document.createElement("dl");
      for (const [label, value] of [
        ["Year", card.dataset.year], ["Topic", card.dataset.topic], ["Tools", card.dataset.tools],
      ]) {
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = label;
        description.textContent = value;
        facts.append(term, description);
      }
      const link = document.createElement("a");
      link.className = "button outline";
      link.href = card.querySelector(".project-link").getAttribute("href");
      link.textContent = "Open " + heading.textContent;
      item.append(heading, summary, facts, link);
      return item;
    }

    for (const toggle of toggles) {
      const key = toggle.dataset.compareProject;
      toggle.addEventListener("click", () => {
        if (!selected.delete(key)) {
          if (selected.size === 2) {
            status.textContent = "Two projects selected. Remove one to add " + key.toUpperCase() + ".";
            return;
          }
          selected.add(key);
        }
        updateComparison();
      });
    }
    bindDialog(dialog);
    open.addEventListener("click", () => {
      if (selected.size !== 2) return;
      panels.replaceChildren(...Array.from(selected, comparisonPanel));
      showDialog(dialog, open);
    });
    clear.addEventListener("click", () => {
      selected.clear();
      updateComparison();
      search.focus();
    });
    for (const control of all("[data-compare-controls]")) control.hidden = false;
    updateComparison();
  }

  function setupGallery() {
    const gallery = byId("gallery-dialog");
    const photos = all(".story-images img");
    if (typeof gallery?.showModal !== "function" || photos.length === 0) return;
    const galleryImage = byId("gallery-image");
    const galleryCaption = byId("gallery-caption");
    const galleryPosition = byId("gallery-position");
    const galleryButton = document.querySelector("[data-gallery-open]");
    const filmstrip = byId("gallery-filmstrip");
    const thumbnails = [];
    let galleryIndex = 0;

    function showPhoto(index) {
      galleryIndex = (photos.length + index) % photos.length;
      const source = photos[galleryIndex];
      galleryImage.src = source.src;
      galleryImage.alt = source.alt;
      galleryCaption.textContent = source.alt;
      galleryPosition.textContent = "Photo " + (galleryIndex + 1) + " of " + photos.length;
      for (const [i, thumbnail] of thumbnails.entries()) {
        if (i === galleryIndex) thumbnail.setAttribute("aria-current", "true");
        else thumbnail.removeAttribute("aria-current");
      }
    }

    bindDialog(gallery);
    galleryButton.hidden = false;
    galleryButton.addEventListener("click", () => {
      showPhoto(0);
      showDialog(gallery, galleryButton);
    });
    for (const [index, photo] of photos.entries()) {
      const button = document.createElement("button");
      button.className = "gallery-thumb";
      button.type = "button";
      button.setAttribute("aria-label", "Enlarge photo: " + photo.alt);
      button.setAttribute("aria-haspopup", "dialog");
      button.addEventListener("click", () => {
        showPhoto(index);
        showDialog(gallery, button);
      });
      photo.after(button);
      const thumbnail = document.createElement("button");
      thumbnail.type = "button";
      thumbnail.setAttribute("aria-label", "Photo " + (index + 1) + ": " + photo.alt);
      const image = document.createElement("img");
      image.src = photo.src;
      image.alt = "";
      image.loading = "lazy";
      thumbnail.append(image);
      thumbnail.addEventListener("click", () => showPhoto(index));
      filmstrip.append(thumbnail);
      thumbnails.push(thumbnail);
    }
    byId("gallery-previous").addEventListener("click", () => showPhoto(galleryIndex - 1));
    byId("gallery-next").addEventListener("click", () => showPhoto(galleryIndex + 1));
    gallery.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        showPhoto(galleryIndex + (event.key === "ArrowLeft" ? -1 : 1));
      }
    });
  }

  function setupContact() {
    const dialog = byId("copy-dialog");
    if (typeof dialog?.showModal !== "function") return;
    const status = byId("copy-status");
    const value = byId("copy-value");
    bindDialog(dialog);
    for (const button of all("[data-copy]")) {
      button.hidden = false;
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.copy);
          status.textContent = button.dataset.copyLabel + " copied.";
          return;
        } catch {
          // Show the exact text when this browser does not allow copying.
        }
        byId("copy-label").textContent = button.dataset.copyLabel;
        value.value = button.dataset.copy;
        showDialog(dialog, button);
        value.focus();
        value.select();
      });
    }
  }

  setupWork();
  setupGallery();
  setupContact();

  const geometryToggle = document.querySelector("[data-geometry-toggle]");
  if (geometryToggle) {
    const track = document.querySelector(".geometry-track");
    const copy = track.firstElementChild.cloneNode(true);
    copy.querySelector("pattern").id = "hero-dots-repeat";
    copy.querySelector("rect").setAttribute("fill", "url(#hero-dots-repeat)");
    track.append(copy);
    track.dataset.moving = "";
    geometryToggle.hidden = false;
    geometryToggle.addEventListener("click", () => {
      const paused = track.toggleAttribute("data-paused");
      geometryToggle.textContent = paused ? "Resume animation" : "Pause animation";
    });
  }

  const documentButtons = all("button[data-doc]");
  function closeDocument(button) {
    const panel = byId(button.getAttribute("aria-controls"));
    panel.replaceChildren();
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.textContent = button.dataset.closedLabel;
  }
  for (const button of documentButtons) {
    button.hidden = false;
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-expanded") === "true") {
        closeDocument(button);
        return;
      }
      const panel = byId(button.getAttribute("aria-controls"));
      const frame = document.createElement("iframe");
      frame.src = button.dataset.doc;
      frame.title = button.dataset.closedLabel + " on Google Drive";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      panel.replaceChildren(frame);
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      button.textContent = "Close document preview";
    });
  }

  function setupVideo() {
    const videoToggle = document.querySelector("[data-video-toggle]");
    if (!videoToggle) return undefined;
    const videoLabel = document.querySelector("[data-video-label]");
    const videoStatus = byId("video-status");
    const videoScreen = byId("project-player");
    const videoPoster = videoScreen.querySelector("img");
    const onlineVideo = document.querySelector("[data-online-player]");
    const webOrigin = (location.protocol === "https:" || location.protocol === "http:") && window.origin !== "null";
    let frame = null;
    let player = null;
    let playerTimeout = 0;
    let youtubeAPI;

    if (webOrigin) {
      videoToggle.hidden = false;
    } else if (root.dataset.siteUrl) {
      onlineVideo.href = new URL(onlineVideo.dataset.onlinePath, root.dataset.siteUrl).href;
      onlineVideo.hidden = false;
    }

    function reportVideo(message) {
      videoStatus.textContent = message;
      videoStatus.hidden = !message;
    }

    function loadYoutubeAPI() {
      if (window.YT?.Player) return Promise.resolve(window.YT);
      if (youtubeAPI) return youtubeAPI;
      youtubeAPI = new Promise((resolve, reject) => {
        window.onYouTubeIframeAPIReady = () => resolve(window.YT);
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => {
          script.remove();
          youtubeAPI = null;
          reject(new Error("YouTube IFrame API unavailable"));
        };
        document.head.append(script);
      });
      return youtubeAPI;
    }

    function closeVideo() {
      clearTimeout(playerTimeout);
      if (player) {
        try { player.destroy(); } catch { /* The iframe is removed below. */ }
        player = null;
      }
      frame?.remove();
      frame = null;
      videoPoster.hidden = false;
      videoToggle.setAttribute("aria-expanded", "false");
      videoLabel.textContent = "Play project video";
      reportVideo("");
    }

    function openVideo() {
      const current = document.createElement("iframe");
      const url = new URL("https://www.youtube.com/embed/HZ7xnFFFJCU");
      url.search = new URLSearchParams({
        autoplay: "1",
        playsinline: "1",
        rel: "0",
        cc_load_policy: "1",
        enablejsapi: "1",
        origin: location.origin,
      }).toString();
      current.title = "YouTube video: CCT314 GroupProject";
      current.referrerPolicy = "strict-origin-when-cross-origin";
      current.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      current.allowFullscreen = true;
      current.src = url.href;
      frame = current;
      videoPoster.hidden = true;
      videoScreen.append(current);
      videoToggle.setAttribute("aria-expanded", "true");
      videoLabel.textContent = "Close video player";
      reportVideo("Loading the YouTube player…");
      playerTimeout = window.setTimeout(() => {
        if (frame === current) reportVideo("The player is taking longer to load. You can also watch the project video on YouTube.");
      }, 12000);
      loadYoutubeAPI().then((YT) => {
        if (frame !== current) return;
        player = new YT.Player(current, {
          events: {
            onReady() {
              if (frame !== current) return;
              clearTimeout(playerTimeout);
              reportVideo("Use the YouTube controls to play, pause, or select captions when available.");
            },
            onError(event) {
              if (frame !== current) return;
              clearTimeout(playerTimeout);
              const messages = {
                100: "YouTube says this video is unavailable. Try the original YouTube link for more details.",
                101: "YouTube has disabled embedding for this video. Watch the project video on YouTube.",
                150: "YouTube has disabled embedding for this video. Watch the project video on YouTube.",
                153: "YouTube could not verify this page. Watch on YouTube or open the portfolio in its own browser tab.",
              };
              reportVideo(messages[event.data] || "YouTube could not play this video here. You can open the original on YouTube.");
            },
            onAutoplayBlocked() {
              if (frame === current) reportVideo("Press Play in the YouTube player to start the video.");
            },
          },
        });
      }).catch(() => {
        if (frame !== current) return;
        clearTimeout(playerTimeout);
        reportVideo("Use the embedded player or open the original video on YouTube.");
      });
    }

    videoToggle.addEventListener("click", () => {
      if (frame) closeVideo();
      else openVideo();
    });
    return closeVideo;
  }

  const closeVideo = setupVideo();
  const routes = JSON.parse(byId("portfolio-routes").textContent);

  function routeFromHash() {
    const fragment = location.hash.slice(1);
    return Object.hasOwn(routes.aliases, fragment) ? routes.aliases[fragment] : fragment;
  }

  function redirectLegacyLink() {
    const route = routeFromHash();
    if (route !== "home" && Object.hasOwn(routes.paths, route)) {
      const destination = new URL(routes.paths[route], siteBase);
      destination.search = location.search;
      location.replace(destination.href);
    }
  }

  function setupStandaloneNavigation() {
    const views = all("[data-page-view]");
    const pages = new Map(views.map((view) => [view.id, view]));
    const navigation = all("a[data-nav]");
    let active;

    for (const link of all('a[href="#main-content"], a[href="#page-top"]')) {
      link.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        event.preventDefault();
        const target = byId(link.getAttribute("href").slice(1));
        target.scrollIntoView({ block: "start" });
        target.focus({ preventScroll: true });
      });
    }

    function renderRoute(initial = false) {
      const key = routeFromHash();
      const next = pages.get(key) || (key && active) || pages.get("home");
      const previous = active;
      active = next;
      for (const view of views) view.hidden = view !== next;
      if (previous && previous !== next) {
        for (const dialog of all("dialog[open]")) dialog.close();
        if (previous.id === "project-p7") closeVideo?.();
        const openDocument = previous.querySelector('[data-doc][aria-expanded="true"]');
        if (openDocument) closeDocument(openDocument);
      }

      const project = next.id.startsWith("project-");
      const navItem = project ? "work" : next.id;
      root.dataset.route = next.id;
      document.title = next.id === "home" ? "Hanwen Zhang — Portfolio" : next.dataset.title + " — Hanwen Zhang";
      for (const link of navigation) {
        if (link.dataset.nav === navItem) link.setAttribute("aria-current", project ? "location" : "page");
        else link.removeAttribute("aria-current");
      }
      if (key === "glossary") byId("glossary").open = true;
      if ((!initial && next === previous) || (initial && !location.hash)) return;
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        if (!initial) next.querySelector("h1").focus({ preventScroll: true });
      });
    }

    window.addEventListener("hashchange", () => renderRoute());
    renderRoute(true);
  }

  if (root.dataset.siteMode === "standalone") {
    setupStandaloneNavigation();
  } else if (root.dataset.route === "home") {
    window.addEventListener("hashchange", redirectLegacyLink);
    redirectLegacyLink();
  }
})();
