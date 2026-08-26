# Tab Ceiling

A minimal Firefox for Android extension that caps your open tabs at six and
keeps links from spawning new ones.

## How it works

Two mechanisms:

1. **Content script** — clicks on `<a target="_blank">` links navigate the
   current tab instead of opening a new one. No tab is created, no flicker.
2. **Background script** — a safety net. If a tab is created anyway (the "+"
   button, `window.open()` from page JS, "Open in new tab" from a long-press
   menu) and you're already at six, it closes the new tab and loads its URL in
   the tab you came from.

Private browsing windows get their own separate budget of six.

Installing the extension does nothing to tabs you already have open — it only
reacts to tabs created from that point on. For the same reason, there is a
20-second `STARTUP_GRACE_MS` window after browser start during which tab
creation is ignored, so session restore can't be mistaken for you opening
tabs. Verify this yourself before trusting it with a large session: open a few
tabs over the limit, force-quit Firefox, reopen, and confirm they all come
back.

## Configuration

Open the Firefox menu → **Add-ons** → **Tab Ceiling**. The popup shows how much
of your budget is spent and lets you change two things:

- **Tab ceiling** — tabs allowed, 1 to 30. Default 6.
- **Open blocked links here** — on, a blocked link replaces your current page;
  off, the tap does nothing. Off is harsher.

Both save immediately to `storage.local` and take effect without a restart.
`STARTUP_GRACE_MS` and `URL_WAIT_MS` remain constants in `background.js` —
they're tuning, not preferences.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Permissions, popup registration, script wiring |
| `settings.js` | Shared defaults, loaded by both background and popup |
| `background.js` | Enforces the ceiling on `tabs.onCreated` |
| `content.js` | Rewrites `target="_blank"` clicks to same-tab navigation |
| `popup.html` / `popup.js` | The toolbar settings panel |
| `icon.svg` | Toolbar icon |

## Before you build

Open `manifest.json` and change the extension ID from
`tab-ceiling@yourname.example` to something unique to you. It's an identifier,
not a real email address, but it must be unique on AMO.

## Testing on your phone

Requires [Node.js](https://nodejs.org) and a USB cable.

```bash
npm install --global web-ext

# On the phone: Settings > About Firefox > tap the logo 5 times to unlock
# the debug menu, then enable Remote debugging via USB.
# On the computer: enable Developer options + USB debugging in Android settings.

adb devices          # confirm the phone shows up
web-ext run --target=firefox-android --android-device=<device-id>
```

`web-ext run` side-loads the extension without signing, and reloads on file
changes. This is the fast iteration loop.

## Installing it permanently

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
- The extension can be disabled from Firefox's add-ons menu in a few taps. It's
  friction, not a lock.
- Firefox for iOS doesn't support extensions at all.
