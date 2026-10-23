const Y = globalThis.YTDC;
const $ = (id) => document.getElementById(id);
let settings = Y.sanitize({});
let session = Y.freshSession();
let daily = { date: "", seconds: 0, extraMinutes: 0 };
let fricTimer = null;

const isPaused = () => Number(settings.pausedUntil) > Date.now();
const isOn = () => Y.isOn(settings);
const eff = () => Y.effective(settings, session);

function fmtLeft(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function markSeg(id, attr, value) {
  document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle("on", b.getAttribute(attr) === String(value)));
}

/* ---------- friction ---------- */
function cancelFriction() {
  clearInterval(fricTimer);
  fricTimer = null;
  $("friction").hidden = true;
  paint();
}

function withFriction(label, fn) {
  const secs = Number(settings.frictionSeconds) || 0;
  if (secs <= 0) return fn();
  clearInterval(fricTimer);
  let left = secs;
  $("friction").hidden = false;
  $("frictionText").textContent = `${label} in ${left}s`;
  fricTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(fricTimer);
      fricTimer = null;
      $("friction").hidden = true;
      fn();
    } else {
      $("frictionText").textContent = `${label} in ${left}s`;
    }
  }, 1000);
}
$("frictionCancel").addEventListener("click", cancelFriction);

/* ---------- storage ---------- */
async function saveLocal(patch) {
  settings = Y.sanitize({ ...settings, ...patch });
  await chrome.storage.local.set(patch);
  try { await chrome.runtime.sendMessage({ type: "ytdc:sync" }); } catch { /* ignore */ }
  paint();
}

async function saveSession(patch) {
  session = { ...session, ...patch };
  try { await chrome.runtime.sendMessage({ type: "ytdc:set-session", payload: patch }); } catch { /* ignore */ }
  paint();
}

// Quick toggles apply to the running session if there is one, else to the defaults.
function setKey(key, value) {
  if (session.intentLocked) saveSession({ tweaks: { ...session.tweaks, [key]: value } });
  else saveLocal({ [key]: value });
}

async function load() {
  const reply = await chrome.runtime.sendMessage({ type: "ytdc:get-state" }).catch(() => null);
  if (reply) {
    settings = Y.sanitize(reply.settings);
    session = { ...Y.freshSession(), ...reply.session };
    daily = reply.daily || daily;
  }
  buildPause();
  buildModes();
  paint();
}

/* ---------- build ---------- */
function buildPause() {
  const box = $("pause");
  box.innerHTML = "";
  const opts = settings.pauseOptions;
  box.style.gridTemplateColumns = `repeat(${Math.min(4, opts.length)}, 1fr)`;
  opts.forEach((m) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.pause = String(m);
    b.textContent = m >= 60 && m % 60 === 0 ? `${m / 60}h` : `${m}m`;
    b.addEventListener("click", () => withFriction("Pausing", () => saveLocal({ enabled: true, pausedUntil: Date.now() + m * 60000 })));
    box.appendChild(b);
  });
}

function buildModes() {
  const sel = $("modeSelect");
  sel.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = session.intentLocked ? "Switch mode\u2026" : "Start a mode\u2026";
  sel.appendChild(blank);
  settings.modes.forEach((m) => {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.name;
    sel.appendChild(o);
  });
}

/* ---------- paint ---------- */
function paint() {
  const e = eff();
  document.body.classList.toggle("is-off", !settings.enabled);
  document.body.classList.toggle("is-paused", isPaused());
  $("enabled").checked = !!settings.enabled;

  const st = $("status");
  const resume = $("resume");
  if (!settings.enabled) {
    st.textContent = "Off until you turn it back on";
    st.dataset.state = "off";
    resume.hidden = true;
  } else if (isPaused()) {
    st.textContent = `Paused ${fmtLeft(settings.pausedUntil - Date.now())}`;
    st.dataset.state = "paused";
    resume.hidden = false;
  } else {
    st.textContent = "On";
    st.dataset.state = "on";
    resume.hidden = true;
  }

  // session line
  const parts = [];
  if (session.intentLocked) {
    parts.push(e._mode ? e._mode.name : "Session");
    if (session.timerEndsAt) parts.push(session.timerEndsAt > Date.now() ? `${fmtLeft(session.timerEndsAt - Date.now())} left` : "time is up");
    const max = Number(e.maxVideos) || 0;
    if (max > 0) parts.push(`${Math.min(session.videoIds.length, max)}/${max} videos`);
  } else {
    parts.push("No session running");
  }
  const dl = Number(e.dailyLimitMinutes) || 0;
  const usedMin = Math.floor((daily.seconds || 0) / 60);
  parts.push(dl > 0 ? `${usedMin}/${dl + (Number(daily.extraMinutes) || 0)}m today` : `${usedMin}m today`);
  $("sessionLine").textContent = parts.join(" \u00B7 ");
  $("newSession").textContent = session.intentLocked ? "End session" : "New session";

  const pauseMins = (() => {
    if (!isPaused()) return null;
    const left = settings.pausedUntil - Date.now();
    return settings.pauseOptions.reduce((best, n) => (best == null || Math.abs(n * 60000 - left) < Math.abs(best * 60000 - left) ? n : best), null);
  })();
  document.querySelectorAll("#pause button").forEach((b) => b.classList.toggle("on", pauseMins != null && b.dataset.pause === String(pauseMins)));

  $("scope").textContent = session.intentLocked ? "(this session)" : "(defaults)";
  $("scopeTimer").textContent = session.intentLocked ? "(this session)" : "(default mode timer)";
  $("hideShorts").checked = !!e.hideShorts;
  $("hideRelated").checked = !!e.hideRelated;
  $("showComments").checked = !!e.showComments;
  $("disableAutoplay").checked = !!e.disableAutoplay;
  $("ambient").checked = !!e.ambient;
  markSeg("timer", "data-timer", String(Number(e.timerMinutes) || 0));
  if (document.activeElement !== $("modeSelect")) {
    const keep = $("modeSelect").options[0];
    if (keep) keep.textContent = session.intentLocked ? "Switch mode\u2026" : "Start a mode\u2026";
  }
}

/* ---------- events ---------- */
$("enabled").addEventListener("change", (ev) => {
  const enabled = ev.target.checked;
  if (enabled) saveLocal({ enabled: true, pausedUntil: 0 });
  else withFriction("Turning off", () => saveLocal({ enabled: false }));
});

$("resume").addEventListener("click", () => saveLocal({ pausedUntil: 0 }));
$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());

$("newSession").addEventListener("click", async () => {
  session = Y.freshSession();
  try { await chrome.runtime.sendMessage({ type: "ytdc:end-session" }); } catch { /* ignore */ }
  paint();
});

$("modeSelect").addEventListener("change", async (ev) => {
  const id = ev.target.value;
  if (!id) return;
  const probe = Y.effective(settings, { intentLocked: true, intent: id, tweaks: {} });
  const tm = Number(probe.timerMinutes) || 0;
  await saveSession({
    intentLocked: true,
    intent: id,
    tweaks: {},
    timerEndsAt: tm > 0 ? Date.now() + tm * 60000 : null,
    extensions: 0,
    startedAt: session.startedAt || Date.now(),
    lastActive: Date.now()
  });
  ev.target.value = "";
});

[["hideShorts", false], ["hideRelated", false], ["showComments", false], ["disableAutoplay", false], ["ambient", false]].forEach(([key]) => {
  $(key).addEventListener("change", (ev) => setKey(key, ev.target.checked));
});

document.querySelectorAll("#timer button").forEach((b) => {
  b.addEventListener("click", () => {
    const n = Number(b.dataset.timer);
    if (session.intentLocked) {
      saveSession({ tweaks: { ...session.tweaks, timerMinutes: n }, timerEndsAt: n > 0 ? Date.now() + n * 60000 : null });
    } else {
      saveLocal({ timerMinutes: n });
    }
  });
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === "local") {
    const patch = {};
    for (const k of Object.keys(Y.DEFAULTS)) if (changes[k]) patch[k] = changes[k].newValue;
    if (changes.daily && changes.daily.newValue) daily = changes.daily.newValue;
    if (Object.keys(patch).length) {
      settings = Y.sanitize({ ...settings, ...patch });
      if (patch.modes) buildModes();
      if (patch.pauseOptions) buildPause();
    }
    paint();
  }
  if (area === "session") {
    const reply = await chrome.runtime.sendMessage({ type: "ytdc:get-state" }).catch(() => null);
    if (reply) session = { ...Y.freshSession(), ...reply.session };
    buildModes();
    paint();
  }
});

load();
setInterval(paint, 1000);
