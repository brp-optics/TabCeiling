# Changelog

All notable changes to Tab Ceiling are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.3] - 2026-09-14
### Changed
- Icon updated with wider arrow for higher visibility at low resolutions.

### Future changes
- "Override for one tab" or "Override for 30 seconds" button in settings will greatly increase usability.
  Too easy to toggle off and forget otherwise.

## [1.5.2] - 2026-09-13
### Changed
- Desktop ceiling is now off by default. Click "Block new tabs at ceiling" to enable.
- Desktop tab ceiling threshold is now displayed and can be changed even when ceiling is disabled. 
  We hope that by displaying it we can reduce new user confusion and surprise.
- Renamed UI element in settings for clarity: "At ceiling" became "When blocked" on Android, 
  as Android doesn't have a ceiling setting.
- Icon updated and large-size icons added to manifest.
- UI hints updated.

## [1.5.1] - 2026-09-13
### Fixed
- Android detects when a tab is supposed to close on page load and now force-closes the tab.
  This fixes the problem with the "+" tab (about:blank), which cannot be force-closed.

## [1.5.0] - 2026-09-12
- This version customizes the interfaces for Android and Desktop, 
  because there is no way to read the actual number of tabs on Android.

### Added
- "Limit open tabs" is now a standalone toggle on Desktop, allowing the tab limit to be disabled without changing its value.
- "Block new tabs" is now a standalone toggle on Android. 
- Android provides number of tabs opened and closed in the last hour, in lieu of an absolute tab count.
- Android interface now shows if the circuit breaker has been hit.
- Android adds a classifier for loading tabs based on their dimensions. 

### Changed
- The interface is now platform-dependent: a master toggle and a ceiling setter are shown on Desktop, 
  but a master toggle and count of opened and closed tabs is shown on Android.
- The tab ceiling interface has been removed from Android, in favor of a "block tabs" toggle. 
  A numerical ceiling doesn't make sense where we can't know the absolute number of tabs.
- On Desktop, the tab ceiling is no longer capped at 30, and the interface allows typing in numbers.
- The arrow buttons used to set the tab ceiling now scale their increment with the current tab ceiling setting.
- The row of pips now hides itself above 30 tabs / pips.

### Fixed
- Tab opening detection on Android is now experimentally verified.
  It only counts (and blocks) tabs which are newly opened by the user (as opposed to loaded from an inactive tab).
- Platform detection was previously dependent on successfully reading and counting the open tabs, 
  which would prevent the interface from showing if the counting errored out. Now independent.

### Known issues
- Tab opening detection on Android fails if user uses the "+" button.
- Unchecking "Limit Open Tabs" on Desktop hides the ceiling. Would be better if ceiling were greyed out.

## [1.4.0] - 2026-09-08
This version attempted to implement the features listed in the 1.5.0 changelog. 
However, mismatching files were deployed resulting in a broken extension.

## [1.3.0] - 2026-09-02
- This version attempts to fix a bug in tab closing behavior on Android,
  which resulted in runaway closing of inactive tabs if the number of tabs was above limit and 
  an inactive tab was activated.

### Changed
  We have to take some pains to make sure that when an unloaded or inactive tab is activated,
  it doesn't count as a new tab load and get closed automatically. We implement a cooldown
  period on new tab closures controlled by CLOSE_QUIET_MS (default 500 ms)
  such that a new tab opening less than a 500 ms after the last tab closed
  or a new tab opening with a URL already loaded and no openerTabID is considered a legacy tab and not closed.
  We also implement a circuit breaker, 
   where 3 forced closures in 10 seconds will cause the addon to stop enforcing the tab limit until FF is restarted.
  This should limit the damage if we have a bug which closes tabs that were not actually new.

### Known issues
  FF on Android only provides a count of currently loaded tabs to extensions.
  This means that inactive tabs and tabs that are unloaded (not in RAM) will not appear in the tab count.

## [1.2.0] - 2026-08-31

### Added

- The tab ceiling can now be disabled by stepping the counter limit past 30 tabs.
  In "Always" mode links are still collapsed into the current tab
  regardless of the counter setting.
- "Load links in the current tab" replaces the old on/off setting with three
  modes, defaulting to **Never**:
  - **Never**: at the ceiling, a new tab is closed and its URL dropped. This
    preserves the state of the page you are currently reading.
  - **At ceiling**: at the ceiling, the URL loads in the tab you tapped the
    link from instead of being dropped. Under the ceiling, links open new tabs
    normally.
  - **Always**: links never open new tabs.

### Changed

- `target="_blank"` links are now only rewritten into the current tab in
  "Always" mode. Previously they were rewritten at every tab count regardless
  of the setting.
- Settings from earlier versions are migrated on first run.
  This affects exactly one user.
- Rewrote the add-on description.

### Fixed

- Removed tab counting dependence on `windowId`. Firefox for Android has no
  window concept. Tabs are now matched on their private-browsing flag.
- The popup now shows an error in place of the tab count when it can't read
  tabs, rather than sitting on placeholder dashes.
- `build.sh` creates `build/` if it's missing, and replaces the archive instead
  of appending to it. Deleted files could previously survive in later builds.

### Known bugs
  FF on Android only provides a count of currently loaded tabs to extensions.
  This means that archived tabs and tabs that are not in RAM will not appear in the tab count.

## [1.1.0] - 2026-08-30

### Added

- Settings popup, reachable from the Firefox menu under Extensions. Shows the
  tab count against the ceiling and allows changing the limit from 1 to 30.
- Settings are stored in `storage.local` and apply without a restart.

## [1.0.0] - 2026-08-26

### Added

- Initial release. Caps open tabs at a fixed limit of six by closing tabs
  created beyond it, and rewrites `target="_blank"` links to navigate the
  current tab.
- A 20-second grace period after browser start, so session restore isn't
  mistaken for opening tabs.
