# Feature: Base Config Export & Repo-Seeded Rules

## Status
**Implemented.** All files below are live. `src/data/baseConfig.json` is populated with the initial base rules as of 2026-05-19.

## Problem
All user configuration (persons, categories, override rules) lives exclusively in browser localStorage. This means:
- Lost on browser data clear
- Not portable across machines
- No way to bake a curated set of rules into the app at build time

## What This Feature Does
Adds an **Export Config** button to the Rules & Categories page that downloads a JSON file containing the current `persons`, `categories`, and `rules`. The user commits that file to the repo as `src/data/baseConfig.json`. On the next build, these become the **base layer** — baked into the bundle. Users can still add more items at runtime (stored in localStorage as before), and those stack on top. The next export captures both layers combined.

## Two-Layer Architecture

```
src/data/baseConfig.json  ──(Vite import at build time)──▶  bundle
                                                                │
localStorage: expense-tracker-data (local additions)  ─────────┤
                                                                ▼
                                                  merged runtime state
                                                                │
                                            "Export Config" ───┘
                                                       ▼
                                            base-config.json  →  user commits to repo
```

**Key invariants:**
- Base items are always present unless the user explicitly deleted them (deletion is tracked)
- If a user modifies a base item in the UI, their version is kept (local wins on conflict by ID)
- Transactions and upload sessions are never part of base config — only config, not data

---

## File-by-File Implementation

### 1. `src/data/baseConfig.json` (NEW FILE)
Create this file. Initially it may be empty arrays; the user will populate it by exporting and committing.

```json
{
  "persons": [],
  "categories": [],
  "rules": []
}
```

Vite natively imports JSON — no plugin needed. Import it as:
```ts
import baseConfig from '../data/baseConfig.json'
```

TypeScript may need `resolveJsonModule: true` in `tsconfig.json` (check before assuming it's there).

---

### 2. `src/types/index.ts` — Add `deletedBaseIds` to `AppData`

Current `AppData`:
```ts
export interface AppData {
  transactions: Transaction[]
  uploadSessions: UploadSession[]
  categories: Category[]
  rules: Rule[]
  persons: string[]
}
```

Change to:
```ts
export interface AppData {
  transactions: Transaction[]
  uploadSessions: UploadSession[]
  categories: Category[]
  rules: Rule[]
  persons: string[]
  deletedBaseIds: string[]  // IDs of base config items the user has explicitly deleted
}
```

`deletedBaseIds` prevents base items from resurrecting after the user deletes them. It stores IDs for both categories and rules (persons use name strings — see below).

---

### 3. `src/store/useStore.ts` — Merge logic + deletion tracking

**Import base config at top of file:**
```ts
import baseConfig from '../data/baseConfig.json'
```

**Add `deletedBaseIds` to initial state:**
```ts
// in the create() call, initial state:
deletedBaseIds: [],
```

**Update `deleteCategory`:**
```ts
deleteCategory: (id) => {
  const isBase = (baseConfig.categories as Category[]).some((c) => c.id === id)
  set((s) => ({
    categories: s.categories.filter((c) => c.id !== id),
    deletedBaseIds: isBase ? [...s.deletedBaseIds, id] : s.deletedBaseIds,
  }))
},
```

**Update `deleteRule`:**
```ts
deleteRule: (id) => {
  const isBase = (baseConfig.rules as Rule[]).some((r) => r.id === id)
  set((s) => ({
    rules: s.rules.filter((r) => r.id !== id),
    deletedBaseIds: isBase ? [...s.deletedBaseIds, id] : s.deletedBaseIds,
  }))
},
```

**Persons use names, not IDs.** Track deleted base persons in `deletedBaseIds` too (the name string acts as the ID):
```ts
removePerson: (name) => {
  const isBase = (baseConfig.persons as string[]).includes(name)
  set((s) => ({
    persons: s.persons.filter((p) => p !== name),
    deletedBaseIds: isBase ? [...s.deletedBaseIds, name] : s.deletedBaseIds,
  }))
},
```

**Update `onRehydrateStorage` to merge base config:**

After the existing migration logic (retiring old categories, updating keywords, etc.), add:

```ts
// Merge base config items — add any base item not already present and not explicitly deleted
const deleted = new Set(state.deletedBaseIds ?? [])

for (const bp of baseConfig.persons as string[]) {
  if (!deleted.has(bp) && !state.persons.includes(bp)) {
    state.persons = [...state.persons, bp]
  }
}

for (const bc of baseConfig.categories as Category[]) {
  if (!deleted.has(bc.id) && !state.categories.find((c) => c.id === bc.id)) {
    state.categories = [...state.categories, bc]
  }
}

for (const br of baseConfig.rules as Rule[]) {
  if (!deleted.has(br.id) && !state.rules.find((r) => r.id === br.id)) {
    state.rules = [...state.rules, br]
  }
}
```

**Important:** This only adds missing base items. It does NOT overwrite items that already exist by ID. This means if the user modified a base category in the UI, their version survives. If you need base items to always win (i.e., be authoritative on every reload), swap the logic to overwrite on ID match — but the current design intentionally lets local edits persist.

---

### 4. Export function — add to `src/components/RulesPage.tsx`

Add an **"Export Config"** button at the top of the page, next to the `<h1>Rules & Categories</h1>` heading. Do not put it inside a specific section — it exports everything on the page (persons + categories + rules).

```tsx
import { useStore } from '../store/useStore'

// Inside the component:
const { categories, rules, persons } = useStore()

const handleExportConfig = () => {
  const config = { persons, categories, rules }
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'base-config.json'
  a.click()
  URL.revokeObjectURL(url)
}
```

Button placement — replace the existing `<h1>` block at the top of the return:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">Rules & Categories</h1>
  <button
    onClick={handleExportConfig}
    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
  >
    Export Config
  </button>
</div>
```

**The export does NOT include `transactions`, `uploadSessions`, or `deletedBaseIds`** — just the three config arrays.

---

## Edge Cases & Decisions

| Scenario | Behavior |
|---|---|
| User deletes a base rule | Added to `deletedBaseIds`; does not resurface on reload |
| User edits a base rule | Local version kept (local wins by ID); base version ignored |
| User adds a new rule (not in base) | Stays in localStorage; exported in next export; becomes base if committed |
| Base JSON is empty arrays | No-op; existing localStorage state is unaffected |
| First-ever load, empty localStorage | Default categories/rules from useStore.ts apply first, then base config items are added if not already there |
| `deletedBaseIds` missing from old localStorage | `?? []` fallback in rehydrate handles it gracefully |

---

## What NOT to Do
- Do not import the base config JSON anywhere except `useStore.ts` — the store is the single source of truth
- Do not add a UI import/upload flow — the user pastes exported JSON to the LLM directly, and the LLM commits it to the repo
- Do not merge base items aggressively (overwriting local edits) — the design intent is that local changes survive

---

## Relevant Existing Code Locations
- `src/store/useStore.ts` — Zustand store with localStorage persistence (`expense-tracker-data`)
- `src/types/index.ts` — All types: `Transaction`, `Category`, `Rule`, `RuleCondition`, `AppData`
- `src/components/RulesPage.tsx` — The page where persons, categories, and rules are managed; export button goes here
- `src/utils/ruleEngine.ts` — `classifyTransaction()`, `applyCategories()`, `applyRules()` — not changed by this feature
