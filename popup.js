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

const $ = (id) => document.getElementById(id);
let settings = { ...DEFAULTS };

function isPaused(s = settings) {
  return Number(s.pausedUntil) > Date.now();
}

function formatLeft(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function renderStatus() {
  const el = $("status");
  const resume = $("resume");
  if (!settings.enabled) {
    el.textContent = "Off";
    el.dataset.state = "off";
    resume.hidden = true;
    return;
  }
  if (isPaused()) {
    el.textContent = `Paused ${formatLeft(settings.pausedUntil - Date.now())}`;
    el.dataset.state = "paused";
    resume.hidden = false;
    return;
  }
  el.textContent = "On";
  el.dataset.state = "on";
  resume.hidden = true;
}

function markSeg(id, attr, value) {
  document.querySelectorAll(`#${id} button`).forEach((btn) => {
    btn.classList.toggle("on", btn.getAttribute(attr) === String(value));
  });
}

async function save(patch) {
  settings = { ...settings, ...patch };
  await chrome.storage.local.set(patch);
  renderStatus();
}

async function load() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  settings = { ...DEFAULTS, ...stored };
  $("enabled").checked = !!settings.enabled;
  $("askIntent").checked = !!settings.askIntent;
  $("showComments").checked = !!settings.showComments;
  $("stopAtEnd").checked = !!settings.stopAtEnd;
  $("hideShorts").checked = settings.hideShorts !== false;
  $("hideRelated").checked = settings.hideRelated !== false;
  markSeg("landing", "data-landing", settings.landing);
  markSeg("timer", "data-timer", String(settings.timerMinutes ?? 0));
  renderStatus();
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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  let touched = false;
  for (const key of Object.keys(DEFAULTS)) {
    if (changes[key]) {
      settings[key] = changes[key].newValue;
      touched = true;
    }
  }
  if (touched) {
    $("enabled").checked = !!settings.enabled;
    renderStatus();
  }
});

load();
setInterval(renderStatus, 1000);
