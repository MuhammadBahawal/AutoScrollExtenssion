# Insta Reel AutoScroll

A cross-browser WebExtension that automatically moves to the next Instagram Reel when the current reel ends.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-1f6feb)
![Browser Support](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Opera%20%7C%20Vivaldi%20%7C%20Firefox-2ea44f)
![License](https://img.shields.io/badge/License-MIT-8250df)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Browser Support](#browser-support)
- [Project Structure](#project-structure)
- [Install (Developer Mode)](#install-developer-mode)
- [Publish to Stores](#publish-to-stores)
- [Settings](#settings)
- [How It Works](#how-it-works)
- [Permissions](#permissions)
- [Troubleshooting](#troubleshooting)
- [Privacy](#privacy)
- [License](#license)

## Overview

`Insta Reel AutoScroll` watches the active Instagram Reel video and triggers a smooth scroll when playback ends. It includes a popup dashboard, configurable options, session stats, and fallback logic for Instagram DOM changes.

## Features

- Auto-scrolls when the current Reel finishes
- Active-video detection based on viewport visibility
- Popup controls for enable/disable, test scroll, and stats reset
- Options page for timing, retry behavior, and debug logging
- Cross-browser API wrapper (`browser.*` and `chrome.*` compatibility)
- Fallback script injection when content script is not connected

## Browser Support

| Browser | Support | Notes |
| --- | --- | --- |
| Chrome | Yes | Load unpacked or publish to Chrome Web Store |
| Microsoft Edge | Yes | Load unpacked or publish to Edge Add-ons |
| Brave | Yes | Uses Chromium extension model |
| Opera | Yes | Uses Chromium extension model |
| Vivaldi | Yes | Uses Chromium extension model |
| Firefox | Yes | Load temporary add-on or publish via AMO |
| Safari | Partial | Requires conversion with `safari-web-extension-converter` on macOS |

## Project Structure

```text
AutoScrollExtenssion/
|- manifest.json
|- webext-api.js
|- content.js
|- popup.html
|- popup.css
|- popup.js
|- options.html
|- options.css
|- options.js
|- icons/
|  |- icon16.png
|  |- icon32.png
|  |- icon48.png
|  `- icon128.png
`- README.md
```

## Install (Developer Mode)

### Chrome / Edge / Brave / Opera / Vivaldi

1. Open your browser extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
   - Opera: `opera://extensions/`
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Choose `manifest.json` from this project.

Note: temporary Firefox add-ons are removed after browser restart unless signed/published.

## Publish to Stores

### Chrome Web Store

1. Zip the extension root files (do not zip the parent folder).
2. Upload in the Chrome Web Store Developer Dashboard.
3. Complete listing details (description, screenshots, privacy info).

### Edge Add-ons

1. Use the same extension zip.
2. Upload in Microsoft Partner Center (Edge Add-ons).
3. Complete metadata and submit for review.

### Firefox Add-ons (AMO)

1. Use the same source code.
2. Zip extension root.
3. Upload to AMO for signing/review.

### Safari

Use macOS + Xcode:

```bash
xcrun safari-web-extension-converter /path/to/AutoScrollExtenssion
```

Then open the generated Xcode project, configure signing, and build/distribute.

## Settings

| Setting | Default | Range | Description |
| --- | --- | --- | --- |
| Enable Auto-Scroll | `true` | boolean | Master extension toggle |
| Debug Logging | `false` | boolean | Logs detailed behavior in console |
| Delay After End | `600` | `0-5000` ms | Wait before auto-scroll |
| Random Extra Delay | `0` | `0-1000` ms | Adds randomized delay |
| Scroll Factor | `0.95` | `0.6-1.5` | Portion of viewport to scroll |
| Retry Attempts | `2` | `1-5` | Additional attempts if first scroll fails |

## How It Works

1. Finds all `<video>` nodes on Instagram Reels pages.
2. Calculates visibility score to determine the active video.
3. Detects playback completion via `ended` and near-end timing checks.
4. Scrolls to next Reel with retry and fallback strategies.
5. Updates popup stats through runtime messaging.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Save settings and extension state |
| `scripting` | Inject scripts from popup fallback flow |
| `activeTab` | Target active tab for fallback injection |
| `host_permissions` (`https://www.instagram.com/*`) | Restrict extension execution to Instagram |

## Troubleshooting

### Popup shows "Not connected to page"

- Refresh Instagram tab
- Open `https://www.instagram.com/reels/`
- Reopen popup and test again

### Auto-scroll is not triggering

- Confirm extension is enabled in popup
- Turn on **Debug Logging** in options
- Check browser DevTools console for `[InstaReelAutoScroll]` logs

### Works in one browser but not another

- Remove and reload unpacked extension
- Confirm browser supports Manifest V3
- Verify permissions were accepted during install

## Privacy

This extension stores only local/synced configuration values using the browser extension storage API. It does not include external analytics or remote data collection logic.

## License

MIT
