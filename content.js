// Intercept clicks on links that would open a new tab, and navigate in place
// instead. This is the graceful half of the extension: no tab is ever created,
// so there's no flash of a tab appearing and vanishing.
//
// Runs in the capture phase so we see the click before the page's own handlers.

document.addEventListener("click", (event) => {
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
