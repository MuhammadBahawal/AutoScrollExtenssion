/**
 * Video Detector - Finds the currently active/visible video on the page
 * Uses IntersectionObserver with fallback heuristics
 */

import { logger } from './Logger.js';

class VideoDetector {
    constructor() {
        this.observer = null;
        this.visibilityMap = new Map();
        this.activeVideo = null;
        this.onActiveChangeCallback = null;
        this.mutationObserver = null;
        this.debounceTimer = null;
    }

    /**
     * Initialize the video detector
     */
    initialize(options = {}) {
        this.options = {
            visibilityThreshold: options.visibilityThreshold || 0.5,
            debounceMs: options.debounceMs || 150,
            ...options
        };
    }

    /**
     * Start observing videos
     */
    startObserving(videoSelector = 'video', onActiveChange = null) {
        this.cleanup();
        this.onActiveChangeCallback = onActiveChange;

        // Setup IntersectionObserver
        this.observer = new IntersectionObserver(
            (entries) => this._handleIntersection(entries),
            {
                root: null,
                threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0]
            }
        );

        // Setup MutationObserver to detect new videos
        this.mutationObserver = new MutationObserver((mutations) => {
            this._handleMutations(mutations, videoSelector);
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial video scan
        this._observeVideos(videoSelector);
        this._determineActiveVideo();

        logger.debug('VideoDetector started observing');
    }

    /**
     * Observe all current videos
     */
    _observeVideos(selector) {
        const videos = document.querySelectorAll(selector);
        videos.forEach(video => {
            if (!this.visibilityMap.has(video)) {
                this.observer.observe(video);
                this.visibilityMap.set(video, { ratio: 0, isIntersecting: false });
            }
        });
    }

    /**
     * Handle intersection changes
     */
    _handleIntersection(entries) {
        entries.forEach(entry => {
            this.visibilityMap.set(entry.target, {
                ratio: entry.intersectionRatio,
                isIntersecting: entry.isIntersecting,
                rect: entry.boundingClientRect
            });
        });

        // Debounce the active video determination
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this._determineActiveVideo();
        }, this.options.debounceMs);
    }

    /**
     * Handle DOM mutations
     */
    _handleMutations(mutations, selector) {
        let hasNewVideos = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(selector)) {
                            hasNewVideos = true;
                        } else if (node.querySelectorAll) {
                            const videos = node.querySelectorAll(selector);
                            if (videos.length > 0) hasNewVideos = true;
                        }
                    }
                }

                // Clean up removed videos
                for (const node of mutation.removedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(selector)) {
                            this._unobserveVideo(node);
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll(selector).forEach(v => this._unobserveVideo(v));
                        }
                    }
                }
            }
        }

        if (hasNewVideos) {
            this._observeVideos(selector);
        }
    }

    /**
     * Stop observing a specific video
     */
    _unobserveVideo(video) {
        if (this.observer) {
            this.observer.unobserve(video);
        }
        this.visibilityMap.delete(video);
    }

    /**
     * Determine the currently active video
     */
    _determineActiveVideo() {
        let bestVideo = null;
        let bestScore = 0;

        for (const [video, data] of this.visibilityMap) {
            // Skip if video element is no longer in DOM
            if (!document.contains(video)) {
                this._unobserveVideo(video);
                continue;
            }

            const score = this._calculateVideoScore(video, data);
            if (score > bestScore) {
                bestScore = score;
                bestVideo = video;
            }
        }

        // Only consider it active if score meets threshold
        const newActive = bestScore >= this.options.visibilityThreshold ? bestVideo : null;

        if (newActive !== this.activeVideo) {
            const previousVideo = this.activeVideo;
            this.activeVideo = newActive;

            logger.debug('Active video changed:', {
                previous: previousVideo ? 'video' : null,
                current: newActive ? 'video' : null,
                score: bestScore
            });

            if (this.onActiveChangeCallback) {
                this.onActiveChangeCallback(newActive, previousVideo);
            }
        }
    }

    /**
     * Calculate a score for a video based on visibility and state
     */
    _calculateVideoScore(video, data) {
        let score = 0;

        // Visibility ratio (40% weight)
        score += (data.ratio || 0) * 0.4;

        // Playing state bonus (30% weight)
        if (!video.paused && !video.ended && video.readyState >= 2) {
            score += 0.3;
        }

        // Center proximity bonus (20% weight)
        if (data.rect) {
            const viewportCenter = window.innerHeight / 2;
            const videoCenter = data.rect.top + (data.rect.height / 2);
            const distanceFromCenter = Math.abs(viewportCenter - videoCenter);
            const maxDistance = window.innerHeight;
            const centerScore = 1 - Math.min(distanceFromCenter / maxDistance, 1);
            score += centerScore * 0.2;
        }

        // Valid duration bonus (10% weight)
        if (video.duration && isFinite(video.duration) && video.duration > 0) {
            score += 0.1;
        }

        return score;
    }

    /**
     * Get the currently active video
     */
    getActiveVideo() {
        return this.activeVideo;
    }

    /**
     * Get all observed videos
     */
    getAllVideos() {
        return Array.from(this.visibilityMap.keys()).filter(v => document.contains(v));
    }

    /**
     * Force refresh active video detection
     */
    refresh() {
        this._determineActiveVideo();
    }

    /**
     * Fallback: Find best video using heuristics only
     */
    findBestVideoFallback(videos = null) {
        const videoList = videos || this.getAllVideos();

        return videoList
            .map(video => ({
                video,
                score: this._scoreVideoFallback(video)
            }))
            .sort((a, b) => b.score - a.score)
            .filter(x => x.score > 0.3)
        [0]?.video || null;
    }

    /**
     * Fallback scoring without observer data
     */
    _scoreVideoFallback(video) {
        const rect = video.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Check if in viewport
        if (rect.bottom < 0 || rect.top > viewportHeight) return 0;
        if (rect.right < 0 || rect.left > viewportWidth) return 0;

        // Calculate visible area
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(viewportHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const visibilityRatio = rect.height > 0 ? visibleHeight / rect.height : 0;

        let score = visibilityRatio * 0.5;

        // Bonus for playing
        if (!video.paused && video.readyState >= 3) score += 0.25;

        // Bonus for valid duration
        if (video.duration && video.duration > 1) score += 0.1;

        // Bonus for center proximity
        const videoCenter = rect.top + rect.height / 2;
        const viewportCenter = viewportHeight / 2;
        const centerDistance = Math.abs(videoCenter - viewportCenter);
        score += (1 - centerDistance / viewportHeight) * 0.15;

        return score;
    }

    /**
     * Cleanup all observers
     */
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        this.visibilityMap.clear();
        this.activeVideo = null;
        this.onActiveChangeCallback = null;

        logger.debug('VideoDetector cleaned up');
    }
}

export const videoDetector = new VideoDetector();
export default VideoDetector;
