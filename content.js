/**
 * AutoScroll Extension - Content Script
 * Multi-platform video auto-scroller with proper adapter pattern
 * v2.1.0 - Bug fixes for settings, state sync, and platform support
 */

(function () {
  'use strict';

  // ============================================================================
  // CONFIGURATION & DEFAULTS
  // ============================================================================

  const VERSION = '2.1.0';
  const LOG_PREFIX = '[AutoScroll]';

  const DEFAULT_SETTINGS = {
    globalEnabled: true,
    theme: 'dark',
    sites: {
      instagram: { enabled: true },
      youtube: { enabled: true },
      tiktok: { enabled: true },
      x: { enabled: true },
      facebook: { enabled: true }
    },
    delayAfterEnd: 600,
    randomExtraDelay: 200,
    scrollFactor: 0.95,
    retryAttempts: 3,
    hotkeys: {
      enabled: true,
      togglePause: 'Space'
    },
    safety: {
      stopOnTabInactive: true,
      stopOnManualScroll: false,
      pauseOnInteraction: true
    },
    debugLogging: true  // Enable by default for debugging
  };

  // ============================================================================
  // STATE
  // ============================================================================

  let settings = null;  // Will be loaded from storage
  let currentAdapter = null;
  let currentVideo = null;
  let isRunning = false;
  let isPaused = false;
  let scrollLock = false;
  let endedDebounce = false;

  // Video tracking state
  let lastKnownTime = 0;
  let wasNearEnd = false;
  let loopCount = 0;

  // Session stats
  const sessionStats = {
    scrollCount: 0,
    lastScrollTime: null,
    lastVideoInfo: { duration: 0, currentTime: 0 },
    lastScrollMethod: null,
    lastError: null
  };

  // Observers
  let mutationObserver = null;
  let urlCheckInterval = null;
  let lastUrl = window.location.href;

  // ============================================================================
  // LOGGING
  // ============================================================================

  function debugLog(...args) {
    if (settings?.debugLogging) {
      const site = currentAdapter?.name || 'init';
      console.log(`${LOG_PREFIX}[${site}]`, ...args);
    }
  }

  function log(...args) {
    const site = currentAdapter?.name || 'init';
    console.log(`${LOG_PREFIX}[${site}]`, ...args);
  }

  function error(...args) {
    const site = currentAdapter?.name || 'init';
    console.error(`${LOG_PREFIX}[${site}]`, ...args);
    sessionStats.lastError = args.join(' ');
  }

  // ============================================================================
  // SETTINGS MANAGEMENT
  // ============================================================================

  async function loadSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
        chrome.storage.sync.get(null, (result) => {
          // Deep merge with defaults
          settings = deepMerge(DEFAULT_SETTINGS, result || {});
          debugLog('Settings loaded:', settings);
          resolve(settings);
        });
      } else {
        settings = { ...DEFAULT_SETTINGS };
        resolve(settings);
      }
    });
  }

  function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] !== undefined) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    return result;
  }

  function setupSettingsListener() {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(async (changes, areaName) => {
        if (areaName === 'sync') {
          debugLog('Settings changed:', Object.keys(changes));

          // Reload ALL settings to ensure consistency
          await loadSettings();

          // Re-evaluate running state
          evaluateRunningState();
        }
      });
    }
  }

  function isSiteEnabled(siteName) {
    if (!settings) return false;
    if (!settings.globalEnabled) return false;
    if (!siteName) return false;
    return settings.sites?.[siteName]?.enabled ?? true;
  }

  function evaluateRunningState() {
    const shouldRun = currentAdapter &&
      currentAdapter.isSupported(window.location.href) &&
      isSiteEnabled(currentAdapter.name);

    debugLog(`Evaluating state: shouldRun=${shouldRun}, isRunning=${isRunning}`);

    if (shouldRun && !isRunning) {
      startTracking();
    } else if (!shouldRun && isRunning) {
      stopTracking();
    }
  }

  // ============================================================================
  // PLATFORM ADAPTERS
  // ============================================================================

  const InstagramAdapter = {
    name: 'instagram',
    displayName: 'Instagram Reels',

    isMatch(url) {
      return /instagram\.com/i.test(url);
    },

    isSupported(url) {
      const path = new URL(url).pathname;
      return /\/reels?\/?/i.test(path) || /\/reel\//i.test(path);
    },

    findActiveVideo() {
      const videos = Array.from(document.querySelectorAll('video'));
      return this._findBestVideo(videos);
    },

    _findBestVideo(videos) {
      let bestVideo = null;
      let bestScore = 0;

      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 100) continue;

        let score = 0;

        // Visibility score
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(window.innerHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const visibilityRatio = rect.height > 0 ? visibleHeight / rect.height : 0;
        score += visibilityRatio * 0.4;

        // Playing bonus
        if (!video.paused && video.readyState >= 2) score += 0.3;

        // Center proximity
        const videoCenter = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const centerDistance = Math.abs(videoCenter - viewportCenter);
        score += (1 - Math.min(centerDistance / window.innerHeight, 1)) * 0.2;

        // Duration bonus
        if (video.duration && isFinite(video.duration) && video.duration > 1) score += 0.1;

        if (score > bestScore) {
          bestScore = score;
          bestVideo = video;
        }
      }

      return bestScore > 0.3 ? bestVideo : null;
    },

    goNext() {
      const methods = [
        // Method 1: ArrowDown key
        () => {
          debugLog('Instagram: Trying ArrowDown');
          const target = currentVideo || document.activeElement || document.body;
          target.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
          }));
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
          }));
        },
        // Method 2: Scroll container
        () => {
          debugLog('Instagram: Trying container scroll');
          const containers = [
            ...document.querySelectorAll('div[style*="overflow"]'),
            document.querySelector('[role="main"]'),
            document.querySelector('main')
          ].filter(Boolean);

          for (const container of containers) {
            const style = window.getComputedStyle(container);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
              container.scrollHeight > container.clientHeight) {
              container.scrollBy({ top: window.innerHeight * 0.95, behavior: 'smooth' });
              return;
            }
          }
          window.scrollBy({ top: window.innerHeight * 0.95, behavior: 'smooth' });
        },
        // Method 3: Large scroll
        () => {
          debugLog('Instagram: Trying large scroll');
          window.scrollBy({ top: window.innerHeight * 1.2, behavior: 'smooth' });
        }
      ];

      return methods;
    }
  };

  const YouTubeAdapter = {
    name: 'youtube',
    displayName: 'YouTube Shorts',

    isMatch(url) {
      return /youtube\.com/i.test(url) || /youtu\.be/i.test(url);
    },

    isSupported(url) {
      return /\/shorts\//i.test(url);
    },

    findActiveVideo() {
      // YouTube Shorts: Look for video in visible reel renderer
      const renderers = document.querySelectorAll('ytd-reel-video-renderer');

      for (const renderer of renderers) {
        const rect = renderer.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;

        // Check if this renderer is the visible one (center of viewport)
        if (centerY > 0 && centerY < window.innerHeight) {
          const video = renderer.querySelector('video');
          if (video) {
            return video;
          }
        }
      }

      // Fallback: find any playing video in viewport
      const videos = document.querySelectorAll('video');
      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        if (centerY > 0 && centerY < window.innerHeight && !video.paused) {
          return video;
        }
      }

      return null;
    },

    goNext() {
      const methods = [
        // Method 1: ArrowDown (YouTube's built-in navigation)
        () => {
          debugLog('YouTube: Trying ArrowDown');
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
          }));
        },
        // Method 2: 'j' key (also works for next)
        () => {
          debugLog('YouTube: Trying j key');
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'j', code: 'KeyJ', keyCode: 74, bubbles: true, cancelable: true
          }));
        },
        // Method 3: Click navigation button
        () => {
          debugLog('YouTube: Trying nav button click');
          const navButton = document.querySelector('#navigation-button-down button') ||
            document.querySelector('[aria-label*="Next"]') ||
            document.querySelector('button[aria-label*="next" i]');
          if (navButton) {
            navButton.click();
          }
        },
        // Method 4: Scroll the shorts container
        () => {
          debugLog('YouTube: Trying container scroll');
          const shortsContainer = document.querySelector('ytd-shorts') ||
            document.querySelector('#shorts-inner-container');
          if (shortsContainer) {
            shortsContainer.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
          } else {
            window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
          }
        }
      ];

      return methods;
    }
  };

  const TikTokAdapter = {
    name: 'tiktok',
    displayName: 'TikTok',

    isMatch(url) {
      return /tiktok\.com/i.test(url);
    },

    isSupported(url) {
      const path = new URL(url).pathname;
      // TikTok: homepage, foryou, video pages, explore
      return path === '/' ||
        /^\/foryou/i.test(path) ||
        /\/@[^/]+\/video\//i.test(path) ||
        /^\/explore/i.test(path);
    },

    findActiveVideo() {
      const videos = Array.from(document.querySelectorAll('video'));
      let bestVideo = null;
      let bestScore = 0;

      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        // TikTok videos are usually full-screen-ish
        if (rect.width < 200 || rect.height < 300) continue;

        const centerY = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const distance = Math.abs(centerY - viewportCenter);
        let score = 1 - (distance / window.innerHeight);

        // Bonus for playing
        if (!video.paused && video.readyState >= 2) score += 0.3;

        // Bonus for large size (main video, not thumbnail)
        if (rect.height > window.innerHeight * 0.5) score += 0.2;

        if (score > bestScore) {
          bestScore = score;
          bestVideo = video;
        }
      }

      return bestScore > 0.3 ? bestVideo : null;
    },

    goNext() {
      const methods = [
        // Method 1: ArrowDown
        () => {
          debugLog('TikTok: Trying ArrowDown');
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
          }));
        },
        // Method 2: Page Down
        () => {
          debugLog('TikTok: Trying PageDown');
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'PageDown', code: 'PageDown', keyCode: 34, bubbles: true, cancelable: true
          }));
        },
        // Method 3: Window scroll
        () => {
          debugLog('TikTok: Trying window scroll');
          window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
        },
        // Method 4: Swiper container scroll
        () => {
          debugLog('TikTok: Trying swiper scroll');
          const swiper = document.querySelector('[class*="swiper"]') ||
            document.querySelector('[class*="VideoFeed"]');
          if (swiper) {
            swiper.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
          }
        }
      ];

      return methods;
    }
  };

  const FacebookAdapter = {
    name: 'facebook',
    displayName: 'Facebook Reels',

    isMatch(url) {
      return /facebook\.com/i.test(url) || /fb\.com/i.test(url);
    },

    isSupported(url) {
      const path = new URL(url).pathname;
      return /\/reel\//i.test(path) ||
        /\/reels/i.test(path) ||
        /\/watch/i.test(path);
    },

    findActiveVideo() {
      const videos = Array.from(document.querySelectorAll('video'));
      let bestVideo = null;
      let bestScore = 0;

      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        if (rect.width < 150 || rect.height < 200) continue;

        // Check visibility
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        let score = 0;

        // Visibility
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(window.innerHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        score += (visibleHeight / rect.height) * 0.4;

        // Playing
        if (!video.paused) score += 0.3;

        // Center proximity
        const centerY = rect.top + rect.height / 2;
        const distance = Math.abs(centerY - window.innerHeight / 2);
        score += (1 - distance / window.innerHeight) * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestVideo = video;
        }
      }

      return bestScore > 0.3 ? bestVideo : null;
    },

    goNext() {
      const methods = [
        // Method 1: ArrowDown
        () => {
          debugLog('Facebook: Trying ArrowDown');
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
          }));
        },
        // Method 2: Window scroll
        () => {
          debugLog('Facebook: Trying window scroll');
          window.scrollBy({ top: window.innerHeight * 0.95, behavior: 'smooth' });
        },
        // Method 3: Find and scroll container
        () => {
          debugLog('Facebook: Trying container scroll');
          const container = document.querySelector('[role="main"]') ||
            document.querySelector('[data-pagelet*="Reel"]');
          if (container) {
            container.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
          }
        }
      ];

      return methods;
    }
  };

  const XAdapter = {
    name: 'x',
    displayName: 'X (Twitter)',

    isMatch(url) {
      return /twitter\.com/i.test(url) || /x\.com/i.test(url);
    },

    isSupported(url) {
      const path = new URL(url).pathname;
      // X: Home timeline, status pages with video, video tab
      return /^\/home/i.test(path) ||
        /\/status\//i.test(path) ||
        /\/i\/videos/i.test(path) ||
        path === '/';
    },

    findActiveVideo() {
      // Find videos in tweets
      const videos = Array.from(document.querySelectorAll('article video, [data-testid="videoPlayer"] video'));
      let bestVideo = null;
      let bestScore = 0;

      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 100) continue;
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        let score = 0;

        // Visibility
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(window.innerHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        score += (visibleHeight / rect.height) * 0.4;

        // Playing
        if (!video.paused) score += 0.3;

        // Center proximity
        const centerY = rect.top + rect.height / 2;
        const distance = Math.abs(centerY - window.innerHeight / 2);
        score += (1 - distance / window.innerHeight) * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestVideo = video;
        }
      }

      return bestScore > 0.3 ? bestVideo : null;
    },

    goNext() {
      const methods = [
        // Method 1: 'j' key (Twitter's navigation)
        () => {
          debugLog('X: Trying j key');
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'j', code: 'KeyJ', keyCode: 74, bubbles: true, cancelable: true
          }));
        },
        // Method 2: ArrowDown
        () => {
          debugLog('X: Trying ArrowDown');
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
          }));
        },
        // Method 3: Scroll to next article with video
        () => {
          debugLog('X: Trying article scroll');
          if (currentVideo) {
            const article = currentVideo.closest('article');
            if (article) {
              let next = article.nextElementSibling;
              while (next && !next.querySelector('video')) {
                next = next.nextElementSibling;
              }
              if (next) {
                next.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
              }
            }
          }
          window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        }
      ];

      return methods;
    }
  };

  // All adapters in priority order
  const ADAPTERS = [
    InstagramAdapter,
    YouTubeAdapter,
    TikTokAdapter,
    FacebookAdapter,
    XAdapter
  ];

  function detectAdapter() {
    const url = window.location.href;
    for (const adapter of ADAPTERS) {
      if (adapter.isMatch(url)) {
        return adapter;
      }
    }
    return null;
  }

  // ============================================================================
  // VIDEO TRACKING
  // ============================================================================

  function startTracking() {
    if (isRunning) return;

    isRunning = true;
    log('Starting video tracking');

    updateActiveVideo();
    setupMutationObserver();
    setupScrollListener();
  }

  function stopTracking() {
    if (!isRunning) return;

    isRunning = false;
    log('Stopping video tracking');

    // Remove event listeners from current video
    if (currentVideo) {
      currentVideo.removeEventListener('ended', handleVideoEnded);
      currentVideo.removeEventListener('timeupdate', handleTimeUpdate);
      currentVideo = null;
    }

    // Disconnect observer
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    resetLoopTracking();
  }

  function updateActiveVideo() {
    if (!isRunning || !currentAdapter) return;

    const newVideo = currentAdapter.findActiveVideo();

    if (newVideo !== currentVideo) {
      // Detach from old video
      if (currentVideo) {
        currentVideo.removeEventListener('ended', handleVideoEnded);
        currentVideo.removeEventListener('timeupdate', handleTimeUpdate);
      }

      resetLoopTracking();

      // Attach to new video
      if (newVideo) {
        newVideo.addEventListener('ended', handleVideoEnded);
        newVideo.addEventListener('timeupdate', handleTimeUpdate);
        currentVideo = newVideo;

        debugLog('Attached to video:', {
          duration: newVideo.duration?.toFixed(1) || 'loading',
          paused: newVideo.paused,
          readyState: newVideo.readyState
        });
      } else {
        currentVideo = null;
        debugLog('No active video found');
      }
    }
  }

  function resetLoopTracking() {
    lastKnownTime = 0;
    wasNearEnd = false;
    loopCount = 0;
  }

  // ============================================================================
  // END DETECTION
  // ============================================================================

  function handleVideoEnded() {
    if (scrollLock || endedDebounce || isPaused) return;
    log('Video ended event fired');
    triggerAutoScroll('ended_event');
  }

  function handleTimeUpdate(event) {
    const video = event.target;
    if (!video || scrollLock || endedDebounce || isPaused) return;

    const duration = video.duration;
    const currentTime = video.currentTime;

    // Update stats
    sessionStats.lastVideoInfo = { duration, currentTime };

    if (!duration || !isFinite(duration) || duration < 1) return;

    const epsilon = 0.5;
    const nearEnd = (duration - currentTime) < epsilon;
    const jumpedToStart = currentTime < 2 && lastKnownTime > (duration - 2);

    // Loop detection: video jumped back to start after being near end
    if (jumpedToStart && wasNearEnd) {
      loopCount++;
      debugLog(`Video LOOPED (loop #${loopCount})`);
      wasNearEnd = false;
      lastKnownTime = currentTime;
      triggerAutoScroll('loop_detected');
      return;
    }

    if (nearEnd) {
      wasNearEnd = true;
    }

    // Very close to end threshold
    if ((duration - currentTime) < 0.15 && !endedDebounce) {
      debugLog('Video at end threshold');
      triggerAutoScroll('end_threshold');
      return;
    }

    lastKnownTime = currentTime;
  }

  // ============================================================================
  // AUTO-SCROLL
  // ============================================================================

  async function triggerAutoScroll(trigger = 'manual') {
    // Pre-flight checks
    if (!settings?.globalEnabled) {
      debugLog('Scroll blocked: global disabled');
      return;
    }

    if (!isSiteEnabled(currentAdapter?.name)) {
      debugLog('Scroll blocked: site disabled');
      return;
    }

    if (scrollLock) {
      debugLog('Scroll blocked: scroll lock');
      return;
    }

    if (isPaused) {
      debugLog('Scroll blocked: paused');
      return;
    }

    if (settings.safety?.stopOnTabInactive && document.hidden) {
      debugLog('Scroll blocked: tab inactive');
      return;
    }

    // Lock scrolling
    scrollLock = true;
    endedDebounce = true;

    const previousVideo = currentVideo;
    const randomExtra = Math.random() * (settings.randomExtraDelay || 200);
    const totalDelay = (settings.delayAfterEnd || 600) + randomExtra;

    debugLog(`Trigger: ${trigger}, waiting ${totalDelay.toFixed(0)}ms`);

    await delay(totalDelay);

    // Re-check after delay
    if (!isSiteEnabled(currentAdapter?.name)) {
      scrollLock = false;
      endedDebounce = false;
      return;
    }

    // Execute scroll methods
    let success = false;
    const methods = currentAdapter.goNext();
    const maxAttempts = settings.retryAttempts || 3;

    for (let attempt = 1; attempt <= maxAttempts && !success; attempt++) {
      for (let i = 0; i < methods.length && !success; i++) {
        try {
          methods[i]();

          await delay(600);

          const newVideo = currentAdapter.findActiveVideo();
          if (newVideo && newVideo !== previousVideo) {
            success = true;
            sessionStats.lastScrollMethod = `method_${i + 1}_attempt_${attempt}`;
            log(`Scroll SUCCESS: method ${i + 1}, attempt ${attempt}`);
          } else {
            debugLog(`Method ${i + 1} didn't change video, trying next...`);
          }
        } catch (e) {
          error(`Method ${i + 1} error:`, e.message);
        }
      }
    }

    if (success) {
      sessionStats.scrollCount++;
      sessionStats.lastScrollTime = Date.now();
      sessionStats.lastError = null;
      sendStatsUpdate();
    } else {
      error('All scroll methods failed');
      sessionStats.lastError = 'All scroll methods failed';
    }

    // Unlock after a brief delay
    setTimeout(() => {
      scrollLock = false;
      endedDebounce = false;
      updateActiveVideo();
    }, 500);
  }

  // ============================================================================
  // OBSERVERS
  // ============================================================================

  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    let debounceTimer = null;

    mutationObserver = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isRunning) {
          updateActiveVideo();
        }
      }, 200);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function setupScrollListener() {
    let debounceTimer = null;

    window.addEventListener('scroll', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isRunning && !scrollLock) {
          updateActiveVideo();
        }
      }, 150);
    }, { passive: true });
  }

  function setupUrlWatcher() {
    if (urlCheckInterval) {
      clearInterval(urlCheckInterval);
    }

    urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        const oldUrl = lastUrl;
        lastUrl = window.location.href;
        debugLog('URL changed:', lastUrl);
        handleUrlChange(oldUrl, lastUrl);
      }
    }, 500);
  }

  async function handleUrlChange(oldUrl, newUrl) {
    // Stop current tracking
    stopTracking();

    // Re-detect adapter (might be same, might be different)
    const newAdapter = detectAdapter();

    if (!newAdapter) {
      debugLog('No adapter for new URL');
      currentAdapter = null;
      return;
    }

    if (!newAdapter.isSupported(newUrl)) {
      debugLog(`${newAdapter.name} detected but page not supported`);
      currentAdapter = newAdapter;
      return;
    }

    currentAdapter = newAdapter;

    // Check if enabled
    if (!isSiteEnabled(newAdapter.name)) {
      debugLog(`${newAdapter.name} is disabled`);
      return;
    }

    // Wait for page to settle, then start tracking
    await delay(1000);
    startTracking();
  }

  // ============================================================================
  // MESSAGING
  // ============================================================================

  function setupMessageListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        handleMessage(message, sendResponse);
        return true;  // Keep channel open for async
      });
    }
  }

  function handleMessage(message, sendResponse) {
    debugLog('Message received:', message.action);

    switch (message.action) {
      case 'getState':
      case 'getStats':
        const state = {
          // Site info
          siteName: currentAdapter?.name || null,
          siteDisplayName: currentAdapter?.displayName || null,
          isSupported: currentAdapter?.isSupported(window.location.href) || false,
          isSiteEnabled: isSiteEnabled(currentAdapter?.name),

          // Runtime state
          isRunning: isRunning,
          globalEnabled: settings?.globalEnabled ?? true,
          paused: isPaused,

          // Stats
          scrollCount: sessionStats.scrollCount,
          lastScrollTimestamp: sessionStats.lastScrollTime,
          lastVideoInfo: sessionStats.lastVideoInfo,
          lastScrollMethod: sessionStats.lastScrollMethod,
          lastError: sessionStats.lastError,

          // Debug info
          hasVideo: currentVideo !== null,
          videoInfo: currentVideo ? {
            duration: currentVideo.duration,
            currentTime: currentVideo.currentTime,
            paused: currentVideo.paused
          } : null,

          // Version
          version: VERSION
        };
        sendResponse(state);
        break;

      case 'testScroll':
        triggerAutoScroll('manual_test').then(() => {
          sendResponse({
            success: true,
            scrollCount: sessionStats.scrollCount
          });
        });
        break;

      case 'resetStats':
        sessionStats.scrollCount = 0;
        sessionStats.lastScrollTime = null;
        sessionStats.lastVideoInfo = { duration: 0, currentTime: 0 };
        sessionStats.lastScrollMethod = null;
        sessionStats.lastError = null;
        sendResponse({ success: true });
        break;

      case 'togglePause':
        isPaused = !isPaused;
        log(`Auto-scroll ${isPaused ? 'PAUSED' : 'RESUMED'}`);
        sendResponse({ paused: isPaused });
        break;

      case 'ping':
        sendResponse({ pong: true, version: VERSION });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  function sendStatsUpdate() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          action: 'statsUpdate',
          data: {
            scrollCount: sessionStats.scrollCount,
            lastScrollTimestamp: sessionStats.lastScrollTime,
            lastVideoInfo: sessionStats.lastVideoInfo,
            siteName: currentAdapter?.name
          }
        });
      } catch (e) {
        // Popup might be closed - this is fine
      }
    }
  }

  // ============================================================================
  // HOTKEYS
  // ============================================================================

  function setupHotkeyListener() {
    document.addEventListener('keydown', (event) => {
      if (!settings?.hotkeys?.enabled) return;

      // Ignore in input fields
      const tagName = event.target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || event.target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd + Space = toggle pause
      if (event.key === ' ' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        isPaused = !isPaused;
        log(`Auto-scroll ${isPaused ? 'PAUSED' : 'RESUMED'} (hotkey)`);
        sendStatsUpdate();
      }
    });
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async function init() {
    log(`Initializing AutoScroll v${VERSION}...`);

    // 1. Setup message listener FIRST (so popup can always connect)
    setupMessageListener();

    // 2. Load settings
    await loadSettings();
    setupSettingsListener();

    // 3. Detect adapter
    currentAdapter = detectAdapter();

    if (!currentAdapter) {
      log('No adapter matches this site');
      setupUrlWatcher();  // Still watch for navigation
      return;
    }

    log(`Adapter: ${currentAdapter.displayName}`);

    // 4. Check if page is supported
    if (!currentAdapter.isSupported(window.location.href)) {
      log('Page type not supported, watching for navigation');
      setupUrlWatcher();
      return;
    }

    // 5. Check if site is enabled
    if (!isSiteEnabled(currentAdapter.name)) {
      log(`${currentAdapter.name} is DISABLED in settings`);
      setupUrlWatcher();
      return;
    }

    // 6. Wait for page to be ready
    await delay(1000);

    // 7. Start tracking
    startTracking();
    setupUrlWatcher();
    setupHotkeyListener();

    log('AutoScroll ready!');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
