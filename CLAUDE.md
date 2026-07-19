# BillDNA — project conventions for Claude

Single-file React SME ERP: `billdna-erp.jsx` (18 phases). Persistence: `window.storage` key `billdna_erp_v2`.

## Build
npx esbuild billdna-erp.jsx --loader:.jsx=jsx --bundle --format=esm --external:react --external:react-dom --outfile=out-esm.js

## Test (all must pass before any PR)
for f in tests/phase*.mjs; do node $f; done
node pos-flow-test.mjs
node tests/shadow-verification.mjs   # independent shadow-ledger auditor — source of truth
node tests/perf.mjs

## Rules
- Fix code, not tests. Only change a test if provably wrong; never weaken assertions.
- Frozen phases: don't refactor working modules while fixing a bug elsewhere.
- Business rules: GST split CGST/SGST 50/50; returns restore stock (no auto cash refund); stock may go negative (billing-ahead allowed); payroll = salary × payable-days/workingDays.
- UI text: Tanglish (Tamil-English) is intentional.
- Never commit secrets; node_modules & out-esm.js stay gitignored.
