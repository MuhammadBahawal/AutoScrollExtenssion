/**
 * Logger utility for AutoScroll extension
 * Provides debug and always-on logging with consistent formatting
 */

const LOG_PREFIX = '[AutoScroll]';

class Logger {
    constructor() {
        this.debugEnabled = false;
        this.siteName = '';
    }

    setDebugEnabled(enabled) {
        this.debugEnabled = enabled;
    }

    setSiteName(name) {
        this.siteName = name;
    }

    _formatPrefix() {
        return this.siteName
            ? `${LOG_PREFIX}[${this.siteName}]`
            : LOG_PREFIX;
    }

    /**
     * Debug log - only shows when debug logging is enabled
     */
    debug(...args) {
        if (this.debugEnabled) {
            console.log(this._formatPrefix(), ...args);
        }
    }

    /**
     * Info log - always shows
     */
    info(...args) {
        console.log(this._formatPrefix(), ...args);
    }

    /**
     * Warning log - always shows
     */
    warn(...args) {
        console.warn(this._formatPrefix(), ...args);
    }

    /**
     * Error log - always shows
     */
    error(...args) {
        console.error(this._formatPrefix(), ...args);
    }

    /**
     * Group logs together
     */
    group(label) {
        if (this.debugEnabled) {
            console.group(`${this._formatPrefix()} ${label}`);
        }
    }

    groupEnd() {
        if (this.debugEnabled) {
            console.groupEnd();
        }
    }

    /**
     * Log with timing
     */
    time(label) {
        if (this.debugEnabled) {
            console.time(`${this._formatPrefix()} ${label}`);
        }
    }

    timeEnd(label) {
        if (this.debugEnabled) {
            console.timeEnd(`${this._formatPrefix()} ${label}`);
        }
    }
}

// Singleton instance
export const logger = new Logger();
export default logger;
