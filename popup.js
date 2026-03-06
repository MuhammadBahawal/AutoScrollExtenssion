document.addEventListener("DOMContentLoaded", () => {
  const api = window.webextApi;
  const enableToggle = document.getElementById("enableToggle");
  const statusText = document.getElementById("statusText");
  const scrollCount = document.getElementById("scrollCount");
  const lastScroll = document.getElementById("lastScroll");
  const videoDuration = document.getElementById("videoDuration");
  const videoCurrentTime = document.getElementById("videoCurrentTime");
  const testScrollBtn = document.getElementById("testScrollBtn");
  const resetStatsBtn = document.getElementById("resetStatsBtn");
  const popupContainer = document.querySelector(".popup-container");

  if (!api || !api.isSupported) {
    statusText.textContent = "Browser not supported";
    statusText.style.color = "#FFB6C1";
    return;
  }

  function isInstagramTab(tab) {
    return Boolean(tab && tab.url && tab.url.includes("instagram.com"));
  }

  function isReelsTab(tab) {
    if (!tab || !tab.url) {
      return false;
    }
    return tab.url.includes("instagram.com/reel") || tab.url.includes("instagram.com/reels");
  }

  async function getActiveTab() {
    const tabs = await api.tabsQuery({ active: true, currentWindow: true });
    return tabs && tabs.length > 0 ? tabs[0] : null;
  }

  async function loadState() {
    try {
      const result = await api.storageGet({ enabled: true });
      enableToggle.checked = result.enabled;
      updateStatusUI(result.enabled);
    } catch (error) {
      console.error("[InstaReelAutoScroll] Failed to read state:", error);
      updateStatusUI(false);
    }

    await getStatsFromContentScript();
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

  async function getStatsFromContentScript() {
    let tab;
    try {
      tab = await getActiveTab();
    } catch (error) {
      console.error("[InstaReelAutoScroll] Failed to query tab:", error);
      displayNotOnInstagram();
      return;
    }

    if (!isInstagramTab(tab)) {
      displayNotOnInstagram();
      return;
    }

    const reelsPage = isReelsTab(tab);

    try {
      const response = await api.tabsSendMessage(tab.id, { action: "getStats" });
      if (!response) {
        if (reelsPage) {
          displayNoConnection();
        } else {
          displayNotOnReels();
        }
        return;
      }

      updateStatsUI(response);
      if (reelsPage) {
        const enabled = enableToggle.checked;
        statusText.textContent = enabled ? "Active on Reels" : "Disabled";
        statusText.style.color = enabled ? "#90EE90" : "#FFB6C1";
      } else {
        displayNotOnReels();
      }
    } catch (error) {
      console.log("Could not connect to content script:", error.message || error);
      if (reelsPage) {
        displayNoConnection();
        await tryInjectContentScript(tab.id);
      } else {
        displayNotOnReels();
      }
    }
  }

  async function tryInjectContentScript(tabId) {
    try {
      await api.executeScript({
        target: { tabId },
        files: ["webext-api.js", "content.js"],
      });
      console.log("Content script injected successfully");
      setTimeout(getStatsFromContentScript, 1000);
    } catch (error) {
      console.log("Could not inject content script:", error.message || error);
    }
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

      if (duration && Number.isFinite(duration)) {
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
    if (!seconds || !Number.isFinite(seconds)) {
      return "--";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 5) {
      return "Just now";
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ago`;
    }
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}h ago`;
    }
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  enableToggle.addEventListener("change", async () => {
    const enabled = enableToggle.checked;
    try {
      await api.storageSet({ enabled });
      updateStatusUI(enabled);
      console.log("[InstaReelAutoScroll] Extension", enabled ? "enabled" : "disabled");
    } catch (error) {
      console.error("[InstaReelAutoScroll] Failed to toggle extension:", error);
      enableToggle.checked = !enabled;
    }
  });

  testScrollBtn.addEventListener("click", async () => {
    let tab;
    try {
      tab = await getActiveTab();
    } catch (error) {
      console.error("[InstaReelAutoScroll] Failed to query tab:", error);
      return;
    }

    if (!isReelsTab(tab)) {
      alert("Please navigate to Instagram Reels first!");
      return;
    }

    testScrollBtn.textContent = "Scrolling...";
    testScrollBtn.disabled = true;

    try {
      const response = await api.tabsSendMessage(tab.id, { action: "testScroll" });
      if (response && response.success) {
        scrollCount.textContent = response.scrollCount;
        lastScroll.textContent = "Just now";
      }
    } catch (error) {
      console.log("Error:", error.message || error);
    }

    setTimeout(() => {
      testScrollBtn.innerHTML = '<span class="btn-icon">&#8595;</span> Test Scroll Now';
      testScrollBtn.disabled = false;
    }, 500);
  });

  resetStatsBtn.addEventListener("click", async () => {
    let tab;
    try {
      tab = await getActiveTab();
    } catch (error) {
      console.error("[InstaReelAutoScroll] Failed to query tab:", error);
      scrollCount.textContent = "0";
      lastScroll.textContent = "--";
      return;
    }

    if (isReelsTab(tab)) {
      try {
        const response = await api.tabsSendMessage(tab.id, { action: "resetStats" });
        if (response && response.success) {
          scrollCount.textContent = "0";
          lastScroll.textContent = "--";
        }
      } catch (error) {
        console.log("Error:", error.message || error);
      }
      return;
    }

    scrollCount.textContent = "0";
    lastScroll.textContent = "--";
  });

  api.onRuntimeMessage((message) => {
    if (message.action === "statsUpdate" && message.data) {
      updateStatsUI(message.data);
    }
  });

  setInterval(() => {
    getStatsFromContentScript();
  }, 2000);

  loadState();
});
