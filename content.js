(() => {
  const Y = globalThis.YTDC;
  let settings = { ...Y.DEFAULTS };
  let session = Y.freshSession();
  let eff = Y.effective(settings, session);
  let on = true;
  let daily = { date: Y.dayKey(), seconds: 0, extraMinutes: 0 };
  let host = null;
  let shadow = null;
  let notice = { kind: null };
  let lastHref = location.href;
  let videoBound = null;
  let bootTimer = null;
  let pendingSeconds = 0;
  let lastActiveWrite = 0;
  let observer = null;
  let scanTimer = null;
  const listeners = [];
  const GATE_KINDS = ["quiet", "daily", "timer", "videos", "blocked", "allow"];

  // ambient.js lives in the same isolated world and reads this
  Y.live = {
    get eff() { return eff; },
    get on() { return on; },
    onChange(fn) { listeners.push(fn); }
  };

  document.documentElement.classList.add("ytdc-booting");
  bootTimer = setTimeout(() => document.documentElement.classList.remove("ytdc-booting"), 800);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isWatchPage = () => location.pathname === "/watch";
  const currentVideoId = () => (isWatchPage() ? new URLSearchParams(location.search).get("v") : null);

  /* ---------------- state ---------------- */

  function recompute() {
    eff = Y.effective(settings, session);
    on = Y.isOn(settings);
    applyRoot();
    syncScanner();
    listeners.forEach((fn) => {
      try { fn(); } catch { /* ignore */ }
    });
  }

  function applyRoot() {
    const root = document.documentElement;
    const flag = (name, v) => root.classList.toggle(name, !!v);
    flag("ytdc-on", on);
    flag("ytdc-hide-shorts", on && eff.hideShorts);
    flag("ytdc-hide-home", on && eff.homeMode !== "allow");
    flag("ytdc-hide-related", on && eff.hideRelated);
    flag("ytdc-hide-endcards", on && eff.hideEndCards);
    flag("ytdc-hide-comments", on && !eff.showComments);
    flag("ytdc-hide-chat", on && eff.hideLiveChat);
    flag("ytdc-hide-desc", on && eff.hideDescription);
    flag("ytdc-hide-merch", on && eff.hideMerch);
    flag("ytdc-hide-explore", on && eff.hideExplore);
    flag("ytdc-hide-ads", on && eff.hideAds);
    flag("ytdc-hide-chips", on && eff.hideChips);
    flag("ytdc-hide-bell", on && eff.hideBell);
    flag("ytdc-hide-guide", on && eff.hideGuide);
    flag("ytdc-search-home", on && eff.homeMode !== "allow" && eff.landing === "search");
    root.classList.remove("ytdc-booting");
    if (bootTimer) {
      clearTimeout(bootTimer);
      bootTimer = null;
    }
  }

  async function send(msg) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch {
      return null;
    }
  }

  function persistSession(patch) {
    session = { ...session, ...patch };
    recompute();
    return send({ type: "ytdc:set-session", payload: patch });
  }

  async function loadState() {
    const reply = await send({ type: "ytdc:get-state" });
    if (reply && reply.settings) settings = Y.sanitize(reply.settings);
    if (reply && reply.session) session = { ...Y.freshSession(), ...reply.session };
    if (reply && reply.daily) daily = reply.daily;
    const mins = Number(settings.idleResetMinutes) || 0;
    if (mins > 0 && session.intentLocked && session.lastActive && Date.now() - session.lastActive > mins * 60000) {
      session = Y.freshSession();
      await send({ type: "ytdc:end-session" });
    }
    recompute();
  }

  /* ---------------- UI shell ---------------- */

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
        .layer { position: fixed; inset: 0; z-index: 2147483646; display: none; align-items: center; justify-content: center;
          background: rgba(20,18,15,.72); backdrop-filter: blur(10px) grayscale(.6); }
        #notice { z-index: 2147483647; background: rgba(20,18,15,.84); }
        .layer.show { display: flex; }
        .card { width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; background: #efe8d7; color: #1b1a17;
          border: 1px solid rgba(27,26,23,.3); border-radius: 6px; padding: 26px 24px 20px; box-shadow: 0 24px 80px rgba(0,0,0,.45); }
        .kicker { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #857c6c; margin: 0 0 8px; }
        h1 { font: 700 26px/1.15 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; margin: 0 0 6px; letter-spacing: -.01em; }
        .sub { color: #4a453c; font-size: 13px; line-height: 1.45; margin: 0 0 18px; }
        .choices { display: grid; gap: 8px; }
        button { appearance: none; border: 1px solid rgba(27,26,23,.22); background: #f6f1e4; color: #1b1a17; border-radius: 4px;
          padding: 11px 14px; font-size: 14px; text-align: left; cursor: pointer; }
        button:hover { border-color: #1b1a17; }
        button small { display: block; margin-top: 2px; color: #857c6c; font-size: 12px; }
        button.primary { background: #1b1a17; color: #f6f1e4; border-color: #1b1a17; font-weight: 600; text-align: center; }
        button.primary:hover { background: #33302a; }
        button.center { text-align: center; }
        input[type=text], input[type=number], select { width: 100%; background: #f6f1e4; color: #1b1a17; border: 1px solid rgba(27,26,23,.22);
          border-radius: 4px; padding: 9px 11px; font-size: 13px; }
        input.need { border-color: #a0402c; }
        .note { margin: 0 0 12px; }
        details.tweak { margin-top: 14px; border-top: 1px solid rgba(27,26,23,.15); padding-top: 12px; }
        details.tweak summary { cursor: pointer; color: #4a453c; font-size: 12px; letter-spacing: .04em; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
        .grid label { display: grid; gap: 4px; font-size: 11px; color: #857c6c; letter-spacing: .03em; }
        .timer { position: fixed; z-index: 2147483645; display: none; align-items: center; gap: 8px; background: #efe8d7; color: #1b1a17;
          border: 1px solid rgba(27,26,23,.3); border-radius: 999px; padding: 6px 12px; font-size: 12px; max-width: 70vw; white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,.25); }
        .timer.show { display: flex; }
        .timer.warn { background: #1b1a17; color: #f6e2c8; border-color: #1b1a17; }
        .timer.top-right { top: 12px; right: 12px; } .timer.top-left { top: 12px; left: 12px; }
        .timer.bottom-right { bottom: 12px; right: 12px; } .timer.bottom-left { bottom: 12px; left: 12px; }
      </style>
      <div class="layer" id="intent" role="dialog" aria-label="Choose why you opened YouTube"><div class="card"></div></div>
      <div class="layer" id="notice" role="dialog"><div class="card"></div></div>
      <div class="timer top-right" id="timer" aria-live="polite"></div>
    `;
  }

  function layerEl(id) {
    ensureUi();
    return shadow.getElementById(id);
  }

  function syncPointer() {
    const open = ["intent", "notice"].some((id) => shadow.getElementById(id).classList.contains("show"));
    host.style.pointerEvents = open ? "auto" : "none";
  }

  function pauseVideo() {
    try {
      const v = document.querySelector("video.html5-main-video, #movie_player video");
      if (v && !v.paused) v.pause();
    } catch { /* ignore */ }
  }

  /* ---------------- generic notice card ---------------- */

  function showNotice(kind, spec) {
    const layer = layerEl("notice");
    if (notice.kind === kind && layer.classList.contains("show")) return;
    notice = { kind };
    const card = layer.querySelector(".card");
    card.innerHTML = `
      <p class="kicker">${esc(spec.kicker || "YouTube Declutter")}</p>
      <h1>${esc(spec.title || "")}</h1>
      <p class="sub">${esc(spec.sub || "")}</p>
      <div class="choices"></div>`;
    const choices = card.querySelector(".choices");
    (spec.buttons || []).forEach((b) => {
      const btn = document.createElement("button");
      btn.textContent = b.label;
      btn.className = `${b.primary ? "primary" : ""} center`.trim();
      btn.addEventListener("click", b.run);
      choices.appendChild(btn);
    });
    layer.classList.add("show");
    syncPointer();
    pauseVideo();
  }

  function hideNotice(kind) {
    if (!shadow) return;
    if (kind && notice.kind !== kind) return;
    shadow.getElementById("notice").classList.remove("show");
    notice = { kind: null };
    syncPointer();
  }

  /* ---------------- navigation helpers ---------------- */

  function focusSearch() {
    const input = document.querySelector("input#search, input[name='search_query']");
    if (!input) return;
    input.focus();
    try { input.click(); } catch { /* ignore */ }
  }

  function goLanding(opts = {}) {
    const path = Y.landingPath(eff);
    if (path === null) {
      if (location.pathname !== "/") location.assign(location.origin + "/");
      else if (opts.focusSearch) setTimeout(focusSearch, 400);
      return;
    }
    const target = location.origin + path;
    if (location.href !== target) location.assign(target);
  }

  async function runDone(action, forceOff) {
    let act = action;
    if (forceOff && act === "landing") act = "newtab";
    if (act === "close" || act === "newtab") {
      const reply = await send({ type: "ytdc:done", action: act });
      if (reply && reply.ok) return;
    }
    goLanding();
  }

  async function endSession(forceOff) {
    const act = eff.doneAction;
    const path = Y.landingPath(eff);
    hideNotice();
    session = Y.freshSession();
    await send({ type: "ytdc:end-session" });
    recompute();
    if (act === "landing" && !forceOff) {
      if (path === null) {
        if (location.pathname !== "/") location.assign(location.origin + "/");
      } else {
        location.assign(location.origin + path);
      }
      return;
    }
    runDone(act, forceOff);
  }

  /* ---------------- intent card ---------------- */

  function renderIntent() {
    const card = layerEl("intent").querySelector(".card");
    const modes = settings.modes || [];
    const noteField =
      settings.noteMode === "off"
        ? ""
        : `<div class="note"><input type="text" id="ytdc-note" maxlength="80" placeholder="${settings.noteMode === "required" ? "Why are you here? (required)" : "Why are you here? (optional)"}" /></div>`;
    card.innerHTML = `
      <p class="kicker">YouTube Declutter</p>
      <h1>What are you here for?</h1>
      <p class="sub">Pick how this session runs. Home is gone. When you are done, leave.</p>
      ${noteField}
      <div class="choices">
        ${modes.map((m) => `<button data-mode="${esc(m.id)}">${esc(m.name)}${m.desc ? `<small>${esc(m.desc)}</small>` : ""}</button>`).join("")}
      </div>
      <details class="tweak">
        <summary>Customize this session</summary>
        <div class="grid">
          <label>Timer (minutes)<input type="number" min="0" id="tw-timer" placeholder="mode default" /></label>
          <label>Max videos<input type="number" min="0" id="tw-videos" placeholder="mode default" /></label>
          <label>Related videos<select id="tw-related"><option value="">mode default</option><option value="hide">hide</option><option value="show">show</option></select></label>
          <label>Comments<select id="tw-comments"><option value="">mode default</option><option value="show">show</option><option value="hide">hide</option></select></label>
          <label>Ambient light<select id="tw-ambient"><option value="">mode default</option><option value="on">on</option><option value="off">off</option></select></label>
          <label>Autoplay<select id="tw-autoplay"><option value="">mode default</option><option value="off">off</option><option value="leave">leave alone</option></select></label>
          <label>When a video ends<select id="tw-end"><option value="">mode default</option><option value="prompt">show card</option><option value="done">Done action</option><option value="pause">just stop</option><option value="off">don't interfere</option></select></label>
        </div>
      </details>`;
    card.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => chooseMode(btn.getAttribute("data-mode")));
    });
  }

  function collectTweaks() {
    const val = (id) => shadow.getElementById(id)?.value ?? "";
    const t = {};
    const timer = val("tw-timer");
    if (timer !== "") t.timerMinutes = Number(timer);
    const vids = val("tw-videos");
    if (vids !== "") t.maxVideos = Number(vids);
    if (val("tw-related")) t.hideRelated = val("tw-related") === "hide";
    if (val("tw-comments")) t.showComments = val("tw-comments") === "show";
    if (val("tw-ambient")) t.ambient = val("tw-ambient") === "on";
    if (val("tw-autoplay")) t.disableAutoplay = val("tw-autoplay") === "off";
    if (val("tw-end")) t.endAction = val("tw-end");
    return Y.sanitizeOverrides(t);
  }

  async function startSession(id, tweaks, note, navigate) {
    const probe = Y.effective(settings, { intentLocked: true, intent: id, tweaks });
    const tm = Number(probe.timerMinutes) || 0;
    const vid = currentVideoId();
    await persistSession({
      intentLocked: true,
      intent: id,
      tweaks,
      note,
      timerEndsAt: tm > 0 ? Date.now() + tm * 60000 : null,
      videoIds: vid ? [vid] : [],
      extensions: 0,
      startedAt: Date.now(),
      lastActive: Date.now(),
      quietPass: session.quietPass,
      passes: []
    });
    showIntentLayer(false);
    if (navigate) goLanding({ focusSearch: true });
  }

  function chooseMode(id) {
    const noteEl = shadow.getElementById("ytdc-note");
    const note = noteEl ? noteEl.value.trim() : "";
    if (settings.noteMode === "required" && !note) {
      noteEl.classList.add("need");
      noteEl.focus();
      return;
    }
    startSession(id, collectTweaks(), note, !isWatchPage());
  }

  function showIntentLayer(show) {
    const layer = layerEl("intent");
    const was = layer.classList.contains("show");
    if (show && !was) {
      renderIntent();
      pauseVideo();
    }
    layer.classList.toggle("show", !!show);
    syncPointer();
  }

  function maybeShowIntent() {
    if (!on) {
      showIntentLayer(false);
      return;
    }
    if (!settings.askIntent) {
      showIntentLayer(false);
      if (!session.intentLocked) startSession(settings.defaultMode, {}, "", false);
      return;
    }
    showIntentLayer(!session.intentLocked);
  }

  /* ---------------- watch page ---------------- */

  function disableAutoplay() {
    if (!on || !eff.disableAutoplay) return;
    const btn = document.querySelector(".ytp-autonav-toggle-button");
    if (btn && btn.getAttribute("aria-checked") === "true") btn.click();
    document.querySelectorAll("ytd-compact-autoplay-renderer button[aria-pressed='true']").forEach((el) => el.click());
  }

  function bindVideo() {
    if (!on || !isWatchPage()) return;
    disableAutoplay();
    if (eff.endAction !== "prompt" && eff.endAction !== "done") return;
    const video = document.querySelector("#movie_player video, ytd-player video, video.html5-main-video");
    if (!video || video === videoBound) return;
    if (videoBound) videoBound.removeEventListener("ended", onVideoEnded);
    videoBound = video;
    video.addEventListener("ended", onVideoEnded);
  }

  function onVideoEnded() {
    if (!on || !isWatchPage()) return;
    if (eff.endAction === "done") {
      runDone(eff.doneAction);
      return;
    }
    if (eff.endAction !== "prompt") return;
    showNotice("ended", {
      kicker: "Video finished",
      title: "You are done with this one.",
      sub: "Do not slide into the next recommendation. Choose on purpose.",
      buttons: [
        { label: "Done", primary: true, run: () => { hideNotice("ended"); runDone(eff.doneAction); } },
        { label: "Another from this channel", run: () => { hideNotice("ended"); const u = channelVideosUrl(); if (u) location.assign(u); else goLanding(); } },
        { label: "Back to intent", run: () => backToIntent() }
      ]
    });
  }

  function channelVideosUrl() {
    const owner = document.querySelector(
      "ytd-video-owner-renderer a[href^='/@'], ytd-video-owner-renderer a[href^='/channel/'], ytd-video-owner-renderer a[href^='/c/']"
    );
    const href = owner && owner.getAttribute("href");
    if (!href) return null;
    const clean = href.split("?")[0].replace(/\/+$/, "");
    return `${location.origin}${clean.startsWith("/") ? clean : `/${clean}`}/videos`;
  }

  async function backToIntent() {
    hideNotice();
    session = Y.freshSession();
    await send({ type: "ytdc:end-session" });
    recompute();
    if (settings.askIntent) {
      if (location.pathname !== "/") location.assign(location.origin + "/");
      else maybeShowIntent();
    } else {
      goLanding();
    }
  }

  function watchChannel() {
    const vid = currentVideoId();
    if (!vid) return null;
    const flexy = document.querySelector("ytd-watch-flexy");
    if (!flexy || flexy.getAttribute("video-id") !== vid) return null;
    const a = document.querySelector(
      "ytd-watch-metadata ytd-video-owner-renderer a[href^='/@'], ytd-video-owner-renderer a[href^='/@'], ytd-video-owner-renderer a[href^='/channel/']"
    );
    if (!a) return null;
    const m = (a.getAttribute("href") || "").match(/^\/(@[^/?#]+)/);
    let handle = "";
    try { handle = m ? Y.norm(decodeURIComponent(m[1])) : ""; } catch { handle = m ? Y.norm(m[1]) : ""; }
    const nameEl = document.querySelector("ytd-watch-metadata ytd-channel-name a, ytd-video-owner-renderer ytd-channel-name a");
    const name = Y.norm(nameEl ? nameEl.textContent : "");
    if (!handle && !name) return null;
    return { handle, name, key: handle || name, label: (nameEl && nameEl.textContent.trim()) || handle };
  }

  /* ---------------- gates (limits, quiet hours, channels) ---------------- */

  function trackVideo() {
    if (!on || !session.intentLocked) return;
    const id = currentVideoId();
    if (!id || session.videoIds.includes(id)) return;
    persistSession({ videoIds: [...session.videoIds, id].slice(-300) });
  }

  function extensionsLeft() {
    const max = Number(eff.maxExtensions) || 0;
    if (max === 0) return Infinity;
    return Math.max(0, max - (Number(session.extensions) || 0));
  }

  function limitButtons(label, extendFn) {
    const btns = [{ label: "Done", primary: true, run: () => endSession() }];
    const left = extensionsLeft();
    if (left > 0) {
      const tail = left === Infinity ? "" : ` (${left} left)`;
      btns.push({ label: `${label}${tail}`, run: extendFn });
    }
    return btns;
  }

  function gate(kind, spec) {
    showNotice(kind, spec);
    return true;
  }

  function evaluateGates() {
    const act = eff.limitAction;
    const auto = act === "auto";

    if (Y.inQuietHours(eff) && !session.quietPass) {
      const buttons = [{ label: eff.doneAction === "close" ? "Close tab" : "Leave YouTube", primary: true, run: () => runDone(eff.doneAction, true) }];
      if (eff.quietOverride) buttons.push({ label: "Open anyway (this session)", run: () => { hideNotice("quiet"); persistSession({ quietPass: true }); } });
      return gate("quiet", { kicker: "Quiet hours", title: `YouTube is closed until ${eff.quietEnd}.`, sub: "You set this up when you were thinking clearly.", buttons });
    }

    const dlimit = Number(eff.dailyLimitMinutes) || 0;
    if (dlimit > 0 && daily.seconds / 60 >= dlimit + (Number(daily.extraMinutes) || 0)) {
      const buttons = [{ label: "Done for today", primary: true, run: () => runDone(eff.doneAction, true) }];
      if (!auto && extensionsLeft() > 0) {
        const mins = Number(eff.extendMinutes) || 10;
        buttons.push({
          label: `+${mins} minutes today`,
          run: async () => {
            const r = await send({ type: "ytdc:add-extra", minutes: mins });
            if (r && r.daily) daily = r.daily;
            persistSession({ extensions: (Number(session.extensions) || 0) + 1 });
            hideNotice("daily");
          }
        });
      }
      return gate("daily", { kicker: "Daily limit", title: `That's ${dlimit} minutes today.`, sub: "Tomorrow is also a day.", buttons });
    }

    if (session.intentLocked && session.timerEndsAt && session.timerEndsAt - Date.now() <= 0) {
      if (auto) { endSession(); return true; }
      const mins = Number(eff.extendMinutes) || 10;
      return gate("timer", {
        kicker: "Time is up",
        title: "This session is over.",
        sub: "You set a limit so YouTube would not set one for you.",
        buttons: limitButtons(`+${mins} minutes`, () => {
          hideNotice("timer");
          persistSession({ timerEndsAt: Date.now() + mins * 60000, extensions: (Number(session.extensions) || 0) + 1 });
        })
      });
    }

    const max = Number(eff.maxVideos) || 0;
    if (session.intentLocked && max > 0 && isWatchPage() && session.videoIds.length > max) {
      if (auto) { endSession(); return true; }
      return gate("videos", {
        kicker: "Video limit",
        title: `That's ${max} video${max === 1 ? "" : "s"}.`,
        sub: "You picked this number before you started.",
        buttons: limitButtons("+1 video", () => {
          hideNotice("videos");
          persistSession({ tweaks: { ...session.tweaks, maxVideos: max + 1 }, extensions: (Number(session.extensions) || 0) + 1 });
        })
      });
    }

    if (on && isWatchPage()) {
      const ch = watchChannel();
      if (ch) {
        const blocked = new Set((settings.blockedChannels || []).map(Y.norm));
        if (blocked.has(ch.handle) || blocked.has(ch.name)) {
          return gate("blocked", {
            kicker: "Blocked channel",
            title: `${ch.label || "This channel"} is on your block list.`,
            sub: "Edit the list in the extension options if that is wrong.",
            buttons: [{ label: "Back", primary: true, run: () => { hideNotice("blocked"); goLanding(); } }]
          });
        }
        const allowed = new Set((eff.allowedChannels || []).map(Y.norm));
        if (eff.allowlistOn && allowed.size > 0 && !allowed.has(ch.handle) && !allowed.has(ch.name) && !(session.passes || []).includes(ch.key)) {
          return gate("allow", {
            kicker: "Not on your list",
            title: `${ch.label || "This channel"} is not in this session's allowlist.`,
            sub: "Go back, or allow it for the rest of this session.",
            buttons: [
              { label: "Back", primary: true, run: () => { hideNotice("allow"); goLanding(); } },
              { label: "Allow this channel for this session", run: () => { hideNotice("allow"); persistSession({ passes: [...(session.passes || []), ch.key] }); } }
            ]
          });
        }
      }
    }

    if (GATE_KINDS.includes(notice.kind)) hideNotice();
    return false;
  }

  /* ---------------- timer pill ---------------- */

  function renderPill() {
    const el = layerEl("timer");
    const parts = [];
    let warn = false;
    if (eff.timerShow) {
      if (session.intentLocked && session.note) parts.push(`\u201C${session.note.slice(0, 28)}\u201D`);
      if (session.intentLocked && session.timerEndsAt) {
        const left = session.timerEndsAt - Date.now();
        if (left > 0) {
          const mins = Math.floor(left / 60000);
          const secs = Math.floor((left % 60000) / 1000);
          parts.push(`${mins}:${String(secs).padStart(2, "0")} left`);
          if (left < (Number(eff.timerWarnMinutes) || 0) * 60000) warn = true;
        }
      }
      const max = Number(eff.maxVideos) || 0;
      if (session.intentLocked && max > 0) parts.push(`${Math.min(session.videoIds.length, max)}/${max} videos`);
      const dlimit = Number(eff.dailyLimitMinutes) || 0;
      if (dlimit > 0) {
        const rem = dlimit + (Number(daily.extraMinutes) || 0) - daily.seconds / 60;
        parts.push(`${Math.max(0, Math.ceil(rem))}m today`);
        if (rem < 5) warn = true;
      }
    }
    if (!on || !parts.length) {
      el.classList.remove("show");
      return;
    }
    el.className = `timer ${eff.timerPosition || "top-right"} show${warn ? " warn" : ""}`;
    el.textContent = parts.join(" \u00B7 ");
  }

  /* ---------------- usage counting ---------------- */

  async function flushUsage() {
    if (pendingSeconds <= 0) return;
    const secs = pendingSeconds;
    pendingSeconds = 0;
    const r = await send({ type: "ytdc:add-usage", seconds: secs });
    if (r && r.daily) daily = r.daily;
  }

  function countUsage() {
    if (document.visibilityState !== "visible") return;
    pendingSeconds += 1;
    if (daily.date !== Y.dayKey()) daily = { date: Y.dayKey(), seconds: 0, extraMinutes: 0 };
    daily.seconds += 1;
    if (pendingSeconds >= 10) flushUsage();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushUsage();
  });
  window.addEventListener("pagehide", flushUsage);

  /* ---------------- channel and word filters ---------------- */

  const ITEM_SEL = "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model";

  function filtersActive() {
    return on && ((settings.blockedChannels || []).length || (settings.blockedKeywords || []).length || (eff.allowlistOn && (eff.allowedChannels || []).length));
  }

  function scan() {
    scanTimer = null;
    const active = filtersActive();
    const blocked = new Set((settings.blockedChannels || []).map(Y.norm));
    const words = (settings.blockedKeywords || []).map((w) => w.toLowerCase());
    const allowed = new Set((eff.allowedChannels || []).map(Y.norm));
    const allowOn = eff.allowlistOn && allowed.size > 0;
    document.querySelectorAll(ITEM_SEL).forEach((el) => {
      let hide = false;
      if (active) {
        const chans = [];
        el.querySelectorAll("a[href^='/@'], a[href^='/channel/'], a[href^='/c/'], ytd-channel-name a").forEach((a) => {
          const m = (a.getAttribute("href") || "").match(/^\/(@[^/?#]+)/);
          if (m) {
            try { chans.push(Y.norm(decodeURIComponent(m[1]))); } catch { chans.push(Y.norm(m[1])); }
          }
          const t = Y.norm(a.textContent);
          if (t) chans.push(t);
        });
        if (chans.some((c) => blocked.has(c))) hide = true;
        if (!hide && words.length) {
          const text = (el.textContent || "").toLowerCase();
          if (words.some((w) => text.includes(w))) hide = true;
        }
        if (!hide && allowOn && chans.length && !chans.some((c) => allowed.has(c))) hide = true;
      }
      if (hide) el.setAttribute("data-ytdc-hide", "1");
      else el.removeAttribute("data-ytdc-hide");
    });
  }

  function schedScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(scan, 400);
  }

  function syncScanner() {
    const active = filtersActive();
    if (active && !observer) {
      observer = new MutationObserver(schedScan);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } else if (!active && observer) {
      observer.disconnect();
      observer = null;
    }
    schedScan();
  }

  /* ---------------- page-level behavior ---------------- */

  function rewriteHomeClicks(event) {
    if (!on || eff.homeMode === "allow") return;
    const a = event.target.closest && event.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const isLogo = !!(a.closest("ytd-topbar-logo-renderer, #logo") || a.id === "logo");
    const isHome = href === "/" || href === "https://www.youtube.com/" || href === "https://youtube.com/" || a.getAttribute("title") === "Home";
    const inGuide = !!a.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer");
    if (!isLogo && !(isHome && inGuide)) return;
    event.preventDefault();
    event.stopPropagation();
    goLanding({ focusSearch: true });
  }

  function convertShortsUrl() {
    if (!on || eff.shortsUrl === "allow") return;
    if (!location.pathname.startsWith("/shorts/")) return;
    if (eff.shortsUrl === "block") {
      const path = Y.landingPath(eff);
      location.replace(location.origin + (path || "/"));
      return;
    }
    const id = location.pathname.split("/")[2];
    if (id) location.replace(`${location.origin}/watch?v=${id}${location.search || ""}`);
  }

  function onNavigated() {
    if (location.href === lastHref) {
      bindVideo();
      return;
    }
    lastHref = location.href;
    hideNotice("ended");
    convertShortsUrl();
    maybeShowIntent();
    bindVideo();
    trackVideo();
    schedScan();
    tick();
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

  function tick() {
    countUsage();
    const nowOn = Y.isOn(settings);
    if (nowOn !== on) {
      recompute();
      maybeShowIntent();
    }
    if (!on) {
      hideNotice();
      showIntentLayer(false);
      renderPill();
      return;
    }
    ensureUi();
    trackVideo();
    evaluateGates();
    renderPill();
    const idle = Number(settings.idleResetMinutes) || 0;
    if (idle > 0 && session.intentLocked && document.visibilityState === "visible" && Date.now() - lastActiveWrite > 20000) {
      lastActiveWrite = Date.now();
      persistSession({ lastActive: Date.now() });
    }
  }

  document.addEventListener("click", rewriteHomeClicks, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session") {
      let touched = false;
      for (const key of Object.keys(changes)) {
        if (key in session && changes[key].newValue !== undefined) {
          session[key] = changes[key].newValue;
          touched = true;
        }
      }
      if (touched) {
        recompute();
        maybeShowIntent();
        tick();
      }
      return;
    }
    if (area !== "local") return;
    if (changes.daily && changes.daily.newValue) daily = changes.daily.newValue;
    const patch = {};
    let changed = false;
    for (const key of Object.keys(Y.DEFAULTS)) {
      if (changes[key]) {
        patch[key] = changes[key].newValue;
        changed = true;
      }
    }
    if (!changed) return;
    settings = Y.sanitize({ ...settings, ...patch });
    recompute();
    maybeShowIntent();
    tick();
    bindVideo();
  });

  loadState().then(() => {
    ensureUi();
    convertShortsUrl();
    maybeShowIntent();
    startUrlWatch();
    bindVideo();
    trackVideo();
    tick();
    setInterval(tick, 1000);
    if (on && eff.landing === "search" && eff.homeMode !== "allow" && (location.pathname === "/" || location.pathname === "")) {
      setTimeout(focusSearch, 600);
    }
  });
})();
