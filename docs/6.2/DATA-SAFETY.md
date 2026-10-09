# 6.2 data safety and milestones

Baseline: release tag v6.1.3, commit f363a05. Development branch dev-v6.2.0. Main and public releases remain untouched until the release gates pass.

## Legacy inventory

The 6.1.3 store uses lifeos4.* JSON keys: tasks, events, calendarTemplates, routines, routineExceptions, routineChecks, transactions, financeAccounts, financeBudgets, financeBills, financeSavings, goals, notes, activeNoteId, dashboard, dashSelectedDate, dashCalView, quickNote, quickNoteState, keys and paydayDay. domos612.* contains appearance/profile settings, workTimer, autoCheck, lastPage and operational timestamps. domos_* contains migration flags. The old unprefixed prototype keys must also be backed up, including unknown keys; none may be cleared by 6.2.

Hazards: V5.1 boot deletes prototype keys; V5.3 seeds a named personal daily routine; V5.5 seeds calendar templates; V5.5.1 seeds a test task; default settings include a personal name/location/payday. Migration must execute before legacy application scripts. Fresh profiles start empty, with templates strictly opt-in. Existing records, including earlier seeded records, are preserved as the existing user's data.

## Database boundary

SQLite is owned by Rust commands. The frontend never receives arbitrary SQL access. Every user-owned row has profile_id; record keys are unique within a profile. UUIDs identify profiles. Reads/writes take an explicit validated profile ID. Revisions reject stale saves, including saves from pop-outs. Multi-key writes and migrations are transactions.

Schema migrations run in order and are tracked with their version and SQL checksum. Unknown/newer schemas or altered applied migration definitions stop startup. Failed migrations roll back. The development app uses a distinct identifier and database path from the installed stable app.

## Upgrade order

1. Read localStorage without modifying it. Inventory every key; preserve raw values even if a known value is malformed.
2. Write a complete pre-migration snapshot to a unique native backup file, flush it and read it back to verify its exact contents. No legacy import or profile-data write is permitted before this succeeds. Empty database/schema initialization can precede capture and never reads or modifies legacy data.
3. Validate known structured records and ask the user to name the destination profile.
4. Transactionally create the profile and import the structured records, original state/preferences and an import receipt. Verify counts and payloads before commit.
5. Activate the profile only after verification. Retain all legacy localStorage keys. A retry of the same import is idempotent and cannot duplicate a profile.
6. On any error, keep legacy storage unchanged and present retry/export/recovery controls.

Backup restore likewise validates first, writes a rollback backup, and restores in one transaction. No successful-looking UI appears before durable persistence acknowledges a write.

## Gates

A: inventory, modular migration/audit code, schema, rollback tests, existing 6.1.3 regression suite and build.
B: onboarding, native migration and backup, profiles/switching, SQLite-backed existing features, real exported-data migration and isolation tests.
C–H: history/timeline/sessions, goals/hierarchy, habits/trackers, reviews, notifications, responsive polish; test and report each phase.
I: clean native install, copy of actual 6.1.3 data, multi-profile isolation, backup round trip, signed production build and actual updater compatibility. Do not publish 6.2 before these pass.

The user supplied the approved concept image on 5 October 2026. A local reference copy is saved at `%USERPROFILE%/Documents/DOMOS-References/DOM.OS-6.2-approved-UI-concept.png`. Visual implementation follows the data foundation; the current development interface is not the finished concept. The retrieved specification's final section is truncated; the user's release gates remain authoritative.
