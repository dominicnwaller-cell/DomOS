# Habits + Trackers — completed milestone

Developed from `864d409` on `dev-v6.2.0`. Foundation checkpoint `285ea85`; functional/UI checkpoint `6dc9aa9`; final refinement checkpoint follows this document. Main and the installed stable app are unchanged. Nothing published. Stop before Daily Shutdown / Weekly Review UI.

## Implemented

- SQLite schema 4 adds profile-scoped pause periods, Routine links and tracker pins; existing migration checksums remain intact. Source references are unique per Habit/profile. New relationships validate inside their profile. Transactional backup/restore includes all new records and accepts earlier backup schemas.
- Habit quick capture requires name + frequency. Completion, count, duration and quantity support AT LEAST / AT MOST, optional minimum, daily/weekday/interval schedules and flexible weekly/monthly quotas. Quotas count qualifying individual sessions rather than imaginary daily opportunities. Logs can exceed targets. Skip/pause/archive gaps do not corrupt consistency; unlogged AT MOST days are unknown. History survives archive and restoration.
- Shared actions cover creation, editing, logging, pause/resume, archive/restore, Routine links and confirmed permanent deletion. Completing a linked Routine step creates one canonical source log; repeated Assistant completion remains idempotent. Manual logging never changes Routine checks.
- Trackers support rating, number, count, duration, Yes/No and clock time, templates, multiple timestamped entries per day, type-appropriate daily aggregation, entry edits and confirmed deletion. Up to five pins support ordered Quick Check-In. Detail ranges show sparse recorded trends without fabricated values. Timestamp grouping follows the active profile timezone.
- One Tracking sidebar destination, Habits/Trackers tabs, detail screens, short creation flows, Today integration without duplicate linked Routine ticks, canonical History, Goal support links, Ctrl+K search and registry-driven conservative local Assistant commands/autocomplete. Calendar-week summary services are ready for the future Weekly Review UI.
- Fixed integration defects: partial Habit logs cannot inflate explicit Goal completion targets or History completion evidence; removing a Routine clears live links while retaining Habit history. Final polish improves margins, flexible grids, civil-date wording, boolean log labels, singular labels and off-day states. New command input clears stale read results while preserving action/Undo controls.

## Validation

All JavaScript suites passed: 60 Habit/Tracker services, 13 Tracking UI/integration, 29 Assistant, 27 Timeline/History, 38 refinement, 42 Goals services, 23 Goals UI/integration and 68 existing regression checks: **300 counted checks, zero failures**. Additional migration, profile adapter, fresh-profile and window-safety suites passed.

**15 Rust database tests passed**, including the actual 6.1.3 backup fixture at `%USERPROFILE%/Documents/DOMOS-Backups/after-6.1.3-2026-10-05.json`.

**40 isolated native checks passed**, including actual forms, Routine/Assistant deduplication, multiple entries/average, entry edit/delete/Undo, SQLite backup round-trip, profile isolation, corrupt restore rollback and all previous pop-out/synchronization checks. Final native proof finished `2026-10-06T08:56:39Z` (exact timestamp in the copied report).

Validation, frontend production build, verification native build and ordinary native development build passed. Ordinary development output excludes the verification frontend; its separate development identity is launched at completion. Visual review and screenshot inventory: HABITS-TRACKERS-VISUAL-REVIEW.md.

## Limits / technical debt

- Local commands use a deliberately conservative exact-name grammar; no cloud providers or API calls.
- Cue/reminder preferences are metadata; notification delivery remains a later milestone.
- Habit configuration edits use current settings for historical calculations; schedule/target configuration is not yet versioned historically.
- Duration/quantity quotas count individually qualifying sessions; partial sessions do not combine into a qualifying session.
- Existing compatibility bridge and collection-level Undo guards remain. Undo may refuse after newer edits.
- Clock-time trackers use a list rather than a misleading numeric trend. Sparse histories may show zero completed periods; no trend is invented.
- Desktop screenshots reviewed; responsive components exist, but full mobile-device/accessibility testing is not claimed.
- Production signing, installed clean migration and the actual 6.1.3 → 6.2.0 in-app update remain release gates. This milestone does not publish or replace the stable app.
