(() => {
  const DEFAULTS = { enabled: true, ambient: true, pausedUntil: 0 };
  let settings = { ...DEFAULTS };
  let bound = null;
  let boundId = "";

  function isOn() {
    if (!settings.enabled || settings.ambient === false) return false;
    const until = Number(settings.pausedUntil) || 0;
    return !until || until <= Date.now();
  }

  function watchPage() {
    return location.pathname === "/watch";
  }

  function videoId() {
    try {
      return new URLSearchParams(location.search).get("v") || "";
    } catch {
      return "";
    }
  }

  function ensure() {
    let host = document.getElementById("ytdc-ambient");
    if (host) return host;
    host = document.createElement("div");
    host.id = "ytdc-ambient";
    host.setAttribute("aria-hidden", "true");
    host.innerHTML = '<video class="ghost" muted playsinline></video><div class="still"></div><div class="veil"></div>';
    document.documentElement.appendChild(host);
    return host;
  }

  function clearGhost(host) {
    const ghost = host.querySelector("video");
    if (!ghost) return;
    try {
      ghost.pause();
    } catch {
      /* ignore */
    }
    ghost.srcObject = null;
    ghost.style.opacity = "0";
  }

  function stop() {
    document.documentElement.classList.remove("ytdc-ambient");
    const host = document.getElementById("ytdc-ambient");
    if (!host) return;
    clearGhost(host);
    bound = null;
  }

  function paintStill(host, id) {
    if (!id || host.dataset.vid === id) return;
    host.dataset.vid = id;
    const still = host.querySelector(".still");
    if (still) {
      still.style.backgroundImage = `url("https://i.ytimg.com/vi/${id}/hqdefault.jpg")`;
    }
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(probe, 0, 0, 8, 8);
        const px = ctx.getImageData(3, 3, 1, 1).data;
        document.documentElement.style.setProperty("--ytdc-wash", `rgb(${px[0]}, ${px[1]}, ${px[2]})`);
      } catch {
        /* thumbnail may be locked; the blur still paints */
      }
    };
    probe.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  function bind(video) {
    const host = ensure();
    const ghost = host.querySelector("video");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !video.captureStream) {
      clearGhost(host);
      bound = video;
      return;
    }
    try {
      const stream = video.captureStream();
      ghost.srcObject = stream;
      ghost.style.opacity = "1";
      ghost.play().catch(() => {
        ghost.style.opacity = "0";
      });
      bound = video;
    } catch {
      clearGhost(host);
      bound = video;
    }
  }

  function tick() {
    if (!isOn() || !watchPage() || document.fullscreenElement) {
      stop();
      return;
    }
    const host = ensure();
    document.documentElement.classList.add("ytdc-ambient");
    const id = videoId();
    if (id && id !== boundId) {
      boundId = id;
      bound = null;
      paintStill(host, id);
    }
    const video = document.querySelector("video.html5-main-video, #movie_player video");
    if (video && video !== bound && video.readyState >= 2) bind(video);
  }

  function load(stored) {
    settings = { ...DEFAULTS, ...stored };
    tick();
  }

  chrome.storage.local.get(DEFAULTS).then(load).catch(() => tick());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled) settings.enabled = changes.enabled.newValue;
    if (changes.ambient) settings.ambient = changes.ambient.newValue;
    if (changes.pausedUntil) settings.pausedUntil = changes.pausedUntil.newValue;
    tick();
  });

  document.addEventListener("yt-navigate-finish", tick);
  window.addEventListener("popstate", tick);
  setInterval(tick, 900);
})();
