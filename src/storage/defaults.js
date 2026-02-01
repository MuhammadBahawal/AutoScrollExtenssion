/**
 * Default settings and constants for AutoScroll extension
 */

export const DEFAULT_SETTINGS = {
    // Global
    globalEnabled: true,
    theme: 'dark', // 'light', 'dark', 'system'

    // Per-site enables
    sites: {
        instagram: { enabled: true },
        youtube: { enabled: true },
        tiktok: { enabled: true },
        x: { enabled: true },
        facebook: { enabled: true }
    },

    // Timing
    delayAfterEnd: 600,      // ms
    randomExtraDelay: 200,   // ms (max random addition)

    // Scroll behavior
    scrollFactor: 0.95,
    retryAttempts: 3,

    // Hotkeys
    hotkeys: {
        enabled: true,
        togglePause: 'Space',
        scrollNext: 'ArrowDown',
        scrollPrev: 'ArrowUp'
    },

    // Safety
    safety: {
        stopOnTabInactive: true,
        stopOnManualScroll: false,
        pauseOnInteraction: true,
        manualScrollCooldown: 2000 // ms
    },

    // Debug
    debugLogging: false
};

export const SITE_NAMES = {
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    facebook: 'Facebook'
};

export const SITE_ICONS = {
    instagram: '📸',
    youtube: '▶️',
    tiktok: '🎵',
    x: '𝕏',
    facebook: '👤'
};

export const SITE_COLORS = {
    instagram: '#E4405F',
    youtube: '#FF0000',
    tiktok: '#000000',
    x: '#1DA1F2',
    facebook: '#1877F2'
};
