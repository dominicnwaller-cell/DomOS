# Review acceptance evidence - 8 October 2026

All data modifications for native verification and visual journeys used synthetic UUID profiles in `com.dom.os.nativeverify`. No stable profile was opened or edited.

| Journey | Evidence and result | Limit |
|---|---|---|
| A Normal day | Controlled clock crosses midnight in actual native app; Today advances, Summary remains lazily available and no forced Review/modal occurs. Passed. | Actual wall-clock overnight not performed. |
| B Sleep/inactive rollover | Controlled multi-day clock plus focus reconciliation preserves deliberate historical Calendar selection and reflection draft, without invented missed rows. Repeated real native window activation also works. Passed in these paths. | **Actual physical Windows sleep/wake UNVERIFIED.** Synthetic focus is not proof of OS suspend/resume. |
| C Overnight work | Actual native service timer remains one running session across controlled midnight; each side receives 30 minutes; Stop remains explicit. Passed. | Controlled application clock, no system-clock change. |
| D Imperfect week | Synthetic skipped/minimum-met/quota-exceeding Habits, unresolved invoice and absent optional reviews; completed current-week Review retains in-progress label and never forces Reset. Manually navigated; Daily Review finished with invoice unresolved. Passed. | Synthetic representative data, not a longitudinal user study. |
| E Historical corrections | Native rendered Work correction rejects invalid interval visibly, then changes stopped interval from one hour to 30 minutes. Same session ID/reflection retained. Historical pinned Tracker form requires explicit attribution and prevents repeat submit. Old transaction refreshes derived spending. Service tests separately verify old Task changes/Undo and preserved deadline. Passed for stated paths. | Old Task correction was automated service/UI coverage rather than a separately typed manual historic form journey. |
| F Focus transition | Native harness explicitly continues known Objective to independent next-week row and compares old row byte-for-byte. Computer Use also opens completed week's Reset and clicks Continue, observing idempotent existing selection and unchanged old display. Passed. | No physical passage into a later calendar week; period selection is explicit. |

Backup: native schema-5 export/import creates a new UUID with all Review, Focus and Tracker records preserved. Duplicate-day restore rejects and preserves existing snapshot and revision. Database tests cover duplicate weekly periods, malformed metadata, pre-upgrade WAL backup and failed migration preservation. Original private real 6.1.3 fixture migration/round-trip tests passed.

The native report is `%USERPROFILE%/Documents/DOMOS-Reviews/6.2-daily-weekly-reviews/native-verification.json` (53 checks). Complete executable tests live in `src/testing/native-reviews.js`, `scripts/test-reviews.mjs`, `scripts/test-reviews-ui.mjs` and `src-tauri/src/database.rs`. GUI manual observations are the screenshot gallery, not a claim that every automated assertion was independently repeated by hand.
