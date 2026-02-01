/**
 * Settings Manager - Handles loading, saving, and syncing settings
 */

import { DEFAULT_SETTINGS } from './defaults.js';
import { logger } from '../core/Logger.js';

class SettingsManager {
    constructor() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.listeners = new Set();
        this._initialized = false;
    }

    /**
     * Initialize settings from storage
     */
    async initialize() {
        if (this._initialized) return this.settings;

        try {
            const stored = await this._loadFromStorage();
            this.settings = this._mergeSettings(DEFAULT_SETTINGS, stored);
            this._setupChangeListener();
            this._initialized = true;
            logger.debug('Settings initialized:', this.settings);
            return this.settings;
        } catch (error) {
            logger.error('Failed to initialize settings:', error);
            return this.settings;
        }
    }

    /**
     * Load settings from chrome.storage.sync
     */
    _loadFromStorage() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
                chrome.storage.sync.get(null, (result) => {
                    resolve(result || {});
                });
            } else {
                resolve({});
            }
        });
    }

    /**
     * Deep merge settings with defaults
     */
    _mergeSettings(defaults, stored) {
        const merged = { ...defaults };

        for (const key in stored) {
            if (stored[key] !== undefined) {
                if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
                    merged[key] = this._mergeSettings(defaults[key], stored[key]);
                } else {
                    merged[key] = stored[key];
                }
            }
        }

        return merged;
    }

    /**
     * Setup listener for storage changes
     */
    _setupChangeListener() {
        if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'sync') {
                    this._handleChanges(changes);
                }
            });
        }
    }

    /**
     * Handle storage changes
     */
    _handleChanges(changes) {
        let hasChanges = false;

        for (const key in changes) {
            if (changes[key].newValue !== undefined) {
                this._setNestedValue(this.settings, key, changes[key].newValue);
                hasChanges = true;
                logger.debug(`Setting changed: ${key}`, changes[key].newValue);
            }
        }

        if (hasChanges) {
            this._notifyListeners(changes);
        }
    }

    /**
     * Set a nested value using dot notation
     */
    _setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in current)) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
    }

    /**
     * Get current settings
     */
    getSettings() {
        return this.settings;
    }

    /**
     * Get a specific setting value
     */
    get(key, defaultValue = undefined) {
        const keys = key.split('.');
        let value = this.settings;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * Save settings to storage
     */
    async save(newSettings) {
        try {
            const toSave = { ...this.settings, ...newSettings };

            await new Promise((resolve, reject) => {
                if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
                    chrome.storage.sync.set(toSave, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });

            this.settings = toSave;
            logger.debug('Settings saved:', toSave);
            return true;
        } catch (error) {
            logger.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Reset to default settings
     */
    async reset() {
        return this.save(DEFAULT_SETTINGS);
    }

    /**
     * Check if a site is enabled
     */
    isSiteEnabled(siteName) {
        return this.settings.globalEnabled &&
            (this.settings.sites?.[siteName]?.enabled ?? true);
    }

    /**
     * Add a settings change listener
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of changes
     */
    _notifyListeners(changes) {
        for (const listener of this.listeners) {
            try {
                listener(changes, this.settings);
            } catch (error) {
                logger.error('Settings listener error:', error);
            }
        }
    }
}

// Singleton instance
export const settingsManager = new SettingsManager();
export default settingsManager;
