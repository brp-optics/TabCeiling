// Shared by background.js, content.js and popup.js so the defaults live in
// exactly one place. Loaded as a plain script in all three contexts.

const LIMIT_MIN = 1;

// A sanity bound for the input field, not a design opinion. People really do
// keep thousands of tabs; the ceiling should be able to sit above where they
// actually are, or it's useless to them.
const LIMIT_MAX = 9999;

// The pip row is display only, so it caps far lower than the ceiling does.
// Above this the pips are dropped entirely rather than shown at a scale that
// would misrepresent the number.
const PIP_MAX = 30;

// How aggressively a link that wants a new tab gets collapsed into the tab you
// tapped it from. Ordered least to most disruptive; the popup relies on that.
const LINK_MODES = ["never", "ceiling", "always"];

// Rolling window for the activity readout in the popup.
const ACTIVITY_WINDOW_MS = 60 * 60 * 1000;
const ACTIVITY_KEY = "tabActivity";

// A standing permission to let new tabs through, for pages that genuinely
// need one (about:debugging, OAuth handoffs, print previews).
//
// Shape: { n, until }. Both are nullable and mean "no bound":
//   { n: 1,    until: null }  one tab, no deadline  — the button today
//   { n: 3,    until: null }  three tabs, no deadline — tapped three times
//   { n: null, until: <ts> }  unlimited until a moment — a future "pause for
//                             10 minutes" needs no change to consumeGrant()
//
// No expiry by default on purpose: a slow page load or a distraction should
// not silently revoke something you asked for.
const GRANT_KEY = "tabGrant";

const DEFAULTS = {
  // Desktop only. Firefox for Android reports just the loaded tabs and often
  // none at all, so there is no total to compare a ceiling against there.
  tabLimit: 6,

  // Desktop only. Previously "off" was encoded as a tabLimit one past the max,
  // which meant the limit and its on/off state shared one control and neither
  // could change without the other.
  //
  // Off by default, matching blockNew on Android: nothing starts closing tabs
  // before the user has seen the settings. The ceiling value stays visible and
  // editable while off, so the number means something when they switch it on.
  ceilingOn: false,

  // Android only, and binary for the same reason: with no usable count, the
  // honest options are block the tabs you open, or don't. The classifier in
  // background.js reliably tells your tabs from ones the browser is restoring,
  // so this is enforceable even though a count is not.
  //
  // Off by default. An extension that starts closing tabs the moment it is
  // installed, before anyone has looked at its settings, is the wrong first
  // impression — particularly this one, given its history.
  blockNew: false,

  linkMode: "never"
};

function ceilingEnabled(settings) {
  return settings.ceilingOn;
}

async function loadSettings() {
  const stored = await browser.storage.local.get(null);
  const settings = { ...DEFAULTS };

  if (Number.isInteger(stored.tabLimit)) {
    settings.tabLimit = clampLimit(stored.tabLimit);
  }

  if (typeof stored.blockNew === "boolean") {
    settings.blockNew = stored.blockNew;
  }

  if (typeof stored.ceilingOn === "boolean") {
    settings.ceilingOn = stored.ceilingOn;
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
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, value));
}

/**
 * Recent tab opens and closes, trimmed to the rolling window. Purely a
 * readout — nothing enforces against it, which is deliberate: closing an
 * unloaded tab fires no event we can see, so the close figure undercounts and
 * must never be trusted with a decision.
 */
async function loadActivity() {
  const stored = await browser.storage.local.get(ACTIVITY_KEY);
  const events = Array.isArray(stored[ACTIVITY_KEY]) ? stored[ACTIVITY_KEY] : [];
  const cutoff = Date.now() - ACTIVITY_WINDOW_MS;
  return events.filter((e) => e && e.t > cutoff);
}

function grantActive(grant) {
  if (!grant) return false;
  if (grant.until != null && Date.now() > grant.until) return false;
  if (grant.n != null && grant.n <= 0) return false;
  return true;
}

async function loadGrant() {
  const stored = await browser.storage.local.get(GRANT_KEY);
  const grant = stored[GRANT_KEY];
  return grantActive(grant) ? grant : null;
}

/**
 * Spend one tab from the grant. Returns whether this tab is allowed through.
 * Only call when the tab would otherwise have been blocked — spending a grant
 * on a tab that was going to be allowed anyway is a silent theft.
 */
async function consumeGrant() {
  const stored = await browser.storage.local.get(GRANT_KEY);
  const grant = stored[GRANT_KEY];

  if (!grantActive(grant)) {
    if (grant) await browser.storage.local.remove(GRANT_KEY);
    return false;
  }

  // Unlimited-until-a-deadline grants are not decremented.
  if (grant.n == null) return true;

  const n = grant.n - 1;
  if (n > 0) {
    await browser.storage.local.set({ [GRANT_KEY]: { ...grant, n } });
  } else {
    await browser.storage.local.remove(GRANT_KEY);
  }
  return true;
}

/**
 * Add tabs to the grant. Taps stack. An unlimited grant already in force is
 * left alone rather than being narrowed to a count.
 */
async function addGrant(count = 1) {
  const grant = await loadGrant();
  if (grant && grant.n == null) return grant;

  const next = { n: (grant ? grant.n : 0) + count, until: grant ? grant.until : null };
  await browser.storage.local.set({ [GRANT_KEY]: next });
  return next;
}

function clearGrant() {
  return browser.storage.local.remove(GRANT_KEY);
}

/**
 * v1.x stored a boolean `redirect`. Rewrite it as a linkMode once, so we're
 * not carrying the translation forever. Safe to call on every startup.
 */
async function migrateSettings() {
  const stored = await browser.storage.local.get(null);

  // The seeded tab estimate from the development builds is gone: closing an
  // unloaded tab fires no event, so it only ever drifted upward.
  if ("tabEstimate" in stored || "estimateSetAt" in stored) {
    await browser.storage.local.remove(["tabEstimate", "estimateSetAt"]);
  }

  // A stored limit of 31 was the old sentinel for "ceiling off". Translate it
  // into the explicit flag and restore a usable number.
  if (stored.tabLimit === 31 && typeof stored.ceilingOn !== "boolean") {
    await browser.storage.local.set({ ceilingOn: false, tabLimit: 6 });
  }

  if (LINK_MODES.includes(stored.linkMode)) return;
  if (typeof stored.redirect !== "boolean") return;

  await browser.storage.local.set({
    linkMode: stored.redirect ? "ceiling" : "never"
  });
  await browser.storage.local.remove("redirect");
}
