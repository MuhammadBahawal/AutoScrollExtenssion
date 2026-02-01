/**
 * Adapters Index - Export all platform adapters
 */

export { default as BaseAdapter } from './BaseAdapter.js';
export { default as InstagramAdapter } from './InstagramAdapter.js';
export { default as YouTubeAdapter } from './YouTubeAdapter.js';
export { default as TikTokAdapter } from './TikTokAdapter.js';
export { default as XAdapter } from './XAdapter.js';
export { default as FacebookAdapter } from './FacebookAdapter.js';

// All adapters array for registration
export const ALL_ADAPTERS = [
    (await import('./InstagramAdapter.js')).default,
    (await import('./YouTubeAdapter.js')).default,
    (await import('./TikTokAdapter.js')).default,
    (await import('./XAdapter.js')).default,
    (await import('./FacebookAdapter.js')).default
];
