# YouTube Declutter

<p align="center">
  <img src="icons/mark.svg" alt="YouTube Declutter — hand-drawn play mark" width="168" height="168" />
</p>

<p align="center"><strong>Use YouTube intentionally.</strong></p>

A small Chrome extension that removes the casino floor and puts a reason at the door. No Home feed. No Shorts. No related-video rabbit hole. Watch what you came for, then stop.

---

## Mark

Hand-drawn YouTube play badge. Marker red on paper white. Wobbly ink outline, white triangle, no wordmark.

That is the toolbar icon, the Chrome extensions tile, and the popup lockup. Vector fallback: [`icons/mark.svg`](icons/mark.svg).

---

## What 1.2 does

1. **Intent session** — First visit in a browser session asks *what are you here for?* Optional 10 / 25 / 45 minute timer.
2. **Never-Home landing** — Logo and Home go to Subscriptions, Search, or Watch Later. The algorithm grid is not a destination.
3. **Hide layer + master toggle** — Shorts (href-based, any language), Playables, Explore/Trending rows, Home grid, layout promos. Toolbar icon turns the whole extension off.
4. **End of video = stop** — Autoplay is turned off. End screens go away. When a video ends: Done, another from this channel, or back to intent.
5. **Focus watch page** — Related rail, merch, end cards gone. Comments and live chat hidden unless you opt back in.

Shorts URLs are rewritten to the normal `/watch` player so a pasted Short does not open the swipe feed.

This does **not** block in-player video ads. It only hides page promo units.

---

## Install in Chrome

Chrome will not load a `.zip`. Unzip it first.

1. Download **YouTube-Declutter-v1.2.0.zip** from [Releases](https://github.com/gundaIf/YouTube-Declutter/releases) — the attached file, not “Source code (zip)”.
2. Unzip it. You should get one folder named `YouTube-Declutter` that contains `manifest.json`.
3. Open `chrome://extensions`.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** → select that `YouTube-Declutter` folder.
6. Pin the extension. Open YouTube. Say why you are there.

Reload after updates: `chrome://extensions` → the refresh icon on the card.

Do not drag the zip onto Chrome. Do not use “Pack extension” unless you know you need a `.crx`.

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
