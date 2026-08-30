// Intercept clicks on links that would open a new tab, and navigate in place
// instead. Only active in "always" mode — in the other two modes a link is
// allowed to open its tab, and the background script decides what happens to
// it. This is the graceful path: no tab is created, so no flash.
//
// Runs in the capture phase so we see the click before the page's own handlers.

let active = false;

browser.storage.local
  .get(null)
  .then((stored) => { active = resolveMode(stored) === "always"; })
  .catch(() => { /* leave inactive; the background script still enforces */ });

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.linkMode) active = changes.linkMode.newValue === "always";
});

// settings.js isn't injected here, so read the stored shape directly. Mirrors
// loadSettings()'s migration fallback for anyone still on the v1.x boolean.
function resolveMode(stored) {
  if (["never", "ceiling", "always"].includes(stored.linkMode)) {
    return stored.linkMode;
  }
  if (typeof stored.redirect === "boolean") {
    return stored.redirect ? "ceiling" : "never";
  }
  return "never";
}

document.addEventListener("click", (event) => {
  if (!active) return;
  if (event.defaultPrevented) return;

  // Left click only, no modifier keys. (Irrelevant on a phone, but it keeps
  // ctrl-click and middle-click working when you test on desktop.)
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const start = event.target instanceof Element ? event.target : null;
  if (!start) return;

  const link = start.closest("a[href]");
  if (!link) return;

  // Only links that explicitly ask for a new tab/window.
  const target = (link.target || "").toLowerCase();
  if (target !== "_blank" && target !== "_new") return;

  const href = link.href;
  if (!/^https?:/i.test(href)) return;

  event.preventDefault();
  event.stopPropagation();
  window.location.href = href;
}, true);
