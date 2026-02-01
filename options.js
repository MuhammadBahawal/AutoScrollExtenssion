document.addEventListener('DOMContentLoaded', () => {
    // Default settings
    const DEFAULT_SETTINGS = {
        globalEnabled: true,
        debugLogging: false,
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
        safety: {
            stopOnTabInactive: true,
            pauseOnInteraction: true,
            stopOnManualScroll: false
        },
        hotkeys: {
            enabled: true
        }
    };

    // Elements mapping
    const elements = {
        // General
        globalEnabled: document.getElementById('globalEnabled'),
        debugLogging: document.getElementById('debugLogging'),

        // Sites
        siteInstagram: document.getElementById('siteInstagram'),
        siteYoutube: document.getElementById('siteYoutube'),
        siteTiktok: document.getElementById('siteTiktok'),
        siteX: document.getElementById('siteX'),
        siteFacebook: document.getElementById('siteFacebook'),

        // Timing
        delayAfterEnd: document.getElementById('delayAfterEnd'),
        delayAfterEndValue: document.getElementById('delayAfterEndValue'),
        randomExtraDelay: document.getElementById('randomExtraDelay'),
        randomExtraDelayValue: document.getElementById('randomExtraDelayValue'),

        // Scroll
        scrollFactor: document.getElementById('scrollFactor'),
        scrollFactorValue: document.getElementById('scrollFactorValue'),
        retryAttempts: document.getElementById('retryAttempts'),
        retryAttemptsValue: document.getElementById('retryAttemptsValue'),

        // Safety
        stopOnTabInactive: document.getElementById('stopOnTabInactive'),
        pauseOnInteraction: document.getElementById('pauseOnInteraction'),
        stopOnManualScroll: document.getElementById('stopOnManualScroll'),

        // Hotkeys
        hotkeysEnabled: document.getElementById('hotkeysEnabled'),

        // Actions
        resetAllBtn: document.getElementById('resetAllBtn'),
        saveIndicator: document.getElementById('saveIndicator')
    };

    // Site element mapping
    const siteElements = {
        instagram: elements.siteInstagram,
        youtube: elements.siteYoutube,
        tiktok: elements.siteTiktok,
        x: elements.siteX,
        facebook: elements.siteFacebook
    };

    let saveTimeout = null;

    // ==================== INITIALIZATION ====================
    function init() {
        loadSettings();
        setupEventListeners();
    }

    // ==================== SETTINGS ====================
    function loadSettings() {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
            // General
            if (elements.globalEnabled) {
                elements.globalEnabled.checked = result.globalEnabled;
            }
            if (elements.debugLogging) {
                elements.debugLogging.checked = result.debugLogging;
            }

            // Sites
            for (const [site, el] of Object.entries(siteElements)) {
                if (el) {
                    el.checked = result.sites?.[site]?.enabled ?? true;
                }
            }

            // Timing
            if (elements.delayAfterEnd) {
                elements.delayAfterEnd.value = result.delayAfterEnd;
                updateValueLabel('delayAfterEnd', result.delayAfterEnd);
            }
            if (elements.randomExtraDelay) {
                elements.randomExtraDelay.value = result.randomExtraDelay;
                updateValueLabel('randomExtraDelay', result.randomExtraDelay);
            }

            // Scroll
            if (elements.scrollFactor) {
                elements.scrollFactor.value = result.scrollFactor;
                updateValueLabel('scrollFactor', result.scrollFactor);
            }
            if (elements.retryAttempts) {
                elements.retryAttempts.value = result.retryAttempts;
                updateValueLabel('retryAttempts', result.retryAttempts);
            }

            // Safety
            if (elements.stopOnTabInactive) {
                elements.stopOnTabInactive.checked = result.safety?.stopOnTabInactive ?? true;
            }
            if (elements.pauseOnInteraction) {
                elements.pauseOnInteraction.checked = result.safety?.pauseOnInteraction ?? true;
            }
            if (elements.stopOnManualScroll) {
                elements.stopOnManualScroll.checked = result.safety?.stopOnManualScroll ?? false;
            }

            // Hotkeys
            if (elements.hotkeysEnabled) {
                elements.hotkeysEnabled.checked = result.hotkeys?.enabled ?? true;
            }
        });
    }

    function saveSettings(updates) {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (current) => {
            const newSettings = deepMerge(current, updates);
            chrome.storage.sync.set(newSettings, () => {
                showSaveIndicator();
            });
        });
    }

    function showSaveIndicator() {
        if (saveTimeout) clearTimeout(saveTimeout);

        elements.saveIndicator.classList.add('visible');

        saveTimeout = setTimeout(() => {
            elements.saveIndicator.classList.remove('visible');
        }, 2000);
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // General toggles
        elements.globalEnabled?.addEventListener('change', () => {
            saveSettings({ globalEnabled: elements.globalEnabled.checked });
        });

        elements.debugLogging?.addEventListener('change', () => {
            saveSettings({ debugLogging: elements.debugLogging.checked });
        });

        // Site toggles
        for (const [site, el] of Object.entries(siteElements)) {
            el?.addEventListener('change', () => {
                const sites = {};
                for (const [s, e] of Object.entries(siteElements)) {
                    if (e) {
                        sites[s] = { enabled: e.checked };
                    }
                }
                saveSettings({ sites });
            });
        }

        // Timing sliders
        elements.delayAfterEnd?.addEventListener('input', (e) => {
            updateValueLabel('delayAfterEnd', e.target.value);
        });
        elements.delayAfterEnd?.addEventListener('change', (e) => {
            saveSettings({ delayAfterEnd: parseInt(e.target.value, 10) });
        });

        elements.randomExtraDelay?.addEventListener('input', (e) => {
            updateValueLabel('randomExtraDelay', e.target.value);
        });
        elements.randomExtraDelay?.addEventListener('change', (e) => {
            saveSettings({ randomExtraDelay: parseInt(e.target.value, 10) });
        });

        // Scroll sliders
        elements.scrollFactor?.addEventListener('input', (e) => {
            updateValueLabel('scrollFactor', e.target.value);
        });
        elements.scrollFactor?.addEventListener('change', (e) => {
            saveSettings({ scrollFactor: parseFloat(e.target.value) });
        });

        elements.retryAttempts?.addEventListener('input', (e) => {
            updateValueLabel('retryAttempts', e.target.value);
        });
        elements.retryAttempts?.addEventListener('change', (e) => {
            saveSettings({ retryAttempts: parseInt(e.target.value, 10) });
        });

        // Safety toggles
        elements.stopOnTabInactive?.addEventListener('change', () => {
            saveSettings({
                safety: {
                    stopOnTabInactive: elements.stopOnTabInactive.checked,
                    pauseOnInteraction: elements.pauseOnInteraction?.checked ?? true,
                    stopOnManualScroll: elements.stopOnManualScroll?.checked ?? false
                }
            });
        });

        elements.pauseOnInteraction?.addEventListener('change', () => {
            saveSettings({
                safety: {
                    stopOnTabInactive: elements.stopOnTabInactive?.checked ?? true,
                    pauseOnInteraction: elements.pauseOnInteraction.checked,
                    stopOnManualScroll: elements.stopOnManualScroll?.checked ?? false
                }
            });
        });

        elements.stopOnManualScroll?.addEventListener('change', () => {
            saveSettings({
                safety: {
                    stopOnTabInactive: elements.stopOnTabInactive?.checked ?? true,
                    pauseOnInteraction: elements.pauseOnInteraction?.checked ?? true,
                    stopOnManualScroll: elements.stopOnManualScroll.checked
                }
            });
        });

        // Hotkeys
        elements.hotkeysEnabled?.addEventListener('change', () => {
            saveSettings({
                hotkeys: {
                    enabled: elements.hotkeysEnabled.checked
                }
            });
        });

        // Reset button
        elements.resetAllBtn?.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
                chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
                    loadSettings();
                    showSaveIndicator();
                });
            }
        });
    }

    // ==================== UTILITIES ====================
    function updateValueLabel(setting, value) {
        const labelElement = elements[`${setting}Value`];
        if (!labelElement) return;

        switch (setting) {
            case 'delayAfterEnd':
            case 'randomExtraDelay':
                labelElement.textContent = `${value}ms`;
                break;
            case 'scrollFactor':
                labelElement.textContent = `${Math.round(value * 100)}%`;
                break;
            case 'retryAttempts':
                labelElement.textContent = value;
                break;
        }
    }

    function deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    // Start
    init();
});
