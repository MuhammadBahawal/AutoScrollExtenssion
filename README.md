# AutoScroll - Multi-Platform Video Auto-Scroller

![Version](https://img.shields.io/badge/version-2.0.0-purple)
![Manifest](https://img.shields.io/badge/manifest-v3-blue)
![Platforms](https://img.shields.io/badge/platforms-5-green)

Automatically scroll to the next video when the current one ends on **Instagram Reels**, **YouTube Shorts**, **TikTok**, **X (Twitter)**, and **Facebook Reels**.

## ✨ Features

### Multi-Platform Support
- 📸 **Instagram Reels** - Works on `/reels/` and individual reel pages
- ▶️ **YouTube Shorts** - Works on `/shorts/` pages
- 🎵 **TikTok** - Works on For You page and video pages
- 𝕏 **X (Twitter)** - Works on timeline and video feeds
- 👤 **Facebook Reels** - Works on Reels and Watch pages

### Smart Detection
- **Intelligent video detection** using visibility scoring and center proximity
- **Multiple end-detection methods**: `ended` event, `timeupdate` threshold, loop detection
- **Automatic adapter selection** based on current site

### Robust Scrolling
- **Multiple scroll methods** per platform with automatic fallback
- Configurable retry attempts if first method fails
- Methods include: ArrowDown simulation, viewport scroll, container scroll, scrollIntoView

### Modern UI
- 🌙 Dark theme with purple gradient accents
- Per-platform enable/disable toggles
- Real-time session stats
- Status banner showing current detection state

### Privacy Focused
- ✅ **No data collection** - All settings stored locally
- ✅ **No remote code execution**
- ✅ **Minimal permissions** - Only storage, activeTab, and site-specific host permissions
- ✅ **Chrome Web Store ready** (Manifest V3)

## 📦 Installation

### From Source (Developer Mode)

1. Download or clone this repository
2. Open Chrome/Edge/Brave and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the extension folder (`AutoScrollExtenssion`)

### From Chrome Web Store
*Coming soon*

## ⚙️ Settings

Access settings by clicking the extension icon → ⚙️ Settings, or right-click the extension icon → Options.

### General
| Setting | Default | Description |
|---------|---------|-------------|
| Enable AutoScroll | ✓ | Master toggle for all platforms |
| Debug Logging | ✗ | Show detailed logs in browser console |

### Timing
| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Delay After End | 600ms | 0-3000ms | Wait time before scrolling |
| Random Extra Delay | 200ms | 0-2000ms | Adds randomness to feel natural |

### Scroll Behavior
| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Scroll Factor | 95% | 50-150% | Percentage of viewport to scroll |
| Retry Attempts | 3 | 1-5 | Number of methods to try |

### Safety Controls
| Setting | Default | Description |
|---------|---------|-------------|
| Stop When Tab Inactive | ✓ | Pause when switching tabs |
| Pause on Interaction | ✓ | Pause when focusing inputs |
| Stop on Manual Scroll | ✗ | Pause after user scrolls |

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Space` | Pause/Resume auto-scroll |

## 🏗️ Architecture

```
AutoScrollExtenssion/
├── manifest.json          # Extension manifest (MV3)
├── content.js             # Main content script (bundled IIFE)
├── popup.html/css/js      # Popup UI
├── options.html/css/js    # Settings page
├── icons/                 # Extension icons
└── src/                   # Source modules (for reference)
    ├── core/
    │   ├── Controller.js
    │   ├── Logger.js
    │   ├── SiteDetector.js
    │   ├── EndDetector.js
    │   ├── ScrollManager.js
    │   ├── SafetyController.js
    │   ├── HotkeyManager.js
    │   └── VideoDetector.js
    ├── adapters/
    │   ├── BaseAdapter.js
    │   ├── InstagramAdapter.js
    │   ├── YouTubeAdapter.js
    │   ├── TikTokAdapter.js
    │   ├── XAdapter.js
    │   └── FacebookAdapter.js
    └── storage/
        ├── SettingsManager.js
        ├── StatsManager.js
        └── defaults.js
```

### Adapter Pattern

Each platform has a dedicated adapter that handles:
- **URL matching** - Detect if on this platform
- **Page type detection** - Determine if on a supported page (Reels, Shorts, etc.)
- **Video finding** - Find and score videos on the page
- **Scroll methods** - Platform-specific scroll implementations

### Video Detection

Videos are scored by:
1. **Visibility** - Percentage of video visible in viewport (50% weight)
2. **Playing state** - Bonus if video is currently playing (25% weight)
3. **Valid duration** - Bonus if duration can be read (10% weight)
4. **Center proximity** - Closer to viewport center = higher score (15% weight)

### End Detection

Multiple methods to catch video end:
1. **`ended` event** - Most reliable when fired by browser
2. **`timeupdate` threshold** - When `duration - currentTime < 0.5s`
3. **Loop detection** - When `currentTime` jumps back to start after being near end

## 🧪 Testing Checklist

### Instagram
- [ ] Navigate to instagram.com/reels/ - should detect "Instagram Reels"
- [ ] Watch a reel to end - should auto-scroll to next
- [ ] Navigate away from reels - should show "Navigate to Reels"

### YouTube
- [ ] Navigate to youtube.com/shorts/xxx - should detect "YouTube Shorts"
- [ ] Watch a short to end - should auto-scroll to next
- [ ] Navigate to regular video - should show "Navigate to Shorts"

### TikTok
- [ ] Navigate to tiktok.com - should detect "TikTok"
- [ ] Watch video to end - should auto-scroll to next
- [ ] Test on video page (/video/xxx)

### X (Twitter)
- [ ] Navigate to x.com or twitter.com - should detect "X (Twitter)"
- [ ] Find a video tweet - watch to end
- [ ] Should scroll to next video in timeline

### Facebook
- [ ] Navigate to facebook.com/reels/ - should detect "Facebook Reels"
- [ ] Watch a reel to end - should auto-scroll
- [ ] Test on facebook.com/watch/

### General
- [ ] Toggle global enable/disable - content script should respond
- [ ] Toggle individual platform - only that platform affected
- [ ] Change delay settings - should apply immediately
- [ ] Test Ctrl+Space pause/resume
- [ ] Verify stats update in real-time
- [ ] Test "Skip to Next" button
- [ ] Test "Reset" button

## 🔧 Troubleshooting

### Extension not working?

1. **Refresh the page** after installing or enabling
2. **Check the popup** - It should show "Active on [Platform]"
3. **Enable Debug Logging** in Settings and check browser console (F12)
4. **Make sure you're on a supported page** (Reels, Shorts, etc.)

### Videos not being detected?

- Some sites load videos dynamically - wait a moment after page load
- Try scrolling manually once to trigger video loading
- Check console for `[AutoScroll]` logs

### Scrolling not working?

- The extension tries multiple scroll methods automatically
- In rare cases, the site may have changed its DOM structure
- Try increasing "Retry Attempts" in settings

## 📜 Privacy Policy

**AutoScroll does not collect any personal data.**

- All settings are stored locally in Chrome's sync storage
- No analytics or tracking
- No network requests except to the supported sites you visit
- No data leaves your browser

## 📄 License

MIT License - see LICENSE file

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📝 Changelog

### v2.0.0
- 🚀 Multi-platform support (Instagram, YouTube, TikTok, X, Facebook)
- 🎨 Complete UI redesign
- ⚙️ Per-platform enable/disable toggles
- 🔒 Safety controls
- ⌨️ Hotkey support
- 📊 Real-time stats

### v1.0.0
- Initial release (Instagram Reels only)