# Focused release blocker remediation — 2026-10-09

Base: `953316dfca89db8b8066308080b8bc3be73cecfc`, branch `dev-v6.2.0`.

## Results

Both reported blockers are fixed and verified in the isolated `com.dom.os.nativeverify` Windows application. No new release blocker was found in this focused scope. This is not production release approval.

### Bill Schedule accessibility — Fixed

Canonical Finance drawers now have bounded viewport containment, independently scrolling fields and a separate visible Save/Cancel footer. Opening focuses the first field; Cancel leaves the draft unpersisted and returns focus to its opener. The change is scoped to Finance forms, including closely related recurring-income, allocation and settings forms.

Native pointer testing also exposed reminder/review notices covering the footer. Finance-only stacking rules now keep the drawer above these notices and mobile navigation. Native checks assert footer hit-test clickability, not just its rectangle position. No Finance business rules or unrelated editor layouts were changed.

The actual Windows Bill Schedule Save button was clicked through Computer Use. A synthetic £10.01 once-only bill appeared as an unpaid obligation, with £0.00 recorded and £10.01 outstanding. No payment was invented.

### Native Finance acceptance harness — Fixed

The harness now establishes explicit canonical accounts and reads `lifeos4.financeDomain`. Assistant expense/Undo checks use exact pennies and compare the other profile against its original Finance document. Historical Review fixtures use the canonical historical-entry action and explicit confirmation; recurring fixtures use canonical rules.

New native acceptance covers expense entry, single conserved transfers, observed balances and explicitly confirmed reconciliation, monthly bills and expected income, linked reserve coverage, partial settlement, actual income receipts, forecast/widget consistency, backup ownership rebinding and profile isolation. It preserves confirmation assertions and does not change production business rules to suit fixtures. Window sizing and WebView zoom permissions are confined to the native-verification configuration.

## Verification

- Final instrumented Windows harness: **70/70 passed**, zero failures.
- Native layout checks: 1100×800, minimum 360×640, and 900×700 with 150% WebView zoom; actual Windows native scale factor was 1.5. These are native resize/zoom checks, not an assertion that every Windows DPI setting was exercised.
- Actual native pointer Save: passed.
- Restart: rebuilt with normal assets, exited and relaunched the isolated executable. UI retained receiving balance **£1,080.09**, spending balance **£100.05**, and the £10.01 bill. Read-only SQLite comparison confirmed the complete canonical Finance document was unchanged: **6 transactions, 4 rules**.
- Targeted JavaScript validation: **212 unique checks passed** — Finance UI 15, remediation 16, domain 40, Reviews 53, Reviews UI 20, retained-app audit 68. The final Finance UI rerun passed 15/15 and is not counted twice.
- Application validation, frontend build, final instrumented native build and final normal-assets isolated native build passed.
- The prior full 502 JavaScript / 50 Rust results remain prior evidence; those full suites were not unnecessarily rerun for this UI/harness change. No schema, Rust implementation or financial-domain changes were made.

Evidence: `%USERPROFILE%\Documents\DOMOS-Verification\release-blocker-remediation\native-final.json`, `finance-restart-before.json`, and `restart-result.json`. These contain isolated synthetic verification data and are not committed.

## Limits and remaining release gates

Generic native pop-out synchronization/isolation passed in the harness; targeted Finance concurrency regression checks passed. This pass did not add a simultaneous native Finance-window editing test.

Remaining gates from consolidated verification are still explicit: any unverified Finance notification click-through/selected context, genuine overnight or long-duration sleep behavior, production clean installation and handler registration, packaging/signing, and an actual signed stable 6.1.3 → 6.2.0 in-app update in an isolated release environment. Earlier physical notification and short-sleep observations were not repeated or promoted into broader guarantees here.

Main remains unchanged. The installed stable v6.1.3 executable is unchanged, and its data was not opened or modified. No real financial records were used. No push, merge, signing, publication or production update was performed. The isolated verification window was closed after testing.
