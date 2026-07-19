# BillDNA v1.0.1 — Shadow Verification Certification Report
Date: 19-Jul-2026 · Pipeline: CoderGem Universal Shadow Verification (14 phases)

## Test Summary
| Suite | Tests | Result |
|---|---|---|
| Unit: Phases 1–5 (GST, stock, auth, roles, backup) | 23 | ✅ PASS |
| Unit: Phase 6 Accounting | 12 | ✅ PASS |
| Unit: Phase 7 GST Reports | 12 | ✅ PASS |
| Unit: Phase 8 CRM | 10 | ✅ PASS |
| Unit: Phase 9 Reports | 10 | ✅ PASS |
| Unit: Phase 10 Manufacturing | 9 | ✅ PASS |
| Unit: Phase 11 HR/Payroll | 9 | ✅ PASS |
| Unit: Phases 12–18 | 18 | ✅ PASS |
| E2E smoke: POS flow | 6 | ✅ PASS |
| **Shadow Verification (independent auditor)** | **42** | ✅ **PASS** |
| Performance benchmark | 4 metrics | ✅ PASS |
| **Total** | **151** | **0 failures** |

## Shadow Verification (Phases 1–8)
Independent shadow ledger built purely from scripted user actions + business rules
(never reads app calculations). Verified against app database snapshot:
- Stock per product (Tea/Sugar/Milk/Chai): shadow == app == Σ(stock movements) ✅
- Invoice count, per-invoice totals, sequence integrity, number uniqueness ✅
- Cash & Bank balances recomputed independently from raw events ✅
- Voucher count (expense/payroll/EMI) ✅
- FK integrity: every invoice item & stock move references an existing product ✅
- Stress: 40 rapid bills — counts sync, numbers unique, integrity holds ✅
- Restart/refresh: full state persists and reloads ✅

## Defects Found & Fixed (Phase 11–12 Root Cause + Auto Fix)
1. **POS double-submit race** (real bug, latent): two clicks in the same React batch
   created duplicate invoice number and lost the first bill. Fix: same-tick submit
   guard (`useRef` + microtask release). Verified: double-dispatch → exactly 1 invoice.
2. **Fix-of-fix**: first guard used a 300 ms debounce which blocked legitimate rapid
   billing (caught only by shadow stress test). Corrected to same-tick-only guard;
   40 consecutive fast bills now pass.
3. **Product validation**: negative/zero selling price was accepted. Now rejected.
4. **HR working days** hardcoded 26 → now reads Admin Panel setting.
5. **Invoice prefix** setting was stored but unused → now applied in POS & Store.
6. 5 earlier e2e "failures" were test-harness selector bugs (not app bugs) — fixed.

## Security (Phase 9)
- Static: no `dangerouslySetInnerHTML`, `eval`, `localStorage` — clean.
- Git history secret scan: no tokens committed — clean.
- XSS probe: product named `<img onerror=…>` rendered inert (React escaping) ✅
- RBAC: Cashier session hides Admin/Accounting/Users/Backup; POS visible ✅
- Session: logout returns to sign-in; wrong PIN rejected ✅
- N/A (no server in this edition): SQLi, CSRF, SSRF, token validation.

## Performance (Phase 10) — 300 products + 400 invoices seeded
Boot 177 ms · Dashboard 134 ms · Reports 71 ms · Products list 1114 ms · DB 159 KB
· Bundle 155 KB. All under 2 s threshold ✅ (Products list is the heaviest screen;
virtualization recommended beyond ~1,000 products.)

## Known Design Rules (documented, not defects)
- Sales return restores stock; cash refund is a manual credit-note step.
- Stock may go negative (billing-ahead allowed by design).
- Single-device edition: multi-device sync, IGST inter-state, e-invoice/e-way
  government APIs, native apps require the future backend project.

## Scores
Code health: **93/100** (−4 heavy Products screen, −3 single-device limits)
Production readiness: **PASS — certified for single-store pilot use**
