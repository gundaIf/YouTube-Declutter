# YouTube Declutter

<p align="center">
  <img src="icons/mark.svg" alt="YouTube Declutter, hand-drawn play mark" width="168" height="168" />
</p>

<p align="center"><strong>Use YouTube intentionally.</strong></p>

A small Chrome extension that removes the casino floor and puts a reason at the door. No Home feed. No Shorts. No related-video rabbit hole. Watch what you came for, then stop.

---

## Mark

Hand-drawn YouTube play badge. Marker red on paper white. Wobbly ink outline, white triangle, no wordmark.

That is the toolbar icon, the Chrome extensions tile, and the popup lockup. Vector fallback: [`icons/mark.svg`](icons/mark.svg).

---

## What 1.5.0 does

1. **Intent session.** First visit in a browser session asks *what are you here for?* Optional 10 / 25 / 45 minute timer.
2. **Never-Home landing.** Logo and Home go to Subscriptions, Search, or Watch Later. The algorithm grid is not a destination.
3. **Dashboard.** Click the toolbar icon. Pause 5 / 15 / 30 / 60 minutes, turn the extension off, pick a landing, hide Shorts or related, show comments, or reset the current session.
4. **End of video = stop.** Autoplay is turned off. End screens go away. When a video ends: Done, another from this channel, or back to intent.
5. **Focus watch page.** Related rail, merch, end cards gone. Comments and live chat hidden unless you opt back in.
6. **Ambient light.** A live, blurred copy of the current frame glows behind the player. Fill page spreads it across the masthead and the rail, like a browser ambilight. Around player keeps it tight.

Shorts URLs are rewritten to the normal `/watch` player so a pasted Short does not open the swipe feed.

This does **not** block in-player video ads. It only hides page promo units.

---

## Install in Chrome

Chrome will not load a `.zip`. Unzip it first.

1. Download **YouTube-Declutter-v1.5.0.zip** from [Releases](https://github.com/gundaIf/YouTube-Declutter/releases), the attached file, not "Source code (zip)".
2. Unzip it. You should get one folder named `YouTube-Declutter` that contains `manifest.json`.
3. Open `chrome://extensions`.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** → select that `YouTube-Declutter` folder.
6. Pin the extension. Click the icon for the dashboard. Open YouTube. Say why you are there.

Reload after updates: `chrome://extensions` → the refresh icon on the card.

Do not drag the zip onto Chrome. Do not use “Pack extension” unless you know you need a `.crx`.

---

Click the toolbar icon for the dashboard. Pause 5 / 15 / 30 / 60 minutes, or flip the switch to turn it off until you turn it back on.

## Defaults

| Setting | Default |
|---|---|
| Extension | On |
| Pause | Off |
| Ask intent each session | On |
| Landing | Subscriptions |
| Timer | Off |
| Hide Shorts | On |
| Hide related | On |
| Stop when a video ends | On |
| Ambient light | On, fill page |
| Comments | Hidden |

Nothing leaves your machine. Settings live in `chrome.storage.local`. Session intent lives in `chrome.storage.session`.

---

## Permissions

- `storage`: settings and the current session
- `webNavigation` + `tabs`: catch Home and send you to your landing
- `alarms`: wake the extension when a pause ends
- `youtube.com` host: content script and CSS

---

## Files

```
manifest.json
background.js    # redirect + toolbar icon + pause alarm
content.js       # intent, timer, watch-page, Shorts rewrite
styles.css       # hide layer
popup.html/.css/.js
ambient.js         # live frame glow
icons/             # hand-drawn play mark
```

Vanilla JS. No build step. No analytics.

---

## License

MIT. See `LICENSE`.
