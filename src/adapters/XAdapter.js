/**
 * X (Twitter) Adapter - Handles Twitter/X video feed auto-scroll
 */

import BaseAdapter from './BaseAdapter.js';
import { logger } from '../core/Logger.js';

class XAdapter extends BaseAdapter {
    static siteName = 'x';
    static displayName = 'X (Twitter)';
    static supportedPageTypes = ['timeline', 'status', 'video_feed', 'explore'];

    static isMatch(url) {
        return /twitter\.com/.test(url) || /x\.com/.test(url);
    }

    static getPageType(url) {
        if (/\/status\//.test(url)) return 'status';
        if (/\/i\/videos/.test(url)) return 'video_feed';
        if (/\/explore/.test(url)) return 'explore';
        if (/\/search/.test(url)) return 'search';
        if (/\/home/.test(url) || /\/(twitter|x)\.com\/?$/.test(url)) return 'timeline';
        return 'timeline';
    }

    constructor(controller) {
        super(controller);
        this.videoSelector = 'video';
    }

    onInitialize() {
        logger.debug('X adapter initialized', {
            pageType: this.getCurrentPageType()
        });
    }

    findAllVideos() {
        // X/Twitter videos are typically in article or specific containers
        const selectors = [
            'article video',
            'div[data-testid="videoPlayer"] video',
            'div[data-testid="videoComponent"] video',
            'video'
        ];

        for (const selector of selectors) {
            const videos = document.querySelectorAll(selector);
            // Filter for actual video content (not just tiny previews)
            const validVideos = Array.from(videos).filter(v => {
                const rect = v.getBoundingClientRect();
                return rect.width > 100 && rect.height > 100;
            });
            if (validVideos.length > 0) {
                return validVideos;
            }
        }

        return Array.from(document.querySelectorAll('video'));
    }

    getVideoContainer(video) {
        // Videos are in tweets (articles)
        return video.closest('article') ||
            video.closest('div[data-testid="tweet"]') ||
            video.closest('div[data-testid="videoPlayer"]')?.closest('article') ||
            video.parentElement?.parentElement;
    }

    findScrollContainer() {
        // Twitter uses the main timeline container
        const timeline = document.querySelector('[data-testid="primaryColumn"]');
        if (timeline && timeline.scrollHeight > timeline.clientHeight) {
            return timeline;
        }

        return null;
    }

    getScrollMethods() {
        return [
            {
                name: 'j_key',
                execute: (scrollManager) => {
                    // Twitter/X uses j/k for navigation
                    scrollManager.simulateKeyDown('j');
                }
            },
            {
                name: 'scroll_window',
                execute: (scrollManager) => {
                    scrollManager.scrollByViewport(0.8);
                }
            },
            {
                name: 'scroll_to_next_article',
                execute: async (scrollManager) => {
                    const current = this.findActiveVideo();
                    if (!current) return;

                    const article = this.getVideoContainer(current);
                    if (article) {
                        // Find next article with video
                        let nextElement = article.nextElementSibling;
                        while (nextElement) {
                            if (nextElement.querySelector('video')) {
                                scrollManager.scrollIntoView(nextElement);
                                return;
                            }
                            nextElement = nextElement.nextElementSibling;
                        }
                    }

                    // Fallback to viewport scroll
                    scrollManager.scrollByViewport(0.8);
                }
            },
            {
                name: 'scroll_into_view',
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

export default XAdapter;
