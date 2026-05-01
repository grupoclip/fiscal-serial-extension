// Background service worker
// Initializes a default serialNumber on first install

const STORAGE_KEY = 'fiscalSerialData';

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const existing = await chrome.storage.local.get(STORAGE_KEY);
    if (!existing[STORAGE_KEY]) {
      const defaultData = { serialNumber: 'Z243333' };
      await chrome.storage.local.set({ [STORAGE_KEY]: defaultData });
      console.log('[FiscalSerial] Default key initialized:', defaultData);
    }
  }
});

// Optional: notify content scripts when the value changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY]) {
    console.log('[FiscalSerial] Value updated:', changes[STORAGE_KEY].newValue);
  }
});
