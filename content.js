const style = document.createElement("style");
style.textContent = `
  /* === SHORTS === */
  ytd-rich-shelf-renderer[is-shorts],
  ytd-reel-shelf-renderer,
  ytd-shorts,
  ytd-reel-item-renderer {
    display: none !important;
  }

  /* Shorts in sidebar nav */
  ytd-guide-entry-renderer a[title="Shorts"],
  ytd-mini-guide-entry-renderer a[title="Shorts"] {
    display: none !important;
  }

  /* Shorts in search results */
  ytd-video-renderer:has([overlay-style="SHORTS"]) {
    display: none !important;
  }

  /* Shorts chip/filter button */
  yt-chip-cloud-chip-renderer:has([title="Shorts"]) {
    display: none !important;
  }

  /* === ADS ONLY === */
  #masthead-ad,
  ytd-ad-slot-renderer,
  ytd-banner-promo-renderer,
  .ytd-promoted-sparkles-web-renderer {
    display: none !important;
  }

  /* === HOMEPAGE RECOMMENDATIONS === */
  ytd-browse[page-subtype="home"] ytd-rich-grid-renderer {
    display: none !important;
  }

  /* === MISC === */
  ytd-statement-banner-renderer {
    display: none !important;
  }

  ytd-backstage-post-thread-renderer {
    display: none !important;
  }
`;
document.documentElement.appendChild(style);

// -----------------------------------------------
// REDIRECT: Logo click and Home button click
// -----------------------------------------------
function redirectHomeToSubscriptions() {
  // YouTube logo
  const logo = document.querySelector("a#logo, ytd-logo a, #logo a");

  // Home button in sidebar
  const homeButton = document.querySelector(
    "ytd-guide-entry-renderer a[href='/'], ytd-mini-guide-entry-renderer a[href='/']"
  );

  if (logo && !logo.dataset.redirected) {
    logo.dataset.redirected = "true";
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "https://www.youtube.com/feed/subscriptions";
    });
  }

  if (homeButton && !homeButton.dataset.redirected) {
    homeButton.dataset.redirected = "true";
    homeButton.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "https://www.youtube.com/feed/subscriptions";
    });
  }
}

// -----------------------------------------------
// Also catch SPA navigation via URL changes
// -----------------------------------------------
let lastUrl = location.href;

function checkUrlChange() {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;

    const url = new URL(currentUrl);
    // If YouTube navigated to homepage, redirect to subscriptions
    if (
      url.hostname === "www.youtube.com" &&
      (url.pathname === "/" || url.pathname === "")
    ) {
      window.location.href = "https://www.youtube.com/feed/subscriptions";
    }
  }
}

// -----------------------------------------------
// Hide unwanted elements
// -----------------------------------------------
const HIDE_SELECTORS = [
  "ytd-rich-shelf-renderer[is-shorts]",
  "ytd-reel-shelf-renderer",
  "ytd-shorts",
  "ytd-reel-item-renderer",
  "ytd-guide-entry-renderer a[title='Shorts']",
  "ytd-video-renderer:has([overlay-style='SHORTS'])",
  "#masthead-ad",
  "ytd-ad-slot-renderer",
  "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer",
];

function hideElements() {
  HIDE_SELECTORS.forEach((selector) => {
    try {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.display = "none";
      });
    } catch (e) {
      // Invalid selector, skip
    }
  });
}

// -----------------------------------------------
// MutationObserver — handles SPA dynamic content
// -----------------------------------------------
const observer = new MutationObserver(() => {
  hideElements();
  redirectHomeToSubscriptions();
  checkUrlChange();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// Run on initial load
hideElements();
redirectHomeToSubscriptions();
