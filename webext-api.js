(function (globalScope) {
  "use strict";

  const hasBrowser = typeof globalScope.browser !== "undefined";
  const hasChrome = typeof globalScope.chrome !== "undefined";
  const rawApi = hasBrowser
    ? globalScope.browser
    : hasChrome
      ? globalScope.chrome
      : null;

  function getLastErrorMessage() {
    if (!hasChrome) {
      return null;
    }

    const runtime = globalScope.chrome && globalScope.chrome.runtime;
    if (!runtime || !runtime.lastError) {
      return null;
    }

    return runtime.lastError.message || "Unknown runtime error";
  }

  function callApi(method, context, args) {
    return new Promise((resolve, reject) => {
      if (typeof method !== "function") {
        reject(new Error("Extension API method is not available"));
        return;
      }

      if (hasBrowser) {
        try {
          const result = method.apply(context, args);
          if (result && typeof result.then === "function") {
            result.then(resolve, reject);
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
        return;
      }

      try {
        method.apply(context, [
          ...args,
          (result) => {
            const errorMessage = getLastErrorMessage();
            if (errorMessage) {
              reject(new Error(errorMessage));
              return;
            }
            resolve(result);
          },
        ]);
      } catch (error) {
        reject(error);
      }
    });
  }

  const storageSync = rawApi && rawApi.storage && rawApi.storage.sync;
  const tabsApi = rawApi && rawApi.tabs;
  const runtimeApi = rawApi && rawApi.runtime;
  const scriptingApi = rawApi && rawApi.scripting;

  const api = {
    isSupported: Boolean(rawApi),
    storageGet(defaults) {
      return callApi(storageSync && storageSync.get, storageSync, [defaults]);
    },
    storageSet(values) {
      return callApi(storageSync && storageSync.set, storageSync, [values]);
    },
    tabsQuery(queryInfo) {
      return callApi(tabsApi && tabsApi.query, tabsApi, [queryInfo]);
    },
    tabsSendMessage(tabId, message) {
      return callApi(tabsApi && tabsApi.sendMessage, tabsApi, [tabId, message]);
    },
    executeScript(details) {
      if (!scriptingApi || typeof scriptingApi.executeScript !== "function") {
        return Promise.reject(new Error("scripting.executeScript is not available"));
      }
      return callApi(scriptingApi.executeScript, scriptingApi, [details]);
    },
    runtimeSendMessage(message) {
      return callApi(runtimeApi && runtimeApi.sendMessage, runtimeApi, [message]);
    },
    onRuntimeMessage(listener) {
      if (!runtimeApi || !runtimeApi.onMessage || typeof runtimeApi.onMessage.addListener !== "function") {
        return () => {};
      }
      runtimeApi.onMessage.addListener(listener);
      return () => {
        if (typeof runtimeApi.onMessage.removeListener === "function") {
          runtimeApi.onMessage.removeListener(listener);
        }
      };
    },
    onStorageChanged(listener) {
      if (!rawApi || !rawApi.storage || !rawApi.storage.onChanged || typeof rawApi.storage.onChanged.addListener !== "function") {
        return () => {};
      }
      rawApi.storage.onChanged.addListener(listener);
      return () => {
        if (typeof rawApi.storage.onChanged.removeListener === "function") {
          rawApi.storage.onChanged.removeListener(listener);
        }
      };
    },
  };

  globalScope.webextApi = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
