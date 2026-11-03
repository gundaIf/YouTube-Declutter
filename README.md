# YouTube Declutter

<p align="center">
  <img src="icons/mark.svg" alt="YouTube Declutter, linocut play mark" width="168" height="168" />
</p>

<p align="center"><strong>Use YouTube intentionally. Decide how each session runs.</strong></p>

A small Chrome extension that removes the casino floor and puts a reason at the door. Every session starts with a mode you pick. Every behaviour is a setting you can change.

---

## What 2.0 adds

1. **Session modes.** A mode is a bundle of settings: landing page, timer, video cap, what to hide, what happens when a video ends. Six come built in. Make, copy, reorder and delete your own in the options page.
2. **Customize this session.** The intent card has a "Customize this session" drawer. Set a one-off timer, video cap, related, comments, ambient, autoplay or end-of-video behaviour without touching your modes.
3. **Limits.** Session timer, max videos per session, daily limit, quiet hours, extension length, max extensions, and what "Done" does (landing page, new tab, close tab).
4. **Hide anything.** Shorts, related rail, end cards, comments, live chat, description, merch, Explore links, promo units, filter chips, notification bell, the whole sidebar. Each one is a toggle, per default and per mode.
5. **Channel and word filters.** Block channels or words everywhere. Turn on an allowlist in a mode for a tight, single-purpose session.
6. **Reason note.** Optionally type why you're here. It sits in the timer pill.
7. **Friction.** An optional countdown before the popup lets you turn the extension off or pause it.
8. **Usage.** Visible YouTube time per day, 14-day chart, stored on your machine only.
9. **Ambient light controls.** Spread, intensity, blur, saturation, brightness.
10. **Backup.** Export and import settings and modes as JSON. Keyboard shortcuts at `chrome://extensions/shortcuts`.

Order of precedence: your defaults, then the mode, then the one-off session tweaks.

This does **not** block in-player video ads. It only hides page promo units. The friction countdown is a speed bump, not a lock.

---

## Install in Chrome

1. Download the zip from [Releases](https://github.com/gundaIf/YouTube-Declutter/releases) and unzip it. You should get one folder named `YouTube-Declutter` that contains `manifest.json`.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select that `YouTube-Declutter` folder.
5. Pin the extension. Click the icon for the dashboard, or open **Details → Extension options** for everything.

Reload after updates: `chrome://extensions` → the refresh icon on the card. Existing settings carry over.

---

## Where things live

| Place | What |
|---|---|
| Toolbar popup | On/off, pause, switch or end the session, quick toggles for the current session, timer |
| Options page | Modes, every setting, filters, usage, backup |
| Intent card | Pick a mode, optional note, optional one-off tweaks |

Nothing leaves your machine. Settings and usage live in `chrome.storage.local`. The running session lives in `chrome.storage.session` and clears when the browser closes (or after the idle time you set).

---

## Files

```
manifest.json
shared.js        # settings schema, defaults, mode merging, helpers
background.js    # redirects, toolbar icon, pause alarm, usage, shortcuts
content.js       # intent card, limits, gates, filters, watch page
ambient.js       # live frame glow
styles.css       # hide layer
popup.*          # dashboard
options.*        # full settings page
icons/           # mark.svg and toolbar PNGs
tools/make-icons.py  # redraws icons/ (needs Pillow)
```

Vanilla JS. No build step. No analytics.

## License

MIT. See `LICENSE`.
