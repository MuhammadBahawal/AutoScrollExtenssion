/**
 * Hotkey Manager - Handles keyboard shortcuts for the extension
 */

import { logger } from './Logger.js';

class HotkeyManager {
    constructor() {
        this.options = {
            enabled: true,
            togglePause: 'Space',
            scrollNext: 'ArrowDown',
            scrollPrev: 'ArrowUp'
        };

        this.callbacks = {
            onTogglePause: null,
            onScrollNext: null,
            onScrollPrev: null
        };

        this._boundHandler = null;
        this._active = false;
    }

    /**
     * Configure hotkeys
     */
    configure(options = {}) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Set callbacks for hotkey actions
     */
    setCallbacks(callbacks = {}) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Initialize hotkey listener
     */
    initialize() {
        if (this._active) return;

        this._boundHandler = (e) => this._handleKeyDown(e);
        document.addEventListener('keydown', this._boundHandler);
        this._active = true;

        logger.debug('HotkeyManager initialized');
    }

    /**
     * Handle keydown events
     */
    _handleKeyDown(event) {
        if (!this.options.enabled) return;

        // Don't capture if user is typing in an input
        if (this._isTypingContext(event.target)) {
            return;
        }

        const key = event.key;

        // Toggle pause/resume
        if (key === this.options.togglePause) {
            // Only handle Space if not in a focusable button context
            if (key === 'Space' && this._isButtonContext(event.target)) {
                return;
            }
            event.preventDefault();
            logger.debug('Hotkey: Toggle pause');
            if (this.callbacks.onTogglePause) {
                this.callbacks.onTogglePause();
            }
            return;
        }

        // Scroll next (when Ctrl/Cmd is held)
        if (key === this.options.scrollNext && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            logger.debug('Hotkey: Scroll next');
            if (this.callbacks.onScrollNext) {
                this.callbacks.onScrollNext();
            }
            return;
        }

        // Scroll previous (when Ctrl/Cmd is held)
        if (key === this.options.scrollPrev && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            logger.debug('Hotkey: Scroll previous');
            if (this.callbacks.onScrollPrev) {
                this.callbacks.onScrollPrev();
            }
            return;
        }
    }

    /**
     * Check if target is a text input context
     */
    _isTypingContext(target) {
        if (!target) return false;

        const tagName = target.tagName.toLowerCase();

        // Check for input elements
        if (tagName === 'input' || tagName === 'textarea') {
            return true;
        }

        // Check for contenteditable
        if (target.isContentEditable) {
            return true;
        }

        // Check for common comment/input containers
        if (target.closest('[role="textbox"]') ||
            target.closest('[contenteditable="true"]')) {
            return true;
        }

        return false;
    }

    /**
     * Check if target is a button context (for Space key)
     */
    _isButtonContext(target) {
        if (!target) return false;

        const tagName = target.tagName.toLowerCase();

        return tagName === 'button' ||
            tagName === 'a' ||
            target.closest('[role="button"]') !== null;
    }

    /**
     * Enable hotkeys
     */
    enable() {
        this.options.enabled = true;
        logger.debug('Hotkeys enabled');
    }

    /**
     * Disable hotkeys
     */
    disable() {
        this.options.enabled = false;
        logger.debug('Hotkeys disabled');
    }

    /**
     * Check if hotkeys are enabled
     */
    isEnabled() {
        return this.options.enabled;
    }

    /**
     * Get current hotkey configuration
     */
    getConfig() {
        return { ...this.options };
    }

    /**
     * Update a specific hotkey
     */
    setHotkey(action, key) {
        if (action in this.options && action !== 'enabled') {
            this.options[action] = key;
            logger.debug(`Hotkey updated: ${action} = ${key}`);
        }
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this._boundHandler) {
            document.removeEventListener('keydown', this._boundHandler);
            this._boundHandler = null;
        }
        this._active = false;
        logger.debug('HotkeyManager cleaned up');
    }
}

export const hotkeyManager = new HotkeyManager();
export default HotkeyManager;
