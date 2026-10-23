(() => {
  const Y = globalThis.YTDC;
  let canvas = null;
  let ctx = null;
  let video = null;
  let running = false;
  let raf = 0;
  let lastDraw = 0;

  const live = () => Y.live;
  const eff = () => (live() ? live().eff : Y.DEFAULTS);
  const wanted = () => !!(live() && live().on && eff().ambient !== false);
  const watchPage = () => location.pathname === "/watch";

  function ensure() {
    if (canvas && document.documentElement.contains(canvas)) return canvas;
    canvas = document.createElement("canvas");
    canvas.id = "ytdc-glow";
    canvas.width = 48;
    canvas.height = 27;
    canvas.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(canvas);
    ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    return canvas;
  }

  function playerBox() {
    const player = document.querySelector("#movie_player, ytd-player #container, ytd-player");
    if (!player) return null;
    const rect = player.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return null;
    return rect;
  }

  function place() {
    if (!canvas) return;
    const rect = playerBox();
    if (!rect) {
      canvas.style.opacity = "0";
      return;
    }
    const e = eff();
    const page = e.ambientSpread !== "player";
    const spread = page ? 3.1 : 1.65;
    const w = Math.max(rect.width * spread, page ? window.innerWidth * 1.2 : 0);
    const h = Math.max(rect.height * spread, page ? window.innerHeight * 1.25 : 0);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const blur = page ? e.ambientBlur : Math.round(e.ambientBlur * 0.65);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.left = `${cx - w / 2}px`;
    canvas.style.top = `${cy - h / 2}px`;
    canvas.style.opacity = String(Math.max(0, Math.min(1, e.ambientIntensity / 100)));
    canvas.style.filter = `blur(${blur}px) saturate(${e.ambientSaturation / 100}) brightness(${e.ambientBrightness / 100})`;
  }

  function draw(now) {
    if (!ctx || !video || video.readyState < 2) return;
    if (now - lastDraw < 50) return;
    lastDraw = now;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      /* frame not ready */
    }
  }

  function frame(now) {
    if (!running) return;
    place();
    draw(now || performance.now());
    raf = requestAnimationFrame(frame);
  }

  function bindVideo() {
    const next = document.querySelector("video.html5-main-video, #movie_player video");
    if (next) video = next;
  }

  function start() {
    ensure();
    document.documentElement.classList.add("ytdc-ambient");
    canvas.hidden = false;
    bindVideo();
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    document.documentElement.classList.remove("ytdc-ambient");
    if (canvas) canvas.hidden = true;
    video = null;
  }

  function tick() {
    if (!wanted() || !watchPage()) {
      stop();
      return;
    }
    start();
  }

  if (Y.live) Y.live.onChange(tick);
  document.addEventListener("yt-navigate-finish", () => {
    video = null;
    tick();
  });
  window.addEventListener("popstate", tick);
  setInterval(tick, 1000);
})();
