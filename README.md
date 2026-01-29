# Insta Reel AutoScroll - Chrome Extension

🎬 A Manifest V3 Chrome extension that automatically scrolls to the next Instagram Reel when the current one ends.

## Features

- **Auto-scroll on video end**: Detects when a reel ends and smoothly scrolls to the next one
- **Smart video detection**: Uses visibility scoring to identify the active reel
- **Configurable settings**: Customize delay, scroll behavior, and more
- **Popup UI**: Quick toggle, session stats, and test scroll button
- **Debug mode**: Detailed console logging for troubleshooting

## Installation

### Load as Unpacked Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select this extension folder (`d:\AutoScrollExtenssion`)
5. The extension icon should appear in your toolbar

### Create Icons (Required)

The extension needs icon files. You can either:

**Option A: Create simple icons**
Create three PNG files in the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can use any image editor or online tool like:
- [Favicon Generator](https://favicon.io/)
- [Icons8](https://icons8.com/)

**Option B: Use placeholder icons**
Create simple colored square images as placeholders.

**Option C: Remove icons temporarily**
Edit `manifest.json` and remove the `icons` and `default_icon` sections.

## Usage

1. Navigate to Instagram Reels: `https://www.instagram.com/reels/`
2. Click the extension icon to open the popup
3. Ensure the toggle is ON (enabled)
4. Watch reels - the extension will auto-scroll when each reel ends!

### Popup Controls

- **Enable/Disable Toggle**: Turn auto-scrolling on/off
- **Reels Scrolled**: Counter of auto-scrolls this session
- **Last Scroll**: Time since last auto-scroll
- **Test Scroll Now**: Manual trigger to test scrolling
- **Reset Stats**: Clear the session counter

### Settings (Options Page)

Right-click the extension icon → **Options**, or click ⚙️ Settings in the popup.

| Setting | Default | Description |
|---------|---------|-------------|
| Enable Auto-Scroll | ON | Master toggle |
| Debug Logging | OFF | Show console logs |
| Delay After End | 600ms | Wait time before scrolling |
| Random Extra Delay | 0ms | Add randomness (0-400ms) |
| Scroll Factor | 0.95 | Viewport portion to scroll |
| Retry Attempts | 2 | Scroll retries if first fails |

## How It Works

### Video Detection
1. Finds all `<video>` elements on the page
2. Calculates visibility score using `getBoundingClientRect()`
3. Selects the video with highest visibility (≥60% preferred)
4. Re-checks on scroll and DOM changes

### End Detection
1. Listens for `ended` event on active video
2. Safety check via `timeupdate` when (duration - currentTime) < 0.25s
3. Uses MutationObserver to track Instagram's dynamic DOM

### Scroll Logic
1. **Primary**: `window.scrollBy({ top: viewport * scrollFactor, behavior: "smooth" })`
2. **Retry**: Larger scroll (115% viewport) if video didn't change
3. **Fallback**: `element.scrollIntoView()` on next container

## Customizing Selectors

If Instagram changes their DOM structure, you may need to update `content.js`:

### Video Container Selector
Find the `scrollToNextContainer` function around line 270:

```javascript
let container = previousVideo.closest("div[role='presentation']") ||
                previousVideo.closest("article") ||
                previousVideo.parentElement?.parentElement?.parentElement;
```

Update these selectors based on Instagram's current DOM.

### Video Elements
The extension uses `document.querySelectorAll("video")` which should work regardless of DOM changes.

## Troubleshooting

### Extension not working?
1. Enable **Debug Logging** in Settings
2. Open DevTools (F12) → Console tab
3. Look for `[InstaReelAutoScroll]` messages
4. Check if videos are being detected

### Scroll not triggering?
- Ensure you're on `instagram.com/reels/*` or `instagram.com/reel/*`
- Check if the extension is enabled (popup toggle)
- Try the "Test Scroll Now" button

### Popup shows "Not connected"?
- Refresh the Instagram page
- The content script may need to reinitialize

## Files

```
AutoScrollExtenssion/
├── manifest.json        # Extension configuration
├── content.js           # Main logic (injected into Instagram)
├── popup.html          # Popup UI structure
├── popup.css           # Popup styles
├── popup.js            # Popup functionality
├── options.html        # Settings page structure
├── options.css         # Settings page styles
├── options.js          # Settings functionality
├── icons/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## Permissions

- `storage`: Save settings across sessions
- `host_permissions`: Access Instagram pages only

## License

MIT License - Feel free to modify and distribute!

## Support

If you encounter issues or have suggestions, please check the console logs with debug mode enabled for more information.