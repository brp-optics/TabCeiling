# Tab Ceiling

A minimal Firefox for Android extension that caps your open tabs at six (configurable) and
keeps links from spawning new ones.

## How it works

Two mechanisms:

1. **Content script** — clicks on `<a target="_blank">` links navigate the
   current tab instead of opening a new one. No tab is created, no flicker.
2. **Background script** — the ceiling. If a tab is created anyway (the "+"
   button, `window.open()` from page JS, "Open in new tab" from a long-press
   menu) and you're already at six, it closes the new tab and loads its URL in
   the tab you came from.

Private browsing windows get their own separate budget.

## Usage
1. Install the add-on from https://addons.mozilla.org/en-US/firefox/addon/tab-ceiling/

## Configuration

Open the Firefox **⋮** menu → **Extensions** → **Tab Ceiling** to reach the
   settings. On Android a browser action lives in that menu; there is no
   toolbar icon.

The popup shows how much
of your budget is spent and lets you change two things:

- **Tab ceiling**: tabs allowed, 1 to 30. Default 6.
- **Open blocked links in the origin tab**: when you are at the ceiling and a new tab
  is blocked, load its URL in the tab that the link came from instead of discarding it.
  Off by default to avoid interrupting the page you are reading.

## Technical details

Installing the extension does nothing to tabs you already have open — it only
reacts to tabs created from that point on. For the same reason, there is a
20-second `STARTUP_GRACE_MS` window after browser start during which tab
creation is ignored, so session restore can't be mistaken for you opening
tabs. You can verify this yourself before trusting it with a large session: open a few
tabs over the limit, force-quit Firefox, reopen, and confirm they all come
back.

Configuration changes are saved immediately to `storage.local` and take effect without a restart.
`STARTUP_GRACE_MS` and `URL_WAIT_MS` are constants only exposed in `background.js`.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Permissions, popup registration, script wiring |
| `settings.js` | Shared defaults, loaded by both background and popup |
| `background.js` | Enforces the ceiling on `tabs.onCreated` |
| `content.js` | Rewrites `target="_blank"` clicks to same-tab navigation |
| `popup.html` / `popup.js` | The toolbar settings panel |
| `icon.svg` | Extension icon |
| `build.sh` | Zips the extension into `build/<version>.zip` for upload |
| `LICENSE` | AGPLv3 License terms |


## Developers: Testing on your phone

Requires [Node.js](https://nodejs.org) and a USB cable.

```bash
npm install --global web-ext

# On the phone, two separate steps:
#   Android: Settings > About phone > tap Build number 7 times,
#            then Developer options > USB debugging.
#   Firefox: Settings > scroll to Advanced > Remote debugging via USB.
#            (This is a plain visible toggle. The five-taps-on-the-logo trick
#            unlocks the Custom Add-on Collection menu, not this.)
#

adb devices          # confirm the phone shows up
web-ext run --target=firefox-android --android-device=<device-id>
```

Run this script on the computer while the phone is connected via adb.
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

- `window.open()` calls from page scripts aren't intercepted by the content
  script, so those tabs briefly appear before the background script closes
  them.
- The content script rewrites `target="_blank"` links at every tab count, not
  just at the ceiling, and is not governed by the "Open blocked links" setting.
  So such links load in your current tab even when you are well under the
  limit. Tracked for a future release.
- The current interface limits tabs to 0 to 30. Would be good to raise limit.
- Currently can only be disabled by uninstalling. Would be good to make entire extension toggleable in case of urgent work that requires new tabs.
- The extension is easy to uninstall. The point is to help you be organized, not overcome addictions.
- Firefox for iOS doesn't support extensions at all. Thus iOS is not supported.
