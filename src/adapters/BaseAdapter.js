/**
 * Base Adapter - Abstract base class for all platform adapters
 */

import { logger } from '../core/Logger.js';

class BaseAdapter {
    // Static properties - must be overridden by subclasses
    static siteName = 'base';
    static displayName = 'Base';
    static supportedPageTypes = [];

    /**
     * Check if this adapter matches the current URL
     * @param {string} url - Current URL
     * @param {Document} doc - Document object
     * @returns {boolean}
     */
    static isMatch(url, doc = document) {
        return false;
    }

    /**
     * Get the page type from URL
     * @param {string} url - Current URL
     * @param {Document} doc - Document object
     * @returns {string|null}
     */
    static getPageType(url, doc = document) {
        return null;
    }

    /**
     * Check if the page type is supported for auto-scroll
     * @param {string} pageType
     * @returns {boolean}
     */
    static isSupportedPageType(pageType) {
        return this.supportedPageTypes.includes(pageType);
    }

    constructor(controller) {
        this.controller = controller;
        this.name = this.constructor.siteName;
        this.initialized = false;
        this.videoSelector = 'video';
    }

    /**
     * Initialize the adapter
     */
    initialize() {
        if (this.initialized) return;

        logger.setSiteName(this.constructor.displayName);
        this.onInitialize();
        this.initialized = true;

        logger.info(`${this.constructor.displayName} adapter initialized`);
    }

    /**
     * Hook for subclass initialization
     */
    onInitialize() {
        // Override in subclass
    }

    /**
     * Find all video elements on the page
     * @returns {HTMLVideoElement[]}
     */
    findAllVideos() {
        return Array.from(document.querySelectorAll(this.videoSelector));
    }

    /**
     * Find the currently active/visible video
     * @returns {HTMLVideoElement|null}
     */
    findActiveVideo() {
        const videos = this.findAllVideos();
        if (videos.length === 0) return null;
        if (videos.length === 1) return videos[0];

        // Find best video by visibility and playing state
        let bestVideo = null;
        let bestScore = 0;

        for (const video of videos) {
            const score = this._scoreVideo(video);
            if (score > bestScore) {
                bestScore = score;
                bestVideo = video;
            }
        }

        return bestScore >= 0.5 ? bestVideo : null;
    }

    /**
     * Score a video for "active" selection
     */
    _scoreVideo(video) {
        const rect = video.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Check if in viewport
        if (rect.bottom < 0 || rect.top > viewportHeight) return 0;
        if (rect.right < 0 || rect.left > viewportWidth) return 0;
        if (rect.width === 0 || rect.height === 0) return 0;

        // Calculate visible area
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(viewportHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const visibilityRatio = rect.height > 0 ? visibleHeight / rect.height : 0;

        let score = visibilityRatio * 0.5;

        // Bonus for playing
        if (!video.paused && video.readyState >= 2) score += 0.25;

        // Bonus for valid duration
        if (video.duration && isFinite(video.duration) && video.duration > 0) score += 0.1;

        // Bonus for center proximity
        const videoCenter = rect.top + rect.height / 2;
        const viewportCenter = viewportHeight / 2;
        const centerDistance = Math.abs(videoCenter - viewportCenter);
        score += (1 - Math.min(centerDistance / viewportHeight, 1)) * 0.15;

        return score;
    }

    /**
     * Get the container element for a video
     * @param {HTMLVideoElement} video
     * @returns {HTMLElement|null}
     */
    getVideoContainer(video) {
        // Default: return parent element
        return video?.parentElement;
    }

    /**
     * Get scroll methods for this platform
     * Returns array of { name, execute } objects
     * @returns {Array}
     */
    getScrollMethods() {
        return [
            {
                name: 'viewport_scroll',
                execute: (scrollManager) => {
                    scrollManager.scrollByViewport(0.95);
                }
            }
        ];
    }

    /**
     * Find the scroll container for this platform
     * @returns {HTMLElement|null}
     */
    findScrollContainer() {
        return null;
    }

    /**
     * Get platform-specific video selector
     * @returns {string}
     */
    getVideoSelector() {
        return this.videoSelector;
    }

    /**
     * Check if currently on a supported page
     * @returns {boolean}
     */
    isOnSupportedPage() {
        const pageType = this.constructor.getPageType(window.location.href);
        return this.constructor.isSupportedPageType(pageType);
    }

    /**
     * Get current page type
     * @returns {string|null}
     */
    getCurrentPageType() {
        return this.constructor.getPageType(window.location.href);
    }

    /**
     * Cleanup adapter resources
     */
    destroy() {
        this.onDestroy();
        this.initialized = false;
        logger.debug(`${this.constructor.displayName} adapter destroyed`);
    }

    /**
     * Hook for subclass cleanup
     */
    onDestroy() {
        // Override in subclass
    }
}

export default BaseAdapter;
