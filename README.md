# Tab Ceiling

A minimal Firefox (Desktop and Android) extension that caps your opening of new tabs (when you are over a limit) and optionally
keeps links from spawning new tabs, too.

## Motivation

Do you ever open a new Firefox session only to end up with hundreds of tabs a few hours later?
Tab Ceiling limits your ability to open new tabs, 
helping you to keep your tab population under a reasonable limit (1 to 9999, default 6).

## What it does

Tab Ceiling has two modes: 
1. Tab Ceiling blocks the creation of new tabs:
  - on Desktop:  past a configurable ceiling.
  - on Android:  with a manual toggle
  - The ceiling can be bypassed when necessary with an "Allow one new tab" button, for those sites which require them. 
2. Optionally, Tab Ceiling loads links in the tab that opened them instead of a new tab.
  - Option 1 ("Never"): do not do this (safe default). Results in blocked links being dropped,
    but navigation stays on current page.
  - Option 2 ("At ceiling" / "When blocked"): a *blocked* link loads in the tab that originated it.
  - Option 3 ("Always"): links never open in new tabs.

## Tab and data safety

Tab Ceiling takes care to not block tabs on session restore and on load from background (Android).
It even has a "circuit breaker" which stops tab blocking if it is happening too quickly, 
to avoid the potential for a bug causing runaway tab closures. 
All settings that could cause data loss (page redirection, tab blocking) are opt-in, and disabled by 
default when the extension is first installed. 

The failure of existing extensions to provide safety was one of the core motivations for this project.

## Fully offline, privacy preserving

Although we need the "all tabs" permission from Firefox to count and block tabs, 
Tab Ceiling collects and exports no data, and has no ads. 
It is fully on your device, and fully offline.

## How it works

Two mechanisms:

1. **Background script**: the ceiling. If a tab is created (by the "+"
   button, by `window.open()` from page JS, or by "Open in new tab" from a long-press
   menu) and you're already at the ceiling, it closes the new tab and (optionally) loads its URL in
   the tab you came from.
2. **Content script**: Optionally, clicks on `<a target="_blank">` links navigate the
   current tab instead of opening a new one. No tab is created. 
   This behavior can be disabled, enabled at ceiling, or always enabled.

Private browsing windows get their own separate tab budget.

## Usage
1. Install the add-on from https://addons.mozilla.org/en-US/firefox/addon/tab-ceiling/
2. Toggle "Block new tabs" or "Block new tabs at ceiling" in settings to enable it.

## Settings and configuration options

Open the Firefox **⋮** menu → **Extensions** → **Tab Ceiling** to reach the
   settings. On Android a browser action lives in that menu and the menu is only visible from a tab that has content; there is no
   toolbar icon.

### On Desktop

The popup shows how much
of your budget is spent and lets you change three things:

- **"Block new tabs at ceiling"**: enable the headline feature of blocking new tabs (past the ceiling)
- **Tab ceiling**: tabs allowed before new tab opening is blocked, 1 to 9999. Default 6.
- **Load links in the current tab**: When a new tab
  is blocked, load its URL in the tab that the link came from instead of discarding it.
  Off by default to avoid interrupting the page you are reading.
  Can be configured to take effect at the tab ceiling or to always be in effect.


### On Android

The settings let you change two things:

- **"Block new tabs"**: enable the headline feature of blocking new tabs (past the ceiling)
- **Load links in the current tab**: When a new tab
  is blocked, load its URL in the tab that the link came from instead of discarding it.
  Off by default to avoid interrupting the page you are reading.
  Can be configured to take effect at the tab ceiling (doesn't work on Android) or to always be in effect.

## Technical details

Installing the extension does nothing to tabs you already have open — it only
reacts to tabs created from that point on. For the same reason, there is a
20-second `STARTUP_GRACE_MS` window after browser start during which new tabs are not force-closed,
so session restore can't be mistaken for you opening
tabs. You can verify this yourself before trusting it with a large session: open a few
tabs over the limit, force-quit Firefox, reopen, and confirm they all come
back.

On Android, there is no mechanism for extensions to see how many tabs are open. Tabs restored from memory appear nearly the same as newly opened tabs. In order to tell a restored tab from a new tab, Tab Ceiling takes advantage of the fact that restored tabs arrive with the page size already set to the screen's dimensions, whereas new tabs are first created with size 0x0 and then are updated when content arrives. Some restore tabs also start with size 0x0, but they are populated quickly. We attempt to filter them out by checking for size 150 ms after opening. 

On Android, the "+" button creates a tab, but Firefox will not allow it to close until it shows a page.
In order to block the "+" button, Tab Ceiling waits and closes it the moment it navigates to a page.

On Android, there are two more safety nets: (1) tab creations within 500 ms of a tab the extension closed are ignored (CLOSE_QUIET_MS), since that's the browser backfilling the screen with a tab from memory. (2) If three tabs are closed within ten seconds, a safety switch triggers, and blocking ceases until Firefox restarts or the extension is uninstalled and reinstalled. If it triggers safety switch is shown in the settings panel.

We also save the tab IDs locally so that we can display how many tabs have opened/closed over the last hour and eventually build up a database of those that have been loaded from memory.

Classifier signals considered but not used:
- `sessions.setTabValue`/`getTabValue` would tag tabs, but the `sessions` API doesn't exist on Android.
- `webNavigation.onCommitted` reveals a `reload` transition for each restore. The `forward_back` transition qualifier seems to appear on restores and not on user-opened tabs, so it is a possible second signal,
but it would require the WebNavigation permission, which looks scary at the install prompt.
- `tabs.discard` is not implemented on Android.

Configuration changes are saved immediately to `storage.local` and take effect without a restart.
`STARTUP_GRACE_MS` and `URL_WAIT_MS` are constants only exposed in `background.js`.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Permissions, popup registration, script wiring |
| `settings.js` | Shared defaults, loaded by both background and popup |
| `background.js` | Enforces the ceiling on `tabs.onCreated` |
| `content.js` | Rewrites `target="_blank"` clicks to same-tab navigation |
| `popup.html` / `popup.js` | The settings panel |
| `icon.svg` | Extension icon |
| `build.sh` | Zips the extension into `build/<version>.zip` for upload |
| `LICENSE` | AGPLv3 License terms |
| `check.sh` | Pre-build check: makes sure every called name and call site exists.
| `make-icon.py` | Generates `icon.svg`.

## Developers: Testing on your phone

Requires [Node.js](https://nodejs.org) and a USB cable.

```bash

<<<<<<< HEAD
# `sudo apt-get install npm`
=======
sudo apt-get install npm
>>>>>>> 7e2dab7 (v1.6.3: update docs)

# On the phone, two separate steps:
#   Android: Settings > About phone > tap Build number 7 times,
#            then Developer options > USB debugging.
#   Firefox: Settings > scroll to Advanced > Remote debugging via USB.
#            (This is a plain visible toggle. The five-taps-on-the-logo trick
#            unlocks the Custom Add-on Collection menu, not this.)
#

adb devices          # confirm the phone shows up, note device-id
npx web-ext run --target=firefox-android --android-device=<device-id>
```

Run this script from the extension's source directory on the computer while the phone is connected via adb.
`web-ext run` side-loads the extension without signing, and reloads on file
changes.

## Developers: Installing a dev build permanently

Release builds of Firefox for Android only install signed extensions. You have
two options:

**Sign it as unlisted (recommended).** Create an account on
[addons.mozilla.org](https://addons.mozilla.org), then:

```bash
web-ext sign --api-key=<key> --api-secret=<secret> --channel=unlisted
```

Keys come from the AMO Developer Hub under API Credentials. Unlisted means it
isn't published publicly or searchable — it's just signed for your own use. You
get back an `.xpi` file. Transfer it to the phone and open it in Firefox.

**Or use Firefox Nightly**, which can side-load unsigned extensions after you
enable the setting in `about:config`. No AMO account needed, but you're running
Nightly as your daily browser.

## Known limitations

- The total number of open tabs is not available on Android.
  Instead of providing a ceiling, we just have tab blocking controlled by a manual toggle.
- On Android the about:blank page cannot be closed. We close as soon as it navigates to a page.
- On Android a link that opens in a new foreground tab may load too quickly and bypass the block. Acceptable sacrifices to avoid losing user data.
- On Android tabs restored from Recently Closed look like new tabs and are blocked. Turn off the blocking or load up on grace tabs before restoring from Recently Closed.
- `window.open()` calls from page scripts aren't intercepted by the content
  script, so some tabs briefly appear before the background script closes
  them.
- The extension is easy to uninstall. The point is to help you be organized, not overcome addictions.
- Firefox for iOS doesn't support extensions at all. Thus iOS is not supported.
