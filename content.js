// Selectors for elements we want to hide
const HIDE_SELECTORS = [
  // Shorts shelf on homepage/subscriptions
  "ytd-rich-shelf-renderer[is-shorts]",
  "ytd-reel-shelf-renderer",
  "ytd-shorts",

  // Shorts in sidebar navigation
  "ytd-guide-entry-renderer a[title='Shorts']",
  "#endpoint[title='Shorts']",

  // Shorts chips/filters
  "yt-chip-cloud-chip-renderer:has([title='Shorts'])",

  // Shorts in search results
  "ytd-video-renderer:has([overlay-style='SHORTS'])",
  "ytd-reel-item-renderer",

  // Recommended video sidebar (watch page)
  "#secondary #related",

  // Homepage recommendations (shows when not redirected)
  "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer",

  // "People also watched" / end screen recommendations
  "ytd-watch-next-secondary-results-renderer",

  // Notification preview
  "ytd-popup-container",

  // Masthead ad
  "#masthead-ad",

  // Feed filters bar (optional - comment out if you want to keep it)
  // "ytd-feed-filter-chip-bar-renderer",
];

// Apply hiding via JS as backup to CSS
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

// YouTube is a SPA, so we need to watch for DOM changes
const observer = new MutationObserver(() => {
  hideElements();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// Also run on initial load
hideElements();