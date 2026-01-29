(function () {
  "use strict";

  const LOG_PREFIX = "[InstaReelAutoScroll]";

  const DEFAULT_SETTINGS = {
    enabled: true,
    delayAfterEnd: 600,
    scrollFactor: 0.95,
    retryAttempts: 2,
    randomExtraDelay: 0,
    debugLogging: false,
  };

  let settings = { ...DEFAULT_SETTINGS };
  let currentActiveVideo = null;
  let scrollLock = false;
  let sessionScrollCount = 0;
  let lastScrollTimestamp = null;
  let lastVideoInfo = { duration: 0, currentTime: 0 };
  let endedDebounce = false;

  function log(...args) {
    if (settings.debugLogging) {
      console.log(LOG_PREFIX, ...args);
    }
  }

  function logAlways(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function loadSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
          settings = { ...DEFAULT_SETTINGS, ...result };
          log("Settings loaded:", settings);
          resolve(settings);
        });
      } else {
        log("Chrome storage not available, using defaults");
        resolve(settings);
      }
    });
  }

  function setupSettingsListener() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "sync") {
          for (const key in changes) {
            if (key in settings) {
              settings[key] = changes[key].newValue;
              log(`Setting changed: ${key} = ${changes[key].newValue}`);
            }
          }
          if (changes.enabled) {
            if (changes.enabled.newValue) {
              logAlways("Extension enabled");
              initializeVideoTracking();
            } else {
              logAlways("Extension disabled");
              cleanupVideoTracking();
            }
          }
        }
      });
    }
  }

  function findAllVideos() {
    return Array.from(document.querySelectorAll("video"));
  }

  function getVisibilityScore(video) {
    const rect = video.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(viewportHeight, rect.bottom);
    const visibleLeft = Math.max(0, rect.left);
    const visibleRight = Math.min(viewportWidth, rect.right);

    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);

    const visibleArea = visibleHeight * visibleWidth;
    const totalArea = rect.width * rect.height;

    if (totalArea === 0) return 0;

    return visibleArea / totalArea;
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

    if (bestScore >= 0.6) {
      return bestVideo;
    } else if (bestScore > 0) {
      log(`Best video visibility (${bestScore.toFixed(2)}) is below 0.6 threshold`);
      return bestVideo;
    }

    return null;
  }

  let lastKnownTime = 0;
  let wasNearEnd = false;
  let loopCount = 0;

  function handleVideoEnded() {
    if (scrollLock || endedDebounce) {
      log("Scroll locked or debounced, ignoring ended event");
      return;
    }
    logAlways("Video ended event fired - triggering scroll");
    triggerAutoScroll();
  }

  function handleTimeUpdate(event) {
    const video = event.target;
    if (!video || scrollLock || endedDebounce) return;

    const duration = video.duration;
    const currentTime = video.currentTime;

    lastVideoInfo = { duration, currentTime };

    if (!duration || !isFinite(duration) || duration < 1) return;

    const nearEnd = (duration - currentTime) < 0.5;
    const jumpedToStart = currentTime < 2 && lastKnownTime > (duration - 2);

    if (jumpedToStart && wasNearEnd) {
      loopCount++;
      logAlways(`Video LOOPED! (Loop #${loopCount}) - Triggering auto-scroll`);
      wasNearEnd = false;
      lastKnownTime = currentTime;
      triggerAutoScroll();
      return;
    }

    if (nearEnd) {
      wasNearEnd = true;
      log(`Video near end: ${currentTime.toFixed(2)}/${duration.toFixed(2)}`);
    }

    if ((duration - currentTime) < 0.1 && !endedDebounce) {
      logAlways(`Video at end: ${currentTime.toFixed(2)}/${duration.toFixed(2)} - Triggering scroll`);
      triggerAutoScroll();
      return;
    }

    lastKnownTime = currentTime;
  }

  function resetLoopTracking() {
    lastKnownTime = 0;
    wasNearEnd = false;
  }

  function findScrollContainer() {
    const selectors = [
      'div[style*="overflow"][style*="auto"]',
      'div[style*="overflow"][style*="scroll"]',
      'section main div[style*="overflow"]',
      'div._aagw',
      'div[role="main"]',
      'main',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          if (el.scrollHeight > el.clientHeight) {
            log("Found scroll container:", el.className || el.tagName);
            return el;
          }
        }
      }
    }

    if (document.documentElement.scrollHeight > window.innerHeight) {
      log("Using document.documentElement as scroll container");
      return document.documentElement;
    }

    log("No scroll container found, using window");
    return null;
  }

  function performScroll(scrollAmount) {
    const container = findScrollContainer();

    if (container && container !== document.documentElement) {
      container.scrollBy({
        top: scrollAmount,
        left: 0,
        behavior: "smooth",
      });
      logAlways(`Scrolled container by ${scrollAmount.toFixed(0)}px`);
    } else {
      window.scrollBy({
        top: scrollAmount,
        left: 0,
        behavior: "smooth",
      });
      logAlways(`Scrolled window by ${scrollAmount.toFixed(0)}px`);
    }
  }

  function simulateArrowDown() {
    logAlways("Simulating ArrowDown key press");

    const target = currentActiveVideo || document.activeElement || document.body;

    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true,
    });

    const keyupEvent = new KeyboardEvent('keyup', {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true,
    });

    target.dispatchEvent(keydownEvent);
    setTimeout(() => target.dispatchEvent(keyupEvent), 100);

    document.dispatchEvent(keydownEvent);
  }

  async function triggerAutoScroll() {
    if (!settings.enabled) {
      log("Extension disabled, skipping scroll");
      return;
    }

    if (scrollLock) {
      log("Scroll already in progress");
      return;
    }

    scrollLock = true;
    endedDebounce = true;

    const previousVideo = currentActiveVideo;

    const randomExtra = Math.random() * settings.randomExtraDelay;
    const totalDelay = settings.delayAfterEnd + randomExtra;

    logAlways(`Waiting ${totalDelay.toFixed(0)}ms before scrolling...`);

    await delay(totalDelay);

    let success = false;
    let attempts = 0;

    while (!success && attempts < settings.retryAttempts) {
      attempts++;
      logAlways(`Scroll attempt ${attempts}/${settings.retryAttempts}`);

      const scrollAmount = window.innerHeight * settings.scrollFactor;
      performScroll(scrollAmount);

      await delay(800);

      let newActiveVideo = findActiveVideo();
      if (newActiveVideo && newActiveVideo !== previousVideo) {
        success = true;
        logAlways("Successfully scrolled to new video via scroll");
        break;
      }

      logAlways("Scroll didn't work, trying ArrowDown key...");
      simulateArrowDown();

      await delay(800);

      newActiveVideo = findActiveVideo();
      if (newActiveVideo && newActiveVideo !== previousVideo) {
        success = true;
        logAlways("Successfully scrolled to new video via ArrowDown");
        break;
      }

      if (attempts < settings.retryAttempts) {
        const largerScroll = window.innerHeight * 1.2;
        logAlways(`Retrying with larger scroll: ${largerScroll.toFixed(0)}px`);
        performScroll(largerScroll);

        await delay(800);

        newActiveVideo = findActiveVideo();
        if (newActiveVideo && newActiveVideo !== previousVideo) {
          success = true;
          logAlways("Successfully scrolled with larger amount");
          break;
        }
      }
    }

    if (!success) {
      logAlways("Primary methods failed, attempting scrollIntoView fallback");
      success = await scrollToNextVideo(previousVideo);
    }

    if (success) {
      sessionScrollCount++;
      lastScrollTimestamp = Date.now();
      logAlways(`Auto-scroll successful! Total scrolls this session: ${sessionScrollCount}`);

      updatePopupStats();
    } else {
      logAlways("All scroll attempts failed - Instagram may have blocked scrolling");
    }

    setTimeout(() => {
      scrollLock = false;
      endedDebounce = false;
      updateActiveVideo();
    }, 500);
  }

  async function scrollToNextVideo(previousVideo) {
    if (!previousVideo) return false;

    const allVideos = findAllVideos();
    const currentIndex = allVideos.indexOf(previousVideo);

    if (currentIndex >= 0 && currentIndex < allVideos.length - 1) {
      const nextVideo = allVideos[currentIndex + 1];
      logAlways("Scrolling next video into view");

      nextVideo.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      await delay(800);

      const newVideo = findActiveVideo();
      return newVideo && newVideo !== previousVideo;
    }

    let container = previousVideo.closest("div[role='presentation']") ||
      previousVideo.closest("article") ||
      previousVideo.parentElement?.parentElement;

    if (container) {
      const nextSibling = container.nextElementSibling;
      if (nextSibling) {
        logAlways("Scrolling next container into view");
        nextSibling.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        await delay(800);

        const newVideo = findActiveVideo();
        return newVideo && newVideo !== previousVideo;
      }
    }

    return false;
  }

  function updateActiveVideo() {
    if (!settings.enabled) return;

    const newActiveVideo = findActiveVideo();

    if (newActiveVideo !== currentActiveVideo) {
      if (currentActiveVideo) {
        currentActiveVideo.removeEventListener("ended", handleVideoEnded);
        currentActiveVideo.removeEventListener("timeupdate", handleTimeUpdate);
        log("Detached listeners from previous video");
      }

      resetLoopTracking();

      if (newActiveVideo) {
        newActiveVideo.addEventListener("ended", handleVideoEnded);
        newActiveVideo.addEventListener("timeupdate", handleTimeUpdate);
        currentActiveVideo = newActiveVideo;
        logAlways("Attached listeners to new active video", {
          duration: newActiveVideo.duration?.toFixed(1) || "loading",
          currentTime: newActiveVideo.currentTime?.toFixed(1) || 0,
        });
      } else {
        currentActiveVideo = null;
        log("No active video found");
      }
    }
  }

  function cleanupVideoTracking() {
    if (currentActiveVideo) {
      currentActiveVideo.removeEventListener("ended", handleVideoEnded);
      currentActiveVideo.removeEventListener("timeupdate", handleTimeUpdate);
      currentActiveVideo = null;
    }
  }

  function initializeVideoTracking() {
    log("Initializing video tracking");
    updateActiveVideo();
  }

  let mutationObserver = null;
  let mutationDebounceTimer = null;

  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver((mutations) => {
      if (mutationDebounceTimer) {
        clearTimeout(mutationDebounceTimer);
      }

      mutationDebounceTimer = setTimeout(() => {
        const hasVideoChanges = mutations.some((mutation) => {
          return (
            mutation.type === "childList" &&
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
          );
        });

        if (hasVideoChanges) {
          log("DOM changed, updating active video");
          updateActiveVideo();
        }
      }, 200);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    log("Mutation observer set up");
  }

  let scrollDebounceTimer = null;

  function setupScrollListener() {
    window.addEventListener("scroll", () => {
      if (scrollDebounceTimer) {
        clearTimeout(scrollDebounceTimer);
      }

      scrollDebounceTimer = setTimeout(() => {
        if (!scrollLock) {
          updateActiveVideo();
        }
      }, 150);
    }, { passive: true });

    log("Scroll listener set up");
  }

  function setupMessageListener() {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        log("Received message:", message);

        if (message.action === "getStats") {
          sendResponse({
            scrollCount: sessionScrollCount,
            lastScrollTimestamp: lastScrollTimestamp,
            lastVideoInfo: lastVideoInfo,
            enabled: settings.enabled,
          });
        } else if (message.action === "testScroll") {
          log("Test scroll triggered from popup");
          performTestScroll().then(() => {
            sendResponse({ success: true, scrollCount: sessionScrollCount });
          });
          return true;
        } else if (message.action === "resetStats") {
          sessionScrollCount = 0;
          lastScrollTimestamp = null;
          sendResponse({ success: true });
        }

        return true;
      });
    }
  }

  async function performTestScroll() {
    const scrollAmount = window.innerHeight * settings.scrollFactor;
    logAlways(`Test scroll: ${scrollAmount.toFixed(0)}px`);

    performScroll(scrollAmount);
    await delay(600);

    simulateArrowDown();
    await delay(600);

    const allVideos = findAllVideos();
    if (allVideos.length > 1 && currentActiveVideo) {
      const currentIndex = allVideos.indexOf(currentActiveVideo);
      if (currentIndex >= 0 && currentIndex < allVideos.length - 1) {
        allVideos[currentIndex + 1].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }

    await delay(400);
    sessionScrollCount++;
    lastScrollTimestamp = Date.now();
    updateActiveVideo();
    updatePopupStats();
    logAlways("Test scroll completed");
  }

  function updatePopupStats() {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          action: "statsUpdate",
          data: {
            scrollCount: sessionScrollCount,
            lastScrollTimestamp: lastScrollTimestamp,
            lastVideoInfo: lastVideoInfo,
          },
        });
      } catch (e) {
      }
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isReelsPage() {
    const url = window.location.href;
    return url.includes('instagram.com/reels') || url.includes('instagram.com/reel/');
  }

  async function init() {
    setupMessageListener();

    if (!isReelsPage()) {
      logAlways("Not on Instagram Reels page, waiting for navigation...");
      setupNavigationListener();
      return;
    }

    logAlways("Initializing on Instagram Reels page");

    await loadSettings();
    setupSettingsListener();

    if (settings.enabled) {
      await delay(1500);

      initializeVideoTracking();
      setupMutationObserver();
      setupScrollListener();

      logAlways("Extension fully initialized and active");
    } else {
      logAlways("Extension is disabled in settings");
    }
  }

  let lastUrl = window.location.href;
  let navigationInitialized = false;

  function setupNavigationListener() {
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        logAlways("URL changed to:", lastUrl);

        if (isReelsPage() && !navigationInitialized) {
          navigationInitialized = true;
          initAfterNavigation();
        } else if (!isReelsPage()) {
          navigationInitialized = false;
          cleanupVideoTracking();
        }
      }
    }, 500);
  }

  async function initAfterNavigation() {
    logAlways("Detected navigation to Reels page");

    await loadSettings();
    setupSettingsListener();

    if (settings.enabled) {
      await delay(1500);
      initializeVideoTracking();
      setupMutationObserver();
      setupScrollListener();
      logAlways("Extension initialized after navigation");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
