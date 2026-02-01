document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const elements = {
        enableToggle: document.getElementById('enableToggle'),
        statusBanner: document.getElementById('statusBanner'),
        statusIcon: document.getElementById('statusIcon'),
        statusText: document.getElementById('statusText'),
        scrollCount: document.getElementById('scrollCount'),
        lastScroll: document.getElementById('lastScroll'),
        videoDuration: document.getElementById('videoDuration'),
        videoProgress: document.getElementById('videoProgress'),
        testScrollBtn: document.getElementById('testScrollBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        pauseIcon: document.getElementById('pauseIcon'),
        pauseText: document.getElementById('pauseText'),
        resetStatsBtn: document.getElementById('resetStatsBtn'),
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
        paused: false
    };

    // ==================== INITIALIZATION ====================
    function init() {
        loadSettings();
        getStateFromContentScript();
        setupEventListeners();
        setupMessageListener();

        // Update stats periodically
        setInterval(getStateFromContentScript, 2000);
    }

    // ==================== SETTINGS ====================
    function loadSettings() {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
            elements.enableToggle.checked = result.globalEnabled;
            updateGlobalToggleUI(result.globalEnabled);

            // Load platform toggles
            for (const [site, toggle] of Object.entries(platformToggles)) {
                if (toggle) {
                    toggle.checked = result.sites?.[site]?.enabled ?? true;
                }
            }
        });
    }

    function saveSettings(updates) {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (current) => {
            const newSettings = { ...current, ...updates };
            chrome.storage.sync.set(newSettings);
        });
    }

    function saveSiteEnabled(siteName, enabled) {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (current) => {
            const sites = { ...current.sites };
            sites[siteName] = { ...sites[siteName], enabled };
            chrome.storage.sync.set({ sites });
        });
    }

    // ==================== STATE ====================
    function getStateFromContentScript() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.url) {
                displayNotSupported();
                return;
            }

            // Check if URL matches any supported site
            const supportedPatterns = [
                /instagram\.com/,
                /youtube\.com/,
                /tiktok\.com/,
                /twitter\.com/,
                /x\.com/,
                /facebook\.com/
            ];

            const isOnSupportedSite = supportedPatterns.some(p => p.test(tab.url));

            if (!isOnSupportedSite) {
                displayNotSupported();
                return;
            }

            // Try to get state from content script
            chrome.tabs.sendMessage(tab.id, { action: 'getStats' }, (response) => {
                if (chrome.runtime.lastError) {
                    displayNoConnection(tab.url);
                    return;
                }

                if (response) {
                    updateUI(response);
                }
            });
        });
    }

    function updateUI(state) {
        currentState = state;

        // Update stats
        elements.scrollCount.textContent = state.scrollCount || 0;
        elements.lastScroll.textContent = state.lastScrollTimestamp
            ? formatTimeAgo(state.lastScrollTimestamp)
            : '--';

        // Update video info
        if (state.lastVideoInfo) {
            const { duration, currentTime } = state.lastVideoInfo;
            if (duration && isFinite(duration)) {
                elements.videoDuration.textContent = formatTime(duration);
                elements.videoProgress.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
            } else {
                elements.videoDuration.textContent = '--';
                elements.videoProgress.textContent = '--';
            }
        }

        // Update pause button
        updatePauseButton(state.paused);

        // Update status banner
        if (state.isSupported) {
            displayActive(state.siteName);
        } else if (state.siteName) {
            displayUnsupportedPage(state.siteName);
        } else {
            displayNoConnection();
        }

        // Highlight active platform
        highlightActivePlatform(state.siteName);
    }

    // ==================== UI UPDATES ====================
    function updateGlobalToggleUI(enabled) {
        if (enabled) {
            elements.popupContainer.classList.remove('disabled');
        } else {
            elements.popupContainer.classList.add('disabled');
        }
    }

    function updatePauseButton(paused) {
        if (paused) {
            elements.pauseIcon.textContent = '▶️';
            elements.pauseText.textContent = 'Resume';
            elements.pauseBtn.classList.add('paused');
        } else {
            elements.pauseIcon.textContent = '⏸️';
            elements.pauseText.textContent = 'Pause';
            elements.pauseBtn.classList.remove('paused');
        }
    }

    function displayActive(siteName) {
        const displayNames = {
            instagram: 'Instagram Reels',
            youtube: 'YouTube Shorts',
            tiktok: 'TikTok',
            x: 'X (Twitter)',
            facebook: 'Facebook Reels'
        };

        elements.statusBanner.className = 'status-banner active';
        elements.statusIcon.className = 'status-icon active';
        elements.statusIcon.textContent = '●';
        elements.statusText.textContent = `Active on ${displayNames[siteName] || siteName}`;
    }

    function displayUnsupportedPage(siteName) {
        const pageTypes = {
            instagram: 'Navigate to Reels',
            youtube: 'Navigate to Shorts',
            tiktok: 'Open For You page',
            x: 'Open timeline or video',
            facebook: 'Navigate to Reels or Watch'
        };

        elements.statusBanner.className = 'status-banner inactive';
        elements.statusIcon.className = 'status-icon inactive';
        elements.statusIcon.textContent = '○';
        elements.statusText.textContent = pageTypes[siteName] || `Open ${siteName} videos`;
    }

    function displayNoConnection(url = '') {
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
        elements.videoDuration.textContent = '--';
        elements.videoProgress.textContent = '--';
    }

    function highlightActivePlatform(siteName) {
        document.querySelectorAll('.platform-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.site === siteName) {
                item.classList.add('active');
            }
        });
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Global toggle
        elements.enableToggle.addEventListener('change', () => {
            const enabled = elements.enableToggle.checked;
            saveSettings({ globalEnabled: enabled });
            updateGlobalToggleUI(enabled);
        });

        // Platform toggles
        for (const [site, toggle] of Object.entries(platformToggles)) {
            if (toggle) {
                toggle.addEventListener('change', () => {
                    saveSiteEnabled(site, toggle.checked);
                });
            }
        }

        // Test scroll button
        elements.testScrollBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab) {
                    elements.testScrollBtn.disabled = true;
                    elements.testScrollBtn.innerHTML = '<span class="btn-icon">⏳</span> Scrolling...';

                    chrome.tabs.sendMessage(tab.id, { action: 'testScroll' }, (response) => {
                        if (response?.success) {
                            elements.scrollCount.textContent = response.scrollCount;
                            elements.lastScroll.textContent = 'Just now';
                        }

                        setTimeout(() => {
                            elements.testScrollBtn.disabled = false;
                            elements.testScrollBtn.innerHTML = '<span class="btn-icon">⬇️</span> Skip to Next';
                        }, 500);
                    });
                }
            });
        });

        // Pause button
        elements.pauseBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, { action: 'togglePause' }, (response) => {
                        if (response) {
                            updatePauseButton(response.paused);
                        }
                    });
                }
            });
        });

        // Reset stats button
        elements.resetStatsBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, { action: 'resetStats' }, (response) => {
                        if (response?.success) {
                            elements.scrollCount.textContent = '0';
                            elements.lastScroll.textContent = '--';
                        }
                    });
                }
            });
        });
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'statsUpdate' && message.data) {
                updateUI({
                    ...currentState,
                    scrollCount: message.data.scrollCount,
                    lastScrollTimestamp: message.data.lastScrollTimestamp,
                    lastVideoInfo: message.data.lastVideoInfo,
                    siteName: message.data.siteName
                });
            }
        });
    }

    // ==================== UTILITIES ====================
    function formatTime(seconds) {
        if (!seconds || !isFinite(seconds)) return '--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 5) return 'Just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    // Start
    init();
});
