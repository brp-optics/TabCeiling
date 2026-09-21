// Tests two non-timing restore signals on Firefox for Android.
//
// SETUP: temporarily add "sessions" and "webNavigation" to "permissions" in
// manifest.json, reload via web-ext, then paste this into the background-page
// console. Turn blocking OFF first.
//
// The harness dies when Firefox restarts. Tags set by it do not (if the
// sessions API works on Android at all) — that is the thing being tested.

window.TC3 = [];
const T0 = Date.now();
const rec3 = (label, data) => TC3.push({ ms: Date.now() - T0, label, data });

console.log("sessions API:", typeof browser.sessions,
            "| webNavigation API:", typeof browser.webNavigation);

// Signal 2: does a restored tab come back carrying a tag set before it unloaded?
browser.tabs.onCreated.addListener(async (tab) => {
  let tag;
  try {
    tag = await browser.sessions.getTabValue(tab.id, "tc-seen");
  } catch (e) {
    tag = "ERROR: " + String(e);
  }
  rec3("created", { id: tab.id, size: `${tab.width}x${tab.height}`, tag: tag ?? null });
  browser.sessions.setTabValue(tab.id, "tc-seen", Date.now()).catch(() => {});
});

// Signal 1: does a restore commit with transitionType "reload"?
browser.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId !== 0) return;                 // top-level documents only
  if (!/^https?:/i.test(d.url)) return;        // skips our own settings panel
  rec3("committed", {
    id: d.tabId, url: d.url.slice(0, 60),
    type: d.transitionType, qualifiers: d.transitionQualifiers
  });
});

// Tag every tab we can currently see, so a later restore has something to find.
window.TC3tagAll = async () => {
  const tabs = await browser.tabs.query({});
  for (const t of tabs) {
    await browser.sessions.setTabValue(t.id, "tc-seen", Date.now()).catch(() => {});
  }
  console.log(`tagged ${tabs.length} tab(s): ${tabs.map((t) => t.id).join(", ")}`);
};

window.TC3dump = () => JSON.stringify(TC3, null, 1);
window.TC3reset = () => { TC3.length = 0; };
console.log("armed — TC3tagAll() to tag, copy(TC3dump()) to export");
