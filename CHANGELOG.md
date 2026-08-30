# Changelog

All notable changes to Tab Ceiling are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
