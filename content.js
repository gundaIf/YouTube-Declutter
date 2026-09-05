(() => {
  const DEFAULTS = {
    enabled: true,
    landing: "subscriptions",
    askIntent: true,
    timerMinutes: 0,
    showComments: false,
    stopAtEnd: true
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

  function applyRoot() {
    const root = document.documentElement;
    root.classList.toggle("ytdc-on", !!settings.enabled);
    root.classList.toggle("ytdc-hide-comments", !settings.showComments);
    root.classList.toggle("ytdc-stop-end", !!settings.stopAtEnd);
    const intent = activeIntent();
    const searchHome = settings.enabled && (intent === "search" || intent === "specific");
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
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: "YouTube Sans", "Roboto", system-ui, sans-serif; }
        .layer {
          position: fixed; inset: 0; z-index: 2147483646;
          display: none; align-items: center; justify-content: center;
          background: rgba(8,8,8,.78);
          backdrop-filter: blur(10px);
        }
        .layer.show { display: flex; }
        .card {
          width: min(440px, calc(100vw - 32px));
          background: #161616;
          color: #f4f0e6;
          border: 1px solid #2a2a2a;
          border-radius: 18px;
          padding: 28px 26px 22px;
          box-shadow: 0 24px 80px rgba(0,0,0,.45);
        }
        .kicker {
          font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
          color: #b7aa8e; margin: 0 0 8px;
        }
        h1 { font-size: 22px; font-weight: 600; margin: 0 0 6px; letter-spacing: -.02em; }
        .sub { color: #9a9a9a; font-size: 13px; line-height: 1.45; margin: 0 0 20px; }
        .choices { display: grid; gap: 8px; }
        button {
          appearance: none; border: 1px solid #2f2f2f; background: #1e1e1e;
          color: #f4f0e6; border-radius: 12px; padding: 12px 14px;
          font-size: 14px; text-align: left; cursor: pointer;
        }
        button:hover { border-color: #b7aa8e; background: #242424; }
        button.primary {
          background: #f2ead8; color: #161616; border-color: #f2ead8; font-weight: 600;
          text-align: center;
        }
        button.primary:hover { filter: brightness(1.04); }
        .row { display: flex; gap: 8px; margin-top: 8px; }
        .row button { flex: 1; text-align: center; }
        .timer {
          position: fixed; top: 12px; right: 12px; z-index: 2147483645;
          display: none; align-items: center; gap: 8px;
          background: #161616; color: #f2ead8; border: 1px solid #2a2a2a;
          border-radius: 999px; padding: 6px 12px; font-size: 12px;
        }
        .timer.show { display: flex; }
        .timer.warn { color: #f0c4a8; border-color: #5a3a28; }
      </style>
      <div class="layer" id="intent" role="dialog" aria-label="Choose why you opened YouTube">
        <div class="card">
          <p class="kicker">YouTube Declutter</p>
          <h1>What are you here for?</h1>
          <p class="sub">Pick a reason. Home is gone. Shorts are gone. When you are done, leave.</p>
          <div class="choices">
            <button data-intent="specific">Watch something specific</button>
            <button data-intent="subscriptions">Browse subscriptions</button>
            <button data-intent="search">Search</button>
            <button data-intent="watchlater">Watch Later</button>
          </div>
        </div>
      </div>
      <div class="layer" id="ended" role="dialog" aria-label="Video finished">
        <div class="card">
          <p class="kicker">Video finished</p>
          <h1>You are done with this one.</h1>
          <p class="sub">Do not slide into the next recommendation. Choose on purpose.</p>
          <div class="choices">
            <button class="primary" data-end="done">Done</button>
            <div class="row">
              <button data-end="channel">Another from this channel</button>
              <button data-end="intent">Back to intent</button>
            </div>
          </div>
        </div>
      </div>
      <div class="layer" id="timesup" role="dialog" aria-label="Session timer ended">
        <div class="card">
          <p class="kicker">Time is up</p>
          <h1>This session is over.</h1>
          <p class="sub">You set a limit so YouTube would not set one for you.</p>
          <div class="choices">
            <button class="primary" data-time="done">Done</button>
            <button data-time="more">+10 minutes</button>
          </div>
        </div>
      </div>
      <div class="timer" id="timer" aria-live="polite"></div>
    `;

    shadow.querySelectorAll("[data-intent]").forEach((btn) => {
      btn.addEventListener("click", () => chooseIntent(btn.getAttribute("data-intent")));
    });
    shadow.querySelectorAll("[data-end]").forEach((btn) => {
      btn.addEventListener("click", () => handleEnd(btn.getAttribute("data-end")));
    });
    shadow.querySelectorAll("[data-time]").forEach((btn) => {
      btn.addEventListener("click", () => handleTimer(btn.getAttribute("data-time")));
    });
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
    try {
      input.click();
    } catch {
      /* ignore */
    }
  }

  function maybeShowIntent() {
    if (!settings.enabled) {
      showLayer("intent", false);
      return;
    }
    if (!settings.askIntent) {
      showLayer("intent", false);
      if (!session.intentLocked) {
        persistSession({
          intentLocked: true,
          intent: settings.landing,
          timerEndsAt:
            settings.timerMinutes > 0 && !session.timerEndsAt
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
    if (!settings.enabled || !settings.stopAtEnd) return;
    const btn = document.querySelector(".ytp-autonav-toggle-button");
    if (btn && btn.getAttribute("aria-checked") === "true") {
      btn.click();
    }
    document.querySelectorAll("ytd-compact-autoplay-renderer button[aria-pressed='true']").forEach((el) => {
      el.click();
    });
  }

  function bindVideo() {
    if (!settings.enabled || !settings.stopAtEnd || !isWatchPage()) return;
    const video = document.querySelector("#movie_player video, ytd-player video, video.html5-main-video");
    if (!video || video === videoBound) return;
    if (videoBound) {
      videoBound.removeEventListener("ended", onVideoEnded);
    }
    videoBound = video;
    video.addEventListener("ended", onVideoEnded);
    disableAutoplay();
  }

  function onVideoEnded() {
    if (!settings.enabled || !settings.stopAtEnd) return;
    if (!isWatchPage()) return;
    showLayer("ended", true);
  }

  function channelVideosUrl() {
    const owner = document.querySelector(
      "ytd-video-owner-renderer a[href^='/@'], ytd-video-owner-renderer a[href^='/channel/'], ytd-video-owner-renderer a[href^='/c/']"
    );
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
      if (url) location.assign(url);
      else location.assign(landingUrl(activeIntent()));
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
    const el = shadow.getElementById("timer");
    if (!settings.enabled || !session.timerEndsAt) {
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
    if (!settings.enabled) return;
    const a = event.target.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const isLogo = !!(a.closest("ytd-topbar-logo-renderer, #logo") || a.id === "logo");
    const isHome =
      href === "/" ||
      href === "https://www.youtube.com/" ||
      href === "https://youtube.com/" ||
      a.getAttribute("title") === "Home";
    const inGuide = !!a.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer");
    if (!isLogo && !(isHome && inGuide)) return;
    event.preventDefault();
    event.stopPropagation();
    const intent = activeIntent();
    goIntent(intent, { focusSearch: intent === "search" || intent === "specific" });
  }

  function convertShortsUrl() {
    if (!settings.enabled) return;
    if (!location.pathname.startsWith("/shorts/")) return;
    const id = location.pathname.split("/")[2];
    if (!id) return;
    const dest = `${location.origin}/watch?v=${id}${location.search || ""}`;
    location.replace(dest);
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
