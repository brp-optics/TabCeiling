const el = {
  count: document.getElementById("count"),
  used: document.getElementById("used"),
  limitReadout: document.getElementById("limitReadout"),
  limitValue: document.getElementById("limitValue"),
  pips: document.getElementById("pips"),
  status: document.getElementById("status"),
  minus: document.getElementById("minus"),
  plus: document.getElementById("plus"),
  seg: document.getElementById("seg"),
  alert: document.getElementById("alert"),
  gauge: document.getElementById("gauge"),
  ceilingRow: document.getElementById("ceilingRow"),
  ceilingToggleRow: document.getElementById("ceilingToggleRow"),
  ceilingOn: document.getElementById("ceilingOn"),
  blockRow: document.getElementById("blockRow"),
  blockNew: document.getElementById("blockNew"),
  activity: document.getElementById("activity"),
  modeHint: document.getElementById("modeHint")
};

const MODE_HINTS = {
  never:
    "A blocked link is dropped. The page you're reading is never taken away.",
  ceiling:
    "Once you're at the ceiling, a blocked link loads in the tab you tapped it from.",
  always:
    "Links that want a new tab always load in the tab you tapped them from, at any count."
};

let settings = { ...DEFAULTS };
let openTabs = 0;
let isAndroid = false;

init();

async function init() {
  // Platform layout must not depend on anything that can fail. On Android
  // tabs.query is unreliable — it has been observed returning nothing — and if
  // it throws, the catch below skips render() entirely, leaving the popup in
  // its default HTML state: desktop ceiling visible, Android toggle hidden.
  try {
    const platform = await browser.runtime.getPlatformInfo();
    isAndroid = platform.os === "android";
  } catch (err) {
    console.error("Tab Ceiling: platform detection failed", err);
  }

  try {
    settings = await loadSettings();
    renderPlatform();

    // Match the background script: no windowId, filter by browsing context.
    const [current] = await browser.tabs.query({ active: true });
    const all = await browser.tabs.query({});
    const incognito = current ? current.incognito : false;
    openTabs = all.filter((t) => t.incognito === incognito).length;

    await renderBreaker();
    render();
    await renderActivity();
  } catch (err) {
    el.status.textContent = "Couldn't read tabs: " + err.message;
    console.error("Tab Ceiling popup:", err);
    renderPlatform();
    renderModes();
  }

  el.minus.addEventListener("click", () => nudgeLimit(-1));
  el.plus.addEventListener("click", () => nudgeLimit(+1));

  el.ceilingOn.addEventListener("change", () => {
    settings.ceilingOn = el.ceilingOn.checked;
    saveSettings({ ceilingOn: settings.ceilingOn });
    render();
  });

  el.limitValue.addEventListener("change", () => {
    const next = clampLimit(parseInt(el.limitValue.value, 10));
    if (!Number.isInteger(next)) return;
    settings.tabLimit = next;
    saveSettings({ tabLimit: next });
    render();
  });

  el.blockNew.addEventListener("change", () => {
    settings.blockNew = el.blockNew.checked;
    saveSettings({ blockNew: settings.blockNew });
  });

  el.seg.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    settings.linkMode = button.dataset.mode;
    saveSettings({ linkMode: settings.linkMode });
    render();
  });
}

/**
 * The background script sets breakerTrippedAt when it has closed too many tabs
 * too quickly and stopped enforcing. It clears the flag on startup, so if it's
 * present the trip happened in this browser session and enforcement is off
 * right now.
 */
async function renderBreaker() {
  const { breakerTrippedAt } = await browser.storage.local.get("breakerTrippedAt");
  if (!breakerTrippedAt) return;

  const mins = Math.max(1, Math.round((Date.now() - breakerTrippedAt) / 60000));
  el.alert.textContent =
    `Stopped enforcing about ${mins} minute${mins === 1 ? "" : "s"} ago, ` +
    `after closing several tabs in quick succession. This is a safety catch ` +
    `against a runaway loop. Restart Firefox to resume.`;
  el.alert.classList.add("show");
}

/**
 * Android has no usable tab total, so it gets a binary block instead of the
 * counted ceiling, and the gauge would only ever show a wrong number.
 */
function renderPlatform() {
  const on = ceilingEnabled(settings);

  el.gauge.hidden = isAndroid || !on;
  el.ceilingToggleRow.hidden = isAndroid;
  el.ceilingRow.hidden = isAndroid || !on;
  el.blockRow.hidden = !isAndroid;

  el.ceilingOn.checked = on;
  el.blockNew.checked = settings.blockNew;
}

/**
 * A readout, not a measurement. Opens are counted accurately; closes are not,
 * because closing an unloaded tab fires no event, so the two are shown
 * separately rather than netted into a single misleading number.
 */
async function renderActivity() {
  const events = await loadActivity().catch(() => []);
  if (!events.length) {
    el.activity.textContent = "No tab activity in the last hour.";
    return;
  }

  const opened = events.filter((e) => e.d > 0).length;
  const closed = events.filter((e) => e.d < 0).length;

  const parts = [`${opened} opened`];
  if (closed) parts.push(`${closed} closed`);
  el.activity.textContent = `Last hour: ${parts.join(", ")}.`;
}

function stepFor(value) {
  if (value < 20) return 1;
  if (value < 100) return 5;
  if (value < 500) return 25;
  return 100;
}

function nudgeLimit(direction) {
  const current = settings.tabLimit;
  // Step down by the size appropriate to where we land, not where we started,
  // so stepping up then down returns to the same number.
  const step = direction > 0 ? stepFor(current) : stepFor(current - 1);
  const next = clampLimit(current + direction * step);
  if (next === settings.tabLimit) return;
  settings.tabLimit = next;
  saveSettings({ tabLimit: next });
  render();
}

function render() {
  const limit = settings.tabLimit;
  const on = ceilingEnabled(settings);
  const over = openTabs - limit;

  el.used.textContent = openTabs;
  el.limitReadout.textContent = limit;
  el.limitValue.value = limit;

  el.minus.disabled = limit <= LIMIT_MIN;
  el.plus.disabled = limit >= LIMIT_MAX;

  el.count.classList.toggle("is-off", !on);
  el.count.classList.toggle("is-over", on && over > 0);
  el.status.classList.toggle("is-over", on && over >= 0);

  renderPips(on && limit <= PIP_MAX ? limit : 0, over);
  renderStatus(on, limit, over);
  renderModes();
  renderPlatform();
}

function renderStatus(on, limit, over) {
  if (!on) {
    el.status.textContent = "";
  } else if (over > 0) {
    el.status.textContent =
      `${over} over — new tabs get closed until you're under ${limit}.`;
  } else if (over === 0) {
    el.status.textContent = "At the ceiling — the next new tab gets closed.";
  } else {
    const left = -over;
    el.status.textContent = `${left} tab${left === 1 ? "" : "s"} left.`;
  }
}

// One pip per allowed tab. Filled pips are tabs you've spent. If you're over
// the ceiling, every pip turns red — the count above carries the overflow.
// Passing 0 (ceiling off) renders nothing, which is the point.
function renderPips(limit, over) {
  el.pips.textContent = "";
  const filled = Math.min(openTabs, limit);

  for (let i = 0; i < limit; i++) {
    const pip = document.createElement("span");
    pip.className = "pip";
    if (i < filled) pip.classList.add(over > 0 ? "over" : "filled");
    el.pips.appendChild(pip);
  }
}

function renderModes() {
  for (const button of el.seg.querySelectorAll("button[data-mode]")) {
    const selected = button.dataset.mode === settings.linkMode;
    button.setAttribute("aria-checked", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  el.modeHint.textContent = MODE_HINTS[settings.linkMode] || "";
}
