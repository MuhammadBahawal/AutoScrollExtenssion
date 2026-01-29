# Icon Placeholders

This folder should contain the extension icons:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Creating Icons

### Option 1: Use an online generator
1. Go to https://favicon.io/emoji-favicons/
2. Search for "movie" or "scroll" emoji
3. Download and rename the files

### Option 2: Create manually
Use any image editor (Paint, Photoshop, GIMP) to create simple colored squares or icons.

### Option 3: Use these SVG placeholders
Create an HTML file with this content and screenshot each size:

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#grad)"/>
  <text x="64" y="80" font-size="60" text-anchor="middle" fill="white">▼</text>
</svg>
```

### Temporary workaround
If you don't have icons, edit `manifest.json`:
1. Remove the `"icons"` section
2. Remove `"default_icon"` from the `"action"` section

The extension will still work but won't have a custom icon.
