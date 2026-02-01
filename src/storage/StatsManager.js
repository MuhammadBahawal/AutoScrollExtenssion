/**
 * Stats Manager - Handles per-site and global statistics
 */

import { logger } from '../core/Logger.js';

class StatsManager {
    constructor() {
        this.stats = {
            global: {
                totalScrolls: 0,
                sessionScrolls: 0,
                lastScrollTime: null
            },
            sites: {}
        };
        this._initialized = false;
    }

    /**
     * Initialize stats from storage
     */
    async initialize() {
        if (this._initialized) return this.stats;

        try {
            const stored = await this._loadFromStorage();
            if (stored.stats) {
                this.stats = {
                    ...this.stats,
                    ...stored.stats,
                    global: {
                        ...this.stats.global,
                        ...stored.stats.global,
                        sessionScrolls: 0 // Reset session on init
                    }
                };
            }
            this._initialized = true;
            logger.debug('Stats initialized:', this.stats);
            return this.stats;
        } catch (error) {
            logger.error('Failed to initialize stats:', error);
            return this.stats;
        }
    }

    /**
     * Load stats from storage
     */
    _loadFromStorage() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.get(['stats'], (result) => {
                    resolve(result || {});
                });
            } else {
                resolve({});
            }
        });
    }

    /**
     * Save stats to storage
     */
    async _saveToStorage() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({ stats: this.stats }, () => {
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Record a scroll event
     */
    async recordScroll(siteName) {
        const now = Date.now();

        // Update global stats
        this.stats.global.totalScrolls++;
        this.stats.global.sessionScrolls++;
        this.stats.global.lastScrollTime = now;

        // Update site stats
        if (!this.stats.sites[siteName]) {
            this.stats.sites[siteName] = {
                totalScrolls: 0,
                sessionScrolls: 0,
                lastScrollTime: null
            };
        }

        this.stats.sites[siteName].totalScrolls++;
        this.stats.sites[siteName].sessionScrolls++;
        this.stats.sites[siteName].lastScrollTime = now;

        await this._saveToStorage();
        logger.debug(`Scroll recorded for ${siteName}:`, this.stats.sites[siteName]);
    }

    /**
     * Get stats for a specific site
     */
    getSiteStats(siteName) {
        return this.stats.sites[siteName] || {
            totalScrolls: 0,
            sessionScrolls: 0,
            lastScrollTime: null
        };
    }

    /**
     * Get global stats
     */
    getGlobalStats() {
        return this.stats.global;
    }

    /**
     * Get all stats
     */
    getAllStats() {
        return this.stats;
    }

    /**
     * Reset session stats (call when extension starts)
     */
    resetSessionStats() {
        this.stats.global.sessionScrolls = 0;
        for (const site in this.stats.sites) {
            this.stats.sites[site].sessionScrolls = 0;
        }
        logger.debug('Session stats reset');
    }

    /**
     * Reset all stats
     */
    async resetAllStats() {
        this.stats = {
            global: {
                totalScrolls: 0,
                sessionScrolls: 0,
                lastScrollTime: null
            },
            sites: {}
        };
        await this._saveToStorage();
        logger.debug('All stats reset');
    }

    /**
     * Format time ago string
     */
    formatTimeAgo(timestamp) {
        if (!timestamp) return '--';

        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 5) return 'Just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
}

// Singleton instance
export const statsManager = new StatsManager();
export default statsManager;
