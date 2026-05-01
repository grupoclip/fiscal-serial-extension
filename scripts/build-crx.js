#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ChromeExtension = require('crx');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, 'extension');
const KEY_PATH = process.env.CRX_KEY_PATH || path.join(ROOT, 'key.pem');

const REPO = process.env.GITHUB_REPOSITORY || 'YOUR_GITHUB_USER/YOUR_REPO';
const BASE_URL = `https://github.com/${REPO}/releases/latest/download`;
const UPDATES_URL = `${BASE_URL}/updates.xml`;
const CRX_URL = `${BASE_URL}/extension.crx`;

const FILES_TO_INCLUDE = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'icons',
];

function computeExtensionId(privateKeyPem) {
  const pubKey = crypto.createPublicKey({ key: privateKeyPem, format: 'pem' });
  const der = pubKey.export({ type: 'spki', format: 'der' });
  const hash = crypto.createHash('sha256').update(der).digest('hex').slice(0, 32);
  return hash.replace(/[0-9a-f]/g, (c) => {
    const code = c.charCodeAt(0);
    return code <= 57
      ? String.fromCharCode(code + 49)
      : String.fromCharCode(code + 10);
  });
}

function stageSources() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });
  for (const entry of FILES_TO_INCLUDE) {
    const src = path.join(ROOT, entry);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(STAGE, entry), { recursive: true });
  }
}

function renderUpdatesXml(extensionId, version) {
  return `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extensionId}'>
    <updatecheck codebase='${CRX_URL}' version='${version}' />
  </app>
</gupdate>
`;
}

function renderWindowsInstall(policyValue) {
  return `Windows Registry Editor Version 5.00

; Force-installs the Fiscal Serial Data extension on Chrome and Edge.
; HKEY_LOCAL_MACHINE applies to all users on this PC and requires
; Administrator rights. To install per-user without admin, replace
; HKEY_LOCAL_MACHINE with HKEY_CURRENT_USER below.
;
; After running, fully restart Chrome / Edge. Verify at chrome://policy
; or edge://policy.

[HKEY_LOCAL_MACHINE\\Software\\Policies\\Google\\Chrome\\ExtensionInstallForcelist]
"1"="${policyValue}"

[HKEY_LOCAL_MACHINE\\Software\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist]
"1"="${policyValue}"
`;
}

function renderWindowsUninstall() {
  return `Windows Registry Editor Version 5.00

; Removes the Fiscal Serial Data force-install policy from Chrome and Edge.
; Requires Administrator rights if installed via HKLM.

[-HKEY_LOCAL_MACHINE\\Software\\Policies\\Google\\Chrome\\ExtensionInstallForcelist]

[-HKEY_LOCAL_MACHINE\\Software\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist]
`;
}

function renderMacInstall(policyValue) {
  return `#!/usr/bin/env bash
# Force-installs the Fiscal Serial Data extension on Chrome and Edge
# for the current macOS user. No sudo required.
#
# Usage:  bash install-mac.sh
# After running, fully quit Chrome / Edge (Cmd-Q) and reopen.
# Verify at chrome://policy and edge://policy.

set -euo pipefail

POLICY="${policyValue}"

# Quit Chrome / Edge so they re-read the policy on next launch.
/usr/bin/osascript -e 'tell application "Google Chrome" to quit' 2>/dev/null || true
/usr/bin/osascript -e 'tell application "Microsoft Edge" to quit' 2>/dev/null || true

for DOMAIN in com.google.Chrome com.microsoft.Edge; do
  /usr/bin/defaults write "$DOMAIN" ExtensionInstallForcelist -array "$POLICY"
  echo "Wrote policy for $DOMAIN -> $(/usr/bin/defaults read "$DOMAIN" ExtensionInstallForcelist)"
done

# Flush the cfprefsd cache so Chrome reads the new plist on next launch.
/usr/bin/killall cfprefsd 2>/dev/null || true

echo
echo "Done. Reopen Chrome / Edge and verify at chrome://policy (search 'ExtensionInstallForcelist')."
`;
}

function renderMacUninstall() {
  return `#!/usr/bin/env bash
# Removes the Fiscal Serial Data force-install policy from Chrome and Edge
# for the current macOS user.

set -euo pipefail

for DOMAIN in com.google.Chrome com.microsoft.Edge; do
  /usr/bin/defaults delete "$DOMAIN" ExtensionInstallForcelist 2>/dev/null || true
  echo "Removed policy from $DOMAIN"
done

echo "Done. Fully quit and reopen Chrome / Edge."
`;
}

async function main() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`Missing private key at ${KEY_PATH}`);
    console.error(`Generate one locally with:`);
    console.error(`  openssl genrsa -out key.pem 2048`);
    process.exit(1);
  }

  const privateKey = fs.readFileSync(KEY_PATH);
  const extensionId = computeExtensionId(privateKey);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'),
  );
  const version = manifest.version;

  stageSources();

  const crx = new ChromeExtension({ privateKey });
  await crx.load(STAGE);
  const buffer = await crx.pack();
  fs.writeFileSync(path.join(DIST, 'extension.crx'), buffer);

  fs.writeFileSync(
    path.join(DIST, 'updates.xml'),
    renderUpdatesXml(extensionId, version),
  );

  const policyValue = `${extensionId};${UPDATES_URL}`;

  fs.writeFileSync(
    path.join(DIST, 'install-windows.reg'),
    renderWindowsInstall(policyValue),
  );
  fs.writeFileSync(
    path.join(DIST, 'uninstall-windows.reg'),
    renderWindowsUninstall(),
  );

  const macInstallPath = path.join(DIST, 'install-mac.sh');
  const macUninstallPath = path.join(DIST, 'uninstall-mac.sh');
  fs.writeFileSync(macInstallPath, renderMacInstall(policyValue));
  fs.writeFileSync(macUninstallPath, renderMacUninstall());
  fs.chmodSync(macInstallPath, 0o755);
  fs.chmodSync(macUninstallPath, 0o755);

  fs.rmSync(STAGE, { recursive: true, force: true });

  console.log(`Extension ID:  ${extensionId}`);
  console.log(`Version:       ${version}`);
  console.log(`Repo:          ${REPO}`);
  console.log(`Updates URL:   ${UPDATES_URL}`);
  console.log(`Outputs in dist/:`);
  console.log(`  extension.crx`);
  console.log(`  updates.xml`);
  console.log(`  install-windows.reg / uninstall-windows.reg`);
  console.log(`  install-mac.sh / uninstall-mac.sh`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
