/**
 * Scroll Manager - Orchestrates scroll operations with retry logic
 */

import { logger } from './Logger.js';

class ScrollManager {
    constructor() {
        this.options = {
            scrollFactor: 0.95,
            retryAttempts: 3,
            scrollTimeout: 800,
            retryDelay: 300
        };
        this.scrollLock = false;
    }

    /**
     * Configure options
     */
    configure(options = {}) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Check if scroll is currently in progress
     */
    isScrolling() {
        return this.scrollLock;
    }

    /**
     * Scroll to next video using adapter's scroll methods
     */
    async scrollToNext(adapter, previousVideo) {
        if (this.scrollLock) {
            logger.debug('ScrollManager: Scroll already in progress');
            return { success: false, reason: 'scroll_locked' };
        }

        this.scrollLock = true;
        const methods = adapter.getScrollMethods();

        try {
            for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
                logger.debug(`ScrollManager: Attempt ${attempt + 1}/${this.options.retryAttempts}`);

                for (const method of methods) {
                    try {
                        logger.debug(`ScrollManager: Trying method "${method.name}"`);

                        await method.execute(this);
                        await this._waitForScrollComplete();

                        const currentVideo = adapter.findActiveVideo();

                        if (currentVideo && currentVideo !== previousVideo) {
                            logger.info(`ScrollManager: Success with method "${method.name}" on attempt ${attempt + 1}`);
                            return {
                                success: true,
                                method: method.name,
                                attempt: attempt + 1
                            };
                        }
                    } catch (error) {
                        logger.warn(`ScrollManager: Method "${method.name}" failed:`, error.message);
                    }
                }

                // Wait before retry
                if (attempt < this.options.retryAttempts - 1) {
                    logger.debug('ScrollManager: Waiting before retry...');
                    await this._delay(this.options.retryDelay);
                }
            }

            logger.warn('ScrollManager: All scroll attempts failed');
            return { success: false, reason: 'all_methods_failed' };

        } finally {
            this.scrollLock = false;
        }
    }

    /**
     * Scroll to previous video
     */
    async scrollToPrevious(adapter, currentVideo) {
        if (this.scrollLock) {
            return { success: false, reason: 'scroll_locked' };
        }

        this.scrollLock = true;

        try {
            // Try scrolling up by viewport
            this.scrollByViewport(-this.options.scrollFactor);
            await this._waitForScrollComplete();

            const newVideo = adapter.findActiveVideo();
            if (newVideo && newVideo !== currentVideo) {
                return { success: true, method: 'scroll_up' };
            }

            // Try ArrowUp key
            this.simulateKeyDown('ArrowUp');
            await this._waitForScrollComplete();

            const afterKeyVideo = adapter.findActiveVideo();
            if (afterKeyVideo && afterKeyVideo !== currentVideo) {
                return { success: true, method: 'arrow_up' };
            }

            return { success: false, reason: 'could_not_scroll_up' };

        } finally {
            this.scrollLock = false;
        }
    }

    /**
     * Wait for scroll animation to complete
     */
    _waitForScrollComplete(timeout = null) {
        return new Promise(resolve => {
            setTimeout(resolve, timeout || this.options.scrollTimeout);
        });
    }

    /**
     * Simple delay
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== Scroll Utilities ====================

    /**
     * Scroll window by viewport factor
     */
    scrollByViewport(factor = this.options.scrollFactor) {
        const amount = window.innerHeight * factor;
        window.scrollBy({
            top: amount,
            left: 0,
            behavior: 'smooth'
        });
        logger.debug(`ScrollManager: Scrolled window by ${amount.toFixed(0)}px`);
    }

    /**
     * Scroll a container element
     */
    scrollContainerBy(container, amount) {
        if (!container) {
            logger.warn('ScrollManager: No container provided');
            return;
        }

        container.scrollBy({
            top: amount,
            left: 0,
            behavior: 'smooth'
        });
        logger.debug(`ScrollManager: Scrolled container by ${amount.toFixed(0)}px`);
    }

    /**
     * Scroll element into view
     */
    scrollIntoView(element, options = {}) {
        if (!element) {
            logger.warn('ScrollManager: No element provided for scrollIntoView');
            return;
        }

        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            ...options
        });
        logger.debug('ScrollManager: Scrolled element into view');
    }

    /**
     * Simulate keyboard key press
     */
    simulateKeyDown(key, target = null) {
        const targetEl = target || document.activeElement || document.body;

        const keyCode = this._getKeyCode(key);

        const keydownEvent = new KeyboardEvent('keydown', {
            key: key,
            code: key,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        });

        const keyupEvent = new KeyboardEvent('keyup', {
            key: key,
            code: key,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        });

        targetEl.dispatchEvent(keydownEvent);

        // Also dispatch to document for sites that listen there
        document.dispatchEvent(keydownEvent);

        // Dispatch keyup after small delay
        setTimeout(() => {
            targetEl.dispatchEvent(keyupEvent);
            document.dispatchEvent(keyupEvent);
        }, 50);

        logger.debug(`ScrollManager: Simulated ${key} key press`);
    }

    /**
     * Get keyCode for common keys
     */
    _getKeyCode(key) {
        const codes = {
            'ArrowDown': 40,
            'ArrowUp': 38,
            'ArrowLeft': 37,
            'ArrowRight': 39,
            'Space': 32,
            'Enter': 13,
            'j': 74,
            'k': 75
        };
        return codes[key] || 0;
    }

    /**
     * Click an element
     */
    clickElement(element) {
        if (!element) {
            logger.warn('ScrollManager: No element to click');
            return false;
        }

        try {
            element.click();
            logger.debug('ScrollManager: Clicked element');
            return true;
        } catch (error) {
            logger.warn('ScrollManager: Click failed:', error.message);
            return false;
        }
    }

    /**
     * Find scrollable container
     */
    findScrollContainer(selectors = []) {
        const defaultSelectors = [
            'div[style*="overflow"][style*="auto"]',
            'div[style*="overflow"][style*="scroll"]',
            '[role="main"]',
            'main'
        ];

        const allSelectors = [...selectors, ...defaultSelectors];

        for (const selector of allSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const style = window.getComputedStyle(el);
                if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                    el.scrollHeight > el.clientHeight) {
                    return el;
                }
            }
        }

        // Fallback to document
        if (document.documentElement.scrollHeight > window.innerHeight) {
            return document.documentElement;
        }

        return null;
    }
}

export const scrollManager = new ScrollManager();
export default ScrollManager;
