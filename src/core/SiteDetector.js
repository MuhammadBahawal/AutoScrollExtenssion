/**
 * Site Detector - Detects which platform the user is on and selects the appropriate adapter
 */

import { logger } from './Logger.js';

// Import adapters (will be loaded dynamically in content.js)
// This module just provides the detection logic

class SiteDetector {
    constructor() {
        this.adapters = [];
        this.currentSite = null;
        this.currentPageType = null;
    }

    /**
     * Register an adapter class
     */
    registerAdapter(AdapterClass) {
        this.adapters.push(AdapterClass);
        logger.debug(`Registered adapter: ${AdapterClass.siteName}`);
    }

    /**
     * Register multiple adapters
     */
    registerAdapters(adapterClasses) {
        adapterClasses.forEach(cls => this.registerAdapter(cls));
    }

    /**
     * Detect which site the current page belongs to
     */
    detect(url = window.location.href, doc = document) {
        for (const AdapterClass of this.adapters) {
            if (AdapterClass.isMatch(url, doc)) {
                const pageType = AdapterClass.getPageType(url, doc);

                this.currentSite = AdapterClass.siteName;
                this.currentPageType = pageType;

                logger.info(`Site detected: ${AdapterClass.siteName} (${pageType})`);

                return {
                    AdapterClass,
                    siteName: AdapterClass.siteName,
                    pageType,
                    isSupported: AdapterClass.isSupportedPageType(pageType)
                };
            }
        }

        this.currentSite = null;
        this.currentPageType = null;

        logger.debug('No matching site detected');
        return null;
    }

    /**
     * Get current site name
     */
    getCurrentSite() {
        return this.currentSite;
    }

    /**
     * Get current page type
     */
    getCurrentPageType() {
        return this.currentPageType;
    }

    /**
     * Get list of supported sites
     */
    getSupportedSites() {
        return this.adapters.map(a => ({
            name: a.siteName,
            displayName: a.displayName || a.siteName,
            supportedPageTypes: a.supportedPageTypes || []
        }));
    }

    /**
     * Check if current URL matches any supported site
     */
    isOnSupportedSite() {
        const detection = this.detect();
        return detection !== null && detection.isSupported;
    }
}

export const siteDetector = new SiteDetector();
export default SiteDetector;
