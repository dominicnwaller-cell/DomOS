> Public technical reference. All profile names, locations and financial illustrations below are generic synthetic examples. Private source material and evidence remain local.

Absolutely. I’d now lock **DOM.OS 6.2.0 — Life Tracking Core** as the next major release, with the second concept image as the visual reference.

The important shift is this:

> **6.1.x built the app. 6.2 builds the model of the person using it.**

DOM.OS should stop being a collection of productivity modules and start understanding the relationship between **time, actions, money, habits and long-term direction**.

The current stable baseline is v6.1.3. Its release already contains the updater, refreshed UI, inline update progress, finance/work deadline fixes and stronger data handling.

---

# DOM.OS 6.2.0 — Master Product Specification

## 1. Product principles

Everything in 6.2 should follow five rules.

**Simple surface, deep system.** The Dashboard stays calm. Complexity belongs inside dedicated pages.

**One source of truth.** Today, Schedule, Calendar, Work Timer, History and Weekly Review must derive their information from the same underlying records rather than maintaining separate versions of reality.

**Planning and tracking are different.** DOM.OS needs to understand both what you intended to do and what actually happened.

**Everything can have a purpose.** Tasks, routines, habits and work sessions can optionally link upward toward objectives, goals and Life Areas.

**Local-first.** 6.2 does not require an internet account. Your data works completely offline.

---

# 2. Profiles become real

This is now a **mandatory 6.2 feature**, not cosmetic polish.

Your repository is currently public.

And the current source still contains migration code specifically adding a personalised daily routine.

That has to end before DOM.OS becomes something other people could realistically use.

## Fresh installation

A completely clean installation should contain:

**No tasks.
No routine.
No goals.
No finance records.
No personal-location weather setting.
No payday.
No notes.
No user-specific names references.**

Instead:

### Welcome to DOM.OS

Then:

### Create your profile

Fields:

| Setting | Example |
|---|---|
| Name | Example User |
| Avatar | Optional |
| Location | Example City, UK |
| Currency | GBP |
| Payday | 15 |
| Time zone | Automatic |
| Time format | 24-hour |
| Date format | DD/MM/YYYY |
| Week starts | Monday |

Then:

### How would you like to start?

**Start Fresh**

Empty profile.

**Use Starter Templates**

Generic optional templates — never your personal schedule.

**Import DOM.OS Backup**

Restore an existing user.

Then:

### Choose Dashboard layout

**Focused**
Smaller, minimal dashboard.

**Balanced**
The style closest to the current DOM.OS setup.

**Expanded**
More Calendar/Schedule/Goals information visible.

Existing users retain their current layout.

---

# 3. Existing 6.1.3 users get a migration flow, not onboarding

Your upgrade must not wipe anything.

When 6.2 first launches and finds legacy DOM.OS data:

> **Existing DOM.OS data found**

DOM.OS should then automatically:

**1. Create a pre-migration backup.**

**2. Ask the user to name the profile.**

For you:

`Example User`

**3. Create the 6.2 database.**

**4. Import the existing:**

Tasks
Calendar events
Routines
Routine completion state
Finances
Goals
Notes
Quick Note
Dashboard layout
Settings
Payday
Work Timer data
Calendar templates

**5. Validate record counts.**

**6. Mark migration successful.**

Only after verification does DOM.OS switch to the new database.

Legacy data should remain untouched temporarily so we have recovery capability.

If migration fails:

> Migration failed. Your existing DOM.OS data has not been changed.

That is a hard requirement.

---

# 4. Local Profile Manager

The sidebar bottom profile area becomes functional.

Clicking the current profile opens:

```text
Example User
Local Profile

Profile Settings
Switch Profile
Add Profile
Lock DOM.OS

Export Backup
Import Backup

Close Profile
```

### Multiple profiles

Profiles must have completely isolated data.

For example:

```text
Example User
Work
Demo
```

Switching profiles changes:

Dashboard
Tasks
Routines
Calendar
Finances
Goals
History
Habits
Trackers
Notes
Work Sessions

No data leakage between them.

### No cloud login in 6.2

I deliberately would **not** build email/password accounts yet.

A DOM.OS Profile is local.

Later:

```text
Local Profile
      ↓
Connect DOM.OS Account
      ↓
Desktop + Mobile Sync
```

That gives us a migration path to real authentication without making 6.2 dependent on a server.

---

# 5. Proper data foundation — SQLite

6.2 is the point where DOM.OS should stop treating localStorage as its main life database.

Core structured data moves to SQLite.

UI preferences can remain in Tauri Store.

Conceptually:

```text
DOM.OS
│
├── Global App Settings
│
└── Profiles
     │
     └── Example User
          ├── Tasks
          ├── Events
          ├── Routines
          ├── Habits
          ├── Trackers
          ├── Life Areas
          ├── Goals
          ├── Objectives
          ├── Work Sessions
          ├── Finances
          ├── Notes
          ├── History
          └── Reviews
```

---

# 6. Core database model

I wouldn't implement every relationship as one giant table.

The major entities should roughly be:

```text
profiles

life_areas
goals
objectives

tasks
events

routines
routine_steps
routine_step_logs

habits
habit_logs

trackers
tracker_entries

work_sessions

finance_accounts
finance_transactions
finance_budgets
finance_bills
finance_savings

notes

daily_checkins
weekly_reviews
weekly_focus

reminders

schema_migrations
```

Everything user-owned contains:

```text
profile_id
```

That becomes the isolation boundary.

---

# 7. Life Areas

This becomes the top level of the Goals system.

Starter suggestions may include:

**Career
Health & Fitness
Money
Home
Relationships
Personal Growth
Experiences**

But these are editable.

Users can:

Create
Rename
Reorder
Choose icon
Choose accent colour
Archive

The app should never force a specific set.

---

# 8. Life Area progress

The percentage shown on a Life Area needs to actually mean something.

It should be calculated from its active Goals.

Example:

```text
CAREER

Build DOM.OS          70%
Grow Client Work      40%

Area progress         55%
```

Potentially weighted goals later.

No fake arbitrary “life score.”

---

# 9. Goals become considerably deeper

A Life Goal contains:

```text
Title
Description
Life Area
Start date
Target date
Priority
Status
Progress mode
```

Status:

```text
Not Started
On Track
At Risk
Paused
Completed
```

### Progress modes

**Manual**

User chooses percentage.

**Objective Based**

Progress derives from child objectives.

---

# 10. Objectives

This solves the gap between massive goals and tiny tasks.

Example:

```text
Life Area
Career

Goal
Build DOM.OS

Objectives
├─ Release DOM.OS 6.2
├─ Build mobile architecture
└─ Prepare public launch
```

Tasks can belong to an objective.

Work sessions can belong to an objective.

An objective may derive its progress from its linked tasks.

---

# 11. Weekly Focus

Not every long-term objective needs attention every week.

Each week the user can choose:

### This week's focus

```text
Release DOM.OS 6.2
Gym four times
Reduce unnecessary spending
```

This becomes part of Weekly Review and Dashboard context.

It helps connect long-term direction to actual weekly behaviour.

---

# 12. Goal Detail screen

The approved mockup direction stays.

Tabs:

```text
Objectives
Linked Actions
Time
Notes
History
```

### Linked Actions

Shows:

Tasks
Routines
Habits

that support the goal.

### Time

Shows Work Timer sessions connected to it.

Example:

> Build DOM.OS
> 26h 42m tracked this month

That's where DOM.OS starts becoming genuinely interesting.

---

# 13. Unified Daily Timeline

This is one of the most important 6.2 additions.

Rather than creating another disconnected feature, the Calendar gets proper:

```text
Day
Week
Month
```

The **Day view becomes the Unified Timeline**.

Example:

```text
07:00  Wake up
        Routine

08:00  Gym
        Routine

10:00  Walk dog
        Routine

11:00  Office work
        Calendar

13:00  Client project
        Work Task

15:04  DOM.OS development
17:12  Actual Work Session

19:00  Dinner
        Routine

22:00  Sleep target
        Routine
```

The blue “current time” line moves live through the page.

---

# 14. Planned vs actual time

A major 6.2 change.

Suppose:

```text
Client work
Planned: 13:00 – 15:00
```

But Work Timer records:

```text
Actual: 13:14 – 16:07
```

DOM.OS keeps both.

That allows later analysis such as:

> You planned 6h of work today.
> You actually worked 7h 12m.

Do not modify the original plan to pretend reality matched.

---

# 15. Today widget

Today remains an **action widget**, not a giant timeline.

It shows things needing action today:

Routine steps
Habits
Today tasks

Completion updates history.

Ticking something no longer means the evidence disappears forever.

The UI can remove completed items from Today while the database retains a completion log.

---

# 16. Schedule widget

Schedule becomes a compact view of the same unified timeline.

No separate data source.

Clicking a Schedule item opens the underlying:

Event
Task
Routine
Work Session

depending on its type.

---

# 17. Calendar

Month view remains similar to the 6.1 design.

But dots/indicators represent:

Routine
Event
Work Task
Deadline
Review

Selecting a date updates Schedule.

Day view opens the Timeline.

Week view shows a seven-day planning structure.

---

# 18. Work Timer V2

Work Timer becomes proper time tracking.

Controls remain:

```text
Start
Pause
Resume
Stop
Reset
```

But starting work may optionally choose:

```text
What are you working on?

DOM.OS
Client work
Admin
General work

Link task
Link objective
No link
```

---

# 19. Work Session history

Each session records:

```text
Start
End
Duration
Profile
Task
Objective
Goal
Description
```

Example:

```text
09:04 – 11:21
DOM.OS
2h 17m

11:36 – 13:02
Client work
1h 26m
```

Sessions crossing midnight must be correctly attributed to both days for analytics.

---

# 20. Habits become separate from Routines

This distinction is important.

### Routine

An ordered sequence.

```text
Morning Routine
→ Wake
→ Breakfast
→ Gym
→ Shower
→ Dog walk
```

### Habit

A repeated behaviour.

```text
Gym
4 times / week
```

### Task

A one-off action.

```text
Send proposal
```

### Goal

A desired outcome.

```text
Improve fitness
```

### Tracker

A measurement.

```text
Energy: 4 / 5
```

DOM.OS should never muddle these concepts together.

---

# 21. Habit system

A habit supports:

```text
Daily
Specific weekdays
X times per week
X times per month
```

Optional:

Goal link
Life Area link
Reminder
Target quantity

Examples:

```text
Gym
4 / week

Read
20 min / day

Walk dog
Daily
```

History provides:

Current streak
Best streak
Weekly completion
Monthly completion

But streaks should not dominate the experience.

---

# 22. Personal Trackers

Trackers record measurements without turning them into tasks.

Types:

```text
1–5 scale
Number
Duration
Counter
Boolean
```

Starter examples:

```text
Mood
Energy
Stress
Sleep
Weight
Water
```

Users can create anything.

No medical interpretation.

Just tracking.

---

# 23. History becomes a proper page

Add:

**History**

to navigation.

Choose a date:

### Sunday 4 October 2026

Then display:

```text
Routine
10 / 13 completed

Habits
3 / 4

Work
6h 31m

Tasks
4 completed

Spending
£25.00

Goals contributed to
Build DOM.OS
Improve Fitness

Trackers
Mood      4 / 5
Energy    3 / 5
Stress    2 / 5
```

This is the moment DOM.OS stops being only a planner and becomes a **life tracker**.

---

# 24. Daily Shutdown

Optional guided flow.

The app can remind the user near the end of the day.

### Step 1 — Review

Show what was completed.

### Step 2 — Check in

Optional:

```text
Mood
Energy
Stress
```

### Step 3 — Reflection

Optional text:

> What went well today?

> Anything worth remembering?

### Step 4 — Tomorrow

Carry forward unfinished tasks or intentionally leave them unscheduled.

No guilt language.

No forced completion.

---

# 25. Weekly Review

This becomes a flagship feature.

Example:

### Week: 28 Sep – 4 Oct

```text
ROUTINE
82%
46 / 56 steps

WORK
36h 14m

TASKS
18 completed
3 carried forward

SPENDING
£200.00
Within budget

GOALS
5 contributed to
```

Then:

### Highlights

```text
4 gym sessions
Most productive day: Tuesday
Longest focus session: 2h 22m
```

### Next Week

```text
2 deadlines
Dentist Wednesday
Payday in 24 days
4 planned gym sessions
```

### Weekly Focus

Choose the 1–3 objectives that matter most next week.

---

# 26. Statistics and Insights

6.2 should collect the data.

It should **not try to become an AI life coach yet**.

Basic statistics are fine:

```text
Routine completion trend
Work hours
Habit consistency
Task completion
Spending
Goal contributions
Tracker averages
```

More advanced relationships belong in 6.3.

Examples later:

> Your energy tends to be higher on gym days.

> Your longest focus sessions usually occur before noon.

But 6.2's job is to capture reliable data first.

---

# 27. Notification engine

All reminders run through one system.

Sources:

```text
Calendar event
Task deadline
Routine
Habit
Work Timer
Daily Shutdown
Weekly Review
Custom Reminder
```

A notification can be:

OS notification
DOM.OS toast
Optional animation

---

# 28. The dog animation survives

Your original dog-walking idea actually fits perfectly here.

A Routine step may optionally have:

```text
Reminder style:
Standard
Persistent
Animated
```

For Walk Dog:

> 🐕 Time to walk the dog

with the optional little animated dog walking across DOM.OS.

But animations respect:

**Reduce motion**
**Disable animations**

settings.

---

# 29. Dashboard remains restrained

Do **not** add a History widget, Habit widget, Tracker widget, Weekly Review widget, Life Area widget and ten other things by default.

We keep the philosophy we already established.

Default Balanced Dashboard could remain roughly:

```text
Today
Schedule
Calendar

Finances
Life Goals
Work Deadlines
```

Work Timer can be enabled.

### Focused layout

```text
Today
Next Up
Work Timer
Finances
Upcoming
```

### Expanded

More Calendar / Goals / planning information.

Everything remains customizable.

---

# 30. Mobile rules begin now

Every 6.2 UI component must support eventual phone layout.

Desktop:

```text
Sidebar | Main Content
```

Phone:

```text
Main Content

Home | Calendar | + | Tasks | More
```

Rules:

Touch targets minimum ~44px.

No essential hover-only controls.

Widgets stack cleanly.

Tables become cards.

Drawers become bottom sheets/full screens.

Drag-and-drop always has a tap-based alternative.

Quick Note becomes Quick Capture.

---

# 31. Quick Capture

This could later become extremely useful on mobile.

A single `+` opens:

```text
Task
Expense
Calendar Event
Note
Tracker Entry
Start Work
```

Desktop can eventually use the same command palette.

---

# 32. Backup format

6.2 backup needs to encompass the entire profile/database.

I'd introduce:

```text
DOM.OS Backup
.domosbackup
```

Internally containing something like:

```text
manifest.json
profiles.json
data.json
settings.json
```

or equivalent database-safe representation.

Manifest records:

```text
DOM.OS version
Backup format version
Created date
Profile IDs
Database schema version
```

Import must validate before overwriting anything.

A restore should create a rollback backup first.

---

# 33. Settings additions

Profile settings now include:

### Profile
Name
Avatar
Location
Currency
Payday

### Appearance
Existing 6.1 controls

### Dashboard
Presets + widget controls

### Calendar
Week start
Default view
Working hours

### Tracking
Daily Shutdown
Weekly Review
Habit settings

### Notifications
Global enable
Routine reminders
Deadlines
Break reminders

### Data & Backup
Automatic backup
Export
Import
Database status

### Updates
Existing 6.1.3 updater design

### About

Existing page.

---

# 34. Security

For 6.2:

**Local profile isolation** is real.

Optional **App Lock/PIN** can prevent casual access.

But I would not falsely market the PIN as full database encryption.

Later we can add stronger encrypted credential storage and secure cloud authentication.

---

# 35. Public repository strategy

I wouldn't change this during the feature build without planning it carefully.

Right now the public repository also hosts the files used by the updater.

Making it private abruptly could interfere with public update downloads.

Long-term, if DOM.OS becomes commercial/closed source, I'd split it:

```text
Private:
domos-app

Public:
domos-releases
```

The public repo would contain:

```text
latest.json
installer
signature
release notes
```

but not source.

If you eventually decide to open-source DOM.OS instead, we intentionally choose a licence.

That is a **pre-public-launch decision**, not something we need to settle in 6.2.

---

# 36. Code architecture also needs improving

I would not put all of this back into another gigantic `index.html`.

6.2 should include a **controlled modularisation**, not a total rewrite.

Something like:

```text
src/
  app/
    bootstrap.js
    router.js

  data/
    database.js
    migrations.js
    backups.js

  features/
    profiles/
    dashboard/
    calendar/
    timeline/
    tasks/
    routines/
    habits/
    goals/
    worktimer/
    finance/
    history/
    reviews/
    notifications/
    notes/
    settings/

  styles/
    tokens.css
    layout.css
    components.css
```

Existing functionality gets moved gradually.

Do **not** rewrite DOM.OS from scratch.

---

# 37. Build phases

This is how I want DOM.OS_CU to tackle it.

### Phase A — Safety/Foundation

Create:

`dev-v6.2.0`

Audit current 6.1.3 data.

Add automated migration tests.

Introduce modular structure.

No user-facing changes yet.

---

### Phase B — Profiles + Database

SQLite.

Profile model.

Fresh onboarding.

Legacy migration.

Remove personal seed data.

Backup/restore.

Profile switching.

This phase must be rock solid before proceeding.

---

### Phase C — History + Timeline

Completion logs.

Work session logs.

Day History.

Calendar Day view.

Unified Timeline.

Planned vs actual.

---

### Phase D — Life Areas / Goals

Life Areas.

Goal hierarchy.

Objectives.

Linked Actions.

Time contribution.

Weekly Focus.

---

### Phase E — Habits / Trackers

Habit definitions.

Habit logs.

Tracker definitions.

Tracker history.

Charts.

---

### Phase F — Reviews

Daily Shutdown.

Weekly Review.

Historical review browsing.

---

### Phase G — Notifications

Unified reminder engine.

Work break reminder.

Deadlines.

Routine reminders.

Dog animation.

---

### Phase H — Responsive / Polish

Mobile-conscious layouts.

Touch controls.

Accessibility.

Performance.

Animation controls.

---

### Phase I — Release

Migration test using copy of real 6.1.3 data.

Clean-install test.

Multiple-profile test.

Backup recovery test.

Signed build.

6.1.3 → 6.2.0 updater test.

Only then public release.

---

# 38. Release acceptance criteria

I would refuse to call 6.2 finished unless all of these pass.

### Clean install

No Example User data.

Onboarding works.

Profile created.

Starter templates are opt-in only.

### Existing user

6.1.3 data survives migration.

No tasks lost.

No finances lost.

No routines lost.

No goal loss.

No notes lost.

Dashboard preferences retained where possible.

### Profiles

Two profiles can coexist.

Profile A cannot see Profile B's data.

Switching is reliable.

### Timeline

Tasks/events/routines/work sessions appear correctly.

Current time accurate.

Day/Week/Month consistent.

### History

Completions remain visible historically.

### Goals

Life Area → Goal → Objective → Task rel

Reader truncated the final acceptance-criteria section at 20,000 characters. The user's implementation request supplies the binding release gates. The second approved concept image is not present in the reader's attachments and is pending retrieval.
