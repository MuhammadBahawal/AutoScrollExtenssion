document.addEventListener("DOMContentLoaded", () => {
    const enableToggle = document.getElementById("enableToggle");
    const statusText = document.getElementById("statusText");
    const scrollCount = document.getElementById("scrollCount");
    const lastScroll = document.getElementById("lastScroll");
    const videoDuration = document.getElementById("videoDuration");
    const videoCurrentTime = document.getElementById("videoCurrentTime");
    const testScrollBtn = document.getElementById("testScrollBtn");
    const resetStatsBtn = document.getElementById("resetStatsBtn");
    const popupContainer = document.querySelector(".popup-container");

    function loadState() {
        chrome.storage.sync.get({ enabled: true }, (result) => {
            enableToggle.checked = result.enabled;
            updateStatusUI(result.enabled);
        });
        getStatsFromContentScript();
    }

    function updateStatusUI(enabled) {
        if (enabled) {
            statusText.textContent = "Enabled";
            statusText.style.color = "#90EE90";
            popupContainer.classList.remove("disabled");
        } else {
            statusText.textContent = "Disabled";
            statusText.style.color = "#FFB6C1";
            popupContainer.classList.add("disabled");
        }
    }

    function getStatsFromContentScript() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url && tab.url.includes("instagram.com")) {
                const isReelsPage = tab.url.includes("instagram.com/reel") || tab.url.includes("instagram.com/reels");

                chrome.tabs.sendMessage(tab.id, { action: "getStats" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("Could not connect to content script:", chrome.runtime.lastError.message);
                        if (isReelsPage) {
                            displayNoConnection();
                            tryInjectContentScript(tab.id);
                        } else {
                            displayNotOnReels();
                        }
                        return;
                    }

                    if (response) {
                        updateStatsUI(response);
                        if (isReelsPage) {
                            const enabled = enableToggle.checked;
                            statusText.textContent = enabled ? "Active on Reels" : "Disabled";
                            statusText.style.color = enabled ? "#90EE90" : "#FFB6C1";
                        } else {
                            displayNotOnReels();
                        }
                    }
                });
            } else {
                displayNotOnInstagram();
            }
        });
    }

    function tryInjectContentScript(tabId) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
        }).then(() => {
            console.log("Content script injected successfully");
            setTimeout(getStatsFromContentScript, 1000);
        }).catch((error) => {
            console.log("Could not inject content script:", error);
        });
    }

    function displayNotOnReels() {
        scrollCount.textContent = "0";
        lastScroll.textContent = "--";
        videoDuration.textContent = "--";
        videoCurrentTime.textContent = "--";
        statusText.textContent = "Navigate to Instagram Reels";
        statusText.style.color = "#87CEEB";
    }

    function updateStatsUI(stats) {
        scrollCount.textContent = stats.scrollCount || 0;

        if (stats.lastScrollTimestamp) {
            const timeAgo = getTimeAgo(stats.lastScrollTimestamp);
            lastScroll.textContent = timeAgo;
        } else {
            lastScroll.textContent = "--";
        }

        if (stats.lastVideoInfo) {
            const duration = stats.lastVideoInfo.duration;
            const current = stats.lastVideoInfo.currentTime;

            if (duration && isFinite(duration)) {
                videoDuration.textContent = formatTime(duration);
                videoCurrentTime.textContent = formatTime(current);
            } else {
                videoDuration.textContent = "--";
                videoCurrentTime.textContent = "--";
            }
        }
    }

    function displayNoConnection() {
        scrollCount.textContent = "--";
        lastScroll.textContent = "--";
        videoDuration.textContent = "--";
        videoCurrentTime.textContent = "--";
        statusText.textContent = "Not connected to page";
        statusText.style.color = "#FFD700";
    }

    function displayNotOnInstagram() {
        scrollCount.textContent = "--";
        lastScroll.textContent = "--";
        videoDuration.textContent = "--";
        videoCurrentTime.textContent = "--";
        statusText.textContent = "Open Instagram Reels to use";
        statusText.style.color = "#87CEEB";
    }

    function formatTime(seconds) {
        if (!seconds || !isFinite(seconds)) return "--";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    function getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 5) return "Just now";
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    enableToggle.addEventListener("change", () => {
        const enabled = enableToggle.checked;
        chrome.storage.sync.set({ enabled }, () => {
            updateStatusUI(enabled);
            console.log("[InstaReelAutoScroll] Extension", enabled ? "enabled" : "disabled");
        });
    });

    testScrollBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url && (tab.url.includes("instagram.com/reel") || tab.url.includes("instagram.com/reels"))) {
                testScrollBtn.textContent = "Scrolling...";
                testScrollBtn.disabled = true;

                chrome.tabs.sendMessage(tab.id, { action: "testScroll" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("Error:", chrome.runtime.lastError.message);
                        testScrollBtn.textContent = "⬇️ Test Scroll Now";
                        testScrollBtn.disabled = false;
                        return;
                    }

                    if (response && response.success) {
                        scrollCount.textContent = response.scrollCount;
                        lastScroll.textContent = "Just now";
                    }

                    setTimeout(() => {
                        testScrollBtn.innerHTML = '<span class="btn-icon">⬇️</span> Test Scroll Now';
                        testScrollBtn.disabled = false;
                    }, 500);
                });
            } else {
                alert("Please navigate to Instagram Reels first!");
            }
        });
    });

    resetStatsBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url && (tab.url.includes("instagram.com/reel") || tab.url.includes("instagram.com/reels"))) {
                chrome.tabs.sendMessage(tab.id, { action: "resetStats" }, (response) => {
                    if (response && response.success) {
                        scrollCount.textContent = "0";
                        lastScroll.textContent = "--";
                    }
                });
            } else {
                scrollCount.textContent = "0";
                lastScroll.textContent = "--";
            }
        });
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "statsUpdate" && message.data) {
            updateStatsUI(message.data);
        }
    });

    setInterval(() => {
        getStatsFromContentScript();
    }, 2000);

    loadState();
});
