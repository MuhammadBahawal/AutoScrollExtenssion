/**
 * TikTok Adapter - Handles TikTok video feed auto-scroll
 */

import BaseAdapter from './BaseAdapter.js';
import { logger } from '../core/Logger.js';

class TikTokAdapter extends BaseAdapter {
    static siteName = 'tiktok';
    static displayName = 'TikTok';
    static supportedPageTypes = ['fyp', 'video', 'following', 'explore'];

    static isMatch(url) {
        return /tiktok\.com/.test(url);
    }

    static getPageType(url) {
        if (/\/@[^/]+\/video\//.test(url)) return 'video';
        if (/\/foryou/.test(url) || /tiktok\.com\/?(\?|$)/.test(url)) return 'fyp';
        if (/\/following/.test(url)) return 'following';
        if (/\/explore/.test(url)) return 'explore';
        if (/\/@/.test(url)) return 'profile';
        return 'other';
    }

    constructor(controller) {
        super(controller);
        this.videoSelector = 'video';
    }

    onInitialize() {
        logger.debug('TikTok adapter initialized', {
            pageType: this.getCurrentPageType()
        });
    }

    findAllVideos() {
        // TikTok's video structure varies - try multiple selectors
        const selectors = [
            'div[class*="DivVideoContainer"] video',
            'div[class*="VideoContainer"] video',
            'div[data-e2e="recommend-list-item"] video',
            'div[class*="video-card"] video',
            'video'
        ];

        for (const selector of selectors) {
            const videos = document.querySelectorAll(selector);
            if (videos.length > 0) {
                return Array.from(videos);
            }
        }

        return Array.from(document.querySelectorAll('video'));
    }

    getVideoContainer(video) {
        // TikTok uses various container classes
        return video.closest('div[class*="DivItemContainer"]') ||
            video.closest('div[class*="VideoContainer"]') ||
            video.closest('div[data-e2e="recommend-list-item"]') ||
            video.closest('div[class*="video-card"]') ||
            video.parentElement?.parentElement;
    }

    findScrollContainer() {
        // TikTok may use swiper-like containers
        const swiperContainer = document.querySelector('div[class*="swiper"]');
        if (swiperContainer && swiperContainer.scrollHeight > swiperContainer.clientHeight) {
            return swiperContainer;
        }

        const feedContainer = document.querySelector('div[class*="VideoFeed"]') ||
            document.querySelector('div[data-e2e="recommend-list"]');
        if (feedContainer) {
            return feedContainer;
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
                    scrollManager.scrollByViewport(1.0);
                }
            },
            {
                name: 'scroll_container',
                execute: (scrollManager) => {
                    const container = this.findScrollContainer();
                    if (container) {
                        scrollManager.scrollContainerBy(container, window.innerHeight);
                    }
                }
            },
            {
                name: 'scroll_next_item',
                execute: async (scrollManager) => {
                    const videos = this.findAllVideos();
                    const current = this.findActiveVideo();
                    const currentIdx = videos.indexOf(current);

                    if (currentIdx >= 0 && currentIdx < videos.length - 1) {
                        const nextContainer = this.getVideoContainer(videos[currentIdx + 1]);
                        if (nextContainer) {
                            scrollManager.scrollIntoView(nextContainer);
                        } else {
                            scrollManager.scrollIntoView(videos[currentIdx + 1]);
                        }
                    }
                }
            },
            {
                name: 'click_swipe_button',
                execute: async (scrollManager) => {
                    // TikTok sometimes has navigation buttons
                    const nextButton = document.querySelector('button[data-e2e="arrow-right"]') ||
                        document.querySelector('[class*="SwipeNavigation"] button:last-child');
                    if (nextButton) {
                        scrollManager.clickElement(nextButton);
                    }
                }
            }
        ];
    }
}

export default TikTokAdapter;
