/**
 * Safety Controller - Handles tab visibility, user interaction, and manual scroll detection
 */

import { logger } from './Logger.js';

class SafetyController {
    constructor() {
        this.options = {
            stopOnTabInactive: true,
            stopOnManualScroll: false,
            pauseOnInteraction: true,
            manualScrollCooldown: 2000,
            interactionCooldown: 1000
        };

        this.state = {
            tabActive: true,
            userScrolling: false,
            userInteracting: false,
            lastManualScrollTime: 0,
            lastInteractionTime: 0
        };

        this.callbacks = {
            onPause: null,
            onResume: null
        };

        this._boundHandlers = {};
        this._scrollTimeout = null;
        this._interactionTimeout = null;
    }

    /**
     * Configure options
     */
    configure(options = {}) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Set callbacks
     */
    setCallbacks(callbacks = {}) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Initialize all safety listeners
     */
    initialize() {
        this._setupVisibilityListener();
        this._setupScrollListener();
        this._setupInteractionListeners();

        logger.debug('SafetyController initialized');
    }

    /**
     * Setup tab visibility listener
     */
    _setupVisibilityListener() {
        this._boundHandlers.visibility = () => {
            const wasActive = this.state.tabActive;
            this.state.tabActive = !document.hidden;

            if (wasActive && !this.state.tabActive) {
                logger.debug('Tab became inactive');
                if (this.options.stopOnTabInactive) {
                    this._notifyPause('tab_inactive');
                }
            } else if (!wasActive && this.state.tabActive) {
                logger.debug('Tab became active');
                if (this.options.stopOnTabInactive) {
                    this._notifyResume('tab_active');
                }
            }
        };

        document.addEventListener('visibilitychange', this._boundHandlers.visibility);
    }

    /**
     * Setup manual scroll detection
     */
    _setupScrollListener() {
        let lastScrollTop = window.scrollY;
        let programmaticScroll = false;

        // Mark next scroll as programmatic
        this.markProgrammaticScroll = () => {
            programmaticScroll = true;
            setTimeout(() => { programmaticScroll = false; }, 100);
        };

        this._boundHandlers.scroll = () => {
            if (programmaticScroll) {
                programmaticScroll = false;
                return;
            }

            const now = Date.now();
            const scrollDelta = Math.abs(window.scrollY - lastScrollTop);

            // Only consider significant scrolls as manual
            if (scrollDelta > 50) {
                this.state.userScrolling = true;
                this.state.lastManualScrollTime = now;

                if (this._scrollTimeout) {
                    clearTimeout(this._scrollTimeout);
                }

                this._scrollTimeout = setTimeout(() => {
                    this.state.userScrolling = false;
                }, this.options.manualScrollCooldown);

                if (this.options.stopOnManualScroll) {
                    this._notifyPause('manual_scroll');
                }
            }

            lastScrollTop = window.scrollY;
        };

        window.addEventListener('scroll', this._boundHandlers.scroll, { passive: true });
    }

    /**
     * Setup user interaction listeners
     */
    _setupInteractionListeners() {
        const handleInteraction = (eventType) => {
            this.state.userInteracting = true;
            this.state.lastInteractionTime = Date.now();

            if (this._interactionTimeout) {
                clearTimeout(this._interactionTimeout);
            }

            this._interactionTimeout = setTimeout(() => {
                this.state.userInteracting = false;
            }, this.options.interactionCooldown);

            if (this.options.pauseOnInteraction) {
                logger.debug(`User interaction: ${eventType}`);
            }
        };

        // Track mouse interactions with video area
        this._boundHandlers.mousedown = (e) => {
            if (e.target.closest('video') || e.target.closest('[role="button"]')) {
                handleInteraction('mousedown');
            }
        };

        this._boundHandlers.touchstart = (e) => {
            if (e.target.closest('video') || e.target.closest('[role="button"]')) {
                handleInteraction('touchstart');
            }
        };

        document.addEventListener('mousedown', this._boundHandlers.mousedown, { passive: true });
        document.addEventListener('touchstart', this._boundHandlers.touchstart, { passive: true });
    }

    /**
     * Check if auto-scroll should be allowed
     */
    canAutoScroll() {
        // Tab must be active (if option enabled)
        if (this.options.stopOnTabInactive && !this.state.tabActive) {
            return { allowed: false, reason: 'tab_inactive' };
        }

        // User must not be scrolling (if option enabled)
        if (this.options.stopOnManualScroll && this.state.userScrolling) {
            return { allowed: false, reason: 'user_scrolling' };
        }

        // User must not be interacting (if option enabled)
        if (this.options.pauseOnInteraction && this.state.userInteracting) {
            return { allowed: false, reason: 'user_interacting' };
        }

        // Check cooldown after manual scroll
        if (this.options.stopOnManualScroll) {
            const timeSinceScroll = Date.now() - this.state.lastManualScrollTime;
            if (timeSinceScroll < this.options.manualScrollCooldown) {
                return { allowed: false, reason: 'scroll_cooldown' };
            }
        }

        return { allowed: true };
    }

    /**
     * Get current safety state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Check if tab is active
     */
    isTabActive() {
        return this.state.tabActive;
    }

    /**
     * Notify pause
     */
    _notifyPause(reason) {
        if (this.callbacks.onPause) {
            this.callbacks.onPause(reason);
        }
    }

    /**
     * Notify resume
     */
    _notifyResume(reason) {
        if (this.callbacks.onResume) {
            this.callbacks.onResume(reason);
        }
    }

    /**
     * Cleanup all listeners
     */
    cleanup() {
        document.removeEventListener('visibilitychange', this._boundHandlers.visibility);
        window.removeEventListener('scroll', this._boundHandlers.scroll);
        document.removeEventListener('mousedown', this._boundHandlers.mousedown);
        document.removeEventListener('touchstart', this._boundHandlers.touchstart);

        if (this._scrollTimeout) clearTimeout(this._scrollTimeout);
        if (this._interactionTimeout) clearTimeout(this._interactionTimeout);

        this._boundHandlers = {};
        logger.debug('SafetyController cleaned up');
    }
}

export const safetyController = new SafetyController();
export default SafetyController;
