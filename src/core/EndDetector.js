/**
 * End Detector - Detects when a video ends or loops
 * Uses multiple detection methods for reliability
 */

import { logger } from './Logger.js';

class EndDetector {
    constructor() {
        this.video = null;
        this.onEndCallback = null;
        this.boundHandlers = {};
        this.lastKnownTime = 0;
        this.wasNearEnd = false;
        this.triggered = false;
        this.options = {
            epsilon: 0.5,         // Seconds before end to consider "near end"
            loopThreshold: 2,     // Seconds to detect loop jump
            minDuration: 1        // Minimum video duration to process
        };
    }

    /**
     * Configure options
     */
    configure(options = {}) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Attach to a video element
     */
    attach(video, onEnd) {
        if (!video) {
            logger.warn('EndDetector: Cannot attach to null video');
            return;
        }

        // Detach from previous video if any
        this.detach();

        this.video = video;
        this.onEndCallback = onEnd;
        this.lastKnownTime = video.currentTime || 0;
        this.wasNearEnd = false;
        this.triggered = false;

        // Method 1: Native 'ended' event
        this.boundHandlers.ended = () => this._handleEnded();
        video.addEventListener('ended', this.boundHandlers.ended);

        // Method 2: timeupdate for near-end and loop detection
        this.boundHandlers.timeupdate = (e) => this._handleTimeUpdate(e);
        video.addEventListener('timeupdate', this.boundHandlers.timeupdate);

        // Method 3: Pause event (as fallback)
        this.boundHandlers.pause = () => this._handlePause();
        video.addEventListener('pause', this.boundHandlers.pause);

        // Reset tracking on seeking
        this.boundHandlers.seeking = () => this._handleSeeking();
        video.addEventListener('seeking', this.boundHandlers.seeking);

        // Reset on play
        this.boundHandlers.play = () => this._handlePlay();
        video.addEventListener('play', this.boundHandlers.play);

        logger.debug('EndDetector attached to video', {
            duration: video.duration,
            currentTime: video.currentTime
        });
    }

    /**
     * Handle native ended event
     */
    _handleEnded() {
        if (this.triggered) return;
        logger.debug('EndDetector: Native ended event fired');
        this._triggerEnd('ended_event');
    }

    /**
     * Handle timeupdate for near-end and loop detection
     */
    _handleTimeUpdate(event) {
        const video = event.target;
        if (!video || this.triggered) return;

        const { duration, currentTime } = video;

        // Skip if duration is invalid
        if (!duration || !isFinite(duration) || duration < this.options.minDuration) {
            return;
        }

        const timeRemaining = duration - currentTime;

        // Loop detection: Video jumped from near-end back to start
        if (currentTime < this.options.loopThreshold &&
            this.lastKnownTime > duration - this.options.loopThreshold &&
            this.wasNearEnd) {
            logger.debug('EndDetector: Loop detected', {
                lastKnownTime: this.lastKnownTime,
                currentTime,
                duration
            });
            this._triggerEnd('loop_detected');
            this.lastKnownTime = currentTime;
            return;
        }

        // Near-end detection
        if (timeRemaining < this.options.epsilon) {
            this.wasNearEnd = true;

            // Very close to end threshold
            if (timeRemaining < 0.15) {
                logger.debug('EndDetector: Threshold reached', {
                    currentTime,
                    duration,
                    timeRemaining
                });
                this._triggerEnd('threshold_reached');
                return;
            }
        }

        this.lastKnownTime = currentTime;
    }

    /**
     * Handle pause event (can indicate end on some platforms)
     */
    _handlePause() {
        const video = this.video;
        if (!video || this.triggered) return;

        // Check if paused at the very end
        if (video.duration && isFinite(video.duration)) {
            const timeRemaining = video.duration - video.currentTime;
            if (timeRemaining < 0.5 && video.ended) {
                logger.debug('EndDetector: Pause at end detected');
                this._triggerEnd('pause_at_end');
            }
        }
    }

    /**
     * Handle seek event - reset tracking
     */
    _handleSeeking() {
        this.wasNearEnd = false;
        // Reset triggered flag only if seeking away from end
        if (this.video && this.video.duration) {
            const timeRemaining = this.video.duration - this.video.currentTime;
            if (timeRemaining > 2) {
                this.triggered = false;
            }
        }
    }

    /**
     * Handle play event - reset triggered flag for new playback
     */
    _handlePlay() {
        if (this.video && this.video.currentTime < 1) {
            this.triggered = false;
            this.wasNearEnd = false;
        }
    }

    /**
     * Trigger end callback
     */
    _triggerEnd(reason) {
        if (this.triggered) return;
        this.triggered = true;

        logger.info(`Video ended: ${reason}`);

        if (this.onEndCallback) {
            this.onEndCallback({
                reason,
                video: this.video,
                duration: this.video?.duration,
                currentTime: this.video?.currentTime
            });
        }
    }

    /**
     * Reset the triggered state (call after scroll to allow next detection)
     */
    reset() {
        this.triggered = false;
        this.wasNearEnd = false;
        this.lastKnownTime = this.video?.currentTime || 0;
        logger.debug('EndDetector reset');
    }

    /**
     * Get current video info
     */
    getVideoInfo() {
        if (!this.video) return null;

        return {
            duration: this.video.duration,
            currentTime: this.video.currentTime,
            paused: this.video.paused,
            ended: this.video.ended,
            readyState: this.video.readyState
        };
    }

    /**
     * Check if duration is available
     */
    hasDuration() {
        return this.video &&
            this.video.duration &&
            isFinite(this.video.duration) &&
            this.video.duration > 0;
    }

    /**
     * Detach from current video
     */
    detach() {
        if (this.video && this.boundHandlers) {
            for (const [event, handler] of Object.entries(this.boundHandlers)) {
                this.video.removeEventListener(event, handler);
            }
        }

        this.video = null;
        this.onEndCallback = null;
        this.boundHandlers = {};
        this.lastKnownTime = 0;
        this.wasNearEnd = false;
        this.triggered = false;

        logger.debug('EndDetector detached');
    }

    /**
     * Check if currently attached to a video
     */
    isAttached() {
        return this.video !== null;
    }
}

export const endDetector = new EndDetector();
export default EndDetector;
