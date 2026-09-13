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
2. Optionally, Tab Ceiling forces new links to open in the tab that opened them.
  - Option 1: do not do this (safe default)
  - Option 2: when the tab would be locked (due to the ceiling or manual toggle)
  - Option 3: always do this

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

On Android, new tabs are detected via a classifier based on the web page dimensions: 
FF Android loads new user-generated tabs a size of 0x0 pixels, but it loads tabs from memory at their display size.
So we use the classifier to identify new tabs and force them closed if they are not loading from memory.
With one exception: about:blank (the default new tab after you click "+") doesn't respond to a force-close event.
So we wait until it has loaded a page, then force-close that page.

We also save the tab IDs locally so that we can display how many tabs have opened/closed over the last hour and ignore those that have been loaded from memory.


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


## Developers: Testing on your phone

Requires [Node.js](https://nodejs.org) and a USB cable.

```bash

# `sudo apt-get install npm`

npm install --global web-ext

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
- Closing new tabs started from "+" can be hit-or-miss on Android. For unclear reasons, it seems to work about half the time. (`about:blank` cannot be closed.)
- `window.open()` calls from page scripts aren't intercepted by the content
  script, so those tabs briefly appear before the background script closes
  them.
- The extension is easy to uninstall. The point is to help you be organized, not overcome addictions.
- Firefox for iOS doesn't support extensions at all. Thus iOS is not supported.
