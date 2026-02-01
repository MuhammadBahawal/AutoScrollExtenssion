/**
 * Instagram Adapter - Handles Instagram Reels auto-scroll
 */

import BaseAdapter from './BaseAdapter.js';
import { logger } from '../core/Logger.js';

class InstagramAdapter extends BaseAdapter {
    static siteName = 'instagram';
    static displayName = 'Instagram';
    static supportedPageTypes = ['reels', 'reel'];

    static isMatch(url) {
        return /instagram\.com/.test(url);
    }

    static getPageType(url) {
        if (/\/reels\/?(\?|$)/.test(url)) return 'reels';
        if (/\/reel\//.test(url)) return 'reel';
        if (/\/stories\//.test(url)) return 'stories';
        if (/\/p\//.test(url)) return 'post';
        return 'feed';
    }

    constructor(controller) {
        super(controller);
        this.videoSelector = 'video';
        this.scrollContainerSelectors = [
            'div[style*="overflow"][style*="auto"]',
            'div[style*="overflow"][style*="scroll"]',
            'section main div[style*="overflow"]',
            'div._aagw',
            'div[role="main"]'
        ];
    }

    onInitialize() {
        logger.debug('Instagram adapter initialized', {
            pageType: this.getCurrentPageType(),
            videosFound: this.findAllVideos().length
        });
    }

    findAllVideos() {
        // Instagram wraps videos in specific containers
        const videos = Array.from(document.querySelectorAll('video'));

        // Filter to only include reel videos (larger, centered videos)
        return videos.filter(video => {
            const rect = video.getBoundingClientRect();
            // Reel videos are typically large and take up significant viewport
            return rect.width > 200 && rect.height > 300;
        });
    }

    getVideoContainer(video) {
        // Instagram uses presentation divs or article elements
        return video.closest('div[role="presentation"]') ||
            video.closest('article') ||
            video.closest('div[class*="reel"]') ||
            video.parentElement?.parentElement;
    }

    findScrollContainer() {
        for (const selector of this.scrollContainerSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const style = window.getComputedStyle(el);
                if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                    el.scrollHeight > el.clientHeight) {
                    return el;
                }
            }
        }

        // Check if document itself is scrollable
        if (document.documentElement.scrollHeight > window.innerHeight) {
            return document.documentElement;
        }

        return null;
    }

    getScrollMethods() {
        return [
            {
                name: 'arrow_down',
                execute: (scrollManager) => {
                    const video = this.findActiveVideo();
                    scrollManager.simulateKeyDown('ArrowDown', video || document.body);
                }
            },
            {
                name: 'scroll_container',
                execute: (scrollManager) => {
                    const container = this.findScrollContainer();
                    if (container && container !== document.documentElement) {
                        scrollManager.scrollContainerBy(container, window.innerHeight * 0.95);
                    } else {
                        scrollManager.scrollByViewport(0.95);
                    }
                }
            },
            {
                name: 'scroll_into_view',
                execute: async (scrollManager) => {
                    const videos = this.findAllVideos();
                    const current = this.findActiveVideo();
                    const currentIdx = videos.indexOf(current);

                    if (currentIdx >= 0 && currentIdx < videos.length - 1) {
                        const nextVideo = videos[currentIdx + 1];
                        scrollManager.scrollIntoView(nextVideo);
                    }
                }
            },
            {
                name: 'scroll_next_container',
                execute: async (scrollManager) => {
                    const current = this.findActiveVideo();
                    if (!current) return;

                    const container = this.getVideoContainer(current);
                    if (container?.nextElementSibling) {
                        scrollManager.scrollIntoView(container.nextElementSibling);
                    }
                }
            },
            {
                name: 'large_scroll',
                execute: (scrollManager) => {
                    // Larger scroll as final fallback
                    scrollManager.scrollByViewport(1.2);
                }
            }
        ];
    }
}

export default InstagramAdapter;
