(() => {
  const DEFAULTS = {
    enabled: true,
    landing: "subscriptions",
    askIntent: true,
    timerMinutes: 0,
    showComments: false,
    stopAtEnd: true,
    hideShorts: true,
    hideRelated: true,
    pausedUntil: 0
  };

  const LANDING_PATH = {
    subscriptions: "/feed/subscriptions",
    watchlater: "/playlist?list=WL",
    search: "/",
    specific: "/"
  };

  let settings = { ...DEFAULTS };
  let session = { intentLocked: false, intent: null, timerEndsAt: null };
  let host = null;
  let shadow = null;
  let lastHref = location.href;
  let videoBound = null;
  let bootTimer = null;

  document.documentElement.classList.add("ytdc-booting");
  bootTimer = setTimeout(() => document.documentElement.classList.remove("ytdc-booting"), 800);

  function landingUrl(intent) {
    const key = intent || settings.landing || "subscriptions";
    const path = LANDING_PATH[key] || LANDING_PATH.subscriptions;
    return `${location.origin}${path}`;
  }

  function activeIntent() {
    if (session.intentLocked && session.intent) return session.intent;
    return settings.landing;
  }

  function isOn() {
    if (!settings.enabled) return false;
    const until = Number(settings.pausedUntil) || 0;
    return !until || until <= Date.now();
  }

  function applyRoot() {
    const root = document.documentElement;
    const on = isOn();
    root.classList.toggle("ytdc-on", on);
    root.classList.toggle("ytdc-hide-comments", on && !settings.showComments);
    root.classList.toggle("ytdc-hide-shorts", on && settings.hideShorts !== false);
    root.classList.toggle("ytdc-hide-related", on && settings.hideRelated !== false);
    root.classList.toggle("ytdc-stop-end", on && !!settings.stopAtEnd);
    const intent = activeIntent();
    const searchHome = on && (intent === "search" || intent === "specific");
    root.classList.toggle("ytdc-search-home", searchHome);
    root.classList.remove("ytdc-booting");
    if (bootTimer) {
      clearTimeout(bootTimer);
      bootTimer = null;
    }
  }

  async function persistSession(patch) {
    session = { ...session, ...patch };
    try {
      await chrome.runtime.sendMessage({ type: "ytdc:set-session", payload: session });
    } catch {
      try {
        sessionStorage.setItem("ytdc-session", JSON.stringify(session));
      } catch {
        /* ignore */
      }
    }
  }

  async function loadState() {
    try {
      const reply = await chrome.runtime.sendMessage({ type: "ytdc:get-state" });
      if (reply?.settings) settings = { ...DEFAULTS, ...reply.settings };
      if (reply?.session) session = { ...session, ...reply.session };
    } catch {
      try {
        const stored = await chrome.storage.local.get(DEFAULTS);
        settings = { ...DEFAULTS, ...stored };
      } catch {
        settings = { ...DEFAULTS };
      }
      try {
        const raw = sessionStorage.getItem("ytdc-session");
        if (raw) session = { ...session, ...JSON.parse(raw) };
      } catch {
        /* ignore */
      }
    }
    applyRoot();
  }

  function ensureUi() {
    if (host && document.documentElement.contains(host)) return;
    host = document.getElementById("ytdc-root");
    if (!host) {
      host = document.createElement("div");
      host.id = "ytdc-root";
      (document.documentElement || document.body).appendChild(host);
    }
    shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML = "__UI__";
  }

  function showLayer(id, on) {
    ensureUi();
    const layer = shadow.getElementById(id);
    if (!layer) return;
    layer.classList.toggle("show", !!on);
    host.style.pointerEvents = anyLayerOpen() ? "auto" : "none";
  }

  function anyLayerOpen() {
    if (!shadow) return false;
    return ["intent", "ended", "timesup"].some((id) =>
      shadow.getElementById(id)?.classList.contains("show")
    );
  }

  function hideAllLayers() {
    showLayer("intent", false);
    showLayer("ended", false);
    showLayer("timesup", false);
  }

  async function chooseIntent(intent) {
    const timerMinutes = Number(settings.timerMinutes) || 0;
    await persistSession({
      intentLocked: true,
      intent,
      timerEndsAt: timerMinutes > 0 ? Date.now() + timerMinutes * 60 * 1000 : null
    });
    hideAllLayers();
    applyRoot();
    goIntent(intent, { focusSearch: intent === "specific" || intent === "search" });
  }

  function goIntent(intent, opts = {}) {
    const dest = landingUrl(intent);
    const here = location.pathname + location.search;
    const target = dest.replace(location.origin, "");
    if (intent === "search" || intent === "specific") {
      if (location.pathname !== "/" && location.pathname !== "") {
        location.assign(location.origin + "/");
        return;
      }
      if (opts.focusSearch) setTimeout(focusSearch, 400);
      return;
    }
    if (here !== target && location.href !== dest) {
      location.assign(dest);
    }
  }

  function focusSearch() {
    const input = document.querySelector("input#search, input[name='search_query']");
    if (!input) return;
    input.focus();
    try { input.click(); } catch { /* ignore */ }
  }

  function maybeShowIntent() {
    if (!isOn()) {
      showLayer("intent", false);
      return;
    }
    if (!settings.askIntent) {
      showLayer("intent", false);
      if (!session.intentLocked) {
        persistSession({
          intentLocked: true,
          intent: settings.landing,
          timerEndsAt: settings.timerMinutes > 0 && !session.timerEndsAt
            ? Date.now() + settings.timerMinutes * 60 * 1000
            : session.timerEndsAt
        });
      }
      return;
    }
    showLayer("intent", !session.intentLocked);
  }

  function isWatchPage() {
    return location.pathname === "/watch";
  }

  function disableAutoplay() {
    if (!isOn() || !settings.stopAtEnd) return;
    const btn = document.querySelector(".ytp-autonav-toggle-button");
    if (btn && btn.getAttribute("aria-checked") === "true") btn.click();
    document.querySelectorAll("ytd-compact-autoplay-renderer button[aria-pressed='true']").forEach((el) => el.click());
  }

  function bindVideo() {
    if (!isOn() || !settings.stopAtEnd || !isWatchPage()) return;
    const video = document.querySelector("#movie_player video, ytd-player video, video.html5-main-video");
    if (!video || video === videoBound) return;
    if (videoBound) videoBound.removeEventListener("ended", onVideoEnded);
    videoBound = video;
    video.addEventListener("ended", onVideoEnded);
    disableAutoplay();
  }

  function onVideoEnded() {
    if (!isOn() || !settings.stopAtEnd) return;
    if (!isWatchPage()) return;
    showLayer("ended", true);
  }

  function channelVideosUrl() {
    const owner = document.querySelector("ytd-video-owner-renderer a[href^='/@'], ytd-video-owner-renderer a[href^='/channel/'], ytd-video-owner-renderer a[href^='/c/']");
    if (!owner) return null;
    const href = owner.getAttribute("href");
    if (!href) return null;
    const clean = href.split("?")[0].replace(/\/+$/, "");
    return `${location.origin}${clean.startsWith("/") ? clean : `/${clean}`}/videos`;
  }

  function handleEnd(action) {
    showLayer("ended", false);
    if (action === "done") {
      location.assign(landingUrl(activeIntent()));
      return;
    }
    if (action === "channel") {
      const url = channelVideosUrl();
      location.assign(url || landingUrl(activeIntent()));
      return;
    }
    if (action === "intent") {
      persistSession({ intentLocked: false, intent: null }).then(() => {
        applyRoot();
        maybeShowIntent();
        if (settings.askIntent) {
          if (location.pathname !== "/") location.assign(location.origin + "/");
        } else {
          location.assign(landingUrl(settings.landing));
        }
      });
    }
  }

  function handleTimer(action) {
    if (action === "more") {
      persistSession({ timerEndsAt: Date.now() + 10 * 60 * 1000 });
      showLayer("timesup", false);
      tickTimer();
      return;
    }
    showLayer("timesup", false);
    persistSession({ timerEndsAt: null });
    location.assign(landingUrl(activeIntent()));
  }

  function tickTimer() {
    ensureUi();
    if (document.documentElement.classList.contains("ytdc-on") !== isOn()) applyRoot();
    const el = shadow.getElementById("timer");
    if (!el) return;
    if (!isOn() || !session.timerEndsAt) {
      el.classList.remove("show");
      return;
    }
    const left = session.timerEndsAt - Date.now();
    if (left <= 0) {
      el.classList.remove("show");
      showLayer("timesup", true);
      return;
    }
    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    el.textContent = `${mins}:${String(secs).padStart(2, "0")} left`;
    el.classList.add("show");
    el.classList.toggle("warn", left < 60 * 1000);
  }

  function rewriteHomeClicks(event) {
    if (!isOn()) return;
    const a = event.target.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const isLogo = !!(a.closest("ytd-topbar-logo-renderer, #logo") || a.id === "logo");
    const isHome = href === "/" || href === "https://www.youtube.com/" || href === "https://youtube.com/" || a.getAttribute("title") === "Home";
    const inGuide = !!a.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer");
    if (!isLogo && !(isHome && inGuide)) return;
    event.preventDefault();
    event.stopPropagation();
    const intent = activeIntent();
    goIntent(intent, { focusSearch: intent === "search" || intent === "specific" });
  }

  function convertShortsUrl() {
    if (!isOn() || settings.hideShorts === false) return;
    if (!location.pathname.startsWith("/shorts/")) return;
    const id = location.pathname.split("/")[2];
    if (!id) return;
    location.replace(`${location.origin}/watch?v=${id}${location.search || ""}`);
  }

  function onNavigated() {
    if (location.href === lastHref) {
      bindVideo();
      return;
    }
    lastHref = location.href;
    convertShortsUrl();
    applyRoot();
    maybeShowIntent();
    bindVideo();
    tickTimer();
  }

  function startUrlWatch() {
    const fire = () => onNavigated();
    document.addEventListener("yt-navigate-finish", fire);
    document.addEventListener("yt-page-data-updated", fire);
    window.addEventListener("popstate", fire);
    setInterval(() => {
      if (location.href !== lastHref) onNavigated();
      else bindVideo();
    }, 1000);
  }

  document.addEventListener("click", rewriteHomeClicks, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let changed = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
        changed = true;
      }
    }
    if (!changed) return;
    applyRoot();
    maybeShowIntent();
    tickTimer();
    bindVideo();
  });

  loadState().then(() => {
    ensureUi();
    convertShortsUrl();
    applyRoot();
    maybeShowIntent();
    startUrlWatch();
    bindVideo();
    tickTimer();
    setInterval(tickTimer, 1000);
    if ((activeIntent() === "search" || activeIntent() === "specific") && (location.pathname === "/" || location.pathname === "")) {
      setTimeout(focusSearch, 600);
    }
  });
})();
