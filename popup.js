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

init();

async function init() {
  try {
    settings = await loadSettings();

    // Match the background script: no windowId, filter by browsing context.
    const [current] = await browser.tabs.query({ active: true });
    const all = await browser.tabs.query({});
    const incognito = current ? current.incognito : false;
    openTabs = all.filter((t) => t.incognito === incognito).length;

    render();
  } catch (err) {
    el.status.textContent = "Couldn't read tabs: " + err.message;
    console.error("Tab Ceiling popup:", err);
  }

  el.minus.addEventListener("click", () => nudgeLimit(-1));
  el.plus.addEventListener("click", () => nudgeLimit(+1));

  el.seg.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    settings.linkMode = button.dataset.mode;
    saveSettings({ linkMode: settings.linkMode });
    render();
  });
}

function nudgeLimit(delta) {
  const next = clampLimit(settings.tabLimit + delta);
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
  el.limitValue.textContent = on ? limit : "Off";

  el.minus.disabled = limit <= LIMIT_MIN;
  el.plus.disabled = limit >= LIMIT_OFF;

  el.count.classList.toggle("is-off", !on);
  el.count.classList.toggle("is-over", on && over > 0);
  el.status.classList.toggle("is-over", on && over >= 0);

  renderPips(on ? limit : 0, over);
  renderStatus(on, limit, over);
  renderModes();
}

function renderStatus(on, limit, over) {
  if (!on) {
    el.status.textContent = "Ceiling off — new tabs open freely.";
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
