importScripts("shared.js");
const Y = globalThis.YTDC;

try {
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" }).catch(() => {});
} catch {
  /* older Chrome: content scripts fall back to messaging */
}

async function getSettings() {
  const stored = await chrome.storage.local.get(null);
  return Y.sanitize({ ...Y.DEFAULTS, ...stored });
}

async function getSession() {
  try {
    return { ...Y.freshSession(), ...(await chrome.storage.session.get(null)) };
  } catch {
    return Y.freshSession();
  }
}

async function getDaily() {
  const { daily } = await chrome.storage.local.get({ daily: null });
  const today = Y.dayKey();
  if (daily && daily.date === today) return daily;
  return { date: today, seconds: 0, extraMinutes: 0 };
}

/* ---------- usage tracking (serialized so tabs don't clobber each other) ---------- */
let queue = Promise.resolve();
function enqueue(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

function addUsage(seconds) {
  return enqueue(async () => {
    const daily = await getDaily();
    daily.seconds += Math.max(0, Math.min(120, Number(seconds) || 0));
    const { history } = await chrome.storage.local.get({ history: {} });
    history[daily.date] = daily.seconds;
    const keys = Object.keys(history).sort();
    while (keys.length > 60) delete history[keys.shift()];
    await chrome.storage.local.set({ daily, history });
    return daily;
  });
}

function addExtra(minutes) {
  return enqueue(async () => {
    const daily = await getDaily();
    daily.extraMinutes += Math.max(1, Math.min(240, Number(minutes) || 0));
    await chrome.storage.local.set({ daily });
    return daily;
  });
}

/* ---------- redirects ---------- */
function isYoutubeHome(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "m.youtube.com") return false;
    return (url.pathname.replace(/\/+$/, "") || "/") === "/";
  } catch {
    return false;
  }
}

async function destinationFor(rawUrl) {
  if (!isYoutubeHome(rawUrl)) return null;
  const settings = await getSettings();
  if (!Y.isOn(settings)) return null;
  const session = await getSession();
  if (settings.askIntent && !session.intentLocked) return null; // intent card handles it
  const sess = session.intentLocked ? session : { ...session, intentLocked: true, intent: settings.defaultMode };
  const eff = Y.effective(settings, sess);
  if (eff.homeMode === "allow") return null;
  const path = Y.landingPath(eff);
  if (!path) return null;
  const from = new URL(rawUrl);
  const dest = new URL(path, `${from.protocol}//${from.hostname}`);
  return dest.toString();
}

async function maybeRedirect(tabId, url) {
  const dest = await destinationFor(url);
  if (!dest || dest === url) return;
  try {
    await chrome.tabs.update(tabId, { url: dest });
  } catch {
    /* tab closed */
  }
}

/* ---------- toolbar state ---------- */
async function scheduleResume(pausedUntil) {
  try {
    await chrome.alarms.clear("ytdc-resume");
    const when = Number(pausedUntil) || 0;
    if (when > Date.now()) await chrome.alarms.create("ytdc-resume", { when });
  } catch {
    /* alarms optional */
  }
}

async function syncAction() {
  const settings = await getSettings();
  const on = Y.isOn(settings);
  const paused = !!settings.enabled && !on;
  try {
    await chrome.action.setIcon({
      path: { 16: "icons/icon16.png", 48: "icons/icon48.png", 128: on ? "icons/icon128.png" : "icons/icon128-off.png" }
    });
  } catch {
    /* icons missing */
  }
  await chrome.action.setBadgeBackgroundColor({ color: paused ? "#8a5a1f" : "#8a1f1f" });
  await chrome.action.setBadgeText({ text: on ? "" : paused ? "WAIT" : "OFF" });
  await chrome.action.setTitle({
    title: on ? "YouTube Declutter: on" : paused ? "YouTube Declutter: paused" : "YouTube Declutter: off"
  });
}

async function endSessionEverywhere() {
  try {
    await chrome.storage.session.set(Y.freshSession());
  } catch {
    /* ignore */
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  const toWrite = {};
  for (const [key, value] of Object.entries(Y.DEFAULTS)) {
    if (!(key in current)) toWrite[key] = value;
  }
  if (Object.keys(toWrite).length) await chrome.storage.local.set(toWrite);
  await syncAction();
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await scheduleResume(settings.pausedUntil);
  await syncAction();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.enabled || changes.pausedUntil) syncAction();
  if (changes.pausedUntil) scheduleResume(changes.pausedUntil.newValue);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "ytdc-resume") return;
  await chrome.storage.local.set({ pausedUntil: 0 });
  await syncAction();
});

for (const evt of ["onBeforeNavigate", "onCommitted", "onHistoryStateUpdated"]) {
  chrome.webNavigation[evt].addListener((details) => {
    if (details.frameId !== 0) return;
    maybeRedirect(details.tabId, details.url);
  });
}

/* ---------- keyboard shortcuts (set them at chrome://extensions/shortcuts) ---------- */
chrome.commands?.onCommand.addListener(async (command) => {
  if (command === "toggle-enabled") {
    const s = await getSettings();
    await chrome.storage.local.set({ enabled: !s.enabled, pausedUntil: 0 });
  } else if (command === "pause-15") {
    await chrome.storage.local.set({ enabled: true, pausedUntil: Date.now() + 15 * 60 * 1000 });
  } else if (command === "end-session") {
    await endSessionEverywhere();
  }
});

/* ---------- messages ---------- */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message && message.type;
  if (type === "ytdc:get-state") {
    Promise.all([getSettings(), getSession(), getDaily()]).then(([settings, session, daily]) =>
      sendResponse({ settings, session, daily })
    );
    return true;
  }
  if (type === "ytdc:set-session") {
    chrome.storage.session.set(message.payload || {}).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (type === "ytdc:end-session") {
    endSessionEverywhere().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (type === "ytdc:add-usage") {
    addUsage(message.seconds).then((daily) => sendResponse({ daily }));
    return true;
  }
  if (type === "ytdc:add-extra") {
    addExtra(message.minutes).then((daily) => sendResponse({ daily }));
    return true;
  }
  if (type === "ytdc:sync") {
    getSettings().then(async (settings) => {
      await scheduleResume(settings.pausedUntil);
      await syncAction();
      sendResponse({ ok: true, on: Y.isOn(settings) });
    });
    return true;
  }
  if (type === "ytdc:done") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) return false;
    const act = message.action === "close" ? "close" : "newtab";
    (act === "close" ? chrome.tabs.remove(tabId) : chrome.tabs.update(tabId, { url: "chrome://newtab/" }))
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  return false;
});

syncAction();
