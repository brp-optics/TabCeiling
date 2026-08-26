const el = {
  count: document.getElementById("count"),
  used: document.getElementById("used"),
  limitReadout: document.getElementById("limitReadout"),
  limitValue: document.getElementById("limitValue"),
  pips: document.getElementById("pips"),
  status: document.getElementById("status"),
  minus: document.getElementById("minus"),
  plus: document.getElementById("plus"),
  redirect: document.getElementById("redirect")
};

let settings = { ...DEFAULTS };
let openTabs = 0;

init();

async function init() {
  settings = await loadSettings();
  el.redirect.checked = settings.redirect;

  const tabs = await browser.tabs.query({ currentWindow: true });
  openTabs = tabs.length;

  render();

  el.minus.addEventListener("click", () => nudgeLimit(-1));
  el.plus.addEventListener("click", () => nudgeLimit(+1));
  el.redirect.addEventListener("change", () => {
    settings.redirect = el.redirect.checked;
    saveSettings({ redirect: settings.redirect });
  });
}

function nudgeLimit(delta) {
  const next = clamp(settings.tabLimit + delta, LIMIT_MIN, LIMIT_MAX);
  if (next === settings.tabLimit) return;
  settings.tabLimit = next;
  saveSettings({ tabLimit: next });
  render();
}

function render() {
  const limit = settings.tabLimit;
  const over = openTabs - limit;

  el.used.textContent = openTabs;
  el.limitReadout.textContent = limit;
  el.limitValue.textContent = limit;

  el.minus.disabled = limit <= LIMIT_MIN;
  el.plus.disabled = limit >= LIMIT_MAX;

  el.count.classList.toggle("is-over", over > 0);
  el.status.classList.toggle("is-over", over >= 0);

  renderPips(limit, over);

  if (over > 0) {
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
