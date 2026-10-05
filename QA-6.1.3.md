# DOM.OS 6.1.3 — 5 October 2026

68 automated integration checks pass against the real application scripts in an isolated jsdom environment. Version validation and the production frontend build pass. Release CI now runs the integration checks before publishing signed installers.

## Changes

- Work Deadlines includes undated upcoming tasks. The finance widget's Open Finances button is removed.
- Transactions have edit/delete controls. Bills support editing, deletion and paid/unpaid status. Budgets and savings can be deleted.
- Spending and budget totals use the current payday cycle, including short months and payday itself. Account balances retain their existing manual/all-history basis.
- Cancelling new tasks, events and calendar templates discards the draft. Undoing a newly saved task removes it.
- Running timers retain the portion of a session after midnight. Weather refresh waits for the result and reports failure accurately.
- Window synchronization covers notes, layout, payday and calendar selection. Refresh waits while an editor is active. Concurrent collection writes merge independent changes; conflicting edits are rejected with an explanation.
- Required names and numeric form values are validated. More user-facing text is escaped. Backup imports validate record IDs, duplicate IDs and selected fields; failed writes roll back earlier changes.
- Actions without an undo snapshot no longer advertise Undo.
- Updates uses inline progress only during download/install, with controls matching the update state. Fixed the renderer name mismatch and text encoding damage introduced during the other chat's edit.

## Added regression coverage

Cancelled drafts, task-create undo, invalid forms, finance edit/delete and bill status, payday boundaries, midnight rollover, independent/concurrent conflict saves, unsafe/duplicate backup IDs, backup round trip and quota rollback, all updater states, and weather failure.

## Limits

These automated checks do not replace physical pointer/layout testing, every native pop-out, real sleep/resume timing, a live weather outage, or installer failure recovery. No destructive checks ran against the installed user's data. The user has accepted handling the remaining manual checks. Native updater installation and data preservation will be recorded after the release is available.

The earlier audit and cleanup record remain in QA-AUDIT.md. Its eight-item source work queue is addressed by this release, with the testing limits above.
