# BillDNA — SME ERP

Full ERP for Indian small businesses. GST billing, inventory, accounting, POS, reports.

## Build plan (18 phases, frozen one by one)
| Phase | Modules | Status |
|---|---|---|
| 1. Core | Auth, Multi-company, Multi-branch, Roles, Dashboard, Notifications, Logs, Backup | ✅ Frozen |
| 2. Masters | Customers, Suppliers, Products, GST rates, Barcode | ⏳ Next |
| 3–18 | Billing, Purchase, Inventory, Accounting, GST, CRM, Reports, Mfg, HR, Assets, Finance, E-com, AI, Integrations, Mobile, Admin | Planned |

## Phase 1
`billdna-phase1.jsx` — React single-file app.
Login: admin@billdna.in / PIN 1234.
Data persistence via `window.storage` (Claude artifact runtime).
