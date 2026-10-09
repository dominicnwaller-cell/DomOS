# DOM.OS 6.2 Notifications — final implementation closure

8 October 2026. Started clean at `15569d5f49a66aa4dbc464d45fe56d11abfd55c8` on `dev-v6.2.0`. Preserved all legitimate work. No reset or application rewrite.

**COMPLETE: required implementation and realistically automatable application-side Windows activation paths pass. UNVERIFIED PLATFORM BEHAVIOUR: the exact selected-context outcome of a physical Windows click is not independently captured. Genuine overnight lifecycle, production signing and 6.1.3→6.2 updater acceptance remain release gates. This is not production release acceptance.**

## Targeted implementation

Native Windows toasts now carry an explicit protocol navigation URI. Tauri's supported deep-link plugin registers a scheme derived from each installation identity; the existing first single-instance plugin forwards arguments into the reminder activation handler. Cold starts retain the URL until the active profile and canonical reminder candidates have synchronized. Strict validation requires the installation scheme, canonical UUID and bounded hashed occurrence target; links cannot execute completion, snooze, deletion or database actions. Cross-profile activation never changes profiles or exposes another profile's records. Resolved/deleted occurrences retain the existing explicit stale-reminder fallback.

The Windows ToastNotificationManager XML preserves one Windows-owned audio request, silent disabled/catch-up presentation and XML escaping. No competing audio/reminder engine, schema changes or unrelated refactors. Three focused Rust tests cover activation validation, profile/stale handling and XML/audio serialization. An isolated-test-only diagnostic records routing outcomes and profile/occurrence identifiers in the evidence folder; no titles, freeform commands or hidden reasoning. Normal installations never write that trace.

Documentation: [Tauri deep links](https://v2.tauri.app/plugin/deep-linking/), [Windows toast schema](https://learn.microsoft.com/windows/apps/design/shell/tiles-and-notifications/toast-schema). The runtime registration approach is supported, but a readable registry key in Codex's context is not proof of external shell resolution.

## Windows evidence and diagnosis

All records are synthetic and use `com.dom.os.notificationtest`. The test package is unsigned/debug; no production installer/signing acceptance is implied.

- **16:23 background:** Task `t7197bf2b-fb59-4e09-9db6-dee00f6f07ae`, profile `00000000-0000-4000-8000-000000000004`. One accepted request; user reported automatic DND had re-enabled. Positive banner/audio was therefore not passed. Original click did nothing.
- **16:33 background after protocol fix:** Task `00000000-0000-4000-8000-000000000002`. File Explorer foreground. User confirmed **“Popup and one sound.”** Canonical source/occurrence ledger shows one native-requested attempt, no retry/duplicate. Clicking showed Windows' missing-app message.
- A fresh launch through File Explorer rather than a Codex-launched process resolved the missing-app symptom. Separate synthetic profile contexts were observed: Codex-launched `synthetic-profile-A` and Explorer-launched `00000000-0000-4000-8000-000000000001`. This supports a packaged-environment registration/context explanation; exact OS virtualization mechanics were not independently proven. No global Windows security/privacy changes were made.
- **17:05 background, Explorer launch:** real scheduled Standard Task visible before due time, File Explorer foreground. User answered **“yes that all worked”** to popup/one sound/click questions. Subsequent capture did not establish the selected panel, so this is retained delivery/app-opening confirmation, not independent selected-context proof.
- **17:09 tray:** Minimise to tray temporarily enabled in the isolated app; window disappeared and process **39912** stayed running. User answered **“done and all ok”** to popup/one sound/reopen questions. Restoration retained PID **39912** and window **526750**, one app instance. Original Minimise preference restored to off. Capture showed Settings rather than the Centre; user later could not identify the destination. Banner/audio and restoration pass, while precise physical click destination is not overstated.
- **17:27 instrumented reminder:** diagnostic later received one valid activation link for profile `synthetic-profile-B`, Task `00000000-0000-4000-8000-000000000003`, matching occurrence/hash, and successful `domos-notification-open` emission. This is real routing evidence but does not alone prove what the user saw at the click.

Human tests stopped under the final autonomous directive. No further questions, sound/popup confirmations or screenshot sessions requested.

## Automatic native activation acceptance

Supported synthetic activation launches the installed executable with its validated protocol argument. It tests the same application handler without requiring an inaccessible physical Windows toast click.

1. **Already running:** 17:27 URL resolved the correct active profile/occurrence, emitted successfully, and Computer Use accessibility observation confirmed an open Attention Centre containing the exact 17:27 Task occurrence. Existing UI tests verify selected-row rendering, category selection and source navigation.
2. **Cold start:** safely quit the isolated app, then launched its executable with the known 16:33 URL in the Codex synthetic context. Startup recorded `hasLink:true`; after canonical profile synchronization it resolved the exact 16:33 occurrence and emitted successfully. Native UI accessibility confirmed the Attention Centre and exact 16:33 occurrence. This is an actual cold process launch, not only a mocked pending flag.
3. **Foreign profile:** with profile `synthetic-profile-A` active, sent the valid `synthetic-profile-B` link. Trace recorded `sameProfile:false`, `ids:null`, no navigation emission. Centre stayed closed; foreign data was not exposed or selected.
4. **Single instance:** activation retained one running process; cold launch created one replacement process after the prior app exited. No duplicate main windows.
5. Malformed URI, wrong installation, invalid UUID/target, stale/removed source, notification category and Undo/persistence safety remain covered by current Rust/JS/native suites.

Evidence: `activation-diagnostics.jsonl`, `closure-activation-ui.json`, `closure-packaged-delivery-evidence.json`. Physical Windows click presentation and synthetic application-side activation are explicitly different evidence categories.

## Final acceptance matrix

| Requirement | Status | Evidence / remaining scope |
|---|---|---|
| Foreground audible reminder | PASS, retained | User confirmed one sound and popup at 15:54 |
| Windows DND suppression | PASS, retained scenario | No popup/sound at 16:00; manual DND restored by user |
| Physical sleep/wake | PASS, retained short scenario | Actual Sleep/no sound burst; long suspend is separate |
| Background Windows popup | PASS | Actual popup confirmed at 16:33 and 17:05 |
| Background sound | PASS | One sound confirmed at 16:33/17:05 |
| Tray dispatch/popup/sound | PASS, tested configuration | Hidden window, running process, human 17:09 confirmation |
| Tray restoration/deduplication | PASS | Same PID/window, one instance; unique claims and batching tests |
| App-side click activation/navigation | PASS | Valid routing trace; automatic running and actual cold-start Centre occurrence checks |
| Precise physical toast-selected context | UNVERIFIED PLATFORM BEHAVIOUR | Human app-opening confirmation, but selected panel not conclusively captured at physical click |
| Stale/foreign-profile activation | PASS automated/native | Exact profile guard, no foreign Centre, stale fallback regression tests |
| Snooze persistence/grouped alerts | PASS, retained/current | Prior restart/group evidence plus current persistence/batch tests |
| Migration/backup/restore/profile isolation | PASS automated/native | Real legacy fixture, rollback, corrupt restore, round-trip, pop-out synchronization |
| Ask DOM.OS / header | PASS, retained/current | Ctrl+K existing registry/search works; old top-left search absent |
| Genuine overnight rollover | UNVERIFIED RELEASE GATE | Reproducible overnight procedure; controlled rollover/DST/restart tests pass |
| Signing/production updater | UNVERIFIED RELEASE GATE | No signed production install or 6.1.3→6.2 in-app update performed |

## Final validation

Latest changes were followed by one full completion suite, without weakening coverage:

- **427 counted JavaScript checks, zero failures**, plus migration/profile/fresh-profile/window suites. Includes 68 retained regression checks and 35 reminder-domain/19 reminder-UI checks.
- **39/39 Rust checks**: 24 database and 15 notification checks. Real 6.1.3 backup supplied through `DOMOS_MIGRATION_FIXTURE`; JS real-backup audit retained. No schema migration changed.
- **61/61 actual isolated native integration checks**, zero failures, finished `2026-10-08T16:26:13.944Z`. SQLite persistence, migration/invalid-restore rollback, backup round-trip, profile isolation, native pop-outs/synchronization and reminder canonical/deduplication tests pass. Harness clock simulations do not establish physical overnight behaviour.
- Repository validation, frontend build, isolated NSIS diagnostic package, native-verification build and final normal development native build pass. Normal assets exclude acceptance/native-verification controls. `git diff --check` passes. Existing non-failing Node module-type/line-ending warnings remain.

Logs: `closure-javascript.log`, `closure-rust.log`, `closure-validate.log`, `closure-package-build.log`, `closure-native-build.log`, `closure-normal-build.log`, `closure-native-final.json`. No full-suite repetition after these final code results; subsequent changes are documentation only.

## Visuals, limitations and release gates

Existing sufficient captures and visual review are retained; no optional polish/new screenshot sessions. Current dark/green hierarchy, responsive Centre/settings and Ctrl+K controls remain validated. Inherited narrow navigation and bright native scrollbars remain broader polish limitations. Native popup observations are human-confirmed, not application screenshot simulations.

Windows owns volume/DND and may suppress ordinary alerts; no complete OS-state detection or bypass. True Quit stops reminders. SQLite claims and Windows presentation cannot prove hearing/display atomically; uncertain accepted attempts are never blindly replayed. Isolated diagnostic trace is test-only. Physical selected-context click, real overnight observation and production signing/updater remain final release validation. See [overnight procedure](NOTIFICATIONS-OVERNIGHT-ACCEPTANCE.md).

Original test-app Minimise to tray was restored. The user temporarily disabled an automatic Windows DND rule; its final restoration is not verified and no further user interaction or OS settings automation is attempted under the final directive.

## Protection and stop

Main remains `85e9f59c32a2a71570b121787bcd27155c581b9c`. Stable executable SHA256 remains `7FD9A1A09EC7471FE8CC324F525E7E98355679D2694D333BDE363F56D4636C7F`. No personal records edited; no stable application actions taken. All application testing used isolated identities/profiles. No push, merge, release, upload or publication. No Finance Readiness or unrelated milestone started.

The final checkpoint and clean working-tree result are recorded in the external completion report after committing. STOP after this milestone.
