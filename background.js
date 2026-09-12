// Live settings, edited from the popup. Starts at the defaults so the listener
// below is never reading undefined during the async load.
let settings = { ...DEFAULTS };

migrateSettings()
  .then(loadSettings)
  .then((loaded) => { settings = loaded; })
  .catch((err) => console.warn("Tab Ceiling: settings load failed", err));

// The breaker itself is in-memory and clears when Firefox restarts, so the
// flag the popup reads has to clear with it. Otherwise a trip from days ago
// shows a warning forever.
browser.storage.local.remove("breakerTrippedAt").catch(() => {});

// Apply popup edits without needing a browser restart.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const [key, change] of Object.entries(changes)) {
    if (!(key in DEFAULTS)) continue;
    if (change.newValue === undefined) continue;
    settings[key] = change.newValue;
  }
});

// How long to wait for a brand-new tab to report its URL before giving up.
const URL_WAIT_MS = 800;

// Ignore tab creation for this long after the browser starts. Session restore
// recreates your old tabs, and depending on Firefox version those may fire
// tabs.onCreated — which would wipe your session. This is the safety catch.
const STARTUP_GRACE_MS = 20000;

// Circuit breaker. If we ever close this many tabs inside this window, we are
// almost certainly in a feedback loop rather than responding to a person
// tapping links, so we stop enforcing until the browser restarts.
//
// This exists because of a real incident: on Firefox for Android, closing a
// tab makes the browser materialise another one from its own storage, which
// fires tabs.onCreated, which closed another tab, and so on until the session
// was gone. Any misclassification we haven't thought of must not be able to
// run away like that again.
const BREAKER_WINDOW_MS = 10000;
const BREAKER_MAX_CLOSURES = 3;

// After we close a tab, Firefox for Android materialises another one to put on
// screen, and that arrives here as a creation event. Anything appearing this
// soon after our own closure is the browser reacting to us, not you opening a
// tab — nobody taps twice that fast. Suppressing it breaks the feedback loop
// at its causal link, one step earlier than the breaker.
const CLOSE_QUIET_MS = 500;

// Fenix's "+" tab is not a real GeckoView tab while it is blank: tabs.remove
// rejects with "not supported", and tabs.query does not even return it. It
// becomes removable once it navigates somewhere. So when a close fails we
// watch the tab and close it the moment it gets a real URL — the blank tab
// stays, but the browsing is still blocked. Give up after this long.
const PENDING_MAX_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------

// Tab IDs we've already acted on, so a race can't make us handle one twice.
const handled = new Set();

// Timestamps of tabs we've closed, trimmed to the breaker window.
let closures = [];
let breakerTripped = false;

// When we last closed a tab ourselves. See CLOSE_QUIET_MS.
let lastCloseAt = 0;

// Tabs we wanted to close but couldn't yet. tabId -> teardown function.
const pending = new Map();

// Set once at startup. Android needs a stricter rule about which tab
// creations we're willing to act on — see the check in the listener.
let isAndroid = false;
browser.runtime
  .getPlatformInfo()
  .then((info) => { isAndroid = info.os === "android"; })
  .catch(() => {});

// Set once when the background page loads. Because the page is persistent
// (see manifest.json), this really is browser-start time and not an
// event-page wakeup, which would reset the clock at random moments.
const loadedAt = Date.now();

browser.tabs.onCreated.addListener(async (tab) => {
  try {
    // Dedupe first: a tab we have already acted on must not be counted or
    // acted on twice.
    if (handled.has(tab.id)) return;

    // Android's only reliable tell that this is the browser materialising a
    // tab rather than you opening one: a restored tab already has the screen's
    // dimensions at creation, because it is about to be displayed. A tab you
    // opened is 0x0 for the first few tens of milliseconds — including one
    // that takes focus immediately, which was the case worth checking.
    //
    // Measured on Fenix: four restores all 378x737 at creation, four opened
    // tabs (the "+" button, three background links, one foreground PDF link)
    // all 0x0, becoming 378x737 about 74ms later.
    //
    // Two things this depends on. It must be read HERE, synchronously, before
    // any await — the signal is gone within a frame. And it must not run on
    // desktop, where newly created tabs already carry the window's dimensions
    // and this test would skip everything.
    if (isAndroid && (tab.width > 0 || tab.height > 0)) return;

    // The desktop equivalent. See looksRestored.
    if (looksRestored(tab)) return;

    // Independently of the classifier above: if we just closed something, this
    // is the browser backfilling the screen, not you.
    if (Date.now() - lastCloseAt < CLOSE_QUIET_MS) return;

    // Everything above this line filters out tabs the browser created. What
    // reaches here is a tab you opened, so it belongs in the statistic —
    // whether or not we go on to enforce against it. The gates below govern
    // enforcement only, which is why recording happens first: the readout is a
    // record of what you did, not of what the extension chose to act on.
    recordActivity(+1);

    // Don't enforce while the session is still restoring.
    if (Date.now() - loadedAt < STARTUP_GRACE_MS) return;
    if (breakerTripped) return;

    // tabs.query only returns loaded tabs on Android, so on that platform this
    // count is a floor, not a total. See README, Known limitations.
    const peers = await queryPeers(tab);

    // Android gets a binary block; desktop gets the counted ceiling. There is
    // no usable tab total on Android — tabs.query returns only loaded tabs and
    // frequently none — so a ceiling there would be comparing against noise.
    const shouldBlock = isAndroid
      ? settings.blockNew
      : ceilingEnabled(settings) && peers.length > settings.tabLimit;

    // In "always" mode we collapse link-opened tabs even under the ceiling —
    // that's what makes the promise unconditional, and it's the only way to
    // catch window.open(), which the content script can't touch.
    const collapseLink =
      settings.linkMode === "always" && tab.openerTabId != null;

    if (!shouldBlock && !collapseLink) return;
    if (!breakerAllows()) return;

    handled.add(tab.id);

    // Work out where to send the URL BEFORE we start waiting. Once the new
    // tab takes focus, "the active tab" is the new tab, which is useless.
    const destination = pickDestination(tab, peers);

    // A tab often starts life as about:blank and gets its real URL a moment
    // later, so we may have to wait for it.
    const url = await resolveUrl(tab);

    if (!(await closeTab(tab.id))) {
      // Blank "+" tab on Android. Wait for it to go somewhere, then close it.
      deferClose(tab.id);
      return;
    }

    if (settings.linkMode !== "never" && url && destination) {
      await browser.tabs.update(destination.id, { url, active: true });
    }
  } catch (err) {
    // Tab vanished mid-flight, or the URL was privileged. Nothing to do.
    console.warn("Tab Ceiling:", err);
  }
});

browser.tabs.onRemoved.addListener((tabId) => {
  handled.delete(tabId);
  const stop = pending.get(tabId);
  if (stop) stop();
  recordActivity(-1);
});

/**
 * Close a tab, reporting whether it actually went. Returns false rather than
 * throwing when the browser refuses, which Fenix does for a blank "+" tab.
 */
async function closeTab(tabId) {
  try {
    await browser.tabs.remove(tabId);
    lastCloseAt = Date.now();
    closures.push(lastCloseAt);
    return true;
  } catch (err) {
    console.warn("Tab Ceiling: could not close tab", tabId, String(err));
    return false;
  }
}

/**
 * Watch a tab we could not close and close it as soon as it navigates
 * somewhere real. Idempotent, self-cleaning, and bounded by PENDING_MAX_MS so
 * a blank tab left open all day doesn't keep a listener alive forever.
 */
function deferClose(tabId) {
  if (pending.has(tabId)) return;

  const stop = () => {
    browser.tabs.onUpdated.removeListener(onUpdated);
    clearTimeout(timer);
    pending.delete(tabId);
  };

  const onUpdated = async (id, changeInfo) => {
    if (id !== tabId || !isRealUrl(changeInfo.url)) return;
    stop();
    if (breakerTripped || !breakerAllows()) return;
    await closeTab(tabId);
  };

  const timer = setTimeout(stop, PENDING_MAX_MS);
  pending.set(tabId, stop);
  browser.tabs.onUpdated.addListener(onUpdated);
}

/**
 * Append to the rolling activity log the popup reads. Display only — the close
 * figure undercounts, because closing an unloaded tab fires no event we can
 * see. Nothing enforces against these numbers.
 */
async function recordActivity(delta) {
  try {
    const events = await loadActivity();
    events.push({ t: Date.now(), d: delta });
    await browser.storage.local.set({ [ACTIVITY_KEY]: events.slice(-500) });
  } catch (err) {
    // A missing statistic is not worth failing a tab decision over.
  }
}

/**
 * A tab the browser is restoring rather than one you just opened: it arrives
 * already knowing its final URL, with nothing that opened it.
 *
 * This never fires on Android, where every creation reports about:blank — the
 * dimension check in the listener covers that platform. It still earns its
 * place on desktop, where session restore can surface tabs this way.
 *
 * Deliberately fails open: a bookmark or an external app opening a URL looks
 * the same, and letting an extra tab through beats closing one you wanted.
 */
function looksRestored(tab) {
  return tab.openerTabId == null && isRealUrl(tab.url);
}

/**
 * False once we've closed too many tabs too quickly. Trips for the life of the
 * background page; restarting Firefox clears it. The popup surfaces the trip
 * via breakerTrippedAt so enforcement never stops silently.
 */
function breakerAllows() {
  const now = Date.now();
  closures = closures.filter((t) => now - t < BREAKER_WINDOW_MS);

  if (closures.length < BREAKER_MAX_CLOSURES) return true;

  breakerTripped = true;
  console.warn(
    "Tab Ceiling: closed %d tabs in %dms — stopping to avoid a runaway loop.",
    closures.length,
    BREAKER_WINDOW_MS
  );
  browser.storage.local.set({ breakerTrippedAt: now }).catch(() => {});
  return false;
}

/**
 * The tab that should receive the collapsed URL: whichever tab spawned the new
 * one, falling back to whatever was active a moment ago. Takes the already
 * fetched peer list so we don't query twice.
 */
function pickDestination(newTab, peers) {
  if (newTab.openerTabId != null) {
    const opener = peers.find((t) => t.id === newTab.openerTabId);
    if (opener) return opener;
  }
  return peers.find((t) => t.active && t.id !== newTab.id) || null;
}

/**
 * All tabs sharing this tab's browsing context (normal vs private).
 * Deliberately avoids windowId — Firefox for Android has no window concept.
 */
async function queryPeers(tab) {
  const all = await browser.tabs.query({});
  return all.filter((t) => t.incognito === tab.incognito);
}

/**
 * Resolve a new tab's real URL, waiting briefly if it isn't known yet.
 * Returns null for blank tabs (e.g. you tapped the "+" button).
 */
function resolveUrl(tab) {
  if (isRealUrl(tab.url)) return Promise.resolve(tab.url);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      browser.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve(value);
    };

    const onUpdated = (tabId, changeInfo) => {
      if (tabId === tab.id && isRealUrl(changeInfo.url)) finish(changeInfo.url);
    };

    browser.tabs.onUpdated.addListener(onUpdated);
    const timer = setTimeout(() => finish(null), URL_WAIT_MS);
  });
}

function isRealUrl(url) {
  return typeof url === "string" && /^https?:/i.test(url);
}
