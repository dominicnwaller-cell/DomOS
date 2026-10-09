# Finance Phase 1 — hostile-review remediation

Branch: `dev-v6.2.0`. Starting checkpoint: `5006a742decdab8ab1c8e6d1cc1144ef9ccf93a3`.
The ending checkpoint is the local commit containing this report; its exact hash is returned in the completion message.

All eight findings are **Fixed**. This is correctness remediation of the existing Finance domain and UI, not a redesign. No cloud/bank integration, signing, publication, production installation or personal-data mutation occurred.

| Finding | Status | Fix and invariant | Focused regression evidence |
| --- | --- | --- | --- |
| F01 | Fixed | A shared posting boundary checks source and destination openings/verified civil dates. Changing an effective transaction date applies the same guard. Transfers remain one atomic ledger record. | Destination/source backdating rejected; exact-boundary and ordinary transfers conserve cash. |
| F02 | Fixed | Domain, native validation and UI picker exclude internal transfers from settlement. Valid historical expenses remain eligible without reposting the opening position. | Internal matching cannot release protection; genuine historical matching settles once; native rejects invalid links. |
| F03 | Fixed | Legacy conversion resolves an existing link instead of creating another rule. New rules carry a validated unique legacy source; stale forms reject. Source navigation opens the existing canonical rule. Raw legacy information remains intact. | Retry/new submission/reopen retain one rule and £100 protection; UI opens Recurring Schedule rather than conversion. |
| F04 | Fixed | Services sharing a profile adapter use one mutation queue. Initialization, execution, confirmation and Undo coordinate persistence; synchronous Finance writes and bridge bypasses reject. Waiting for human confirmation does not retain the queue. Native revision checks remain enabled. | Twelve overlapping actions across two service instances commit individually; both action/Undo orders behave safely; stale confirmation, failed persistence, reopening and conflicting windows are covered. |
| F05 | Fixed | Native restore/import enforce essentials overlap/date invariants and closely related activation requirements: transaction text/lifecycle, declared exact-money fields and effective-dated terms. Validation runs before replacement. Existing unversioned Finance/legacy backups remain supported. | Native invalid restore/import retain original data/revision/profile count; valid periods restore/import; JavaScript activation accepts the valid saved state; malformed optional fields reject in both layers. |
| F06 | Fixed | Metadata and amount edits on the same linked reserve retain its original settlement baseline. The amount remains the total earmark at that baseline; already counted payments continue reducing coverage. Changing account/rule/purpose establishes a new baseline explicitly. Financial changes receive confirmation. | £100 minus £40 remains £60 after rename; increasing to £120 protects £80, subsequent payment leaves £20; reducing the total below settled payments protects zero without changing balances. |
| F07 | Fixed | Optional ordered `amountHistory` terms apply from an explicit effective civil date. Occurrences, old-obligation protection and native reminder eligibility resolve terms by nominal occurrence date. Existing exceptions/settlements override their original occurrence; no age-based materialization is required. | October 2024 and recent past keep £100, later dates use £50/£70 as configured; partial settlement and moved £80 exception remain intact; same-day/backdated policy and native zero-amount future reminder behaviour are tested. |
| F08 | Fixed | Domain-generated confirmation details include resolved records, amounts, accounts, effective dates and ledger effects. Finance and Ask share them. On confirmation, saved state and financial effect are revalidated; a changed preview requires renewed review. | Transfers, observed/ledger/reconciliation values, payment account/bill and reversal impacts are asserted; actual UI payment preview is checked; midnight changes reject stale execution. |

## Persistence and recovery

Finance updates become visible through committed-change events and successful action effects only after persistence resolves. On failed Finance persistence, the service restores the prior in-memory financial/Undo/audit values, retains the attempted state separately as **DOM.OS Unsaved Recovery**, and leaves the save failure explicit. The failed attempt is not reported as saved. Conflicting windows cannot silently overwrite the winning commit; reopening loads committed state. No automatic replay or optimistic-concurrency relaxation was added.

Confirmation remains deliberately conservative: any intervening Finance document edit invalidates its pending preview. The existing one-current-financial-action Undo policy remains; older actions use durable correction/reversal rather than unsafe snapshot overwrite.

Rule terms remain domain version 1 with optional additive history. Existing unversioned rules retain the deterministic amount represented at the starting checkpoint as their baseline. Previously undocumented or already-overwritten historical terms cannot be reconstructed; the remediation does not invent them or create actual historical payments. Schedule/account changes require archival and a replacement rule, preserving existing references.

## Exact files/components changed

- `src/application/finance.js`: posting boundaries, settlement/conversion invariants, reserve baseline, dated terms, activation checks and resolved confirmations.
- `src/application/services.js`: per-profile coordination, confirmed-action revalidation, durable Finance notification/effects and failure rollback.
- `src/data/storage.js`: separate unsaved recovery export; existing SQLite-backed adapter retained.
- `src/app/finance-ui.js`: eligible matching, canonical legacy navigation, effective-date field, reserve semantics and resolved confirmation display.
- `src/assistant/command-bar.js`: display the same domain confirmation details.
- `src-tauri/src/finance_validation.rs`: restore/activation parity, source uniqueness, settlement validation and dated reminder eligibility.
- `src-tauri/src/database.rs`: disposable native regressions for restore/import rollback and validation parity.
- `scripts/test-finance-remediation.mjs`: 16 focused adversarial domain/persistence/integration checks.
- `scripts/test-finance-ui.mjs`: three additional picker/navigation/confirmation UI checks.
- `package.json`: include focused remediation checks in the standard suite.
- This completion report.

## Final verification

- **502 JavaScript/regression checks passed, zero failures**, including 16 focused remediation, 41 Finance acceptance with the real read-only backup fixture, 13 Finance UI and 68 retained stable-app regression checks.
- **50 native Rust tests passed, zero failures**, including real 6.1.3 migration/Finance cutover fixtures, disposable restore/import rollback, profile isolation and source preservation.
- `npm run validate`: passed.
- Frontend production compilation: passed.
- `npm run tauri -- build --config src-tauri/tauri.dev62.conf.json --no-bundle`: passed; isolated executable at `src-tauri/target/release/domos.exe`.
- `git diff --check`: passed. Final clean working-tree state and exact commit are verified after creating the checkpoint.

The first consolidated pass passed 501/49; final closely related restore-parity checks added one JavaScript and one native regression. The final totals above are from the complete post-change pass, not cumulative double-counting.

Tests read the supplied 6.1.3 backup without changing it. A private converted fixture is passed through `DOMOS_FINANCE_NATIVE_FIXTURE` and removed afterwards; disposable native databases are cleaned up. No private fixture or test log is committed. No stable/production database was opened. Existing whole-application automated compatibility suites passed; no new physical Windows walkthrough is claimed.

## Remaining limitations and release verification

No known failing financial consistency case remains in the tested remediation scope. Unsaved recovery is explicitly diagnostic rather than an automatic financial retry/import. Very large histories remain a future persistence/indexing concern. Vite's existing large-chunk warning remains non-failing.

This checkpoint is ready to enter the separate release-verification stage, not ready for publication. Remaining gates are native Finance/pop-out workflow smoke checks, release-candidate clean installation and real migration/backup round-trip, physical Finance toast selected-context navigation, long sleep/wake/overnight lifecycle, production package/signing/installation identity/protocol registration, and signed 6.1.3 → 6.2.0 in-app update with retained user data. Previous application-side notification routing evidence does not substitute for physical Windows presentation/click acceptance.

Protection baseline: `main` is `85e9f59c32a2a71570b121787bcd27155c581b9c`. Stable executable SHA-256 is `7FD9A1A09EC7471FE8CC324F525E7E98355679D2694D333BDE363F56D4636C7F`; both are rechecked before the checkpoint. No push, merge, publish or release.
