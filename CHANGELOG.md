# Ground Floor — Changelog

All notable changes to Ground Floor are documented here.
Format: Build number · Date · What changed · Why

---

## Build 3 — Engagement Velocity + Commenter Timing
**Date:** June 6, 2026

### Added
- `analytics/velocity.js` — pure functions: `detectResurgingNotes`, `calculateOverallVelocity`, `saveEngagementSnapshot`, `loadEngagementSnapshot`
- `analytics/timing.js` — pure functions: `analyseCommenterTiming`, `analyseTimingGap`
- `scraper.js` — saves engagement snapshot on every notes fetch for velocity comparison
- `dashboard.js` — `renderEngagementVelocity` and `renderCommenterTiming` wired into Notes Analytics tab

### Signals produced
- Resurging notes detected when engagement grows 20%+ since last scrape
- Overall engagement velocity trend (up/down/flat) across all notes
- Peak commenter timing by hour, segment, and day of week
- Timing gap analysis — when writer posts vs when engaged readers are active

### Architecture
- Two new pure analytics files added to `analytics/` folder
- Zero DOM references in either analytics file
- Snapshot storage routed through `Storage.set/get` in `storage.js`

---

## Build 2 — Editorial Intelligence
**Date:** June 2, 2026

### Added
- `analytics/readers.js` — pure functions for Reader Intelligence, Relationship Intelligence, and Recommendation Engine
- Outreach signal — surfaces readers worth a personal reply based on comment depth and follower reach
- Relationship map — three cohorts: Loyal, Emerging, Fading readers
- Recommendation Engine — up to 4 specific plain-English directions derived from themes, readers, emotional intent, and relationship data

### Architecture
- Created `analytics/` folder establishing Data → Storage → Analytics → UI layering
- Created `storage.js` — single access point for all chrome.storage reads and writes
- Moved pure correlation functions to `analytics/correlations.js`
- Moved pure theme functions to `analytics/themes.js`
- Enforced hard boundary: analytics never touches DOM, UI never calculates insights

---

## Build 1 — Theme Manager
**Date:** May 30, 2026

### Added
- User-defined theme manager in Readers tab
- Writers define up to 5 themes with custom keywords
- Theme clustering across reader comments — shows which themes resonate most
- Editorial signal — plain-English observation from theme patterns
- Themes stored in `chrome.storage.local` per writer

---

## Build 0 — Foundation
**Date:** May 26, 2026

### Added
- Chrome extension modal — fires on Substack.com, asks "Why are you opening Substack right now?"
- 8 emotional intent options: To think, Curiosity, Inspiration, Avoiding work, Validation, Loneliness, Habit, Calm
- Popup dashboard — At a glance stats, top emotions, recent entries, pattern insight
- Full dashboard — Attention tab with heatmap, time-of-day breakdown, emotional timeline
- Notes Analytics tab — scrapes published posts, top performers, posting patterns, engagement by day
- Correlations tab — 6 correlations: emotional intent vs performance, word count, posting hour, frequency, media type, recency decay
- Readers tab — maps commenters from newsletter posts, follower counts, engagement scoring
- Month-by-month top 5 notes

### Architecture
- Manifest V3 Chrome extension
- `background.js` service worker with authenticated API calls
- `scraper.js` — Notes feed scraper + post comments scraper
- `storage.js` — unified storage layer
- `analytics/` — pure functions layer

---

## Fixes Log

### June 5, 2026
- Fixed `THEME_PALETTE` duplicate declaration error (was declared in both `analytics/themes.js` and `dashboard.js`)
- Fixed `boot is not defined` error — removed stale reference from `dashboard.js`
- Fixed `userThemes is not defined` in `renderReadersData` — now loaded via `Storage.getThemes()` at function start
- Fixed dashboard loading state — replaced direct `chrome.storage` calls with `Storage.getAll()`
- Fixed CSP inline handler violation in `popup.html` — replaced `onclick=` with `addEventListener`
- Fixed `ERR_FILE_NOT_FOUND` on dashboard — `dashboard.html` was missing from folder

### May 29, 2026
- Fixed post comments returning 404 — Notes use different IDs than posts, switched to newsletter post comments API
- Fixed `parseComment` returning null handles — Substack puts author fields directly on comment object, not nested
- Fixed dashboard stuck on Loading — added retry wrapper for `chrome.storage` MV3 timing issue

---

## Known Issues
- Restacks showing 0 — field name mismatch in `parseNote()`, Substack API uses different key than `restack_count`
- Average engagement showing 0.0% — views returning as 0 from Notes feed API, engagement rate denominator is zero
- Week-on-week trend not yet implemented

## Roadmap
- Fix restacks and engagement rate (next)
- Week-on-week likes trend with emotional intent correlation
- Build 3 — Commenter timing analysis
- Build 4 — Subscriber vs non-subscriber (CSV upload)
- Build 5 — Re-engagement flagging + relative thresholds for 5,000+ subscriber writers
