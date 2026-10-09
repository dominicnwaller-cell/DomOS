# Daily Review + Weekly Review milestone - 8 October 2026

Continued from a clean `e6bec7d` on `dev-v6.2.0`. Existing foundation and newer milestones were retained. Incremental checkpoints: `650a6d8` (contracts/summaries/rollover), `ecd21c5` (Review UI/integration/native journeys), and the final refinement/evidence commit containing this report. The final hash is available in the completion message and Git log.

## Implemented

- Automatic civil-day reconciliation on startup/profile boot, periodic execution, focus, visibility/pageshow, profile refresh, and native Tauri window focus. No midnight ritual, modal, snapshot rows, automatic rescheduling, fabricated reviews or stopped timers. Historical navigation and unsaved reflections are retained.
- Lazy Daily/Weekly Summary queries over canonical Tasks/history, Work Sessions/baseline, recorded Routine checks, Habits, Tracker observations, Goal activity, Events and actual finance transactions. No duplicated summary database, fabricated historical plan comparisons, missing-data zeroes or overall score.
- Optional Daily Review with Summary, relevant Loose Ends (five initially), pinned Tracker Check-In, optional reflection, save/finish/reopen. Finish is available from any section. Quiet periods can finish without catch-up or journaling.
- Canonical Tomorrow/Next Week/Choose Date/Backlog/Leave For Now/Complete actions. Scheduled dates and explicit deadlines remain separate. Versioned acknowledgements resurface changed priorities or deadline urgency. Standard audit, conflict checks and Undo remain active.
- Historical Check-In keeps measurement attribution separate from the recording instant; explicit consent is required. Rapid repeat submissions are idempotent; separate observations remain valid.
- Weekly Review: configured period boundaries, in-progress-period label, factual statistics, genuinely recorded period Focus, relevant Open Loops, reflection, complete/reopen and an optional Next Week Reset. Continue/Complete priority/Remove/Select New are explicit. Carry-forward creates independent period rows; old selections remain evidence. Current Goal status is separately labelled.
- Three secondary Dashboard entries; History Review list/status filters/resume; profile-local reflection/date search; six local Assistant registry commands with existing autocomplete and audit.
- Narrow recorded Work correction form preserves session IDs, links and breaks; validates past intervals/overlaps/DST gaps/folds, shows errors in the dialog and updates historical facts without changing plans or reflections.
- Dark green Review surfaces, wrapping controls, 44px controls, focus outlines, mobile layout rules, Reduce Motion, non-overlapping Dashboard entry buttons and corrected completed-review/next-week wording.

## Data architecture

SQLite schema 5 adds `daily_reviews` and `review_acknowledgements` and unique profile/day and profile/weekly-period indexes; existing `weekly_reviews` remains the canonical collection. Prior SQL/checksums are unchanged. Extension data is promoted transactionally. Existing weekly rows lacking reliable period metadata are retained rather than attributed to invented periods. Existing Focus has genuine week identity; unknown historical timezone remains labelled unknown. New Focus retains timezone and absolute boundaries.

Daily identity is profile plus civil day, with original timezone and half-open instant boundaries captured at first deliberate start. Weekly identity includes original civil start, timezone and configured week start. Ordinary commits cannot alter that identity; explicit restore can reinstate prior data. Invalid/duplicate records roll back the entire transaction and revision. Backups support schemas 1-5. Existing SQLite upgrades now create and verify a consistent `VACUUM INTO` pre-migration backup including committed WAL data; failed schema upgrades preserve both original records and backup.

Weekly Tracker averages weight observed daily aggregates equally. Latest/total semantics remain type/purpose appropriate; missing days remain absent. Work uses canonical boundary slices (including DST), and only known original-timezone legacy aggregates are included. Finance totals exclude transfers and scheduled bill definitions. Payday comes from the existing finance helper, not a new model.

## Validation

All passed on the final implementation:

| Suite | Passed |
|---|---:|
| Assistant/services | 29 |
| Life tracking | 27 |
| Timeline refinement | 38 |
| Goals/services | 42 |
| Goals/UI | 23 |
| Habits/Trackers services | 60 |
| Tracking/UI | 13 |
| Review services | 53 |
| Review/UI | 20 |
| Legacy audit regressions | 68 |
| **Counted JavaScript total** | **373** |
| SQLite/database tests | 21 |
| Isolated actual native-window checks | 53 |

Migration/profile-storage/fresh-profile/window suites also pass outside the numbered JS total. Both JS and database runs used the private real 6.1.3 backup fixture, which remains unchanged. Validation, frontend production compilation, native verification debug build and normal `tauri.dev62` development build pass. No installer/signing/publication was performed. Vite reports a harmless static/dynamic Tauri-window import chunk warning; existing Node module-type warnings remain.

## Acceptance and limits

See [manual acceptance](REVIEWS-MANUAL-ACCEPTANCE.md) and [visual review](REVIEWS-VISUAL-REVIEW.md). Controlled native app-clock midnight/inactivity/overnight tests passed. These are not an actual wall-clock overnight run. **Physical Windows OS sleep/wake is UNVERIFIED**; no system suspend or system-clock change was performed. Real window focus was exercised during inspection; controlled multi-day reconciliation uses the app focus event. Do not conflate it with physical resume verification.

Manual Computer Use navigation, unresolved Daily Review completion, quiet-day opening, completed-week planning and explicit Continue were exercised. The native harness additionally submits real rendered forms for historical corrections/check-ins and verifies period identities, audit, Undo, profile isolation, pop-outs and transactional backup restore.

Historical original plans cannot be reconstructed reliably; no historic planned-vs-actual percentage is invented. Reflection drafts survive navigation/rollover in the current window; persistence requires Save/Finish. They are not promised durable before saving. Observation cards are deliberately neutral; Goal activity counts are records, not a productivity score. The brief's 30-second/three-to-five-minute review targets were not a timed user study. Dedicated physical mobile-device testing and the later whole-app hostile release review remain release gates.

## Protected scope and stop

`main` remains `85e9f59c32a2a71570b121787bcd27155c581b9c`. Installed stable executable SHA256 remains `7FD9A1A09EC7471FE8CC324F525E7E98355679D2694D333BDE363F56D4636C7F`; stable installation/data were not operated on. Verification uses `com.dom.os.nativeverify` synthetic UUID profiles; normal development uses `com.dom.os.dev62`. Nothing was pushed, merged, signed, published or installed. STOP here. Notifications, Finance stabilisation, wider refinement and production release gates are separate work.
