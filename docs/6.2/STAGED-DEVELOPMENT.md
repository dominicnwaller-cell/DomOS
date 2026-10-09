# Staged development — 5 October 2026

## Current checkpoint — Notifications finishing pass — 8 October 2026

Finishing pass from `36135a1`: one Windows-owned automatic sound route in foreground/background, silent actionable in-app visual, safe native-failure fallback and partial-success deduplication, exact occurrence/category click routing and final responsive/Ask captures. **427 JS checks, 36 Rust tests, 61 actual native integration checks pass**, plus migration/profile foundation suites and frontend/native/package builds. Main/stable unchanged; nothing published.

Human-confirmed scheduled foreground popup/one sound, DND suppression with original setting restored, and short actual Sleep/no sound burst. Post-wake tray reminder reaches Notification Centre and same process/window restores. **Background/tray banner/audio, actual native click-through, instrumented long-sleep catch-up, overnight Review/day rollover and production signing/update remain gates. Implementation complete; Windows acceptance incomplete; not release ready.** See [current evidence matrix/completion report](NOTIFICATIONS-WINDOWS-ACCEPTANCE.md). STOP before Finance Readiness.

Earlier entries below are historical checkpoints; earlier focused-audio suppression and interrupted final recapture are superseded.

## Current checkpoint — Notifications — 8 October 2026

Notifications & Intelligent Resurfacing development checkpoint: schema 6, central canonical profile reminders/durable claims, Now & Up Next, Attention Centre, Snooze/Dismiss/Undo, native Windows routing, quiet settings/tray controls and unified Ctrl+K Ask/search. Validation: 424 counted JS checks plus migration/profile/window suites; 31 Rust checks (24 database/7 delivery policy); 61 isolated native integration checks. Real 6.1.3 fixture and backup/restore/rollback pass. Packaged synthetic Windows requests, audible explicit Test Sound, Snooze/restart/grouping/tray and 600px visual checks have evidence.

**Outstanding release gates:** focused automatic audio has a meaningful awareness gap; native Windows toast display/hearing/click-through and real OS sleep/wake are not verified. Safe foreground Windows-owned delivery is assessed but not enabled here. Production signing/in-app update remains a separate gate. See [full completion report](NOTIFICATIONS-STATUS.md), [contracts/audio assessment](NOTIFICATIONS-CONTRACTS.md), [manual matrix](NOTIFICATIONS-MANUAL-ACCEPTANCE.md) and [visual review](NOTIFICATIONS-VISUAL-REVIEW.md). Main/stable/publication unchanged. **STOP before Finance Readiness.**

Earlier entries below are historical checkpoints.

## Current checkpoint - 8 October 2026

Daily + Weekly Review milestone passes: automatic date reconciliation, lazy canonical summaries, optional reviews/Tracker check-in, relevant task decisions, historically scoped Focus and explicit next-week planning, Dashboard/History/local Assistant/search integration and schema 5 with verified pre-upgrade backup. Validation: 373 counted JS checks plus migration/profile/window suites, 21 database tests with real 6.1.3 backup, and 53 isolated native checks. Frontend/native development builds and manual visual review pass; all 14 requested screenshots are saved. Physical Windows sleep/wake remains UNVERIFIED. See [milestone report](REVIEWS-STATUS.md), [acceptance](REVIEWS-MANUAL-ACCEPTANCE.md) and [visual evidence](REVIEWS-VISUAL-REVIEW.md). Main/stable/publication unchanged. STOP before Notifications, Finance stabilisation or wider refinement.

Earlier entries below are historical checkpoints.


## Current checkpoint — 6 October 2026

Habits + Trackers milestone now passes: SQLite schema 4, shared profile services, functional Tracking screens, canonical Routine/History/Today integration, Goal support links, local Assistant commands/autocomplete and calendar-week summary services. Final refinement and sample native screenshots are complete. Validation: 300 counted JavaScript checks plus migration/profile/window suites, 15 database tests with the real backup and 40 native checks; frontend and native development builds pass. See HABITS-TRACKERS-STATUS.md and HABITS-TRACKERS-VISUAL-REVIEW.md for scope and limits. Main, installed stable and releases unchanged. STOP before Daily Shutdown / Weekly Review UI.

The sections below preserve earlier milestone reports. Their earlier stop points and test counts are historical.


DOM.OS carries organizational work for the user: capture first, organize later; calm surfaces; clear next actions; recovery instead of punishment. No medical claims, cloud AI, accounts, synchronization, autonomous behavior or mobile app in these stages.

## Stage 1 — passed

The isolated `com.dom.os.nativeverify` build uses synthetic UUID profiles and actual Tauri commands, existing UI, SQLite adapter, pop-out windows and event synchronization. It cannot write the installed stable or development databases. The verification reporter rejects every other application identifier. Normal production builds omit the test frontend.

Nine native checks passed: export/restore round trip; invalid/corrupt restore rollback; restore isolation; backup import into a new UUID; pop-out creation/profile context; a real pop-out quick-note UI edit persisted and reflected in the primary window; draft rejection; acknowledged safe closing; different-profile pop-out isolation and primary context preservation.

Two defects were corrected: pop-out activation no longer changes the primary profile pointer; remote snapshot refresh dispatches each changed storage key so the appropriate UI refreshes. Profile metadata is refreshed alongside its data.

Regression suite: 68 passed. Database suite: 10 passed, with the real 6.1.3 fixture supplied. Additional migration, profile adapter, fresh-profile and window safety suites passed. Validation and isolated native build passed.

Native proof: `%USERPROFILE%/AppData/Roaming/com.dom.os.nativeverify/native-verification.json`. The earlier real native migration check verified five original records and all 22 raw backup keys, unchanged source bytes and persistence across restart.

## Stage 2 — passed

Shared application services require an explicit matching UUID profile context. Existing UI collection saves validate through these services; timer controls and Local commands use the same semantic actions. Experimental Ctrl+Space supports conservative local commands, navigation, capture, result, confirmation and Undo. Local works; Gemini, Ollama, Groq and OpenRouter are inactive provider placeholders with no keys or external calls.

Destructive actions and large/bulk changes require a preview. Backup imports/restores require explicit confirmation. Assistant audit events and action undo persist with domain changes in the same profile batch. Audit stores parsed actions/results, never hidden reasoning. Undo rejects newer substantive edits and accepts SQLite object-key normalization. Reads preserve capture drafts.

Validation: 29 assistant/service tests, 68 existing regressions, all migration/adapter/profile/window suites and 12 database tests passed, including the real 6.1.3 fixture. The isolated native run passed 14 checks on 5 October, including actual command-bar expense/Undo, destructive cancellation, shared UI services and profile rejection. Native build passed.

Technical debt: the preserved legacy UI uses a compatibility bridge rather than a full view rewrite. Undo guards whole changed collections, so unrelated later edits can conservatively prevent Undo. The parser deliberately supports a small grammar. Work Timer remains compatible with V1 until durable linked sessions in Stage 3. Production signing/update verification is still a release gate.

## Stage 3 — functional first milestone

Completion transitions from preserved UI saves and semantic assistant actions now append durable profile-scoped history in the same commit. Undo records reopening rather than erasing completion evidence. Source deletion retains the recorded title/date. Existing completed tasks without a completion timestamp do not receive invented historical dates.

Work sessions persist linked task/goal/objective IDs, status and actual running intervals. Pause/resume excludes breaks; restart retains the session; Reset requires confirmation and retains the session history. Previously recorded V1 aggregates remain intact: only a migrated timer's known live interval can become an actual interval. Past manual session logging validates intervals/overlap through the shared service; there is not yet a dedicated logging form. The timer widget can link a session to an existing task.

Calendar Day/Week views derive events, dated tasks/deadlines, routine steps, work intervals and reminders directly from core collections. Planned and actual times remain separate. Local midnight splitting uses the profile time zone and handles DST. A live current-time marker refreshes each minute. Month preserves working drag/drop and templates and adds unified item/actual-time summaries with access to Day. This is a functional first pass, not the final hour-grid/detail-pane layout in the approved visual concept.

History supports selecting a day and reading completion/reopening evidence, events, actual work, spending, habits and tracker logs. Tasks offer a calm review of earlier unfinished items with Move to Today, Reschedule and No longer needed; actions preserve history and offer Undo. Nothing is automatically rolled forward or archived. Reminder records support dismiss/snooze through the service. Notification generation/delivery comes later.

A native stress run caught a self-event snapshot race. The adapter now waits for pending persistence and rejects older or foreign-profile snapshots; newer local revisions cannot be replaced by old native event responses. A regression test covers this ordering.

Validation: 27 life-tracking tests, 29 assistant/service tests, 68 existing regressions, all migration/profile/window suites, 12 database tests with the actual 6.1.3 fixture, and 19 isolated native checks passed. Native checks include durable UI completion, linked paused/resumed sessions, Day/Week/Month controls, History, tracking backup round trip and profile isolation.

The subsequent refinement below supersedes the first milestone's timezone and hour-grid/detail-pane limitations. Richer History filters/net-completion statistics, dedicated past-session entry, the remaining life-tracking screens and final release gates remain pending.


## Timeline refinement — passed, before Life Areas design

Continued from ca33e46 on dev-v6.2.0. Main, installed stable application and public releases remain unchanged. No new Life Areas/Goals/Objectives system was started.

A shared profile clock now supplies Today, civil labels, actual timestamp labels and timer day boundaries. History regroups timestamped task evidence under the active profile timezone without rewriting stored timestamps. Routine completion keeps its explicitly selected occurrence date. Plans and finance transaction dates remain civil dates. Calendar Day/Week/Month, current-time indicators, assistant actions, legacy editors and timer queries agree on the profile day; a missing profile timezone falls back to the computer timezone. Actual work intervals are clipped at profile midnight, including 23/25-hour DST days and non-hour offsets. Offset labels distinguish a repeated hour. Manual past intervals require explicit ISO offsets and are stored as UTC.

Timer totals derive from persistent sessions rather than resetting paused overnight work. Startup rendering no longer destroys older legacy aggregates before service installation. V1 aggregate time is retained as a date-only baseline, with no fabricated interval or historical timestamp. Reset changes the visible timer counter while preserving full actual session history and query totals. Baseline time cannot be positioned in the timeline because the original source has no interval timestamps.

The new Calendar and History surfaces use restrained dark headers, green borders, accessible focus states and responsive layouts. Day has a 24-hour grid with separate planned/actual columns, overlap lanes, a live indicator and functional item details. Week presents coherent daily columns; Month retains templates and drag/drop, with correct configured week starts and actual-time summaries. Recovery is a calm collapsed review, five items at a time; reschedule/archive/Move to Today and Undo remain real profile-scoped actions. Unrelated stable screens retain their visual design.

Experimental Ask DOM.OS uses one Local action registry for parsing, dropdown suggestions, aliases and ghost completion. Up/Down selects; Tab or Right at the end accepts; Enter runs completed input (incomplete detail captures are filled first); Escape dismisses suggestions before closing the bar. Space accepts only a unique incomplete prefix; ambiguous prefixes and normal detail typing retain literal spaces. Acceptance keeps input focus and appends the detail-capture space. Shift/IME input is respected. Draft navigation closes the bar and focuses the existing editor. Shared action validation, confirmations, guarded Undo, profile isolation and durable audit remain intact. No external provider is enabled.

Validation: 38 refinement tests, 27 tracking tests, 29 assistant/service tests, 68 existing regressions, all migration/profile/adapter/window suites, 12 Rust database tests with the real 6.1.3 backup fixture, and 23 isolated native checks passed. The 38 refinement tests also passed with host TZ Pacific/Honolulu and Asia/Tokyo. Native checks cover backup/restore rollback, pop-out synchronization/isolation, autocomplete execution/Undo, UTC preservation, the hour grid, desktop detail positioning and Month drag targets. Native keyboard and visual checks used the isolated test application. Validation, frontend and native development builds passed; normal builds omit the test harness.

Remaining compromises: Undo guards entire changed collections and can conservatively refuse after unrelated later edits; the compatibility bridge and preserved editors remain. The timeline uses a civil 24-hour visual axis, with explicit offsets for intervals crossing a repeated DST hour; actual durations use elapsed timestamps. This checkpoint is not a signed production release or an actual installed 6.1.3-to-6.2.0 update test. Life Areas/Goals/Objectives await the product-chat design before further development.


## Life Areas / Goals / Objectives — approved milestone, 6 October 2026

Continued from 95402ea on dev-v6.2.0 after product approval. Earlier statements deferring this system describe the previous checkpoint and are superseded by this milestone. Intermediate checkpoints: e1681b2 (schema), 40d1d1c / 1ef9e20 (services and transactional relationship validation correction), d536aa0 (UI and cross-app integration). Main remains at 85e9f59c32a2a71570b121787bcd27155c581b9c; no push, merge, publication or installed-stable modification.

Schema 3 adds profile-scoped check-ins, action references, related Areas, Milestones and Goal activity. It promotes retained extension entities transactionally and preserves schema 1/2 checksums. Native transactions validate references within the profile, including Objective parent consistency and backup restore. Existing entity tables and lossless legacy capture remain intact.

The shared service layer handles Area/Goal/Objective changes, progress, reference links, work linkage, Milestones, Notes and Weekly Focus. Completion history snapshots the Goal/Objective contribution, retaining evidence after source removal. Undo restores domain values while retaining original Goal activity and adding undo evidence. Archive keeps all linked actions, time, Notes, Objectives, Milestones and history. No historical date or Area is invented for legacy goals.

Life Areas include ordered cards, appearance/vision editing, archive/restore, primary-only statistics, related Goals, activity/time and optional 1–5 check-ins. Goal creation asks only title, Area and type. Goal Detail offers Overview, Actions, Progress, Time, Notes and History. Objectives remain optional; Milestones sit alongside them. Existing records can be linked or created atomically without copies. Habit/Routine contribution to percentages requires explicit configuration. Numeric targets support starting/current/target values, units and decreasing targets. Ongoing activity does not imply a completion percentage.

Time uses existing actual intervals and profile timezone boundaries; Objective time rolls up once. Weekly Focus stores the week and configured week start, allows up to three active items and provides deliberate Continue/Done/Remove. Dashboard and Today resurface these references without generating tasks. Dashboard ordering considers Weekly Focus, active Goals and Goal/Objective deadlines. Ctrl+K finds Areas, Goals, Objectives and Milestones. Local Goal commands and autocomplete use the same Assistant registry, service validation, confirmations, Undo and audit. No external provider calls or API keys were introduced.

Validation: 42 Goal service and 16 Goal UI/integration tests; 38 refinement, 27 tracking, 29 assistant and 68 existing regression tests; migration/profile/adapter/fresh-profile/window suites; 14 Rust database tests with the real backup; 32 isolated native checks. Native verification includes all previous 23 checks plus actual SQLite Goal creation, Objective/task completion, numeric/ongoing rendering, single work rollup, dashboard/Today focus, search, command autocomplete/audit, Milestones/Notes/check-ins/archive/Undo and schema-3 backup isolation/corrupt-restore rollback. Proof remains at %USERPROFILE%/AppData/Roaming/com.dom.os.nativeverify/native-verification.json. Validation, frontend and native development builds passed; ordinary builds omit the test harness.

Known limits: automatic progress equally weights measurable Objectives and direct completion actions, excluding unmeasured sources with an explanation; statuses remain user-controlled. Legacy Goals can remain unassigned until edited. Undo guards whole changed collections and can conservatively reject after unrelated edits. Entity records remain JSON within SQLite tables with service validation and transactional relationship checks, rather than a rewrite into fully normalized columns. Permanent deletion is available only for empty archived records via confirmed services; archive is the UI path. Goals can create/link/log supporting Habit records, but dedicated Habits/Trackers screens await approval. Final manual visual spot-check could not continue because the isolated window was minimized; automated native rendering checks passed, but full screenshot-concept conformance is not asserted.

The installed stable application was not altered. Production signing, production clean-install/migration and actual in-app update remain release gates. Stop before Habits/Trackers product design.


## Goals visual refinement — 6 October 2026

Continued from e566b7e. Changes are confined to milestone UI/CSS, Assistant autocomplete ghost rendering and tests/documentation. Services, database schema, progress/time calculations, Focus rules and persisted relationships are unchanged.

Responsive Area cards now have bounded grid widths, icon/accent, singular/plural counts and actual Focus context. Area Detail uses a compact grouped header and desktop Goals/This Week columns with a full-width activity list, collapsing at narrower widths. Goal headers group metadata and actions with quiet Archive treatment; the title anchors the page. Empty progress is a single calm explanation, with Automatic/Numeric/Manual choices in Progress. Metrics, Focus context, modal labels, secondary text and keyboard focus states are clearer. Dashboard Add Goal follows the scoped dark button system. Empty Ask input no longer paints ghost completion over its placeholder; the registry and keyboard behaviour remain intact.

Save notices sit compactly at the lower right. Success with Undo dismisses after 12 seconds, other messages after 6 seconds; hovering or keyboard focus defers expiry. Dismissal does not remove persisted Undo records. No collection/history/audit behaviour changed.

Validation: all existing suites passed: 42 Goal services, 23 Goal UI/integration (7 added checks), 38 refinement, 27 tracking, 29 assistant, 68 regression, migration/profile/adapter/fresh-profile/window suites, and 14 Rust database tests with the real 6.1.3 backup. The final isolated native run passed all 32 checks. Validation, frontend and ordinary native development builds passed. The ordinary build excludes the verification harness.

Desktop native screenshots were compared against the e566b7e set. The white Add Goal button, ghost/placeholder overlap, stretched Area cards, scattered headers and small milestone captions are corrected. Fresh screenshots and review limits are recorded in GOALS-REFINEMENT-REVIEW.md. The screenshots use the same labelled sample records in the separate Clean Install Test development profile; zero Time and unmeasured progress are genuine states. Exact screenshot-concept matching, a broad device/accessibility audit and production signing/updater gates remain outside this focused pass. Main, installed stable and public releases remain unchanged. Stop before Habits/Trackers.
