# YouTube Declutter

<img src="icons/mark.svg" alt="YouTube Declutter mark" width="96" height="96" />

**Use YouTube intentionally.**

A small Chrome extension that removes the casino floor and puts a reason at the door. No Home feed. No Shorts. No related-video rabbit hole. Watch what you came for, then stop.

---

## What 1.1 does

1. **Intent session** — First visit in a browser session asks *what are you here for?* Optional 10 / 25 / 45 minute timer.
2. **Never-Home landing** — Logo and Home go to Subscriptions, Search, or Watch Later. The algorithm grid is not a destination.
3. **Hide layer + master toggle** — Shorts (href-based, any language), Playables, Explore/Trending rows, Home grid, layout promos. Toolbar icon turns the whole extension off.
4. **End of video = stop** — Autoplay is turned off. End screens go away. When a video ends: Done, another from this channel, or back to intent.
5. **Focus watch page** — Related rail, merch, end cards gone. Comments and live chat hidden unless you opt back in.

Shorts URLs are rewritten to the normal `/watch` player so a pasted Short does not open the swipe feed.

This does **not** block in-player video ads. It only hides page promo units.

---

## Install (Load unpacked)

1. Download the latest source ZIP from [Releases](https://github.com/gundaIf/YouTube-Declutter/releases), or clone this repo.
2. Unzip if needed. You want the folder that contains `manifest.json`.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. **Load unpacked** → select that folder.
6. Open YouTube. Choose why you are there.

Reload the extension after updates (`chrome://extensions` → refresh icon on the card).

---

## Defaults

| Setting | Default |
|---|---|
| Extension | On |
| Ask intent each session | On |
| Landing | Subscriptions |
| Timer | Off |
| Stop when a video ends | On |
| Comments | Hidden |

Nothing leaves your machine. Settings live in `chrome.storage.local`. Session intent lives in `chrome.storage.session`.

---

## Permissions

- `storage` — settings and the current session
- `webNavigation` + `tabs` — catch Home and send you to your landing
- `youtube.com` host — content script and CSS

---

## Files

```
manifest.json
background.js    # redirect + toolbar icon
content.js       # intent, timer, watch-page, Shorts rewrite
styles.css       # hide layer
popup.html/.css/.js
icons/             # hand-drawn play mark
```

Vanilla JS. No build step. No analytics.

---

## License

MIT. See `LICENSE`.
