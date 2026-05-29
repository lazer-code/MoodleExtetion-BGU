// Storage adapter for Supabase auth client, backed by chrome.storage.local.
// Supabase expects the interface { getItem, setItem, removeItem } returning
// Promises. chrome.storage.local is callback-based; we promisify here.
//
// We check chrome.runtime.lastError inside every callback: Chrome's extension
// APIs surface errors via this global, not via rejected Promises or thrown
// exceptions. If we don't read it, Chrome logs an "unchecked error" warning
// and — more importantly — the call silently fails. For Supabase auth this
// means session tokens could fail to persist (quota exceeded, invalid context)
// and login would seem to work but not survive a popup close.

const chromeStorageAdapter = {
  getItem: (key) => new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (data) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(data && key in data ? data[key] : null);
    });
  }),

  setItem: (key, value) => new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  }),

  removeItem: (key) => new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  }),
};

// Export for Jest (CommonJS) AND for extension scripts (attach to globalThis)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { chromeStorageAdapter };
}
globalThis.chromeStorageAdapter = chromeStorageAdapter;
