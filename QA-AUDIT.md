# DOM.OS 6.1.2 audit — 4 October 2026

## Result

50 automated integration checks pass against the revised source. These execute the real application scripts and DOM in an isolated jsdom environment, with disposable in-memory app data. Browser checks also verified task creation after visiting Settings, saving an undated task, its appearance in Work Deadlines, and removal of the Open Finances button. User data in the installed application was not used for destructive tests.

This is broad functional coverage, not a claim that every possible input, operating-system interaction, or failure condition has been tested. Native installation/restart and a native goal pop-out were verified earlier in this session against 6.1.2; they have not been rerun against this patch.

## Fixed in source

| Issue | Reproduction / correction |
| --- | --- |
| Work Deadlines hides undated upcoming tasks | The seeded Test Work Task has no date. Incomplete undated tasks now appear after dated tasks with No due date / Set a due date. The widget still displays at most five tasks, with a link to the full board. |
| Saving or creating tasks/events/routines can throw after Settings initializes | The new Settings shell removes hotkeyRows, while renderAll still calls renderKeys. renderKeys now handles the absent panel. |
| Transaction saving fails | An obsolete hidden transaction modal duplicates the active drawer's field IDs, making named DOM references resolve to collections. Removed the obsolete modal. |
| Widget rename is overwritten | Dashboard enhancement replaced saved custom titles. It now respects dashboard names. |
| Notes and task/event titles can be interpreted as HTML | Escaped note previews, task cards, calendar entries and schedule titles. This fixes the tested rendering paths; it is not a complete security audit of imported IDs or all legacy templates. |
| Note list remains stale while typing | Update its active title and preview without rebuilding the editor or losing the caret. |
| New note is hidden by the existing search | Clear the note search when creating a note. |
| Routine redo fails | Include routines in both undo and redo snapshots and restore them in both directions. |
| Ctrl+Z while typing undoes app actions | Preserve ordinary text-input undo/redo in inputs, textareas and editable elements. |
| Escape leaves goal/routine/rename editors open | Close these editors along with the existing drawer and library. |
| Reset shortcuts retains customized values | Clone defaults when initializing mutable shortcuts. |
| Payday differs between finance page and widget | Use the same clamped calendar-day calculation, including payday itself, short months and daylight-saving transitions. |
| Schedule's open-calendar control loses the selected month | Set the full calendar view to the selected schedule date before opening it. |
| Backup import accepts unrelated keys and malformed collections | Validate supported format/version, key namespace, string values and collection arrays before writing. Further object-field validation and rollback on quota failure remain future hardening. |
| Requested finance widget simplification | Removed Open Finances. Category controls and sidebar navigation still open Finances. |

## Remaining confirmed issues / work queue

These were found through source inspection and are not fixed by this first patch. They must not be mistaken for passing end-to-end tests.

1. Finance transactions have an editor function but no Edit/Delete controls in their rendered list. Bills cannot be edited, deleted or marked paid through the current UI. Budgets and savings lack deletion controls. Bills therefore remain committed indefinitely unless data is changed elsewhere.
2. Finance pay-cycle spending and budgets aggregate all recorded history, while dashboard category totals use the current month. The period definitions are inconsistent.
3. New task/event/template objects are saved before the user presses Save; closing the editor leaves the placeholder record behind.
4. A running Work Timer crossing midnight resets to a stopped timer and loses time after midnight.
5. Weather refresh announces success before its request finishes; failures are swallowed and only reflected in the weather icon tooltip.
6. Cross-window synchronization reloads tasks, events, goals, routines and finance collections, but not notes, dashboard layout, payday or selected calendar date. Concurrent edits can also overwrite newer state because persist writes several collections at once.
7. Some actions show an Undo toast without creating a matching snapshot, notably goal changes. Undo is not yet a consistent app-wide feature.
8. Empty/invalid input validation is inconsistent across legacy task, event and finance forms. Imported object IDs and fields need a wider validation and escaping pass.

## Coverage

- Navigation: Dashboard, Work Tasks, Calendar, Routine, Finances, Goals, Notes, Settings.
- Work: create, save, search, priority, duplicate, completion, deletion, undo/redo, drag handler, persistence, dated/undated deadline display.
- Calendar: event CRUD, template CRUD, task display, selected-month navigation.
- Routine: create/edit, pause/resume, deletion, undo/redo, Today completion and progress.
- Goals: create/edit, completion, deletion, dashboard progress.
- Notes: creation, editing, live preview, search, selection, deletion, literal text, keyboard behaviour.
- Finance: all seven tabs; account CRUD; budget creation; bill creation; savings reservation; transaction creation and display; payday consistency.
- Settings/widgets: all eight tabs; accent/density/reduced motion; shortcut assignment/reset; rename, hide/restore, edit mode; quick-note persistence.
- Timer: start/pause/stop/reset (ordinary same-day path).
- Data: export payload scope, rejection of malformed imported collections, cross-window task refresh.
- Validation and production frontend build pass.

Not simulated: real pointer resize/reorder across every widget, every native pop-out, sleep/resume and midnight timing, successful native backup restore, live weather outages, installer failure/rollback, full storage/quota errors, or all mobile layouts. The automated drag test exercises the actual handler rather than a physical mouse gesture.

## Cleanup performed

Moved to Recycle Bin (recoverable): four Desktop folders for v6.0.2 and old v6.1 updater builds, three corresponding Desktop ZIPs, and the v6.1.0/v6.1.1 installers in Downloads.

Preserved: installed DOM.OS 6.1.2, current Git source project, app profile/data, backups, and both release-signing files. Signing files were byte-for-byte matched to the current project before recycling the old build folder. Windows lists one installed DOM.OS version. Git history and current development dependencies remain needed for maintenance.
