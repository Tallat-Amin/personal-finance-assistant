# Personal Finance Assistant

A multi-user finance workspace with credentials auth, private transaction data, CSV import, receipt intake, budget tracking, and a conversational assistant surface.

## Prerequisites

- Node.js 20.19.0 or newer.
- npm 10 or newer.
- A local environment that can install native npm packages. SQLite uses `better-sqlite3`, and receipt OCR uses `tesseract.js`.

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`, create an account, then use **Seed demo** on the dashboard or import a CSV file / pasted CSV rows like:

```csv
date,merchant,amount,category,description
2026-05-02,Green Basket Market,-96.42,Groceries,weekly shop
2026-05-06,Spotify,-10.99,Subscriptions,music
2026-06-09,ElectroHub,-799.99,General,laptop
```

## Completed Slice

- Auth.js / NextAuth credentials sign-up and sign-in with hashed passwords.
- Prisma data model for users, transactions, budgets, memories, chat history, receipts, and Auth.js adapter tables.
- User isolation on every dashboard read, server action, and assistant API request.
- CSV transaction import with file upload, pasted input, debit/credit column support, row-level rejection, duplicate tolerance, and persisted import reports.
- Receipt upload workflow with local Tesseract OCR, extracted merchant/date/total heuristics, confidence storage, raw OCR text, and a visible review queue.
- Dashboard analytics for month spend, category totals, budgets, likely subscriptions, and unusual charges.
- Conversational assistant UI backed by a low-cost deterministic router for common finance questions.
- Memory capture for user preferences such as payday or budget exclusions.

## Task Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Accounts and sign-in | Complete | Credentials auth via Auth.js / NextAuth. Passwords are hashed with bcrypt. |
| Multiple users and private data | Complete | All dashboard reads, mutations, and assistant requests are scoped by the signed-in user id. |
| Financial data import | Complete | CSV upload/paste supports common headers, `amount`, `debit`, `credit`, duplicate detection, and rejected-row reporting. |
| Conversational assistant | Working slice | Rule-routed assistant answers common finance questions without sending the whole ledger to a model. |
| Spending questions | Complete | Handles category spending, biggest purchase, summaries, and month comparisons. |
| Receipt photo reading | Working slice | Tesseract OCR runs locally, stores raw text/confidence, extracts likely merchant/date/total, and records or queues for review. |
| Recurring subscriptions | Heuristic | Groups merchant charges and cadence to surface likely recurring charges. |
| Unusual activity | Heuristic | Flags large category outliers using explainable average-based rules. |
| Compare across time | Complete | Supports this-month vs last-month comparisons. |
| Budget tracking | Complete | Category budgets with progress against current month spend. |
| Unfamiliar merchant lookup | Not implemented | Needs web/search integration plus cached merchant profiles. |
| Plain-English summaries | Complete | Generated from structured aggregates. |
| Cutback suggestions | Basic | Suggests savings opportunities from top spend categories. |
| Remember user context | Partial | Stores user preferences/notes; only basic preferences are applied today. |

## Architecture Decisions

Simple finance questions should be fast and cheap, so the assistant does not send the full ledger to an LLM. It classifies common intents and answers from indexed Prisma queries and local analytics. This handles category spending, biggest purchase, recurring subscriptions, unusual activity, month comparison, summaries, and cutback suggestions with predictable latency.

Complex capabilities are represented as explicit product seams rather than hidden fake intelligence. Receipt OCR uses Tesseract locally and records confidence/raw text, but still treats extraction as reviewable because real receipts are often blurry, rotated, or oddly formatted. Merchant lookup is documented as an external-search tool path, but not called locally to avoid unreliable live web dependencies in the assessment environment.

The schema stores normalized transaction hashes and indexes by user/date/category/merchant so the app can scale beyond toy CSVs. For much larger histories, I would add monthly rollup tables and async ingestion jobs; the current implementation is a working slice that keeps those extension points clear.

## Tradeoffs and Limitations

- SQLite is used for local reviewability. PostgreSQL would be the production target.
- Credentials auth is implemented because requested; OAuth/passkeys would be preferable for a shipped consumer finance product.
- Online merchant research and model-backed agent planning are not implemented. The app exposes where those services would attach.
- The assistant is deterministic, not a true LLM agent. This is intentional for fast/cheap finance lookups, but weaker for ambiguous questions.
- OCR is best-effort. The first OCR run may need Tesseract language data availability, and production should move this to a background worker with image preprocessing and user confirmation.
- The receipt queue shows OCR output, but there is not yet a full edit/confirm review screen for queued receipts.
- Anomaly detection is heuristic and explainable, not statistical modeling. It flags large outliers by category average.
- CSV parsing is intentionally dependency-light and handles quotes, basic aliases, amount/debit/credit formats, and import reports. Production should add richer bank templates and background jobs for large files.
- Tests are not included yet. The highest-value tests would cover CSV parsing, OCR field extraction, assistant routing, subscriptions, and anomaly detection.

## Evaluation Notes

The main product decision is to separate deterministic financial computation from expensive reasoning. Large context is handled by querying/aggregating structured transaction data, not by stuffing history into a prompt. Multi-step work is modeled as routed intents with stored chat and user memories, while OCR and CSV import produce auditable intermediate records instead of silently guessing.
