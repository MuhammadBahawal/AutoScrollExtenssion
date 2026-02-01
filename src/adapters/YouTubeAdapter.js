/**
 * YouTube Adapter - Handles YouTube Shorts auto-scroll
 */

import BaseAdapter from './BaseAdapter.js';
import { logger } from '../core/Logger.js';

class YouTubeAdapter extends BaseAdapter {
    static siteName = 'youtube';
    static displayName = 'YouTube';
    static supportedPageTypes = ['shorts'];

    static isMatch(url) {
        return /youtube\.com/.test(url) || /youtu\.be/.test(url);
    }

    static getPageType(url) {
        if (/\/shorts\//.test(url)) return 'shorts';
        if (/\/watch/.test(url)) return 'watch';
        if (/\/playlist/.test(url)) return 'playlist';
        if (/\/@/.test(url)) return 'channel';
        return 'home';
    }

    constructor(controller) {
        super(controller);
        this.videoSelector = 'video';
    }

    onInitialize() {
        logger.debug('YouTube adapter initialized', {
            pageType: this.getCurrentPageType(),
            isShorts: this.getCurrentPageType() === 'shorts'
        });
    }

    findAllVideos() {
        const pageType = this.getCurrentPageType();

        if (pageType === 'shorts') {
            // Shorts have a specific container structure
            const shortsVideos = document.querySelectorAll('ytd-reel-video-renderer video, ytd-shorts video');
            if (shortsVideos.length > 0) {
                return Array.from(shortsVideos);
            }
        }

        return Array.from(document.querySelectorAll('video'));
    }

    getVideoContainer(video) {
        // YouTube Shorts uses reel-video-renderer
        return video.closest('ytd-reel-video-renderer') ||
            video.closest('ytd-shorts') ||
            video.closest('#shorts-container') ||
            video.parentElement;
    }

    findScrollContainer() {
        // Shorts uses a specific scrollable container
        const shortsContainer = document.querySelector('ytd-shorts');
        if (shortsContainer) {
            return shortsContainer;
        }

        const reelContainer = document.querySelector('#shorts-inner-container');
        if (reelContainer) {
            return reelContainer;
        }

        return null;
    }

    getScrollMethods() {
        return [
            {
                name: 'arrow_down',
                execute: (scrollManager) => {
                    // YouTube Shorts responds well to ArrowDown
                    scrollManager.simulateKeyDown('ArrowDown');
                }
            },
            {
                name: 'j_key',
                execute: (scrollManager) => {
                    // 'j' key also works on YouTube
                    scrollManager.simulateKeyDown('j');
                }
            },
            {
                name: 'click_nav_button',
                execute: async (scrollManager) => {
                    // Click the navigation button if available
                    const downButton = document.querySelector('#navigation-button-down button') ||
                        document.querySelector('[aria-label*="Next"]') ||
                        document.querySelector('ytd-shorts button[aria-label*="Down"]');
                    if (downButton) {
                        scrollManager.clickElement(downButton);
                    }
                }
            },
            {
                name: 'scroll_container',
                execute: (scrollManager) => {
                    const container = this.findScrollContainer();
                    if (container) {
                        scrollManager.scrollContainerBy(container, window.innerHeight);
                    } else {
                        scrollManager.scrollByViewport(1.0);
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
            }
        ];
    }
}

export default YouTubeAdapter;
