# Finance Phase 1 — implementation and verification

Starting commit: `c9877e33af7f02d8477bfcf8a5504cab8b5f57e5`, branch `dev-v6.2.0`.
The ending checkpoint is the local Git commit containing this report; its exact hash is returned in the completion message. No push, merge, release, signing or stable installation change is part of this milestone.

## Safety and persistence

The development identifier is `com.dom.os.dev62`; native verification and notification testing have separate identifiers. Native storage derives its root from the identifier's app-data directory. `npm run dev` now explicitly selects the development configuration. All executable builds in this pass use that configuration with bundling disabled. Database tests create UUID-named temporary directories; the existing production database was never opened.

Finance domain version 1 lives in `profile_state` under `lifeos4.financeDomain`, using the existing SQLite schema 6 transactional/revision machinery. This is an intentional profile-level domain migration, not a rewrite of the database or application. The document owns the accounts, ledger, recurring rules, occurrence exceptions, allocations, balance observations and operation identities. Amounts are strict integer GBP pennies. Native validation independently checks identities, ownership, amounts, dates, posting boundaries and settlement references.

Before the first Finance cutover, native persistence creates and verifies a `pre-finance-v1` backup. The canonical document is committed in one SQLite transaction. Raw legacy Finance tables remain unchanged and subsequent compatibility-bridge writes to them are rejected in JavaScript and native persistence. Profile-settings writes cannot bypass the Finance boundary.

Legacy account snapshots become unverified opening positions. Existing transactions remain historical/non-posting; missing account references are explicit. Unsupported credit positions remain visible but are excluded from cash calculations. Invalid values and ambiguous non-GBP legacy records are preserved in a visible review collection. Legacy bill paid flags, budgets and savings progress create neither assets nor expenses nor automatic commitments. Migration is idempotent. Restore/import validates the domain and rebinds profile ownership inside the destination transaction; invalid restores retain the saved state and rollback backup.

## Components and services changed

- `src/application/finance.js`: migration, validation, ledger, reconciliation, recurrence, protection, forecasts and action planning.
- `src/application/services.js`: shared profile-scoped Finance dispatch, persistence, compatibility projections and Undo.
- `src/app/finance-ui.js` and `finance.css`: Finance workspace, quick-entry forms, account history, commitment management, catch-up, forecasts and responsive styling.
- `src-tauri/src/finance_validation.rs` and `database.rs`: native ownership/money/reference validation, verified cutover backup, immutable legacy bridge, revision checks and transactional restore/import.
- `src/assistant/finance-commands.js`, action registry and command bar: registered Finance commands, autocomplete and shared validated actions.
- Bootstrap, dashboard, History, Daily/Weekly Reviews and JavaScript/native Notifications: canonical Finance selectors and obligation source identities.
- `scripts/test-finance.mjs`, `scripts/test-finance-ui.mjs` and native database tests: adversarial domain, UI, migration, rollback and isolation coverage.

## Delivered behaviour

- Existing seven Finance tabs remain. The main replacement is the financial behaviour beneath them.
- GBP cash/current/savings accounts, preserved openings, ledger-derived balances, archival/restoration, account histories and configurable receiving/spending purposes. No financial rule depends on the names Halifax or Monzo.
- Exact-penny income/expense entry, single linked atomic transfers, explicit historical capture, retained reversals/corrections, optional descriptive fields and request-ID retry protection. Imported history can be corrected or excluded with confirmation while retaining the original record and leaving opening balances unchanged.
- Check Balance records posted/booked versus available observations, comparison amount/time and discrepancy. Reconciliation requires confirmation and creates an unexplained adjustment. Partial/full explanation replaces that adjustment atomically while preserving the confirmed balance. Backdating across an opening or verified balance is guarded.
- Monthly income on the intended 27th with preceding-Friday adjustment, four-weekly schedules anchored explicitly to 1 October 2026, and general independent schedules. Templates are user-invoked, require amounts/accounts, and never create historical receipts. Individual exceptions do not shift later dates.
- Monthly, weekly, four-weekly, quarterly, annual and one-off obligations. Future occurrences are generated over bounded windows; only exceptions/settlements are persisted. Real payments/receipts can be created or matched. Partial settlement, corrections, reversal, cancellation, skipping and rescheduling preserve consistent outstanding amounts. Past materialized amounts are preserved when a rule's future amount changes. Bill reminders can be disabled independently; income schedules do not create bill alerts.
- Protected allocations distinguish independent reserves, essentials, buffers and linked bills. Bill reserves cover their obligations once; payments reduce the coverage. Savings progress and budget targets are not deducted as additional cash. Essentials periods do not stack indefinitely after inactivity.
- Signed, account-specific Available to Transfer estimate with a configurable 30-day default horizon, current recorded cash only, explainable commitments, overdue coverage, verification freshness and setup gaps. Provisional figures are explicitly labelled; shortfalls remain negative.
- Separate conditional cash-flow forecasts, conservative same-day payment ordering, remaining essentials assumptions, account shortfalls and non-posting spending/transfer scenarios.
- Finance Catch-up, legacy review, fast entry and explicit next actions. Scheduled dates never post activity automatically.
- Dashboard, Ask DOM.OS, History, Reviews and Finance Notifications share canonical selectors. Assistant actions retain confirmation, audit and Undo. GBP records remain GBP when profile display currency changes. Native reminder source validation recognises canonical obligation identities and suppresses settled/cancelled sources.

## Verification

The consolidated run passed 483 JavaScript/regression checks (including 41 Finance domain checks with the real fixture and 10 Finance UI checks), 46 native tests, static validation, frontend production compilation and the isolated development executable build. There were zero failed tests. Native tests include real 6.1.3 legacy import and real Finance cutover, with source-byte preservation, transactional rollback, immutable legacy records, stale revisions, profile isolation, backup round-trip and imported-profile ownership rebinding. See the final completion message for exact test totals and the isolated executable build result.

The real backup is read through `DOMOS_MIGRATION_FIXTURE`; its Finance conversion is passed to native disposable tests through `DOMOS_FINANCE_NATIVE_FIXTURE`. Neither private fixture nor temporary databases are committed. Without these environment variables, the private-fixture checks do not execute; generic acceptance tests remain runnable.

Commands:

```text
npm run validate
npm test
cargo test --lib --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --config src-tauri/tauri.dev62.conf.json --no-bundle
```

## Deliberate limits and release gates

- GBP and cash facilities only. Credit facilities, bank connections, OAuth, synchronization and business invoicing remain outside scope.
- Available bank balances are informational, not silently interchangeable with posted ledger balances. Unexplained differences and uncertain bills remain explicit.
- Forecasts depend on manually recorded assumptions; they are not affordability guarantees. Recurrence/older-obligation analysis has a 20,000-occurrence safety bound; exceeding it leaves a visible review gap and prevents readiness.
- Finance is stored as one validated profile document. Very large imported histories may eventually justify row-level persistence/indexing. Obsolete Finance Undo snapshots are reduced to metadata when subsequent financial activity makes them unsafe; durable ledger corrections/reversals and operation/audit history remain. Undo of the current financial action refuses intervening changes.
- Concurrency conflicts fail visibly with retained recovery data; the app does not silently merge competing financial edits. Each Finance document carries a monotonic revision, independently enforced by native persistence. Forms capture this revision and reject stale submissions while retaining typed input; operation retries still return the original result.
- No failing automated cases remain. Vite reports a roughly 501 kB JavaScript chunk warning; compilation succeeds, and code-splitting remains a later performance improvement.
- No interactive Windows Finance walkthrough or new Finance toast click-through was claimed in this pass. UI wiring was tested automatically; Windows-specific Finance display/activation remains a release smoke check. Production packaging/signing and the real stable-to-6.2 in-app update remain release-only gates.

Stable executable baseline and post-check SHA-256:
`7FD9A1A09EC7471FE8CC324F525E7E98355679D2694D333BDE363F56D4636C7F`.
Main baseline: `85e9f59c32a2a71570b121787bcd27155c581b9c`.
