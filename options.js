document.addEventListener("DOMContentLoaded", () => {
    const DEFAULT_SETTINGS = {
        enabled: true,
        delayAfterEnd: 600,
        scrollFactor: 0.95,
        retryAttempts: 2,
        randomExtraDelay: 0,
        debugLogging: false,
    };

    const elements = {
        enabled: document.getElementById("enabled"),
        debugLogging: document.getElementById("debugLogging"),
        delayAfterEnd: document.getElementById("delayAfterEnd"),
        randomExtraDelay: document.getElementById("randomExtraDelay"),
        scrollFactor: document.getElementById("scrollFactor"),
        scrollFactorValue: document.getElementById("scrollFactorValue"),
        retryAttempts: document.getElementById("retryAttempts"),
        saveBtn: document.getElementById("saveBtn"),
        resetBtn: document.getElementById("resetBtn"),
        statusMessage: document.getElementById("statusMessage"),
    };

    function loadSettings() {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
            elements.enabled.checked = settings.enabled;
            elements.debugLogging.checked = settings.debugLogging;
            elements.delayAfterEnd.value = settings.delayAfterEnd;
            elements.randomExtraDelay.value = settings.randomExtraDelay;
            elements.scrollFactor.value = settings.scrollFactor;
            elements.scrollFactorValue.textContent = settings.scrollFactor.toFixed(2);
            elements.retryAttempts.value = settings.retryAttempts;
            console.log("[InstaReelAutoScroll] Settings loaded:", settings);
        });
    }

    function saveSettings() {
        const settings = {
            enabled: elements.enabled.checked,
            debugLogging: elements.debugLogging.checked,
            delayAfterEnd: parseInt(elements.delayAfterEnd.value, 10) || DEFAULT_SETTINGS.delayAfterEnd,
            randomExtraDelay: parseInt(elements.randomExtraDelay.value, 10) || 0,
            scrollFactor: parseFloat(elements.scrollFactor.value) || DEFAULT_SETTINGS.scrollFactor,
            retryAttempts: parseInt(elements.retryAttempts.value, 10) || DEFAULT_SETTINGS.retryAttempts,
        };

        settings.delayAfterEnd = Math.max(0, Math.min(5000, settings.delayAfterEnd));
        settings.randomExtraDelay = Math.max(0, Math.min(1000, settings.randomExtraDelay));
        settings.scrollFactor = Math.max(0.6, Math.min(1.5, settings.scrollFactor));
        settings.retryAttempts = Math.max(1, Math.min(5, settings.retryAttempts));

        chrome.storage.sync.set(settings, () => {
            showStatus("✅ Settings saved successfully!", "success");
            console.log("[InstaReelAutoScroll] Settings saved:", settings);
        });
    }

    function resetSettings() {
        chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
            loadSettings();
            showStatus("🔄 Settings reset to defaults", "info");
            console.log("[InstaReelAutoScroll] Settings reset to defaults");
        });
    }

    function showStatus(message, type) {
        elements.statusMessage.textContent = message;
        elements.statusMessage.className = `status-message show ${type}`;

        setTimeout(() => {
            elements.statusMessage.classList.remove("show");
        }, 3000);
    }

    elements.saveBtn.addEventListener("click", saveSettings);

    elements.resetBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to reset all settings to defaults?")) {
            resetSettings();
        }
    });

    elements.scrollFactor.addEventListener("input", (e) => {
        elements.scrollFactorValue.textContent = parseFloat(e.target.value).toFixed(2);
    });

    elements.delayAfterEnd.addEventListener("change", (e) => {
        let value = parseInt(e.target.value, 10) || 0;
        value = Math.max(0, Math.min(5000, value));
        e.target.value = value;
    });

    elements.randomExtraDelay.addEventListener("change", (e) => {
        let value = parseInt(e.target.value, 10) || 0;
        value = Math.max(0, Math.min(1000, value));
        e.target.value = value;
    });

    elements.retryAttempts.addEventListener("change", (e) => {
        let value = parseInt(e.target.value, 10) || 1;
        value = Math.max(1, Math.min(5, value));
        e.target.value = value;
    });

    document.querySelectorAll("input[type='number']").forEach((input) => {
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                saveSettings();
            }
        });
    });

    loadSettings();
});
