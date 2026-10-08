const DEFAULTS = {
  enabled: true,
  landing: "subscriptions",
  askIntent: true,
  timerMinutes: 0,
  showComments: false,
  stopAtEnd: true,
  hideShorts: true,
  hideRelated: true,
  ambient: true,
  ambientSpread: "page",
  pausedUntil: 0
};

const INTENT_LABEL = {
  subscriptions: "Subscriptions",
  search: "Search",
  watchlater: "Watch Later",
  specific: "Something specific"
};

const $ = (id) => document.getElementById(id);
let settings = { ...DEFAULTS };
let session = { intentLocked: false, intent: null, timerEndsAt: null };
let tick = null;

function isPaused(s = settings) {
  return Number(s.pausedUntil) > Date.now();
}

function isOn(s = settings) {
  return !!s.enabled && !isPaused(s);
}

function formatLeft(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function activePauseMinutes() {
  if (!isPaused()) return null;
  const left = settings.pausedUntil - Date.now();
  const mins = [5, 15, 30, 60];
  return mins.reduce((best, n) => {
    const diff = Math.abs(n * 60 * 1000 - left);
    const bestDiff = best == null ? Infinity : Math.abs(best * 60 * 1000 - left);
    return diff < bestDiff ? n : best;
  }, null);
}

function markSeg(id, attr, value) {
  document.querySelectorAll(`#${id} button`).forEach((btn) => {
    btn.classList.toggle("on", btn.getAttribute(attr) === String(value));
  });
}

function renderStatus() {
  const el = $("status");
  const resume = $("resume");
  const line = $("sessionLine");
  document.body.classList.toggle("is-off", !settings.enabled);
  document.body.classList.toggle("is-paused", isPaused());

  if (!settings.enabled) {
    el.textContent = "Off until you turn it back on";
    el.dataset.state = "off";
    resume.hidden = true;
  } else if (isPaused()) {
    el.textContent = `Paused ${formatLeft(settings.pausedUntil - Date.now())}`;
    el.dataset.state = "paused";
    resume.hidden = false;
  } else {
    el.textContent = "On";
    el.dataset.state = "on";
    resume.hidden = true;
  }

  const pauseMins = activePauseMinutes();
  document.querySelectorAll("#pause button").forEach((btn) => {
    btn.classList.toggle("on", pauseMins != null && btn.getAttribute("data-pause") === String(pauseMins));
  });

  if (session.intentLocked && session.intent) {
    const label = INTENT_LABEL[session.intent] || session.intent;
    line.hidden = false;
    line.textContent = `This session: ${label}`;
  } else {
    line.hidden = true;
    line.textContent = "";
  }
}

function paintControls() {
  $("enabled").checked = !!settings.enabled;
  $("askIntent").checked = !!settings.askIntent;
  $("showComments").checked = !!settings.showComments;
  $("stopAtEnd").checked = !!settings.stopAtEnd;
  $("hideShorts").checked = settings.hideShorts !== false;
  $("hideRelated").checked = settings.hideRelated !== false;
  $("ambient").checked = settings.ambient !== false;
  markSeg("landing", "data-landing", settings.landing);
  markSeg("timer", "data-timer", String(settings.timerMinutes ?? 0));
  markSeg("spread", "data-spread", settings.ambientSpread || "page");
  renderStatus();
}

async function save(patch) {
  settings = { ...settings, ...patch };
  await chrome.storage.local.set(patch);
  try {
    await chrome.runtime.sendMessage({ type: "ytdc:sync" });
  } catch {
    /* service worker will catch storage */
  }
  paintControls();
}

async function loadSession() {
  try {
    session = await chrome.storage.session.get({
      intentLocked: false,
      intent: null,
      timerEndsAt: null
    });
  } catch {
    session = { intentLocked: false, intent: null, timerEndsAt: null };
  }
}

async function load() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  settings = { ...DEFAULTS, ...stored };
  await loadSession();
  paintControls();
}

$("enabled").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  const patch = { enabled };
  if (enabled) patch.pausedUntil = 0;
  save(patch);
});

$("askIntent").addEventListener("change", (e) => save({ askIntent: e.target.checked }));
$("showComments").addEventListener("change", (e) => save({ showComments: e.target.checked }));
$("stopAtEnd").addEventListener("change", (e) => save({ stopAtEnd: e.target.checked }));
$("hideShorts").addEventListener("change", (e) => save({ hideShorts: e.target.checked }));
$("hideRelated").addEventListener("change", (e) => save({ hideRelated: e.target.checked }));
$("ambient").addEventListener("change", (e) => save({ ambient: e.target.checked }));

document.querySelectorAll("#spread button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const ambientSpread = btn.getAttribute("data-spread");
    markSeg("spread", "data-spread", ambientSpread);
    save({ ambient: true, ambientSpread });
    $("ambient").checked = true;
  });
});

document.querySelectorAll("#landing button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const landing = btn.getAttribute("data-landing");
    markSeg("landing", "data-landing", landing);
    save({ landing });
  });
});

document.querySelectorAll("#timer button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const timerMinutes = Number(btn.getAttribute("data-timer"));
    markSeg("timer", "data-timer", String(timerMinutes));
    save({ timerMinutes });
  });
});

document.querySelectorAll("#pause button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const minutes = Number(btn.getAttribute("data-pause"));
    $("enabled").checked = true;
    save({ enabled: true, pausedUntil: Date.now() + minutes * 60 * 1000 });
  });
});

$("resume").addEventListener("click", () => {
  save({ pausedUntil: 0 });
});

$("resetSession").addEventListener("click", async () => {
  session = { intentLocked: false, intent: null, timerEndsAt: null };
  try {
    await chrome.storage.session.set(session);
    await chrome.runtime.sendMessage({ type: "ytdc:set-session", payload: session });
  } catch {
    /* ignore */
  }
  renderStatus();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    let touched = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
        touched = true;
      }
    }
    if (touched) paintControls();
  }
  if (area === "session") {
    loadSession().then(renderStatus);
  }
});

load();
tick = setInterval(renderStatus, 1000);
