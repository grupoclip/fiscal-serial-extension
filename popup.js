// Popup UI logic

const STORAGE_KEY = 'fiscalSerialData';
const DEFAULT_SERIAL = 'Z243333';

const serialInput = document.getElementById('serialInput');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');

// Load current value into the input
async function loadCurrent() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY] || { serialNumber: DEFAULT_SERIAL };
  serialInput.value = data.serialNumber || '';
  updatePreview(data);
}

function updatePreview(data) {
  previewEl.textContent = JSON.stringify(data);
}

function showStatus(message, type = 'success') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }, 2000);
}

// Save handler
saveBtn.addEventListener('click', async () => {
  const value = serialInput.value.trim();

  if (!value) {
    showStatus('Serial number cannot be empty', 'error');
    return;
  }

  const data = { serialNumber: value };
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
  updatePreview(data);
  showStatus('✓ Saved successfully', 'success');
});

// Reset handler
resetBtn.addEventListener('click', async () => {
  const data = { serialNumber: DEFAULT_SERIAL };
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
  serialInput.value = DEFAULT_SERIAL;
  updatePreview(data);
  showStatus('✓ Reset to default', 'success');
});

// Allow Enter key to save
serialInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    saveBtn.click();
  }
});

// Live preview update as user types
serialInput.addEventListener('input', () => {
  updatePreview({ serialNumber: serialInput.value });
});

// Init
loadCurrent();
