// Shared by background.js and popup.js so the defaults live in exactly one
// place. Loaded as a plain script in both contexts (no modules — MV2 event
// pages and popup pages both just take a <script> tag / scripts array entry).

const DEFAULTS = {
  tabLimit: 6,
  redirect: true
};

const LIMIT_MIN = 1;
const LIMIT_MAX = 30;

// storage.local.get(object) returns the defaults for any key not yet stored,
// so a fresh install works with no first-run write.
function loadSettings() {
  return browser.storage.local.get(DEFAULTS);
}

function saveSettings(partial) {
  return browser.storage.local.set(partial);
}
