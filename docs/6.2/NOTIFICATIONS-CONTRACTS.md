# Notifications contracts

Starting checkpoint: `3b5b38b`, `dev-v6.2.0`. One deterministic profile-scoped read model derives reminder candidates from canonical records. No duplicate Tasks or timeline records.

## Identity and durable delivery

Occurrence IDs encode the profile, kind, source ID, civil occurrence date, reminder offset/kind and schedule version without a lossy hash. The native primary-window coordinator owns the active profile and delivery; pop-outs cannot activate or synchronize it. A native thread reconciles every five seconds. Before claiming an alert it verifies the canonical SQLite revision still matches the read model. A profile/source change requires regeneration. Single-instance protection prevents a second coordinator.

Schema 6 preserves migration checksums 1–5. A verified standalone pre-schema backup precedes upgrades. Three normalized profile-scoped tables hold reminder acknowledgements/snoozes, per-source options, and delivery attempts. Native attempt claims are transactionally unique; they do not increment the canonical revision or replace UI data. Settings remain profile state. Background/autostart preferences are installation-specific and are not automatically enabled by restoring a profile.

Snooze only changes reminder state. Dismiss acknowledges a reminder and retains the source obligation. Task Done uses the canonical Task service and durable History. Bills/appointments do not receive fake Task completion actions. Reschedule opens the genuine source editor. UI and Assistant share actions, validation, audit and Undo.

## Dates

Civil dates and schedule clocks use the active profile timezone. Underlying timestamps are UTC. Automatic recurrences choose the earlier DST fold; a nonexistent clock moves to the first valid minute following the gap. Date-only deadlines/bills use 09:00 local. Planned Task dates are separate from explicit deadlines. Routine start alerts are once per civil occurrence, rather than once per step. Flexible quotas do not acquire daily alarms.

## Routing and limits

Focused DOM.OS presents one silent actionable in-app alert and, when automatic sound is enabled, requests one ordinary Windows toast under the installed app AUMID. Unfocused/minimized/tray operation requests a Windows toast. Windows is the sole automatic sound owner in every route. Quiet hours and informational prompts remain in Attention Centre without popup/audio. Native text is generic by default and excludes bill details. Toast activation focuses the existing main window and identifies the occurrence in Attention Centre; it never switches to another profile.

Windows APIs inspected do not establish every Do Not Disturb state. DOM.OS relies on Windows to apply suppression and never forces automatic Web Audio. Test Sound explicitly plays the selected application chime; its volume does not control native toast volume. Quiet hours, informational reminders and catch-up remain silent. A successful native request does not prove physical display or hearing.

SQLite and Windows do not provide one atomic physical-delivery transaction. Claims precede API calls; a crash can leave an uncertain claimed attempt, which is not blindly replayed. Status means an API request, not that the user saw/heard it. No Windows action-button support is assumed. The required action path is click → existing window → Attention Centre/source.

Missed old commitments remain accessible without bursts of sounds. Compatible due reminders form one batch. Priority repeats are explicitly opt-in and bounded at three; ordinary unfinished items are not escalated. True Quit stops the process. Close-to-tray and autostart require explicit installation preferences.

## Unified Ask

The top-left search field and competing search dialog/shortcut were removed. Ctrl+K and Ctrl+Space open the existing Ask interface. Registry autocomplete remains authoritative. Canonical record search includes Areas, Goals, Objectives, Milestones, Tasks, Events, Notes, bills, Habits, Trackers and saved Reviews. Ambiguous record targets yield a picker; ambiguous snoozes require a Centre selection. Unrelated top-right controls stay intact.

## Refinement safeguards

Snoozing a future reminder postpones from the later of now or the original due time. Existing early Snooze state is clamped to that due time. Work break/end identities remain stable across pause/resume and their due time is anchored to canonical segments; elapsed time does not slide the alarm forward. Linked active Work and its planned Task occupy one Now row while preserving separate actual/planned timestamps.

Explicit failed delivery requests receive at most one retry, no sooner than 60 seconds. Retry claims are separately durable and unique. Unknown, claimed, requested and suppressed outcomes never receive this retry. Quiet/informational suppression still applies to retries. No database or coordinator lock is held across Windows focus, resize, hide or presentation calls.

## Focused audio routing and acceptance

The finishing pass enables the same Windows-owned automatic sound route in foreground and background. The simultaneous in-app visual is explicitly silent; there is no second sound owner. One grouped batch makes one native request. Native acceptance is recorded separately from visual acceptance in the durable attempt detail.

An explicit native failure leaves an actionable silent in-app fallback with an honest sound-unavailable warning and retains the existing one-retry/60-second bound. If Windows accepted the request but in-app presentation failed, the accepted request is never retried merely to repair that visual: doing so could sound twice. Unknown/crashed claims are never blindly replayed. OS calls remain outside coordinator/database locks.

Toast activation keeps the active-profile guard. The UI resolves the occurrence to Needs Attention, Upcoming or Snoozed and highlights it. A stale or resolved occurrence explains the current-commitments fallback. Activation never switches profiles or reveals an old profile.

The user confirmed one actual scheduled sound and a Windows popup in the isolated installed application while it was focused at 15:54 on 8 October 2026. Windows DND and physical sleep/wake acceptance require separate evidence; see NOTIFICATIONS-WINDOWS-ACCEPTANCE.md.

Microsoft documents SuppressPopup=true as silent notification-centre delivery. It is not used as an audio-only workaround. Ordinary Windows toast audio remains subject to Windows notification settings, volume, DND and user-configured priority exceptions.


## Windows activation closure pass

Native toasts carry an explicit protocol navigation URI under a scheme derived from the installation identity. The URI contains a canonical profile UUID and a SHA-256 occurrence identifier, not a task title or an executable action. Input is bounded and strictly validated. The single-instance callback forwards valid navigation; cold starts defer navigation until the active profile's canonical candidates have synchronized. A foreign-profile click never selects that profile. Removed/resolved candidates use the existing explicit stale-reminder fallback. No SQLite mutations or completion actions occur from URI activation.

The supported Tauri deep-link registration writes the executable handler for the current installation. Runtime registration is not evidence that an external Windows shell can launch it. The 16:33 real click displayed Windows' missing-app message despite a readable handler key in the Codex process context. External Windows association resolution remains a tested failure until a real click succeeds. The background popup and one Windows-owned sound were separately confirmed by the user; they do not establish navigation acceptance. See the current Windows acceptance report.


Final closure supersedes the intermediate missing-handler failure: an Explorer launch resolved that symptom; supported synthetic already-running and actual cold-start activation now open the exact Centre occurrence, and a foreign-profile URL exposes no records. The physical selected-context result remains separately unverified. See NOTIFICATIONS-CLOSURE.md.
