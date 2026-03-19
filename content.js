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
  /* Only hides recommendations on the homepage, not watch pages */
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

// Selectors for elements we want to hide via JS
const HIDE_SELECTORS = [
  // Shorts shelf
  "ytd-rich-shelf-renderer[is-shorts]",
  "ytd-reel-shelf-renderer",
  "ytd-shorts",
  "ytd-reel-item-renderer",

  // Shorts in sidebar nav
  "ytd-guide-entry-renderer a[title='Shorts']",

  // Shorts in search results
  "ytd-video-renderer:has([overlay-style='SHORTS'])",

  // Ads
  "#masthead-ad",
  "ytd-ad-slot-renderer",

  // Homepage recommendations only
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

// Watch for dynamic content since YouTube is a SPA
const observer = new MutationObserver(() => {
  hideElements();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

hideElements();
