**Superseded current status:** see [final closure](NOTIFICATIONS-CLOSURE.md) for background/tray acceptance, explicit protocol activation, automatic running/cold/foreign-profile verification and remaining physical release gates. The report below is retained checkpoint `15569d5` evidence.

# DOM.OS 6.2 Notifications — finishing pass, 8 October 2026

Started clean at `36135a1` on `dev-v6.2.0`. The prior implementation and legitimate history were preserved. No reset, main changes, publication, stable installation changes or Finance Readiness work.

**Implementation finishing pass: complete. Windows platform acceptance: incomplete. Ready for 6.2 release: no.** Background/tray banners and native hearing remain uncertain; actual Windows toast click-through remains unverified. The focused-audio gap now has a working Windows-owned route with direct human confirmation.

## Changes

- Foreground timed reminders now request the same ordinary Windows toast/audio route used in background, while retaining a silent actionable in-app alert. Windows is the only automatic sound owner. Sound-disabled foreground/catch-up remains visual-only; quiet/informational reminders retain silent Centre delivery. One grouped batch requests one toast.
- Native and visual outcomes are distinguished in durable attempt details. Explicit native failures preserve the silent actionable fallback with a clear sound-unavailable warning and the existing single retry after 60 seconds. An accepted Windows request is never retried because only its in-app visual failed. Unknown claims are not replayed. OS presentation/focus APIs remain outside database/coordinator locks.
- Native click routing now selects the matching Needs Attention, Upcoming or Snoozed tab. Stale/resolved occurrences explain the fallback to current commitments. The native active-profile guard is retained; clicking another profile's old toast never switches profiles or reveals its records.
- Settings and diagnostics explain Windows sound ownership and distinguish the explicit Test Sound chime controls from automatic Windows volume. No forced automatic Web Audio or invented DND detection.
- Added five Rust route/failure/deduplication tests and three UI click-target/privacy/failure tests. No tests weakened. No migrations, source model, reminder engine or unrelated screens redesigned.

## Actual installed Windows evidence

All tests used `com.dom.os.notificationtest`, product **DOM.OS Notification Test**, synthetic profile only. Unsigned debug NSIS package; no production signing/updater acceptance is implied.

- **15:54 focused Standard:** actual in-app alert captured, real canonical timed Task and durable native request. User: **“One sound and Windows popup.”** Exactly one sound was confirmed. Complete Task cleared the real alert/source eligibility.
- **15:56 background Standard:** File Explorer activated before due time. Native request accepted. User observed the Windows Notification Centre entry but was unsure of a banner or sound. Neither is passed. User could not click the notification; click-through is unverified, not inferred from callback registration.
- **16:00 DND on:** user enabled DND, then a real focused Standard reminder was scheduled. Silent actionable in-app alert captured. User: **“No Windows popup or sound; restored DND.”** Original Windows DND setting restored by user. This verifies this ordinary focused reminder scenario, not every Focus mode, priority exception or Windows version.
- **16:02 / resume:** user approved and performed actual Sleep, then replied awake. User: **“Actual Sleep; no sound burst.”** App retained one grouped notice for three simultaneous reminders, all obligations discoverable and durable attempts unique. This is a short physical test plus human confirmation. Windows power-event query returned no matching events, so independent OS event timestamps are unavailable; do not imply instrumented suspend/resume tracing. The ledger does not separately prove the late (>90-second) silent catch-up branch. Controlled inactivity tests support that branch, but long sleep and overnight rollover remain gates.
- **16:06 post-wake, minimise-to-tray:** enabled only the isolated installation's Minimise to tray, clicked native Minimise and observed app window absent while process continued. New canonical reminder requested once at due time. User observed Notification Centre entry, unsure of sound/banner. Relaunch/restoration reused PID **29832**, the same main window ID **119605132**, and one app process. Original minimise preference restored. This verifies continuing processing/entry/restoration, not sound or native click-through.

Windows uses its notification settings, system volume and DND to govern ordinary toast audio. DOM.OS does not bypass suppression. The installed toast library explicitly emits `<audio silent="true"/>` when sound is disabled. Microsoft sources: [toast audio schema](https://learn.microsoft.com/en-us/uwp/schemas/tiles/toastschema/element-audio), [Windows notifications and Do Not Disturb](https://support.microsoft.com/en-us/windows/experience/notifications-and-do-not-disturb-in-windows). OS priority exceptions can alter suppression; no full OS-state detection is claimed.

## Acceptance matrix

Pass is limited to the stated scenario/evidence. Previous manual observations are explicitly labelled retained evidence rather than newly repeated acceptance.

| Scenario | Automated validation | Actual Windows / human evidence | Status | Remaining action |
|---|---|---|---|---|
| In-app reminder | Current UI/native tests | Actual 15:54/16:00 alert; real Complete Task action clears it | Pass | None for tested Standard |
| Foreground audible reminder | One Windows owner; visual-only when disabled; no replay after partial success | User confirmed one sound and Windows popup at 15:54 | Pass | Broader Windows/version settings coverage |
| Background Windows toast | Native request/unique claim pass | 15:56 entry observed in Notification Centre; banner unsure | Unverified banner | Repeat attended background test with banner enabled |
| Background audible reminder | Native sound route exercised | Human unsure at 15:56 and 16:06 | Unverified | Human listening with Windows per-app sound/volume checked |
| Windows DND | No automatic Web Audio; quiet policies pass | User enabled DND; no popup/sound at 16:00; restored settings | Pass, tested scenario | Other Focus/priority exception combinations |
| Windows toast click-through | Current category, stale target and foreign-profile UI tests pass; native callback guarded | User could not click; no physical navigation observation | Unverified | Click actual toast/Notification Centre entry and verify target/process/profile |
| Minimise-to-tray | Native preferences and request tests | Window hides; 16:06 entry observed; same PID/window restored | Pass for processing/restoration; audio/banner unverified | Physical native click and audible tray delivery |
| Snooze across restart | Current persistence/Undo/backup tests | Retained prior real restart and due-time alert screenshots 04/08 | Pass, retained acceptance | Broader custom-time coverage |
| Simultaneous reminders | One batch/unique attempts; route tests | Actual three-item grouped notice, retained prior group screenshot; no burst after user sleep | Pass for grouping | Fully attended audible group test outside DND/sleep |
| Rescheduled Task | Current domain/native obsolete identity tests | No new attended old-time physical delivery test | Pass automated; physical unverified | Wait through original and new due times |
| Completed Task | Current source cancellation tests | Actual Complete Task action removes focused alert; eligibility removed | Pass for tested source | Longer unattended timer suppression test |
| Profile isolation | Current JS/Rust/native tests, backup/restore and pop-outs | All interaction used synthetic identity/profile | Pass automated | Actual foreign-profile old toast activation |
| Physical sleep/wake | Controlled inactivity coverage passes | User confirmed actual Sleep/no burst; grouped state retained, fresh 16:06 delivery request | Pass short test; full gate unverified | Instrumented long suspend/late catch-up and overnight Daily Review/day-rollover |
| Ask DOM.OS | Current UI/native Ctrl+K, search/open tests | Actual Ctrl+K, autocomplete, record search and exact Task drawer observed; top-left search absent | Pass | None for tested pathway |

## Validation

- Full JavaScript suite: **427 counted checks, 0 failures**, plus passing migration/profile adapter/fresh profile/window suites. Includes 35 notification-domain and 19 notification-UI checks; retained 68 stable-app regression checks.
- Rust: **36/36**, consisting of 24 database and 12 notification-policy/presentation tests.
- Actual isolated Tauri native integration: **61/61**, finished 14:54:59 UTC, 0 failures. Migration/restore rollback, profile isolation, real SQLite persistence, native pop-outs/synchronization, canonical Work delivery/deduplication and Ask/source navigation pass. Native API success remains separate from hearing/display.
- Real 6.1.3 backup supplied to full JS and Rust migration tests. Legacy data never cleared; no schema migration changed by this pass. Schema 6 notification-state round-trip/invalid restore rollback retained.
- Repository validation, frontend builds, isolated NSIS/native-verification debug build and final normal native development build pass. Final normal assets checked to exclude `Isolated test controls` and native-verification modules. Build signing and 6.1.3→6.2 production updater acceptance remain release gates.
- `git diff --check` passes. Existing Node module-type warnings remain non-failing.

Logs: `javascript-audio-final.log`, `rust-audio-final.log`, `validate-audio-final.log`, `audio-package-build.log`, `audio-native-build.log`, `audio-normal-build.log`, `native-audio-final.json`, `audio-packaged-delivery-evidence.json`. Request ledger is API evidence only.

## Screenshots and visual review

Existing sufficient captures retained. New screenshots 21–29 are actual working synthetic app states, not simulated Windows toast proof. See SCREENSHOTS.md. Actual OS popup observation in this pass is human-confirmed, not a captured Windows screenshot.

Dark forest/green palette and restrained amber remain consistent. At 600px the Now columns stack, maximum three current rows retain overlap count/Review-more, Centre controls wrap with independent scrolling, and settings form one column. Expired Snooze now visibly reads “Snooze ended”; Undo remains present. Standard alert fits the viewport and actions wrap. Ctrl+K Ask uses the existing registry/typeahead/ghost completion, finds actual records and opens the correct Task. No top-left search field; alerts do not obscure Ask.

No new clipping/overlapping production controls observed in these captures. Test-only controls can obscure the lower-left region when expanded; they are excluded from normal builds. The inherited narrow sidebar hides, Settings tabs scroll horizontally, and the native scrollbar is visually bright. These are existing broader navigation/polish limitations; unrelated stable screens were not redesigned. No physical mobile or screen-reader acceptance claimed.

## Protection and stop

`main` remains **85e9f59c32a2a71570b121787bcd27155c581b9c**. Stable `%USERPROFILE%\AppData\Local\DOM.OS\domos.exe` SHA256 remains **7FD9A1A09EC7471FE8CC324F525E7E98355679D2694D333BDE363F56D4636C7F**. No stable identity, database or installation used by tests. No personal data edited. No push, release, upload, production install or publish. STOP before Finance Readiness.

Final checkpoint and clean working-tree confirmation are recorded in the external report after committing this documentation. Windows platform acceptance remains incomplete and 6.2 is not declared release ready.
