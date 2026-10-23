/* Shared schema, defaults and helpers. Loaded in the service worker, content scripts, popup and options page. */
(() => {
  const POSITIONS = ["top-right", "top-left", "bottom-right", "bottom-left"];

  // mode:true means a session mode (or a one-off session tweak) may override it.
  const SCHEMA = [
    // ---- Session start
    { g: "start", key: "askIntent", t: "bool", def: true, label: "Ask what I'm here for when a session starts", hint: "Shows the mode picker. Off = silently start the default mode." },
    { g: "start", key: "defaultMode", t: "mode", def: "subscriptions", label: "Default mode", hint: "Used when the picker is off." },
    { g: "start", key: "noteMode", t: "select", def: "off", label: "Reason note", options: [["off", "Don't ask"], ["optional", "Ask, optional"], ["required", "Required"]], hint: "Type one line on why you're here. Shown in the timer pill." },
    { g: "start", key: "idleResetMinutes", t: "number", def: 0, min: 0, max: 1440, unit: "min", label: "Start a new session after being away", hint: "0 = a session lasts until the browser closes." },

    // ---- Home & landing
    { g: "home", key: "homeMode", t: "select", def: "landing", label: "YouTube Home", options: [["landing", "Send me to my landing page"], ["allow", "Leave Home alone"]] },
    { g: "home", key: "landing", t: "select", def: "subscriptions", mode: true, label: "Landing page", options: [["subscriptions", "Subscriptions"], ["watchlater", "Watch Later"], ["history", "History"], ["search", "Search (Home with the feed hidden)"], ["custom", "Custom URL"]] },
    { g: "home", key: "landingUrl", t: "text", def: "", mode: true, label: "Custom landing URL", placeholder: "https://www.youtube.com/playlist?list=...", hint: "Only used when landing is Custom. Must be a youtube.com link." },

    // ---- Limits
    { g: "limits", key: "timerMinutes", t: "number", def: 0, min: 0, max: 1440, unit: "min", mode: true, label: "Session timer", hint: "0 = no timer." },
    { g: "limits", key: "maxVideos", t: "number", def: 0, min: 0, max: 500, unit: "videos", mode: true, label: "Max videos per session", hint: "0 = no cap. Opening one more than this triggers the limit." },
    { g: "limits", key: "dailyLimitMinutes", t: "number", def: 0, min: 0, max: 1440, unit: "min", label: "Daily limit", hint: "Total visible YouTube time per day. 0 = off." },
    { g: "limits", key: "limitAction", t: "select", def: "prompt", label: "When a limit is hit", options: [["prompt", "Show a card (Done or extend)"], ["auto", "Just end it, no card"]] },
    { g: "limits", key: "doneAction", t: "select", def: "landing", label: "\"Done\" does this", options: [["landing", "Go to landing page"], ["newtab", "Go to a new tab page"], ["close", "Close the tab"]] },
    { g: "limits", key: "extendMinutes", t: "number", def: 10, min: 1, max: 240, unit: "min", label: "Extension length" },
    { g: "limits", key: "maxExtensions", t: "number", def: 0, min: 0, max: 50, label: "Max extensions per session", hint: "0 = unlimited. Set 1 or 2 if you want it to bite." },
    { g: "limits", key: "timerWarnMinutes", t: "number", def: 1, min: 0, max: 60, unit: "min", label: "Warn when this much time is left", hint: "Pill turns amber." },
    { g: "limits", key: "timerShow", t: "bool", def: true, label: "Show the timer pill" },
    { g: "limits", key: "timerPosition", t: "select", def: "top-right", options: POSITIONS.map((p) => [p, p.replace("-", " ")]), label: "Pill position" },
    { g: "limits", key: "quietOn", t: "bool", def: false, label: "Quiet hours: YouTube is closed" },
    { g: "limits", key: "quietStart", t: "time", def: "22:00", label: "Quiet from" },
    { g: "limits", key: "quietEnd", t: "time", def: "07:00", label: "Quiet until" },
    { g: "limits", key: "quietOverride", t: "bool", def: true, label: "Let me open it anyway", hint: "Off = the only button is Close tab." },

    // ---- Hide
    { g: "hide", key: "hideShorts", t: "bool", def: true, mode: true, label: "Shorts (shelves, tabs, results)" },
    { g: "hide", key: "hideRelated", t: "bool", def: true, mode: true, label: "Related / up-next rail" },
    { g: "hide", key: "hideEndCards", t: "bool", def: true, mode: true, label: "End cards and pause overlay" },
    { g: "hide", key: "showComments", t: "bool", def: false, mode: true, label: "Show comments (off = hidden)" },
    { g: "hide", key: "hideLiveChat", t: "bool", def: true, mode: true, label: "Live chat" },
    { g: "hide", key: "hideDescription", t: "bool", def: false, mode: true, label: "Description box" },
    { g: "hide", key: "hideMerch", t: "bool", def: true, mode: true, label: "Merch and ticket shelves" },
    { g: "hide", key: "hideExplore", t: "bool", def: true, mode: true, label: "Trending, Gaming, Playables, Explore links" },
    { g: "hide", key: "hideAds", t: "bool", def: true, mode: true, label: "Page promo units (not in-video ads)" },
    { g: "hide", key: "hideChips", t: "bool", def: false, mode: true, label: "Filter chips bar" },
    { g: "hide", key: "hideBell", t: "bool", def: false, mode: true, label: "Notification bell" },
    { g: "hide", key: "hideGuide", t: "bool", def: false, mode: true, label: "Whole left sidebar" },

    // ---- Watching
    { g: "watch", key: "shortsUrl", t: "select", def: "rewrite", mode: true, label: "Opening a Shorts link", options: [["rewrite", "Open in the normal player"], ["block", "Send me to landing"], ["allow", "Leave it alone"]] },
    { g: "watch", key: "disableAutoplay", t: "bool", def: true, mode: true, label: "Turn autoplay off" },
    { g: "watch", key: "endAction", t: "select", def: "prompt", mode: true, label: "When a video ends", options: [["prompt", "Show a card (Done / same channel / new intent)"], ["done", "Do the Done action"], ["pause", "Just stop"], ["off", "Don't interfere"]] },

    // ---- Ambient
    { g: "ambient", key: "ambient", t: "bool", def: true, mode: true, label: "Ambient light behind the player" },
    { g: "ambient", key: "ambientSpread", t: "select", def: "page", mode: true, label: "Spread", options: [["page", "Fill page"], ["player", "Around player"]] },
    { g: "ambient", key: "ambientIntensity", t: "range", def: 90, min: 0, max: 100, mode: true, label: "Intensity" },
    { g: "ambient", key: "ambientBlur", t: "range", def: 72, min: 10, max: 140, mode: true, label: "Blur" },
    { g: "ambient", key: "ambientSaturation", t: "range", def: 170, min: 50, max: 250, mode: true, label: "Saturation" },
    { g: "ambient", key: "ambientBrightness", t: "range", def: 78, min: 30, max: 130, mode: true, label: "Brightness" },

    // ---- Filters
    { g: "filters", key: "blockedChannels", t: "list", def: [], label: "Blocked channels", placeholder: "@handle or channel name, one per line", hint: "Hidden from feeds and results. Their videos show a block card." },
    { g: "filters", key: "blockedKeywords", t: "list", def: [], label: "Blocked words", placeholder: "one per line", hint: "Any video whose title or channel contains one of these is hidden from lists." },
    { g: "filters", key: "allowlistOn", t: "bool", def: false, mode: true, label: "Allowlist only" },
    { g: "filters", key: "allowedChannels", t: "list", def: [], mode: true, label: "Allowed channels", placeholder: "@handle or channel name, one per line", hint: "With allowlist on, other channels are hidden in lists and blocked on the watch page." },

    // ---- Control
    { g: "control", key: "frictionSeconds", t: "number", def: 0, min: 0, max: 120, unit: "sec", label: "Wait before turning off or pausing", hint: "Popup shows a countdown you can cancel. A speed bump, not a lock." },
    { g: "control", key: "pauseOptions", t: "numlist", def: [5, 15, 30, 60], label: "Pause buttons (minutes)", placeholder: "5, 15, 30, 60" }
  ];

  const GROUPS = {
    start: "Session start",
    home: "Home and landing",
    limits: "Limits and timer",
    hide: "Hide",
    watch: "Watching",
    ambient: "Ambient light",
    filters: "Channel and word filters",
    control: "Control"
  };

  const MODE_KEYS = SCHEMA.filter((f) => f.mode).map((f) => f.key);
  const BY_KEY = Object.fromEntries(SCHEMA.map((f) => [f.key, f]));

  const MODE_DEFAULTS = [
    { id: "specific", name: "Watch something specific", desc: "Search, watch, leave.", overrides: { landing: "search", hideRelated: true } },
    { id: "subscriptions", name: "Catch up on subscriptions", desc: "25 minutes, no rabbit hole.", overrides: { landing: "subscriptions", timerMinutes: 25 } },
    { id: "search", name: "Search", desc: "Home is just a search box.", overrides: { landing: "search" } },
    { id: "watchlater", name: "Watch Later", desc: "Work through the queue.", overrides: { landing: "watchlater" } },
    { id: "learn", name: "Learn something", desc: "45 minutes, comments on, no glow.", overrides: { landing: "search", timerMinutes: 45, showComments: true, ambient: false } },
    { id: "chill", name: "Chill / background", desc: "Autoplay allowed, no prompts at the end.", overrides: { landing: "watchlater", disableAutoplay: false, endAction: "off" } }
  ];

  const DEFAULTS = (() => {
    const d = {
      enabled: true,
      pausedUntil: 0,
      modes: JSON.parse(JSON.stringify(MODE_DEFAULTS))
    };
    for (const f of SCHEMA) d[f.key] = Array.isArray(f.def) ? f.def.slice() : f.def;
    return d;
  })();

  function freshSession() {
    return {
      intentLocked: false,
      intent: null,
      tweaks: {},
      note: "",
      timerEndsAt: null,
      videoIds: [],
      extensions: 0,
      startedAt: 0,
      lastActive: 0,
      quietPass: false,
      passes: []
    };
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function coerce(f, v) {
    switch (f.t) {
      case "bool":
        return !!v;
      case "number":
      case "range": {
        const n = Number(v);
        if (!Number.isFinite(n)) return f.def;
        return clamp(Math.round(n), f.min ?? 0, f.max ?? 100000);
      }
      case "select": {
        const ok = (f.options || []).some((o) => o[0] === v);
        return ok ? v : f.def;
      }
      case "time":
        return /^\d{1,2}:\d{2}$/.test(String(v)) ? String(v) : f.def;
      case "text":
        return String(v ?? "").slice(0, 500);
      case "mode":
        return String(v || f.def);
      case "list": {
        const arr = Array.isArray(v) ? v : String(v ?? "").split(/\r?\n/);
        return arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 500);
      }
      case "numlist": {
        const arr = Array.isArray(v) ? v : String(v ?? "").split(/[\s,]+/);
        const out = arr.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 1440).map(Math.round);
        return out.length ? [...new Set(out)].slice(0, 8) : f.def.slice();
      }
      default:
        return v;
    }
  }

  function sanitizeOverrides(o) {
    const out = {};
    if (!o || typeof o !== "object") return out;
    for (const k of MODE_KEYS) {
      if (k in o) out[k] = coerce(BY_KEY[k], o[k]);
    }
    return out;
  }

  function sanitizeModes(modes) {
    if (!Array.isArray(modes)) return JSON.parse(JSON.stringify(MODE_DEFAULTS));
    const seen = new Set();
    const out = [];
    for (const m of modes) {
      if (!m || typeof m !== "object") continue;
      let id = String(m.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
      if (!id || seen.has(id)) id = "m_" + Math.random().toString(36).slice(2, 8);
      seen.add(id);
      out.push({
        id,
        name: String(m.name || "Untitled").slice(0, 60),
        desc: String(m.desc || "").slice(0, 120),
        overrides: sanitizeOverrides(m.overrides)
      });
    }
    return out.length ? out.slice(0, 20) : JSON.parse(JSON.stringify(MODE_DEFAULTS));
  }

  // Validate a whole settings object (used on import and before saving from the options page).
  function sanitize(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (f.key in src) out[f.key] = coerce(f, src[f.key]);
    }
    out.enabled = "enabled" in src ? !!src.enabled : true;
    out.pausedUntil = Number(src.pausedUntil) || 0;
    out.modes = sanitizeModes(src.modes);
    if (!out.modes.some((m) => m.id === out.defaultMode)) out.defaultMode = out.modes[0].id;
    return out;
  }

  // Base settings, then the session's mode, then one-off tweaks.
  function effective(settings, session) {
    const s = { ...DEFAULTS, ...(settings || {}) };
    const out = { ...s };
    out._mode = null;
    if (session && session.intentLocked) {
      const mode = (s.modes || []).find((m) => m.id === session.intent) || null;
      out._mode = mode;
      if (mode) Object.assign(out, sanitizeOverrides(mode.overrides));
      if (session.tweaks) Object.assign(out, sanitizeOverrides(session.tweaks));
    }
    return out;
  }

  function isOn(settings, now = Date.now()) {
    if (!settings || !settings.enabled) return false;
    const until = Number(settings.pausedUntil) || 0;
    return !until || until <= now;
  }

  // Returns a path like "/feed/subscriptions", or null meaning "stay on Home, feed hidden, focus search".
  function landingPath(eff) {
    switch (eff.landing) {
      case "watchlater":
        return "/playlist?list=WL";
      case "history":
        return "/feed/history";
      case "search":
        return null;
      case "custom": {
        try {
          const u = new URL(String(eff.landingUrl || "").trim(), "https://www.youtube.com");
          const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
          if (host === "youtube.com") return u.pathname + u.search;
        } catch {
          /* fall through */
        }
        return "/feed/subscriptions";
      }
      default:
        return "/feed/subscriptions";
    }
  }

  function dayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function minutesOfDay(hhmm) {
    const [h, m] = String(hhmm).split(":").map(Number);
    return (clamp(h || 0, 0, 23) * 60) + clamp(m || 0, 0, 59);
  }

  function inQuietHours(eff, d = new Date()) {
    if (!eff.quietOn) return false;
    const s = minutesOfDay(eff.quietStart);
    const e = minutesOfDay(eff.quietEnd);
    const n = d.getHours() * 60 + d.getMinutes();
    if (s === e) return false;
    return s < e ? n >= s && n < e : n >= s || n < e;
  }

  function norm(s) {
    return String(s || "").toLowerCase().replace(/^@/, "").replace(/\s+/g, " ").trim();
  }

  globalThis.YTDC = Object.assign(globalThis.YTDC || {}, {
    SCHEMA, GROUPS, MODE_KEYS, BY_KEY, MODE_DEFAULTS, DEFAULTS,
    freshSession, sanitize, sanitizeModes, sanitizeOverrides, coerce,
    effective, isOn, landingPath, dayKey, inQuietHours, norm, minutesOfDay
  });
})();
