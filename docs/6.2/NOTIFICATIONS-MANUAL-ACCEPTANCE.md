# Latest acceptance

See [finishing-pass matrix](NOTIFICATIONS-WINDOWS-ACCEPTANCE.md) for current evidence and remaining gates. The following is retained prior-checkpoint evidence.

# Notifications manual acceptance — 8 October 2026

All actions use the isolated installed `com.dom.os.notificationtest` package and synthetic profile. The stable installation and its database are outside this test identity.

| Case | Evidence and outcome |
|---|---|
| A — timed/audible | Actual Standard and Priority scheduled Task native requests were recorded at the real wall-clock minute. Test Windows Notification returned an accepted API request. Test Sound played; the user explicitly confirmed hearing the chime. Windows toast display/native sound remain unverified. Focused automatic sound is withheld while complete OS suppression status is unknown. |
| B — reschedule | Native integration and JS tests change the canonical Task schedule and invalidate the old occurrence. Full manual editor/old-time physical delivery check remains a release gate. |
| C — Dismiss | Native integration plus actual UI tests retain the unfinished source, preserve the Centre row and provide Undo. No fake completion. |
| D — Snooze/restart | Manual five-minute Snooze of a date-only deadline, normal app quit, isolated package restart: same state visible afterwards. At the saved UTC instant the native ledger recorded `in-app-requested`; the actual Standard alert was captured. Source deadline was unchanged. |
| E — sleep/wake | Controlled native inactivity/reconciliation checks pass. No physical OS suspend was performed: outstanding release gate. |
| F — recurring Routine | Deterministic civil-day/DST/recurrence tests pass; actual recurring reminder over multiple real days remains unverified. |
| G — grouping | Three real Tasks scheduled for one minute produced one calm alert: “You have 3 things scheduled now.” Three durable delivery slots share the same timestamp; screenshot captured. |
| H — background | Close-to-tray hides the window and retains the same process. Launching again reopens that existing process, rather than creating a second coordinator. A real scheduled Task was delivered while hidden: the ledger records native-requested at its due minute. Default Quit was restored after the test. Actual tray-menu click, minimise-to-tray and Windows-login autostart remain unverified. |
| I — toast activation | Activation handler targets existing main window and only the currently matching profile; invalid/locked profile cannot open its Centre. Actual Windows toast click-through could not be captured: outstanding release gate. |
| J — profile isolation | Native SQLite, service, backup and pop-out isolation checks pass. Notification primary-only activation/sync and candidate-source guards preserve explicit context. |
| K — unified Ask | Actual Ctrl+K opens existing Ask; typing `finish invoice` finds the real synthetic Task. Existing native Enter/open check passes. No old top-left search remains. |

Standard/Priority **UI preview** screenshots are explicitly labelled previews. They reference persisted canonical synthetic reminders but bypass delivery timing solely to review styling; they are not physical-delivery evidence. A separate Standard screenshot records the real post-restart Snooze alert.

No Windows security/privacy permissions were changed. No stable data was edited. Autostart was not registered for the test package.
