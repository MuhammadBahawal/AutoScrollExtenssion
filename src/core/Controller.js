/**
 * Controller - Main state controller for the AutoScroll extension
 * Orchestrates adapters, video detection, end detection, and scrolling
 */

import { logger } from './Logger.js';
import { siteDetector } from './SiteDetector.js';
import { scrollManager } from './ScrollManager.js';
import { safetyController } from './SafetyController.js';
import { hotkeyManager } from './HotkeyManager.js';
import { settingsManager } from '../storage/SettingsManager.js';
import { statsManager } from '../storage/StatsManager.js';
import EndDetector from './EndDetector.js';

class Controller {
    constructor() {
        this.adapter = null;
        this.endDetector = new EndDetector();
        this.currentVideo = null;

        this.state = {
            enabled: true,
            paused: false,
            scrollLock: false,
            initialized: false,
            siteName: null,
            pageType: null
        };

        this._scrollPending = false;
        this._urlCheckInterval = null;
        this._lastUrl = '';
    }

    /**
     * Initialize the controller
     */
    async initialize() {
        if (this.state.initialized) return;

        logger.info('Controller initializing...');

        // Load settings and stats
        await settingsManager.initialize();
        await statsManager.initialize();

        // Configure logger
        logger.setDebugEnabled(settingsManager.get('debugLogging', false));

        // Listen for settings changes
        settingsManager.addListener((changes) => this._handleSettingsChange(changes));

        // Setup message listener for popup communication
        this._setupMessageListener();

        // Detect site and initialize
        await this._detectAndInitialize();

        // Setup URL change detection (for SPAs)
        this._setupUrlWatcher();

        this.state.initialized = true;
        logger.info('Controller initialized');
    }

    /**
     * Detect current site and initialize appropriate adapter
     */
    async _detectAndInitialize() {
        const detection = siteDetector.detect();

        if (!detection) {
            logger.info('No supported site detected');
            this._updateState({ siteName: null, pageType: null });
            return;
        }

        const { AdapterClass, siteName, pageType, isSupported } = detection;

        this._updateState({ siteName, pageType });

        // Check if site is enabled in settings
        if (!settingsManager.isSiteEnabled(siteName)) {
            logger.info(`${siteName} is disabled in settings`);
            return;
        }

        if (!isSupported) {
            logger.info(`Page type "${pageType}" not supported for auto-scroll on ${siteName}`);
            return;
        }

        // Create and initialize adapter
        logger.info(`Initializing adapter for ${siteName} (${pageType})`);
        this.adapter = new AdapterClass(this);
        this.adapter.initialize();

        // Initialize safety and hotkey systems
        this._initializeSafety();
        this._initializeHotkeys();

        // Wait for page to be ready, then start tracking
        await this._waitForPageReady();
        this._startVideoTracking();
    }

    /**
     * Wait for page to be ready
     */
    _waitForPageReady() {
        return new Promise(resolve => {
            const delay = settingsManager.get('delayAfterEnd', 600);
            setTimeout(resolve, Math.min(delay, 1500));
        });
    }

    /**
     * Initialize safety controller
     */
    _initializeSafety() {
        const safetySettings = settingsManager.get('safety', {});
        safetyController.configure(safetySettings);

        safetyController.setCallbacks({
            onPause: (reason) => {
                logger.debug(`Auto-scroll paused: ${reason}`);
            },
            onResume: (reason) => {
                logger.debug(`Auto-scroll resumed: ${reason}`);
            }
        });

        safetyController.initialize();
    }

    /**
     * Initialize hotkey manager
     */
    _initializeHotkeys() {
        const hotkeySettings = settingsManager.get('hotkeys', {});
        hotkeyManager.configure(hotkeySettings);

        hotkeyManager.setCallbacks({
            onTogglePause: () => this.togglePause(),
            onScrollNext: () => this.scrollNext(),
            onScrollPrev: () => this.scrollPrevious()
        });

        hotkeyManager.initialize();
    }

    /**
     * Start tracking videos on the page
     */
    _startVideoTracking() {
        if (!this.adapter) return;

        // Find initial active video
        const video = this.adapter.findActiveVideo();
        if (video) {
            this._attachToVideo(video);
        }

        // Setup mutation observer for dynamic content
        this._setupMutationObserver();

        logger.info('Video tracking started');
    }

    /**
     * Attach end detection to a video
     */
    _attachToVideo(video) {
        if (video === this.currentVideo) return;

        logger.debug('Attaching to new video');
        this.currentVideo = video;

        this.endDetector.attach(video, (data) => {
            this._handleVideoEnd(data);
        });
    }

    /**
     * Handle video end event
     */
    async _handleVideoEnd(data) {
        logger.info(`Video ended: ${data.reason}`);

        // Check if we can auto-scroll
        if (!this._canAutoScroll()) {
            logger.debug('Cannot auto-scroll at this time');
            return;
        }

        await this._scheduleScroll();
    }

    /**
     * Check if auto-scroll should happen
     */
    _canAutoScroll() {
        // Check enabled state
        if (!this.state.enabled || this.state.paused) {
            return false;
        }

        // Check global enabled
        if (!settingsManager.get('globalEnabled', true)) {
            return false;
        }

        // Check site enabled
        if (!settingsManager.isSiteEnabled(this.state.siteName)) {
            return false;
        }

        // Check safety
        const safetyCheck = safetyController.canAutoScroll();
        if (!safetyCheck.allowed) {
            logger.debug(`Safety check failed: ${safetyCheck.reason}`);
            return false;
        }

        // Check scroll lock
        if (this._scrollPending || scrollManager.isScrolling()) {
            return false;
        }

        return true;
    }

    /**
     * Schedule a scroll after delay
     */
    async _scheduleScroll() {
        if (this._scrollPending) return;
        this._scrollPending = true;

        const delayAfterEnd = settingsManager.get('delayAfterEnd', 600);
        const randomExtraDelay = settingsManager.get('randomExtraDelay', 200);
        const totalDelay = delayAfterEnd + (Math.random() * randomExtraDelay);

        logger.debug(`Scheduling scroll in ${totalDelay.toFixed(0)}ms`);

        await this._delay(totalDelay);

        // Re-check if we can still scroll
        if (this._canAutoScroll()) {
            await this._performScroll();
        }

        this._scrollPending = false;
    }

    /**
     * Perform the actual scroll
     */
    async _performScroll() {
        if (!this.adapter) return;

        const previousVideo = this.currentVideo;

        // Configure scroll manager
        scrollManager.configure({
            scrollFactor: settingsManager.get('scrollFactor', 0.95),
            retryAttempts: settingsManager.get('retryAttempts', 3)
        });

        // Mark scroll as programmatic for safety controller
        if (safetyController.markProgrammaticScroll) {
            safetyController.markProgrammaticScroll();
        }

        // Perform scroll
        const result = await scrollManager.scrollToNext(this.adapter, previousVideo);

        if (result.success) {
            logger.info(`Scroll successful: ${result.method} (attempt ${result.attempt})`);

            // Record stats
            await statsManager.recordScroll(this.state.siteName);

            // Reset end detector and attach to new video
            this.endDetector.reset();

            // Wait briefly for DOM to update
            await this._delay(300);

            // Find and attach to new video
            const newVideo = this.adapter.findActiveVideo();
            if (newVideo && newVideo !== previousVideo) {
                this._attachToVideo(newVideo);
            }

            // Send stats update to popup
            this._sendStatsUpdate();

        } else {
            logger.warn(`Scroll failed: ${result.reason}`);
        }
    }

    /**
     * Setup mutation observer for DOM changes
     */
    _setupMutationObserver() {
        this._mutationObserver = new MutationObserver(
            this._debounce(() => {
                if (!this.adapter) return;

                const newVideo = this.adapter.findActiveVideo();
                if (newVideo && newVideo !== this.currentVideo) {
                    this._attachToVideo(newVideo);
                }
            }, 200)
        );

        this._mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Setup URL change watcher for SPA navigation
     */
    _setupUrlWatcher() {
        this._lastUrl = window.location.href;

        this._urlCheckInterval = setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== this._lastUrl) {
                this._lastUrl = currentUrl;
                this._handleUrlChange(currentUrl);
            }
        }, 500);
    }

    /**
     * Handle URL changes
     */
    async _handleUrlChange(newUrl) {
        logger.info('URL changed:', newUrl);

        // Cleanup current adapter
        this._cleanup(false);

        // Re-detect and initialize
        await this._detectAndInitialize();
    }

    /**
     * Setup message listener for popup communication
     */
    _setupMessageListener() {
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this._handleMessage(message, sendResponse);
                return true; // Keep channel open for async response
            });
        }
    }

    /**
     * Handle messages from popup
     */
    _handleMessage(message, sendResponse) {
        switch (message.action) {
            case 'getStats':
                sendResponse({
                    scrollCount: statsManager.getSiteStats(this.state.siteName)?.sessionScrolls || 0,
                    lastScrollTimestamp: statsManager.getSiteStats(this.state.siteName)?.lastScrollTime,
                    lastVideoInfo: this.endDetector.getVideoInfo(),
                    enabled: this.state.enabled,
                    paused: this.state.paused,
                    siteName: this.state.siteName,
                    pageType: this.state.pageType,
                    isSupported: this.adapter?.isOnSupportedPage() || false
                });
                break;

            case 'testScroll':
                this._performScroll().then(() => {
                    sendResponse({
                        success: true,
                        scrollCount: statsManager.getSiteStats(this.state.siteName)?.sessionScrolls || 0
                    });
                });
                break;

            case 'resetStats':
                statsManager.resetSessionStats();
                sendResponse({ success: true });
                break;

            case 'togglePause':
                this.togglePause();
                sendResponse({ paused: this.state.paused });
                break;

            case 'getState':
                sendResponse({
                    ...this.state,
                    settings: settingsManager.getSettings(),
                    stats: statsManager.getAllStats()
                });
                break;

            default:
                sendResponse({ error: 'Unknown action' });
        }
    }

    /**
     * Send stats update to popup
     */
    _sendStatsUpdate() {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            try {
                chrome.runtime.sendMessage({
                    action: 'statsUpdate',
                    data: {
                        scrollCount: statsManager.getSiteStats(this.state.siteName)?.sessionScrolls || 0,
                        lastScrollTimestamp: statsManager.getSiteStats(this.state.siteName)?.lastScrollTime,
                        lastVideoInfo: this.endDetector.getVideoInfo(),
                        siteName: this.state.siteName
                    }
                });
            } catch (e) {
                // Popup might be closed
            }
        }
    }

    /**
     * Handle settings changes
     */
    _handleSettingsChange(changes) {
        logger.debug('Settings changed:', Object.keys(changes));

        // Update debug logging
        if ('debugLogging' in changes) {
            logger.setDebugEnabled(changes.debugLogging.newValue);
        }

        // Update enabled state
        if ('globalEnabled' in changes) {
            this._updateState({ enabled: changes.globalEnabled.newValue });

            if (!changes.globalEnabled.newValue) {
                this._cleanup(false);
            } else {
                this._detectAndInitialize();
            }
        }

        // Update site-specific enabled
        if ('sites' in changes) {
            const siteEnabled = changes.sites.newValue?.[this.state.siteName]?.enabled;
            if (siteEnabled === false && this.adapter) {
                this._cleanup(false);
            } else if (siteEnabled === true && !this.adapter) {
                this._detectAndInitialize();
            }
        }

        // Update safety settings
        if ('safety' in changes) {
            safetyController.configure(changes.safety.newValue);
        }

        // Update hotkey settings
        if ('hotkeys' in changes) {
            hotkeyManager.configure(changes.hotkeys.newValue);
        }
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        this.state.paused = !this.state.paused;
        logger.info(`Auto-scroll ${this.state.paused ? 'paused' : 'resumed'}`);
        this._sendStatsUpdate();
    }

    /**
     * Manual scroll to next video
     */
    async scrollNext() {
        if (!this.adapter) return;
        await this._performScroll();
    }

    /**
     * Manual scroll to previous video
     */
    async scrollPrevious() {
        if (!this.adapter) return;

        const result = await scrollManager.scrollToPrevious(this.adapter, this.currentVideo);

        if (result.success) {
            logger.info('Scrolled to previous video');

            await this._delay(300);
            const newVideo = this.adapter.findActiveVideo();
            if (newVideo) {
                this._attachToVideo(newVideo);
            }
        }
    }

    /**
     * Update state
     */
    _updateState(updates) {
        this.state = { ...this.state, ...updates };
    }

    /**
     * Cleanup resources
     */
    _cleanup(full = true) {
        if (this.adapter) {
            this.adapter.destroy();
            this.adapter = null;
        }

        this.endDetector.detach();
        this.currentVideo = null;
        this._scrollPending = false;

        if (this._mutationObserver) {
            this._mutationObserver.disconnect();
            this._mutationObserver = null;
        }

        if (full) {
            if (this._urlCheckInterval) {
                clearInterval(this._urlCheckInterval);
                this._urlCheckInterval = null;
            }

            safetyController.cleanup();
            hotkeyManager.cleanup();
        }

        logger.debug('Controller cleaned up');
    }

    /**
     * Debounce helper
     */
    _debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    }

    /**
     * Delay helper
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const controller = new Controller();
export default Controller;
