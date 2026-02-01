/**
 * Facebook Adapter - Handles Facebook Reels auto-scroll
 */

import BaseAdapter from './BaseAdapter.js';
import { logger } from '../core/Logger.js';

class FacebookAdapter extends BaseAdapter {
    static siteName = 'facebook';
    static displayName = 'Facebook';
    static supportedPageTypes = ['reels', 'reel', 'watch'];

    static isMatch(url) {
        return /facebook\.com/.test(url) || /fb\.com/.test(url);
    }

    static getPageType(url) {
        if (/\/reel\//.test(url)) return 'reel';
        if (/\/reels/.test(url)) return 'reels';
        if (/\/watch/.test(url)) return 'watch';
        if (/\/videos\//.test(url)) return 'videos';
        return 'feed';
    }

    constructor(controller) {
        super(controller);
        this.videoSelector = 'video';
    }

    onInitialize() {
        logger.debug('Facebook adapter initialized', {
            pageType: this.getCurrentPageType()
        });
    }

    findAllVideos() {
        // Facebook videos can be in various containers
        const videos = Array.from(document.querySelectorAll('video'));

        // Filter to visible, reasonably sized videos
        return videos.filter(video => {
            const rect = video.getBoundingClientRect();
            return rect.width > 150 && rect.height > 200 &&
                rect.top < window.innerHeight && rect.bottom > 0;
        });
    }

    getVideoContainer(video) {
        // Facebook Reels have specific container structures
        // Try to find the reel item container
        return video.closest('div[data-pagelet*="Reel"]') ||
            video.closest('div[role="article"]') ||
            video.closest('div[class*="reel"]') ||
            video.closest('div[data-video-id]') ||
            video.parentElement?.parentElement?.parentElement;
    }

    findScrollContainer() {
        // Facebook Reels typically scroll within a specific container
        const reelsContainer = document.querySelector('div[data-pagelet="Reels"]');
        if (reelsContainer && reelsContainer.scrollHeight > reelsContainer.clientHeight) {
            return reelsContainer;
        }

        const mainContainer = document.querySelector('[role="main"]');
        if (mainContainer && mainContainer.scrollHeight > mainContainer.clientHeight) {
            return mainContainer;
        }

        return null;
    }

    getScrollMethods() {
        return [
            {
                name: 'arrow_down',
                execute: (scrollManager) => {
                    scrollManager.simulateKeyDown('ArrowDown');
                }
            },
            {
                name: 'scroll_window',
                execute: (scrollManager) => {
                    scrollManager.scrollByViewport(0.95);
                }
            },
            {
                name: 'scroll_container',
                execute: (scrollManager) => {
                    const container = this.findScrollContainer();
                    if (container) {
                        scrollManager.scrollContainerBy(container, window.innerHeight * 0.95);
                    }
                }
            },
            {
                name: 'scroll_next_reel',
                execute: async (scrollManager) => {
                    const videos = this.findAllVideos();
                    const current = this.findActiveVideo();
                    const currentIdx = videos.indexOf(current);

                    if (currentIdx >= 0 && currentIdx < videos.length - 1) {
                        const nextContainer = this.getVideoContainer(videos[currentIdx + 1]);
                        if (nextContainer) {
                            scrollManager.scrollIntoView(nextContainer);
                        }
                    }
                }
            },
            {
                name: 'click_next_button',
                execute: async (scrollManager) => {
                    // Facebook may have navigation buttons
                    const nextButton = document.querySelector('[aria-label*="Next"]') ||
                        document.querySelector('[aria-label*="next"]') ||
                        document.querySelector('div[data-pagelet*="Reel"] button[aria-label*="Down"]');
                    if (nextButton) {
                        scrollManager.clickElement(nextButton);
                    }
                }
            }
        ];
    }
}

export default FacebookAdapter;
