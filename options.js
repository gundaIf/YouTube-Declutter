(() => {
  const Y = globalThis.YTDC;
  let settings = Y.sanitize({});
  let usage = { daily: null, history: {} };
  let saveTimer = null;
  const pending = {};

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    [].concat(kids).forEach((c) => c && n.appendChild(c));
    return n;
  };

  /* ---------- saving ---------- */
  function flash() {
    const s = $("#saved");
    s.classList.add("show");
    clearTimeout(flash.t);
    flash.t = setTimeout(() => s.classList.remove("show"), 1200);
  }

  function queueSave(patch) {
    Object.assign(pending, patch);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      const out = { ...pending };
      for (const k of Object.keys(pending)) delete pending[k];
      await chrome.storage.local.set(out);
      flash();
    }, 250);
  }

  /* ---------- generic control ---------- */
  function modeOptions(select, value) {
    select.innerHTML = "";
    settings.modes.forEach((m) => {
      const o = el("option", { value: m.id, text: m.name });
      if (m.id === value) o.selected = true;
      select.appendChild(o);
    });
  }

  // Returns {node, get, set}
  function control(f, value, onChange) {
    const fire = (v) => onChange(Y.coerce(f, v));
    if (f.t === "bool") {
      const input = el("input", { type: "checkbox" });
      input.checked = !!value;
      input.addEventListener("change", () => fire(input.checked));
      return { node: el("label", { class: "switch" }, [input, el("span")]), get: () => input.checked, set: (v) => { input.checked = !!v; }, input };
    }
    if (f.t === "select") {
      const sel = el("select");
      f.options.forEach(([v, l]) => sel.appendChild(el("option", { value: v, text: l })));
      sel.value = value;
      sel.addEventListener("change", () => fire(sel.value));
      return { node: sel, get: () => sel.value, set: (v) => { sel.value = v; }, input: sel };
    }
    if (f.t === "mode") {
      const sel = el("select", { "data-modesel": "1" });
      modeOptions(sel, value);
      sel.addEventListener("change", () => fire(sel.value));
      return { node: sel, get: () => sel.value, set: (v) => { sel.value = v; }, input: sel };
    }
    if (f.t === "number") {
      const input = el("input", { type: "number", min: f.min ?? 0, max: f.max ?? 100000 });
      input.value = value;
      input.addEventListener("change", () => { const v = Y.coerce(f, input.value); input.value = v; fire(v); });
      const wrap = el("div", { class: "ctl" }, [input, f.unit ? el("span", { class: "unit", text: f.unit }) : null]);
      return { node: wrap, get: () => Number(input.value), set: (v) => { input.value = v; }, input };
    }
    if (f.t === "range") {
      const input = el("input", { type: "range", min: f.min, max: f.max });
      const rv = el("span", { class: "rv", text: String(value) });
      input.value = value;
      input.addEventListener("input", () => { rv.textContent = input.value; });
      input.addEventListener("change", () => fire(input.value));
      const wrap = el("div", { class: "ctl" }, [input, rv]);
      return { node: wrap, get: () => Number(input.value), set: (v) => { input.value = v; rv.textContent = v; }, input };
    }
    if (f.t === "time") {
      const input = el("input", { type: "time" });
      input.value = String(value).padStart(5, "0");
      input.addEventListener("change", () => fire(input.value || f.def));
      return { node: input, get: () => input.value, set: (v) => { input.value = v; }, input };
    }
    if (f.t === "list") {
      const ta = el("textarea", { placeholder: f.placeholder || "" });
      ta.value = (value || []).join("\n");
      ta.addEventListener("change", () => fire(ta.value));
      return { node: ta, get: () => Y.coerce(f, ta.value), set: (v) => { ta.value = (v || []).join("\n"); }, input: ta };
    }
    if (f.t === "numlist") {
      const input = el("input", { type: "text", placeholder: f.placeholder || "" });
      input.value = (value || []).join(", ");
      input.addEventListener("change", () => { const v = Y.coerce(f, input.value); input.value = v.join(", "); fire(v); });
      return { node: input, get: () => Y.coerce(f, input.value), set: (v) => { input.value = (v || []).join(", "); }, input };
    }
    const input = el("input", { type: "text", placeholder: f.placeholder || "" });
    input.value = value ?? "";
    input.addEventListener("change", () => fire(input.value));
    return { node: input, get: () => input.value, set: (v) => { input.value = v; }, input };
  }

  function row(f) {
    const c = control(f, settings[f.key], (v) => {
      settings[f.key] = v;
      queueSave({ [f.key]: v });
    });
    const lbl = el("div", { class: "lbl" }, [el("b", { text: f.label }), f.hint ? el("small", { text: f.hint }) : null]);
    const ctl = f.t === "bool" ? el("div", { class: "ctl" }, [c.node]) : f.t === "number" || f.t === "range" ? c.node : el("div", { class: "ctl" }, [c.node]);
    return el("div", { class: "row" }, [lbl, ctl]);
  }

  /* ---------- panes ---------- */
  const PANES = [
    { id: "modes", label: "Session modes" },
    { id: "start", label: "Session start" },
    { id: "home", label: "Home and landing" },
    { id: "limits", label: "Limits and timer" },
    { id: "hide", label: "Hide" },
    { id: "watch", label: "Watching" },
    { id: "ambient", label: "Ambient light" },
    { id: "filters", label: "Channels and words" },
    { id: "control", label: "Control" },
    { id: "usage", label: "Usage" },
    { id: "backup", label: "Backup" }
  ];

  const LEADS = {
    start: "What happens when you open YouTube and no session is running.",
    home: "Home is the algorithm grid. Decide where those clicks go instead.",
    limits: "Timers and caps. Modes can override the timer and video cap per session.",
    hide: "These are the defaults. A mode or a one-off session tweak can override any of them.",
    watch: "How the player and the end of a video behave.",
    ambient: "The live glow behind the player.",
    filters: "Blocked lists apply everywhere. The allowlist is per-mode: turn it on in a mode to run a tight session.",
    control: "Friction for yourself."
  };

  function buildGroupPane(id) {
    const pane = el("section", { class: "pane", id: `pane-${id}`, hidden: "" });
    pane.appendChild(el("h2", { text: Y.GROUPS[id] }));
    pane.appendChild(el("p", { class: "lead", text: LEADS[id] || "" }));
    Y.SCHEMA.filter((f) => f.g === id).forEach((f) => pane.appendChild(row(f)));
    return pane;
  }

  /* ---------- modes ---------- */
  function saveModes() {
    // keep the live mode objects (the editor holds references to them); storage clones on write
    queueSave({ modes: settings.modes });
    document.querySelectorAll("select[data-modesel]").forEach((sel) => modeOptions(sel, settings.defaultMode));
  }

  function overrideRow(mode, f, card) {
    const has = f.key in mode.overrides;
    const start = has ? mode.overrides[f.key] : settings[f.key];
    const box = el("input", { type: "checkbox" });
    box.checked = has;
    const c = control(f, start, (v) => {
      if (box.checked) {
        mode.overrides[f.key] = v;
        saveModes();
      }
    });
    const wrap = el("div", { class: "ov" + (has ? "" : " off") }, [
      box,
      el("div", {}, [el("span", { text: f.label }), el("span", { class: "tag", text: has ? "" : "inherits default" })]),
      f.t === "bool" ? el("div", { class: "ctl" }, [c.node]) : f.t === "number" || f.t === "range" ? c.node : el("div", { class: "ctl" }, [c.node])
    ]);
    box.addEventListener("change", () => {
      wrap.classList.toggle("off", !box.checked);
      wrap.querySelector(".tag").textContent = box.checked ? "" : "inherits default";
      if (box.checked) {
        const v = Y.coerce(f, c.get());
        mode.overrides[f.key] = v;
      } else {
        delete mode.overrides[f.key];
        c.set(settings[f.key]);
      }
      saveModes();
    });
    return wrap;
  }

  function modeCard(mode, idx) {
    const name = el("input", { type: "text", value: mode.name, maxlength: "60", "aria-label": "Mode name" });
    const desc = el("input", { type: "text", value: mode.desc || "", maxlength: "120", placeholder: "One line shown under the name", "aria-label": "Description" });
    name.addEventListener("change", () => { mode.name = name.value || "Untitled"; saveModes(); });
    desc.addEventListener("change", () => { mode.desc = desc.value; saveModes(); });
    const body = el("div", { class: "mode-body", hidden: "" });
    const edit = el("button", { class: "btn", type: "button", text: "Edit" });
    const up = el("button", { class: "btn", type: "button", text: "\u2191", title: "Move up" });
    const down = el("button", { class: "btn", type: "button", text: "\u2193", title: "Move down" });
    const dup = el("button", { class: "btn", type: "button", text: "Copy" });
    const del = el("button", { class: "btn danger", type: "button", text: "Delete" });
    const rebuild = () => { renderModesPane(); };
    edit.addEventListener("click", () => {
      if (body.hidden) {
        body.hidden = false;
        if (!body.childElementCount) fillBody();
        edit.textContent = "Close";
      } else {
        body.hidden = true;
        edit.textContent = "Edit";
      }
    });
    up.addEventListener("click", () => { if (idx > 0) { const m = settings.modes; [m[idx - 1], m[idx]] = [m[idx], m[idx - 1]]; saveModes(); rebuild(); } });
    down.addEventListener("click", () => { const m = settings.modes; if (idx < m.length - 1) { [m[idx + 1], m[idx]] = [m[idx], m[idx + 1]]; saveModes(); rebuild(); } });
    dup.addEventListener("click", () => {
      const copy = JSON.parse(JSON.stringify(mode));
      copy.id = "m_" + Math.random().toString(36).slice(2, 8);
      copy.name = mode.name + " copy";
      settings.modes.splice(idx + 1, 0, copy);
      saveModes();
      rebuild();
    });
    del.addEventListener("click", () => {
      if (settings.modes.length <= 1) return;
      if (!confirm(`Delete "${mode.name}"?`)) return;
      settings.modes.splice(idx, 1);
      if (settings.defaultMode === mode.id) {
        settings.defaultMode = settings.modes[0].id;
        queueSave({ defaultMode: settings.defaultMode });
      }
      saveModes();
      rebuild();
    });

    function fillBody() {
      body.appendChild(el("p", { class: "lead", text: "Tick a setting to override it for this mode. Unticked settings follow your defaults." }));
      const order = ["home", "limits", "hide", "watch", "ambient", "filters"];
      order.forEach((g) => {
        const fields = Y.SCHEMA.filter((f) => f.g === g && f.mode);
        if (!fields.length) return;
        body.appendChild(el("h3", { text: Y.GROUPS[g] }));
        fields.forEach((f) => body.appendChild(overrideRow(mode, f)));
      });
    }

    return el("div", { class: "mode" }, [
      el("div", { class: "mode-head" }, [name, desc, el("div", { class: "mode-actions" }, [edit, up, down, dup, del])]),
      body
    ]);
  }

  function renderModesPane() {
    const pane = $("#pane-modes");
    const wasHidden = pane.hidden;
    pane.innerHTML = "";
    pane.hidden = wasHidden;
    pane.appendChild(el("h2", { text: "Session modes" }));
    pane.appendChild(el("p", { class: "lead", text: "A mode is a bundle of settings. You pick one when a session starts. Make as many as you want." }));
    settings.modes.forEach((m, i) => pane.appendChild(modeCard(m, i)));
    const add = el("button", { class: "btn primary", type: "button", text: "Add mode" });
    add.addEventListener("click", () => {
      settings.modes.push({ id: "m_" + Math.random().toString(36).slice(2, 8), name: "New mode", desc: "", overrides: {} });
      saveModes();
      renderModesPane();
    });
    const reset = el("button", { class: "btn danger", type: "button", text: "Reset modes to defaults" });
    reset.addEventListener("click", () => {
      if (!confirm("Replace all modes with the built-in ones?")) return;
      settings.modes = JSON.parse(JSON.stringify(Y.MODE_DEFAULTS));
      if (!settings.modes.some((m) => m.id === settings.defaultMode)) {
        settings.defaultMode = settings.modes[0].id;
        queueSave({ defaultMode: settings.defaultMode });
      }
      saveModes();
      renderModesPane();
    });
    pane.appendChild(el("div", { class: "bar" }, [add, reset]));
  }

  /* ---------- usage ---------- */
  function fmt(mins) {
    const m = Math.round(mins);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  function renderUsage() {
    const pane = $("#pane-usage");
    pane.innerHTML = "";
    pane.appendChild(el("h2", { text: "Usage" }));
    pane.appendChild(el("p", { class: "lead", text: "Visible YouTube tab time, counted by the extension. Stored only on this machine." }));
    const today = Y.dayKey();
    const hist = { ...(usage.history || {}) };
    if (usage.daily && usage.daily.date === today) hist[today] = usage.daily.seconds;
    const todayMin = (hist[today] || 0) / 60;
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = Y.dayKey(d);
      days.push({ k, label: String(d.getDate()), min: (hist[k] || 0) / 60 });
    }
    const last7 = days.slice(-7).reduce((a, d) => a + d.min, 0);
    const limit = Number(settings.dailyLimitMinutes) || 0;
    pane.appendChild(el("div", { class: "stat" }, [
      el("div", {}, [el("b", { text: fmt(todayMin) }), el("span", { text: limit ? `today of ${fmt(limit)}` : "today" })]),
      el("div", {}, [el("b", { text: fmt(last7 / 7) }), el("span", { text: "daily average, 7 days" })])
    ]));
    const max = Math.max(10, ...days.map((d) => d.min));
    const chart = el("div", { class: "chart" });
    days.forEach((d) => {
      const bar = el("i");
      bar.style.height = `${Math.max(2, Math.round((d.min / max) * 100))}%`;
      chart.appendChild(el("div", { class: "col", title: `${d.k}: ${fmt(d.min)}` }, [d.min >= 1 ? el("em", { text: fmt(d.min) }) : null, bar, el("span", { text: d.label })]));
    });
    pane.appendChild(chart);
    const clear = el("button", { class: "btn danger", type: "button", text: "Clear usage history" });
    clear.addEventListener("click", async () => {
      if (!confirm("Clear all usage history?")) return;
      await chrome.storage.local.set({ history: {}, daily: { date: today, seconds: 0, extraMinutes: 0 } });
    });
    pane.appendChild(el("div", { class: "bar" }, [clear]));
  }

  /* ---------- backup ---------- */
  function renderBackup() {
    const pane = $("#pane-backup");
    pane.innerHTML = "";
    pane.appendChild(el("h2", { text: "Backup" }));
    pane.appendChild(el("p", { class: "lead", text: "Settings and modes as a JSON file. Usage history is not included." }));
    const msg = el("p", { class: "msg" });
    const exp = el("button", { class: "btn primary", type: "button", text: "Export settings" });
    exp.addEventListener("click", () => {
      const data = { ...settings };
      delete data.pausedUntil;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = el("a", { href: URL.createObjectURL(blob), download: "youtube-declutter-settings.json" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      msg.textContent = "Exported.";
    });
    const file = el("input", { type: "file", accept: "application/json,.json", hidden: "" });
    const imp = el("button", { class: "btn", type: "button", text: "Import settings" });
    imp.addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      try {
        const text = await file.files[0].text();
        const clean = Y.sanitize(JSON.parse(text));
        clean.pausedUntil = 0;
        await chrome.storage.local.set(clean);
        msg.textContent = "Imported.";
      } catch {
        msg.textContent = "That file isn't valid settings JSON.";
      }
      file.value = "";
    });
    const reset = el("button", { class: "btn danger", type: "button", text: "Reset everything to defaults" });
    reset.addEventListener("click", async () => {
      if (!confirm("Reset all settings and modes to defaults?")) return;
      await chrome.storage.local.set(Y.sanitize({}));
      msg.textContent = "Reset.";
    });
    pane.appendChild(el("div", { class: "bar" }, [exp, imp, reset, file]));
    pane.appendChild(msg);
    pane.appendChild(el("p", { class: "note", text: "Keyboard shortcuts (toggle on/off, pause 15 minutes, end session) are set at chrome://extensions/shortcuts." }));
  }

  /* ---------- shell ---------- */
  function show(id) {
    document.querySelectorAll("section.pane").forEach((p) => { p.hidden = p.id !== `pane-${id}`; });
    document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.pane === id));
    if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
    if (id === "usage") renderUsage();
  }

  function build() {
    const nav = $("#nav");
    const main = $("#main");
    nav.innerHTML = "";
    main.innerHTML = "";
    PANES.forEach((p) => {
      const b = el("button", { type: "button", "data-pane": p.id, text: p.label });
      b.addEventListener("click", () => show(p.id));
      nav.appendChild(b);
      if (p.id === "modes") main.appendChild(el("section", { class: "pane", id: "pane-modes", hidden: "" }));
      else if (p.id === "usage") main.appendChild(el("section", { class: "pane", id: "pane-usage", hidden: "" }));
      else if (p.id === "backup") main.appendChild(el("section", { class: "pane", id: "pane-backup", hidden: "" }));
      else main.appendChild(buildGroupPane(p.id));
    });
    renderModesPane();
    renderBackup();
    const want = (location.hash || "").slice(1);
    show(PANES.some((p) => p.id === want) ? want : "modes");
  }

  async function load() {
    const stored = await chrome.storage.local.get(null);
    settings = Y.sanitize({ ...Y.DEFAULTS, ...stored });
    usage = { daily: stored.daily || null, history: stored.history || {} };
    build();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const settingsTouched = Object.keys(changes).some((k) => k in Y.DEFAULTS && k !== "pausedUntil" && k !== "enabled");
    if (changes.daily || changes.history) {
      chrome.storage.local.get(["daily", "history"]).then((u) => {
        usage = { daily: u.daily || null, history: u.history || {} };
        const open = document.querySelector("section.pane:not([hidden])");
        if (open && open.id === "pane-usage") renderUsage();
      });
    }
    // Only rebuild for outside changes (import/reset), not our own debounced saves.
    if (settingsTouched && !Object.keys(pending).length && !saveTimer) {
      const keys = Object.keys(changes).filter((k) => k in Y.DEFAULTS);
      const differs = keys.some((k) => JSON.stringify(settings[k]) !== JSON.stringify(changes[k].newValue));
      if (differs) load();
    }
  });

  load();
})();
