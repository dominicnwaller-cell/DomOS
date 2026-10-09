# Review milestone contracts — 8 October 2026

Starting state: clean dev-v6.2.0 at e6bec7d; previous milestones verified. No main/stable/release changes.

Reviews and summaries are independent. Summaries are lazy canonical queries; rollover writes no metric snapshots or review rows, stops no sessions and opens no modal. Date reconciliation runs on startup, profile activation (fresh boot), native focus, DOM focus/pageshow/visibility and every 30 seconds. Tauri API 2.12.1 exposes onFocusChanged; there is no reliance on standard suspend/resume events as Windows wake notifications. Existing Intl utilities are already used by this Windows WebView app. Physical OS sleep/wake remains an acceptance item, not a simulated test claim.

Daily identity is profile + localDate. On first deliberate start, original timezone/start/end instants are retained forever. Weekly identity is profile + civil week start + timezone + configured week start. Changing settings may create a distinct new weekly period; old rows are always opened by id with their original boundaries. No overwrite or merging. Half-open ranges use tested local midnight utilities, including 23/25h DST days.

Existing Weekly Focus already persists a week date and weekStart, so no historic priorities are fabricated or retrofilled. Existing known period selections remain evidence even after removal/completion. Original timezone of older Focus records is unknown and is not invented. New selections additionally store timezone and exact period bounds. Explicit carry-forward creates an independent next-period selection and preserves the older row. No automatic focus rollover.

Legacy task date is a scheduled date; it is not converted into an invented deadline. Explicit deadline/dueDate is preserved. The shared task service now accepts an optional deadline. Reviews reschedule through that same task service and retain deadlines. No entire Task rewrite.

Daily/weekly work uses canonical sessionSlices. Spending excludes transfers and scheduled bill definitions. Ratings average the observed daily aggregates equally; missing days are excluded. Habit schedule/quota calculations reuse Tracking services. Historical plans cannot be reconstructed reliably, so no historic planned-versus-actual score is shown. Routine totals describe currently defined occurrences, not an invented historical original plan.

Historical check-in requires explicit attribution. Tracker entries retain recordedAt, appliesToDate and attributionTimezone in addition to their measurement timestamp. Explicit attribution stays on its selected civil day after timezone changes. Submission tokens prevent accidental double submission; separate tokens permit multiple legitimate entries.

Schema 5 extends dailyReviews/reviewAcknowledgements and adds unique review indexes. Legacy weeklyReviews without period metadata remain preserved; they are not silently treated as a verified period. Revision-checked atomic commits plus database uniqueness prevent duplicate concurrent opens; conflict rejects rather than replaces another window's edits. Period identity is immutable on normal commit; deliberate confirmed backup restore may restore prior records. Versions 1–5 remain supported for backup reads. Prior migration checksum definitions are unchanged.

Historical Work correction is limited to stopped canonical segments. It retains identity/links/breaks and rejects future/overlapping intervals. Local wall times must resolve to real instants; repeated DST times require an explicit earlier/later choice. Unchanged timestamps preserve their exact underlying seconds. Invalid correction feedback remains visible within the modal.

Before an existing SQLite schema upgrade, VACUUM INTO creates a consistent standalone pre-migration backup, including committed WAL state. Quick-check and original version are verified before transactional migration. Failure retains original records/version and the recoverable backup. New review metadata is validated natively for period/lifecycle/date/key consistency; legacy weekly rows without trustworthy identity remain preserved.
