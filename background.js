chrome.webNavigation.onCommitted.addListener((details) => {
  const url = new URL(details.url);

  const isHomepage =
    url.hostname === "www.youtube.com" &&
    (url.pathname === "/" || url.pathname === "") &&
    details.frameId === 0;

  if (isHomepage) {
    chrome.tabs.update(details.tabId, {
      url: "https://www.youtube.com/feed/subscriptions",
    });
  }
});
