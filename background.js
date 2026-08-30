// Live settings, edited from the toolbar popup. Starts at the defaults so the
// listener below is never reading undefined during the async load.
let settings = { ...DEFAULTS };

loadSettings().then((loaded) => { settings = loaded; });

// Apply popup edits without needing a browser restart.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const [key, change] of Object.entries(changes)) {
    settings[key] = change.newValue;
  }
});

// How long to wait for a brand-new tab to report its URL before giving up.
const URL_WAIT_MS = 800;

// Ignore tab creation for this long after the browser starts. Session restore
// recreates your old tabs, and depending on Firefox version those may fire
// tabs.onCreated — which would wipe your session. This is the safety catch.
const STARTUP_GRACE_MS = 20000;

// ---------------------------------------------------------------------------

// Tab IDs we've already acted on, so a race can't make us handle one twice.
const handled = new Set();

// Set once when the background page loads. Because the page is persistent
// (see manifest.json), this really is browser-start time and not an
// event-page wakeup, which would reset the clock at random moments.
const loadedAt = Date.now();

browser.tabs.onCreated.addListener(async (tab) => {
  try {
    // Don't touch anything while the session is still restoring.
    if (Date.now() - loadedAt < STARTUP_GRACE_MS) return;

    // Firefox for Android has no window concept, so windowId-based queries
    // are unreliable there. Match on incognito instead — that still keeps
    // private browsing on its own separate budget.
    const siblings = await queryPeers(tab);
    if (siblings.length <= settings.tabLimit) return;

    if (handled.has(tab.id)) return;
    handled.add(tab.id);

    // Work out where to send the URL BEFORE we start waiting. Once the new
    // tab takes focus, "the active tab" is the new tab, which is useless.
    const destination = await pickDestinationTab(tab);

    // A tab often starts life as about:blank and gets its real URL a moment
    // later, so we may have to wait for it.
    const url = await resolveUrl(tab);

    await browser.tabs.remove(tab.id);

    if (settings.redirect && url && destination) {
      await browser.tabs.update(destination.id, { url, active: true });
    }
  } catch (err) {
    // Tab vanished mid-flight, or the URL was privileged. Nothing to do.
    console.warn("Tab Ceiling:", err);
  }
});

// Keep the Set from growing forever.
browser.tabs.onRemoved.addListener((tabId) => handled.delete(tabId));

/**
 * The tab that should receive the redirected URL: whichever tab spawned the
 * new one, falling back to whatever was active a moment ago.
 */
async function pickDestinationTab(newTab) {
  if (newTab.openerTabId != null) {
    try {
      return await browser.tabs.get(newTab.openerTabId);
    } catch (e) {
      // Opener already closed; fall through.
    }
  }
  const peers = await queryPeers(newTab);
  const active = peers.find((t) => t.active && t.id !== newTab.id);
  return active || null;
}

/**
 * All tabs sharing this tab's browsing context (normal vs private).
 * Deliberately avoids windowId — see the note in the listener above.
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
