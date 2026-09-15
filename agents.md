# ExpenseTracker — Agent Onboarding

## What this app is
A personal, local-only expense tracking web app. No server, no auth. The user uploads bank export files from two Dutch banks (ABN AMRO and bunq), categorises transactions using a keyword + rule engine, and views summaries. Wife's expenses are tracked separately via a "person" field.

## Tech stack
- React + Vite + TypeScript
- Tailwind CSS v4
- Zustand (state + localStorage persistence)
- PapaParse (CSV parsing)
- SheetJS/xlsx (XLS parsing)
- React Router

## Running the app
```
npm run dev
```
Runs on `localhost:5173`. Node must be in PATH.

---

## Key files

| File | Purpose |
|---|---|
| `src/types/index.ts` | All types: `Transaction`, `UploadSession`, `Category`, `Rule`, `RuleCondition`, `AppData` |
| `src/store/useStore.ts` | Zustand store, persisted to localStorage key `expense-tracker-data` |
| `src/data/baseConfig.json` | Base persons/categories/rules baked into the build (see Features section) |
| `src/parsers/abnParser.ts` | ABN AMRO XLS parser |
| `src/parsers/bunqParser.ts` | bunq CSV parser |
| `src/utils/hash.ts` | `abnTransactionId()` and `bunqTransactionId()` — deterministic dedup IDs |
| `src/utils/ruleEngine.ts` | `classifyTransaction()`, `applyCategories()`, `applyRules()` |
| `src/components/UploadPage.tsx` | File upload, session history, manual entries list |
| `src/components/TransactionsPage.tsx` | Transaction table with filters, inline editing |
| `src/components/RulesPage.tsx` | Manage persons, categories, override rules + Export Config button |
| `src/components/SummaryPage.tsx` | Charts and totals |
| `src/components/ManualEntryPage.tsx` | Form to add a transaction manually |
| `src/components/NewRuleForm.tsx` | Reusable new-rule form (used in RulesPage and TransactionsPage) |
| `Features/` | Per-feature design docs for LLM context (read these before implementing related features) |

---

## Data model

### Transaction
```ts
{
  id: string            // deterministic hash — dedup key
  date: string          // ISO: YYYY-MM-DD (editable inline in the table)
  amount: number        // negative = expense, positive = income
  description: string   // cleaned (collapsed whitespace)
  rawDescription: string
  counterparty: string  // extracted from description via regex
  category: string      // category id, e.g. "market"
  type: 'income' | 'expense'
  bank: 'abn' | 'bunq' | 'manual'
  person: string        // e.g. "Me", "Wife"
  isManual: boolean
  sessionId: string     // links to UploadSession.id
  ignored: boolean      // excluded from Summary if true
  categoryPinned?: boolean  // manual category override, survives re-apply
}
```

### Rule / RuleCondition
Rules are applied after category keyword matching, in priority order (lower number = runs first).
```ts
{
  id: string
  name: string
  priority: number
  conditions: RuleCondition[]  // AND logic — all must match
  action: { setCategory?: string; setType?: 'income'|'expense'; ignore?: boolean }
}

// RuleCondition fields: 'description' | 'counterparty' | 'amount' | 'bank'
// operators: 'contains' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte'
// bank field: only supports 'equals', value is 'abn' | 'bunq' | 'manual'
```

Old persisted rules may have `condition` (singular) instead of `conditions` array — handled with migration fallback in `ruleEngine.ts` and `RulesPage.tsx`.

### AppData (what's in localStorage)
```ts
{
  transactions: Transaction[]
  uploadSessions: UploadSession[]
  categories: Category[]
  rules: Rule[]
  persons: string[]
  deletedBaseIds: string[]  // base config items the user explicitly deleted
}
```

---

## Parsing & deduplication

### ABN AMRO (XLS)
- Columns: accountNumber(0), mutationcode(1), date(2), valuedate(3), startSaldo(4), endSaldo(5), amount(6), description(7)
- Date is a float YYYYMMDD
- ID: `abn-` + djb2 hash of `account|date|amount|startSaldo|endSaldo`
- Balance fields make every transaction unique — rock-solid dedup

### bunq (CSV)
- Columns: Date, Interest Date, Amount, Account, Counterparty, Name, Description
- Amount format: European — dot = thousands separator, comma = decimal (e.g. `"2.500,00"` → 2500.00). Parse with: `parseFloat(raw.replace(/\./g, '').replace(',', '.'))`
- ID: `bunq-` + djb2 hash of `account|date|amount|counterparty|description|occurrence`
- `occurrence` is a per-file counter for identical rows (same combo within one file = genuinely separate transactions). Cross-file: both files assign `occurrence=0` to a unique combo → same ID → correctly deduplicated.

### Dedup logic
`addTransactions()` in the store checks `existingIds` (a Set of all current transaction IDs) and skips any incoming transaction whose ID already exists.

---

## Base config feature
`src/data/baseConfig.json` is imported at build time (Vite JSON import) and merged into the store on `onRehydrateStorage`. It seeds persons, categories, and rules that should always be present.

- Items are added if missing (by ID) and not in `deletedBaseIds`
- If a user modifies a base item, their version is kept (local wins)
- If a user deletes a base item, its ID goes into `deletedBaseIds` — it won't resurface
- **Export Config** button on RulesPage downloads `{ persons, categories, rules }` as `base-config.json` — user commits this file to the repo to update the base

See `Features/base-config-export.md` for full design details.

---

## Important quirks & gotchas

- **`categoryPinned`**: if true, `reapplyRules()` skips that transaction and preserves the manually set category. Always respect this flag.
- **`onRehydrateStorage`** in the store runs migrations on each load — this is where old data formats are fixed and base config is merged. Be careful adding logic here; it mutates state directly.
- **`table-fixed` layout** in TransactionsPage — column widths are user-resizable via drag. Don't add columns without also adding a width to `INIT_WIDTHS` and `COL_KEYS`.
- **Manual entries** have random IDs (not hash-based), so they never deduplicate against file-imported transactions even if the underlying transaction is the same.
- **`deletedBaseIds`** tracks both category IDs, rule IDs, and person name strings in the same array.
- The `exportData()` store method exports the full AppData (including transactions) — this is for full data backup. The **Export Config** button on RulesPage exports only `{ persons, categories, rules }` — this is for base config.

---

## Features folder
`Features/` contains design docs for non-trivial features. Read the relevant doc before implementing anything related to that feature.

- `Features/base-config-export.md` — base config seeding, export button, deletedBaseIds tracking

## Prompts folder
`prompts/` contains ready-to-use Claude Code prompts for extending the app.

- `prompts/add-bank-parser.md` — add a new bank's export format
