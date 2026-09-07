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
    shadow.innerHTML = document.getElementById("ytdc-template") ? "" : shadow.innerHTML;
  }
})();
