/**
 * AutoScroll Popup Script
 * v2.1.0 - Fixed state sync and settings handling
 */

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================================
    // ELEMENTS
    // ============================================================================

    const elements = {
        // Header
        enableToggle: document.getElementById('enableToggle'),

        // Status
        statusBanner: document.getElementById('statusBanner'),
        statusIcon: document.getElementById('statusIcon'),
        statusText: document.getElementById('statusText'),

        // Stats
        scrollCount: document.getElementById('scrollCount'),
        lastScroll: document.getElementById('lastScroll'),
        videoDuration: document.getElementById('videoDuration'),
        videoProgress: document.getElementById('videoProgress'),

        // Buttons
        testScrollBtn: document.getElementById('testScrollBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        pauseIcon: document.getElementById('pauseIcon'),
        pauseText: document.getElementById('pauseText'),
        resetStatsBtn: document.getElementById('resetStatsBtn'),

        // Container
        popupContainer: document.querySelector('.popup-container'),

        // Platform toggles
        toggleInstagram: document.getElementById('toggleInstagram'),
        toggleYoutube: document.getElementById('toggleYoutube'),
        toggleTiktok: document.getElementById('toggleTiktok'),
        toggleX: document.getElementById('toggleX'),
        toggleFacebook: document.getElementById('toggleFacebook')
    };

    const platformToggles = {
        instagram: elements.toggleInstagram,
        youtube: elements.toggleYoutube,
        tiktok: elements.toggleTiktok,
        x: elements.toggleX,
        facebook: elements.toggleFacebook
    };

    // ============================================================================
    // STATE
    // ============================================================================

    const DEFAULT_SETTINGS = {
        globalEnabled: true,
        sites: {
            instagram: { enabled: true },
            youtube: { enabled: true },
            tiktok: { enabled: true },
            x: { enabled: true },
            facebook: { enabled: true }
        }
    };

    let currentState = {
        siteName: null,
        isSupported: false,
        paused: false,
        isRunning: false
    };

    let currentTabId = null;
    let pollInterval = null;

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async function init() {
        console.log('[AutoScroll Popup] Initializing...');

        // Load settings first
        await loadSettings();

        // Setup UI listeners
        setupEventListeners();
        setupStorageListener();

        // Get initial state from content script
        await getStateFromContentScript();

        // Start polling for updates
        startPolling();
    }

    // ============================================================================
    // SETTINGS
    // ============================================================================

    async function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
                // Update global toggle
                if (elements.enableToggle) {
                    elements.enableToggle.checked = result.globalEnabled ?? true;
                }
                updateGlobalToggleUI(result.globalEnabled ?? true);

                // Update platform toggles
                for (const [site, toggle] of Object.entries(platformToggles)) {
                    if (toggle) {
                        const enabled = result.sites?.[site]?.enabled ?? true;
                        toggle.checked = enabled;
                    }
                }

                resolve(result);
            });
        });
    }

    function saveGlobalEnabled(enabled) {
        chrome.storage.sync.set({ globalEnabled: enabled }, () => {
            console.log('[AutoScroll Popup] Saved globalEnabled:', enabled);
        });
    }

    function saveSiteEnabled(siteName, enabled) {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (current) => {
            const sites = { ...DEFAULT_SETTINGS.sites, ...current.sites };
            sites[siteName] = { ...sites[siteName], enabled };
            chrome.storage.sync.set({ sites }, () => {
                console.log(`[AutoScroll Popup] Saved ${siteName}:`, enabled);
            });
        });
    }

    function setupStorageListener() {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync') {
                // Reload settings
                loadSettings();
                // Refresh state from content script
                setTimeout(() => getStateFromContentScript(), 100);
            }
        });
    }

    // ============================================================================
    // CONTENT SCRIPT COMMUNICATION
    // ============================================================================

    async function getStateFromContentScript() {
        try {
            // Get active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab?.id || !tab?.url) {
                displayNotSupported();
                return;
            }

            currentTabId = tab.id;

            // Check if URL is a supported site
            const supportedPatterns = [
                /instagram\.com/i,
                /youtube\.com/i,
                /tiktok\.com/i,
                /twitter\.com/i,
                /x\.com/i,
                /facebook\.com/i
            ];

            const isOnSupportedSite = supportedPatterns.some(p => p.test(tab.url));

            if (!isOnSupportedSite) {
                displayNotSupported();
                return;
            }

            // Try to ping content script first
            try {
                const response = await sendMessageToTab(tab.id, { action: 'getState' });

                if (response) {
                    handleContentScriptResponse(response);
                } else {
                    displayWaitingForPage();
                }
            } catch (err) {
                console.log('[AutoScroll Popup] Content script not responding:', err.message);
                displayWaitingForPage();
            }

        } catch (err) {
            console.error('[AutoScroll Popup] Error getting state:', err);
            displayNotSupported();
        }
    }

    function sendMessageToTab(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    function handleContentScriptResponse(response) {
        console.log('[AutoScroll Popup] Got response:', response);

        currentState = {
            ...currentState,
            ...response
        };

        // Update stats
        if (elements.scrollCount) {
            elements.scrollCount.textContent = response.scrollCount ?? 0;
        }
        if (elements.lastScroll) {
            elements.lastScroll.textContent = response.lastScrollTimestamp
                ? formatTimeAgo(response.lastScrollTimestamp)
                : '--';
        }

        // Update video info
        if (response.lastVideoInfo) {
            const { duration, currentTime } = response.lastVideoInfo;
            if (duration && isFinite(duration) && duration > 0) {
                if (elements.videoDuration) {
                    elements.videoDuration.textContent = formatTime(duration);
                }
                if (elements.videoProgress) {
                    elements.videoProgress.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
                }
            } else {
                if (elements.videoDuration) elements.videoDuration.textContent = '--';
                if (elements.videoProgress) elements.videoProgress.textContent = '--';
            }
        }

        // Update pause button
        updatePauseButton(response.paused);

        // Update status banner based on state
        updateStatusBanner(response);

        // Highlight active platform
        highlightActivePlatform(response.siteName);
    }

    function startPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
        }

        pollInterval = setInterval(() => {
            getStateFromContentScript();
        }, 2000);
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'statsUpdate' && message.data) {
                handleContentScriptResponse({
                    ...currentState,
                    ...message.data
                });
            }
        });
    }

    // ============================================================================
    // UI UPDATES
    // ============================================================================

    function updateStatusBanner(state) {
        if (!state.siteName) {
            displayWaitingForPage();
            return;
        }

        const displayNames = {
            instagram: 'Instagram Reels',
            youtube: 'YouTube Shorts',
            tiktok: 'TikTok',
            x: 'X (Twitter)',
            facebook: 'Facebook Reels'
        };

        const displayName = displayNames[state.siteName] || state.siteName;

        // Case 1: Site detected, page supported, site enabled, running
        if (state.isSupported && state.isSiteEnabled && state.isRunning) {
            if (state.paused) {
                displayPaused(displayName);
            } else {
                displayActive(displayName);
            }
        }
        // Case 2: Site detected, page supported, but site disabled
        else if (state.isSupported && !state.isSiteEnabled) {
            displaySiteDisabled(state.siteName, displayName);
        }
        // Case 3: Site detected, page supported, global disabled
        else if (state.isSupported && !state.globalEnabled) {
            displayGlobalDisabled();
        }
        // Case 4: Site detected but page not supported
        else if (!state.isSupported) {
            displayUnsupportedPage(state.siteName, displayName);
        }
        // Case 5: Site detected, conditions met, but not running (loading?)
        else {
            displayWaitingForPage();
        }
    }

    function displayActive(displayName) {
        elements.statusBanner.className = 'status-banner active';
        elements.statusIcon.className = 'status-icon active';
        elements.statusIcon.textContent = '●';
        elements.statusText.textContent = `Active on ${displayName}`;
    }

    function displayPaused(displayName) {
        elements.statusBanner.className = 'status-banner inactive';
        elements.statusIcon.className = 'status-icon inactive';
        elements.statusIcon.textContent = '⏸';
        elements.statusText.textContent = `Paused on ${displayName}`;
    }

    function displaySiteDisabled(siteName, displayName) {
        elements.statusBanner.className = 'status-banner inactive';
        elements.statusIcon.className = 'status-icon inactive';
        elements.statusIcon.textContent = '○';
        elements.statusText.textContent = `${displayName} is disabled`;
    }

    function displayGlobalDisabled() {
        elements.statusBanner.className = 'status-banner inactive';
        elements.statusIcon.className = 'status-icon inactive';
        elements.statusIcon.textContent = '○';
        elements.statusText.textContent = 'AutoScroll is disabled';
    }

    function displayUnsupportedPage(siteName, displayName) {
        const hints = {
            instagram: 'Navigate to Reels',
            youtube: 'Navigate to Shorts',
            tiktok: 'Open For You page',
            x: 'Waiting for video...',
            facebook: 'Navigate to Reels or Watch'
        };

        elements.statusBanner.className = 'status-banner inactive';
        elements.statusIcon.className = 'status-icon inactive';
        elements.statusIcon.textContent = '○';
        elements.statusText.textContent = hints[siteName] || `Open ${displayName}`;
    }

    function displayWaitingForPage() {
        elements.statusBanner.className = 'status-banner inactive';
        elements.statusIcon.className = 'status-icon inactive';
        elements.statusIcon.textContent = '○';
        elements.statusText.textContent = 'Waiting for page...';
    }

    function displayNotSupported() {
        elements.statusBanner.className = 'status-banner unsupported';
        elements.statusIcon.className = 'status-icon unsupported';
        elements.statusIcon.textContent = '○';
        elements.statusText.textContent = 'Open a supported site';

        elements.scrollCount.textContent = '--';
        elements.lastScroll.textContent = '--';
        if (elements.videoDuration) elements.videoDuration.textContent = '--';
        if (elements.videoProgress) elements.videoProgress.textContent = '--';
    }

    function updateGlobalToggleUI(enabled) {
        if (elements.popupContainer) {
            if (enabled) {
                elements.popupContainer.classList.remove('disabled');
            } else {
                elements.popupContainer.classList.add('disabled');
            }
        }
    }

    function updatePauseButton(paused) {
        if (paused) {
            if (elements.pauseIcon) elements.pauseIcon.textContent = '▶️';
            if (elements.pauseText) elements.pauseText.textContent = 'Resume';
            if (elements.pauseBtn) elements.pauseBtn.classList.add('paused');
        } else {
            if (elements.pauseIcon) elements.pauseIcon.textContent = '⏸️';
            if (elements.pauseText) elements.pauseText.textContent = 'Pause';
            if (elements.pauseBtn) elements.pauseBtn.classList.remove('paused');
        }
    }

    function highlightActivePlatform(siteName) {
        document.querySelectorAll('.platform-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.site === siteName) {
                item.classList.add('active');
            }
        });
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================

    function setupEventListeners() {
        // Global toggle
        if (elements.enableToggle) {
            elements.enableToggle.addEventListener('change', () => {
                const enabled = elements.enableToggle.checked;
                saveGlobalEnabled(enabled);
                updateGlobalToggleUI(enabled);
            });
        }

        // Platform toggles
        for (const [site, toggle] of Object.entries(platformToggles)) {
            if (toggle) {
                toggle.addEventListener('change', () => {
                    saveSiteEnabled(site, toggle.checked);
                });
            }
        }

        // Test scroll button
        if (elements.testScrollBtn) {
            elements.testScrollBtn.addEventListener('click', async () => {
                if (!currentTabId) return;

                elements.testScrollBtn.disabled = true;
                elements.testScrollBtn.innerHTML = '<span class="btn-icon">⏳</span> Scrolling...';

                try {
                    const response = await sendMessageToTab(currentTabId, { action: 'testScroll' });

                    if (response?.success) {
                        elements.scrollCount.textContent = response.scrollCount;
                        elements.lastScroll.textContent = 'Just now';
                    }
                } catch (err) {
                    console.error('[AutoScroll Popup] Test scroll failed:', err);
                }

                setTimeout(() => {
                    elements.testScrollBtn.disabled = false;
                    elements.testScrollBtn.innerHTML = '<span class="btn-icon">⬇️</span> Skip to Next';
                }, 500);
            });
        }

        // Pause button
        if (elements.pauseBtn) {
            elements.pauseBtn.addEventListener('click', async () => {
                if (!currentTabId) return;

                try {
                    const response = await sendMessageToTab(currentTabId, { action: 'togglePause' });

                    if (response) {
                        updatePauseButton(response.paused);
                        currentState.paused = response.paused;
                        updateStatusBanner(currentState);
                    }
                } catch (err) {
                    console.error('[AutoScroll Popup] Toggle pause failed:', err);
                }
            });
        }

        // Reset stats button
        if (elements.resetStatsBtn) {
            elements.resetStatsBtn.addEventListener('click', async () => {
                if (!currentTabId) return;

                try {
                    const response = await sendMessageToTab(currentTabId, { action: 'resetStats' });

                    if (response?.success) {
                        elements.scrollCount.textContent = '0';
                        elements.lastScroll.textContent = '--';
                    }
                } catch (err) {
                    console.error('[AutoScroll Popup] Reset stats failed:', err);
                }
            });
        }

        // Message listener for real-time updates
        setupMessageListener();
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    function formatTime(seconds) {
        if (!seconds || !isFinite(seconds)) return '--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function formatTimeAgo(timestamp) {
        if (!timestamp) return '--';

        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 5) return 'Just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    // ============================================================================
    // START
    // ============================================================================

    init();
});
