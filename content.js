// Content Script
// Runs on every page (all_urls) and writes the fiscalSerialData key to the page's localStorage

const STORAGE_KEY = 'fiscalSerialData';

// Inject the value into the page's localStorage
function writeToPageLocalStorage(value) {
  // Content scripts run in an isolated world but they DO share localStorage
  // with the page they are injected into.
  try {
    const jsonString = JSON.stringify(value);
    localStorage.setItem(STORAGE_KEY, jsonString);
    console.log('[FiscalSerial] Written to localStorage:', jsonString);
  } catch (err) {
    console.error('[FiscalSerial] Failed to write to localStorage:', err);
  }
}

// Read from extension storage and sync to page localStorage
async function syncFromExtensionStorage() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const data = result[STORAGE_KEY];

    if (data && data.serialNumber) {
      writeToPageLocalStorage(data);
    } else {
      // Fallback default if not set yet
      const fallback = { serialNumber: 'Z243333' };
      writeToPageLocalStorage(fallback);
      // Also persist back to extension storage
      await chrome.storage.local.set({ [STORAGE_KEY]: fallback });
    }
  } catch (err) {
    console.error('[FiscalSerial] Sync failed:', err);
  }
}

// Initial sync as soon as the content script loads
syncFromExtensionStorage();

// Listen for changes from the popup and re-sync immediately
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY]) {
    const newValue = changes[STORAGE_KEY].newValue;
    if (newValue) {
      writeToPageLocalStorage(newValue);
    }
  }
});
