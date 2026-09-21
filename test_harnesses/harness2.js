// Paste into the extension's background-page console on about:debugging.
// Captures the signals we have never measured for a restore: the onUpdated
// sequence, onActivated ordering, and what the tab list looked like just
// before the event.
//
// TURN THE BLOCK TOGGLE OFF FIRST. This is for observing, not for watching it
// eat tabs.

window.TC = [];
const t0 = Date.now();
const rec = (label, data) => TC.push({ ms: Date.now() - t0, label, data });

const slim = (t) => ({
  id: t.id, url: t.url, title: t.title, index: t.index, active: t.active,
  opener: t.openerTabId, discarded: t.discarded, status: t.status,
  size: `${t.width}x${t.height}`, lastAccessed: t.lastAccessed,
  successor: t.successorTabId, attention: t.attention, hidden: t.hidden
});

browser.tabs.onCreated.addListener((tab) => {
  rec("created", slim(tab));
  browser.tabs.query({}).then(
    (all) => rec("tablist@created", all.map((t) => `${t.id}${t.active ? "*" : ""}`)),
    (e) => rec("tablist-error", String(e))
  );
  // Does anything fill in over the next second and a half?
  for (const d of [50, 200, 1500]) {
    setTimeout(() => browser.tabs.get(tab.id).then(
      (t) => rec(`get+${d}`, slim(t)),
      (e) => rec(`gone+${d}`, String(e))
    ), d);
  }
});

browser.tabs.onUpdated.addListener((id, ch, tab) => {
  rec("updated", { id, ch, size: `${tab.width}x${tab.height}`, active: tab.active });
});

// Never captured before. A restore is triggered by activation; a link-opened
// tab usually is not. The ordering relative to onCreated may be the tell.
browser.tabs.onActivated.addListener((info) => rec("activated", info));
browser.tabs.onRemoved.addListener((id, info) => rec("removed", { id, info }));

window.TCdump = () => JSON.stringify(TC, null, 1);
window.TCreset = () => { TC.length = 0; };
console.log("armed — TCreset() between actions, copy(TCdump()) after each");
