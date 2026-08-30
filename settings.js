// Shared by background.js, content.js and popup.js so the defaults live in
// exactly one place. Loaded as a plain script in all three contexts.

const LIMIT_MIN = 1;
const LIMIT_MAX = 30;

// One past the max means "no ceiling at all". Keeping it a number lets the
// stepper stay a plain integer range — only the display changes.
const LIMIT_OFF = LIMIT_MAX + 1;

// How aggressively a link that wants a new tab gets collapsed into the tab you
// tapped it from. Ordered least to most disruptive; the popup relies on that.
//   never   — blocked tabs are closed and the URL dropped. Your page is never
//             taken away from you.
//   ceiling — only once you're at the limit does the URL load in the origin tab.
//   always  — links never open new tabs, at any count.
const LINK_MODES = ["never", "ceiling", "always"];

const DEFAULTS = {
  tabLimit: 6,
  linkMode: "never"
};

function ceilingEnabled(settings) {
  return settings.tabLimit <= LIMIT_MAX;
}

async function loadSettings() {
  const stored = await browser.storage.local.get(null);
  const settings = { ...DEFAULTS };

  if (Number.isInteger(stored.tabLimit)) {
    settings.tabLimit = clampLimit(stored.tabLimit);
  }

  if (LINK_MODES.includes(stored.linkMode)) {
    settings.linkMode = stored.linkMode;
  } else if (typeof stored.redirect === "boolean") {
    settings.linkMode = stored.redirect ? "ceiling" : "never";
  }

  return settings;
}

function saveSettings(partial) {
  return browser.storage.local.set(partial);
}

function clampLimit(value) {
  return Math.min(LIMIT_OFF, Math.max(LIMIT_MIN, value));
}

/**
 * v1.x stored a boolean `redirect`. Rewrite it as a linkMode once, so we're
 * not carrying the translation forever. Safe to call on every startup.
 */
async function migrateSettings() {
  const stored = await browser.storage.local.get(null);
  if (LINK_MODES.includes(stored.linkMode)) return;
  if (typeof stored.redirect !== "boolean") return;

  await browser.storage.local.set({
    linkMode: stored.redirect ? "ceiling" : "never"
  });
  await browser.storage.local.remove("redirect");
}
