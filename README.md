# BillDNA — SME ERP

![CI](https://github.com/Senthamilgp/BILLDNA/actions/workflows/ci.yml/badge.svg)

Full ERP for Indian small businesses. GST billing, inventory, accounting, POS, reports.

## Build plan (18 phases, frozen one by one)
| Phase | Modules | Status |
|---|---|---|
| 1. Core | Auth, Multi-company, Multi-branch, Roles, Dashboard, Notifications, Logs, Backup | ✅ Frozen |
| 2. Masters | Customers, Suppliers, Products, GST rates, Barcode, Warehouses | ✅ Frozen |
| 3. Billing | GST/Retail Invoice, Estimate, Quotation, POS, Print, WhatsApp, Sales Return | ✅ Frozen |
| 4. Purchase | Purchase Invoice, Supplier Payments, Pending | ✅ Frozen |
| 5. Inventory | Auto stock, Adjustment, Transfer, Low-stock alerts, Movements | ✅ Frozen |
| 3–18 | Billing, Purchase, Inventory, Accounting, GST, CRM, Reports, Mfg, HR, Assets, Finance, E-com, AI, Integrations, Mobile, Admin | Planned |

## Phase 1
`billdna-phase1.jsx` — React single-file app.
Login: admin@billdna.in / PIN 1234.
Data persistence via `window.storage` (Claude artifact runtime).
