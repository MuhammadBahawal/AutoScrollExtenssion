/**
 * AutoScroll Extension - Content Script Entry Point
 * Initializes the extension on supported platforms
 */

(async function () {
  'use strict';

  const LOG_PREFIX = '[AutoScroll]';

  // Simple logger for initialization
  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  // Import modules dynamically (since content scripts don't support ES modules directly)
  // We'll use a bundled approach or inline the code

  // ==================== DEFAULTS ====================
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
      togglePause: 'Space',
      scrollNext: 'ArrowDown',
      scrollPrev: 'ArrowUp'
    },
    safety: {
      stopOnTabInactive: true,
      stopOnManualScroll: false,
      pauseOnInteraction: true,
      manualScrollCooldown: 2000
    },
    debugLogging: false
  };

  const SITE_CONFIGS = {
    instagram: {
      patterns: [/instagram\.com/],
      supportedPaths: [/\/reels?/, /\/reel\//],
      videoSelector: 'video'
    },
    youtube: {
      patterns: [/youtube\.com/, /youtu\.be/],
      supportedPaths: [/\/shorts\//],
      videoSelector: 'video'
    },
    tiktok: {
      patterns: [/tiktok\.com/],
      supportedPaths: [/\/foryou/, /\/@[^/]+\/video\//, /^\/$/],
      videoSelector: 'video'
    },
    x: {
      patterns: [/twitter\.com/, /x\.com/],
      supportedPaths: [/\/home/, /\/status\//, /\/i\/videos/],
      videoSelector: 'video'
    },
    facebook: {
      patterns: [/facebook\.com/, /fb\.com/],
      supportedPaths: [/\/reels?/, /\/reel\//, /\/watch/],
      videoSelector: 'video'
    }
  };

  // ==================== STATE ====================
  let settings = { ...DEFAULT_SETTINGS };
  let currentSite = null;
  let currentVideo = null;
  let scrollLock = false;
  let endedDebounce = false;
  let lastKnownTime = 0;
  let wasNearEnd = false;
  let loopCount = 0;
  let sessionStats = {
    scrollCount: 0,
    lastScrollTime: null,
    lastVideoInfo: { duration: 0, currentTime: 0 }
  };
  let mutationObserver = null;
  let urlCheckInterval = null;
  let lastUrl = window.location.href;
  let isPaused = false;

  // ==================== SITE DETECTION ====================
  function detectSite() {
    const url = window.location.href;

    for (const [siteName, config] of Object.entries(SITE_CONFIGS)) {
      const matchesHost = config.patterns.some(pattern => pattern.test(url));
      if (matchesHost) {
        const isSupported = config.supportedPaths.some(pattern => pattern.test(window.location.pathname));
        return {
          name: siteName,
          config,
          isSupported
        };
      }
    }

    return null;
  }

  // ==================== SETTINGS ====================
  async function loadSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
          settings = { ...DEFAULT_SETTINGS, ...result };
          if (settings.debugLogging) {
            log('Settings loaded:', settings);
          }
          resolve(settings);
        });
      } else {
        resolve(settings);
      }
    });
  }

  function setupSettingsListener() {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync') {
          for (const key in changes) {
            if (key in settings) {
              settings[key] = changes[key].newValue;
              if (settings.debugLogging) {
                log(`Setting changed: ${key}`, changes[key].newValue);
              }
            }
          }

          if (changes.globalEnabled) {
            if (changes.globalEnabled.newValue) {
              initializeVideoTracking();
            } else {
              cleanupVideoTracking();
            }
          }
        }
      });
    }
  }

  function isSiteEnabled(siteName) {
    return settings.globalEnabled &&
      (settings.sites?.[siteName]?.enabled ?? true);
  }

  // ==================== VIDEO DETECTION ====================
  function findAllVideos() {
    if (!currentSite) return [];
    const selector = currentSite.config.videoSelector || 'video';
    const videos = Array.from(document.querySelectorAll(selector));

    // Filter for visible, reasonably sized videos
    return videos.filter(video => {
      const rect = video.getBoundingClientRect();
      return rect.width > 100 && rect.height > 100;
    });
  }

  function getVisibilityScore(video) {
    const rect = video.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    if (rect.width === 0 || rect.height === 0) return 0;

    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(viewportHeight, rect.bottom);
    const visibleLeft = Math.max(0, rect.left);
    const visibleRight = Math.min(viewportWidth, rect.right);

    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleArea = visibleHeight * visibleWidth;
    const totalArea = rect.width * rect.height;

    if (totalArea === 0) return 0;

    let score = (visibleArea / totalArea) * 0.5;

    // Bonus for playing
    if (!video.paused && video.readyState >= 2) score += 0.25;

    // Bonus for valid duration
    if (video.duration && isFinite(video.duration)) score += 0.1;

    // Bonus for center proximity
    const videoCenter = rect.top + rect.height / 2;
    const viewportCenter = viewportHeight / 2;
    const centerDistance = Math.abs(videoCenter - viewportCenter);
    score += (1 - Math.min(centerDistance / viewportHeight, 1)) * 0.15;

    return score;
  }

  function findActiveVideo() {
    const videos = findAllVideos();
    let bestVideo = null;
    let bestScore = 0;

    for (const video of videos) {
      const score = getVisibilityScore(video);
      if (score > bestScore) {
        bestScore = score;
        bestVideo = video;
      }
    }

    return bestScore >= 0.5 ? bestVideo : (bestScore > 0 ? bestVideo : null);
  }

  // ==================== END DETECTION ====================
  function handleVideoEnded() {
    if (scrollLock || endedDebounce || isPaused) {
      return;
    }
    log('Video ended event');
    triggerAutoScroll();
  }

  function handleTimeUpdate(event) {
    const video = event.target;
    if (!video || scrollLock || endedDebounce || isPaused) return;

    const duration = video.duration;
    const currentTime = video.currentTime;

    sessionStats.lastVideoInfo = { duration, currentTime };

    if (!duration || !isFinite(duration) || duration < 1) return;

    const epsilon = 0.5;
    const nearEnd = (duration - currentTime) < epsilon;
    const jumpedToStart = currentTime < 2 && lastKnownTime > (duration - 2);

    // Loop detection
    if (jumpedToStart && wasNearEnd) {
      loopCount++;
      log(`Video LOOPED! (Loop #${loopCount})`);
      wasNearEnd = false;
      lastKnownTime = currentTime;
      triggerAutoScroll();
      return;
    }

    if (nearEnd) {
      wasNearEnd = true;
    }

    // Very close to end
    if ((duration - currentTime) < 0.15 && !endedDebounce) {
      log(`Video at end threshold`);
      triggerAutoScroll();
      return;
    }

    lastKnownTime = currentTime;
  }

  function resetLoopTracking() {
    lastKnownTime = 0;
    wasNearEnd = false;
    loopCount = 0;
  }

  // ==================== SCROLLING ====================
  function findScrollContainer() {
    const selectors = [
      'div[style*="overflow"][style*="auto"]',
      'div[style*="overflow"][style*="scroll"]',
      '[role="main"]',
      'main',
      'ytd-shorts',
      '#shorts-inner-container'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight) {
          return el;
        }
      }
    }

    if (document.documentElement.scrollHeight > window.innerHeight) {
      return document.documentElement;
    }

    return null;
  }

  function performScroll(scrollAmount) {
    const container = findScrollContainer();

    if (container && container !== document.documentElement) {
      container.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    } else {
      window.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }

    if (settings.debugLogging) {
      log(`Scrolled by ${scrollAmount.toFixed(0)}px`);
    }
  }

  function simulateArrowDown() {
    const target = currentVideo || document.activeElement || document.body;

    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true
    });

    target.dispatchEvent(keydownEvent);
    document.dispatchEvent(keydownEvent);

    setTimeout(() => {
      const keyupEvent = new KeyboardEvent('keyup', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        which: 40,
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(keyupEvent);
      document.dispatchEvent(keyupEvent);
    }, 50);
  }

  async function triggerAutoScroll() {
    if (!settings.globalEnabled || !isSiteEnabled(currentSite?.name)) {
      return;
    }

    if (scrollLock || isPaused) {
      return;
    }

    // Check tab visibility
    if (settings.safety?.stopOnTabInactive && document.hidden) {
      if (settings.debugLogging) {
        log('Tab inactive, skipping scroll');
      }
      return;
    }

    scrollLock = true;
    endedDebounce = true;

    const previousVideo = currentVideo;
    const randomExtra = Math.random() * settings.randomExtraDelay;
    const totalDelay = settings.delayAfterEnd + randomExtra;

    if (settings.debugLogging) {
      log(`Waiting ${totalDelay.toFixed(0)}ms before scroll`);
    }

    await delay(totalDelay);

    let success = false;
    let attempts = 0;
    const methods = ['arrow_down', 'scroll_viewport', 'scroll_into_view', 'large_scroll'];

    while (!success && attempts < settings.retryAttempts) {
      attempts++;

      for (const method of methods) {
        try {
          switch (method) {
            case 'arrow_down':
              simulateArrowDown();
              break;
            case 'scroll_viewport':
              performScroll(window.innerHeight * settings.scrollFactor);
              break;
            case 'scroll_into_view':
              const videos = findAllVideos();
              const idx = videos.indexOf(previousVideo);
              if (idx >= 0 && idx < videos.length - 1) {
                videos[idx + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              break;
            case 'large_scroll':
              performScroll(window.innerHeight * 1.2);
              break;
          }

          await delay(600);

          const newVideo = findActiveVideo();
          if (newVideo && newVideo !== previousVideo) {
            success = true;
            log(`Scroll success: ${method} (attempt ${attempts})`);
            break;
          }
        } catch (e) {
          if (settings.debugLogging) {
            log(`Method ${method} failed:`, e);
          }
        }
      }
    }

    if (success) {
      sessionStats.scrollCount++;
      sessionStats.lastScrollTime = Date.now();
      log(`Total scrolls: ${sessionStats.scrollCount}`);
      sendStatsUpdate();
    } else {
      log('All scroll methods failed');
    }

    setTimeout(() => {
      scrollLock = false;
      endedDebounce = false;
      updateActiveVideo();
    }, 500);
  }

  // ==================== VIDEO TRACKING ====================
  function updateActiveVideo() {
    if (!settings.globalEnabled || !currentSite || !isSiteEnabled(currentSite.name)) {
      return;
    }

    const newVideo = findActiveVideo();

    if (newVideo !== currentVideo) {
      if (currentVideo) {
        currentVideo.removeEventListener('ended', handleVideoEnded);
        currentVideo.removeEventListener('timeupdate', handleTimeUpdate);
      }

      resetLoopTracking();

      if (newVideo) {
        newVideo.addEventListener('ended', handleVideoEnded);
        newVideo.addEventListener('timeupdate', handleTimeUpdate);
        currentVideo = newVideo;

        if (settings.debugLogging) {
          log('Attached to new video', {
            duration: newVideo.duration?.toFixed(1) || 'loading',
            currentTime: newVideo.currentTime?.toFixed(1) || 0
          });
        }
      } else {
        currentVideo = null;
      }
    }
  }

  function initializeVideoTracking() {
    if (settings.debugLogging) {
      log('Initializing video tracking');
    }
    updateActiveVideo();
  }

  function cleanupVideoTracking() {
    if (currentVideo) {
      currentVideo.removeEventListener('ended', handleVideoEnded);
      currentVideo.removeEventListener('timeupdate', handleTimeUpdate);
      currentVideo = null;
    }
  }

  // ==================== OBSERVERS ====================
  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    let debounceTimer = null;

    mutationObserver = new MutationObserver((mutations) => {
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        const hasVideoChanges = mutations.some(m =>
          m.type === 'childList' &&
          (m.addedNodes.length > 0 || m.removedNodes.length > 0)
        );

        if (hasVideoChanges) {
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
        if (!scrollLock) {
          updateActiveVideo();
        }
      }, 150);
    }, { passive: true });
  }

  function setupUrlWatcher() {
    urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        log('URL changed:', lastUrl);
        handleUrlChange();
      }
    }, 500);
  }

  async function handleUrlChange() {
    cleanupVideoTracking();
    currentSite = detectSite();

    if (currentSite?.isSupported && isSiteEnabled(currentSite.name)) {
      await delay(1000);
      initializeVideoTracking();
      setupMutationObserver();
    }
  }

  // ==================== MESSAGING ====================
  function setupMessageListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        handleMessage(message, sendResponse);
        return true;
      });
    }
  }

  function handleMessage(message, sendResponse) {
    switch (message.action) {
      case 'getStats':
        sendResponse({
          scrollCount: sessionStats.scrollCount,
          lastScrollTimestamp: sessionStats.lastScrollTime,
          lastVideoInfo: sessionStats.lastVideoInfo,
          enabled: settings.globalEnabled,
          paused: isPaused,
          siteName: currentSite?.name || null,
          isSupported: currentSite?.isSupported || false
        });
        break;

      case 'testScroll':
        triggerAutoScroll().then(() => {
          sendResponse({
            success: true,
            scrollCount: sessionStats.scrollCount
          });
        });
        break;

      case 'resetStats':
        sessionStats = { scrollCount: 0, lastScrollTime: null, lastVideoInfo: { duration: 0, currentTime: 0 } };
        sendResponse({ success: true });
        break;

      case 'togglePause':
        isPaused = !isPaused;
        log(`Auto-scroll ${isPaused ? 'paused' : 'resumed'}`);
        sendResponse({ paused: isPaused });
        break;

      case 'getState':
        sendResponse({
          siteName: currentSite?.name,
          isSupported: currentSite?.isSupported,
          enabled: settings.globalEnabled,
          paused: isPaused,
          settings
        });
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
            siteName: currentSite?.name
          }
        });
      } catch (e) {
        // Popup closed
      }
    }
  }

  // ==================== HOTKEYS ====================
  function setupHotkeyListener() {
    document.addEventListener('keydown', (event) => {
      if (!settings.hotkeys?.enabled) return;

      // Don't capture in input fields
      const tagName = event.target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || event.target.isContentEditable) {
        return;
      }

      // Toggle pause with Ctrl/Cmd + Space
      if (event.key === 'Space' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        isPaused = !isPaused;
        log(`Auto-scroll ${isPaused ? 'paused' : 'resumed'}`);
        sendStatsUpdate();
      }
    });
  }

  // ==================== UTILITIES ====================
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== INITIALIZATION ====================
  async function init() {
    log('Initializing AutoScroll extension...');

    // Setup message listener first
    setupMessageListener();

    // Detect site
    currentSite = detectSite();

    if (!currentSite) {
      log('No supported site detected');
      return;
    }

    log(`Detected: ${currentSite.name} (supported: ${currentSite.isSupported})`);

    // Load settings
    await loadSettings();
    setupSettingsListener();

    // Check if enabled
    if (!settings.globalEnabled || !isSiteEnabled(currentSite.name)) {
      log('Extension disabled for this site');
      return;
    }

    if (!currentSite.isSupported) {
      log('Page type not supported for auto-scroll');
      setupUrlWatcher();
      return;
    }

    // Wait for page to be ready
    await delay(1000);

    // Initialize
    initializeVideoTracking();
    setupMutationObserver();
    setupScrollListener();
    setupUrlWatcher();
    setupHotkeyListener();

    log('AutoScroll extension ready');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
