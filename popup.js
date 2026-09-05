const DEFAULTS = {
  enabled: true,
  landing: "subscriptions",
  askIntent: true,
  timerMinutes: 0,
  showComments: false,
  stopAtEnd: true
};

const $ = (id) => document.getElementById(id);

async function load() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  const settings = { ...DEFAULTS, ...stored };
  $("enabled").checked = !!settings.enabled;
  $("askIntent").checked = !!settings.askIntent;
  $("showComments").checked = !!settings.showComments;
  $("stopAtEnd").checked = !!settings.stopAtEnd;
  markSeg("landing", "data-landing", settings.landing);
  markSeg("timer", "data-timer", String(settings.timerMinutes ?? 0));
}

function markSeg(id, attr, value) {
  document.querySelectorAll(`#${id} button`).forEach((btn) => {
    btn.classList.toggle("on", btn.getAttribute(attr) === String(value));
  });
}

async function save(patch) {
  await chrome.storage.local.set(patch);
}

$("enabled").addEventListener("change", (e) => save({ enabled: e.target.checked }));
$("askIntent").addEventListener("change", (e) => save({ askIntent: e.target.checked }));
$("showComments").addEventListener("change", (e) => save({ showComments: e.target.checked }));
$("stopAtEnd").addEventListener("change", (e) => save({ stopAtEnd: e.target.checked }));

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

load();
