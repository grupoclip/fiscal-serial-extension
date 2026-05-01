# Fiscal Serial Data — Chrome Extension

A Chrome extension that stores a fiscal serial number and writes it to
`localStorage` on every website you visit, under the key `fiscalSerialData`.

## What it does

- On install, it stores a default value: `{"serialNumber": "Z243333"}`
- On **every** page load (all domains), it writes the value to that page's `localStorage`:
  - Key: `fiscalSerialData`
  - Value: `{"serialNumber": "Z243333"}` (or whatever you have set)
- A popup UI lets you view, edit and reset the serial number

## How your web app reads it

In any page, your app can simply do:

```javascript
const raw = localStorage.getItem('fiscalSerialData');
if (raw) {
  const data = JSON.parse(raw);
  console.log(data.serialNumber); // "Z243333"

  // Send to your backend to validate
  fetch('/api/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serialNumber: data.serialNumber })
  });
}
```

## Installation (development mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `fiscal-serial-extension` folder
5. The extension is now installed — pin it from the puzzle icon for easy access

## Editing the serial number

1. Click the extension icon in the toolbar
2. Modify the **Serial Number** field
3. Click **Save**
4. Refresh any open tab and the new value will be written to its `localStorage`

## Files

- `manifest.json` — extension config (Manifest V3)
- `background.js` — service worker, sets default value on install
- `content.js` — runs on all pages, writes to `localStorage`
- `popup.html` / `popup.css` / `popup.js` — the UI
- `icons/` — extension icons (16, 48, 128 px)

## Notes

- The content script runs at `document_start`, so the value is in `localStorage`
  before page scripts run.
- If a page's JavaScript clears `localStorage`, the value will be re-written on
  next page load (or whenever extension storage changes).
- Works on `http://`, `https://`, and `file://` URLs (host_permissions: `<all_urls>`).
