const DEFAULTS = {
  enabled: true,
  landing: "subscriptions",
  askIntent: true,
  timerMinutes: 0,
  showComments: false,
  stopAtEnd: true
};

const LANDING = {
  subscriptions: "https://www.youtube.com/feed/subscriptions",
  watchlater: "https://www.youtube.com/playlist?list=WL",
  search: null,
  specific: null
};

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function getSession() {
  try {
    return await chrome.storage.session.get({
      intentLocked: false,
      intent: null,
      timerEndsAt: null
    });
  } catch {
    return { intentLocked: false, intent: null, timerEndsAt: null };
  }
}

function isYoutubeHome(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "m.youtube.com") return false;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return false;
  }
}

async function destinationFor(rawUrl) {
  const settings = await getSettings();
  if (!settings.enabled) return null;
  if (!isYoutubeHome(rawUrl)) return null;

  const session = await getSession();
  if (settings.askIntent && !session.intentLocked) return null;

  const intent = session.intentLocked && session.intent ? session.intent : settings.landing;
  const mapped = LANDING[intent];
  if (!mapped) return null;

  const dest = new URL(mapped);
  dest.protocol = new URL(rawUrl).protocol;
  if (new URL(rawUrl).hostname.startsWith("m.")) {
    dest.hostname = "m.youtube.com";
  }
  return dest.toString();
}

async function maybeRedirect(tabId, url) {
  const dest = await destinationFor(url);
  if (!dest) return;
  if (dest === url) return;
  try {
    await chrome.tabs.update(tabId, { url: dest });
  } catch {
    /* tab may have closed */
  }
}

async function syncAction() {
  const { enabled } = await getSettings();
  const icon = enabled ? "icons/icon128.png" : "icons/icon128-off.png";
  try {
    await chrome.action.setIcon({ path: { 16: "icons/icon16.png", 48: "icons/icon48.png", 128: icon } });
  } catch {
    /* icons missing in some load paths */
  }
  await chrome.action.setBadgeBackgroundColor({ color: "#8a1f1f" });
  await chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
  await chrome.action.setTitle({
    title: enabled ? "YouTube Declutter — on" : "YouTube Declutter — off"
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  const toWrite = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!(key in current)) toWrite[key] = value;
  }
  if (Object.keys(toWrite).length) await chrome.storage.local.set(toWrite);
  await syncAction();
});

chrome.runtime.onStartup.addListener(syncAction);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.enabled || changes.landing)) syncAction();
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeRedirect(details.tabId, details.url);
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeRedirect(details.tabId, details.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeRedirect(details.tabId, details.url);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ytdc:get-state") {
    Promise.all([getSettings(), getSession()]).then(([settings, session]) => {
      sendResponse({ settings, session });
    });
    return true;
  }
  if (message?.type === "ytdc:set-session") {
    chrome.storage.session.set(message.payload || {}).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

syncAction();
