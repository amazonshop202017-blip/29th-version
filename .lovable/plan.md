## Goal

When importing a TradeValley CSV, scan all rows up-front to discover every **Setup (Strategy)**, **Checklist item**, **Tag Category**, and **Tag** referenced by the trades. For each one:

- If it already exists (case-insensitive name match) → reuse it and link trades to the existing id.
- If it does not exist → create it before inserting trades, so trades reference real ids from day one.

Result: a fresh account / fresh project can ingest a CSV from another TradeValley user and end up with the same setups, checklists, categories, and tags wired up automatically.

## What gets auto-created

From the CSV headers:

- Every column ending in `(Setup)` → a Strategy with that name.
- Every column ending in `(Tag Category)` → a Category with that name.

From the CSV cell values:

- Each comma-separated text inside a `(Setup)` cell → added to that Strategy's `checklistItems` (deduped, case-insensitive).
- Each comma-separated text inside a `(Tag Category)` cell → a Tag with that name under that category.

Matching for "already exists" is **case-insensitive on trimmed name** (mirrors current import logic).

Honest limitation to surface in the result: the export only writes **checked** checklist items per trade. Checklist items defined on a Strategy but never checked in any exported trade will not appear in the CSV and therefore won't be recreated. We will mention this in the success toast.

## Behavior details

- New Categories get an auto-assigned color (cycle through a small palette so they're visually distinct).
- New Strategies get an empty description; their `checklistItems` are the union of all checked items seen across rows for that strategy column.
- New Tags are created as active (not archived) with empty description.
- All creation happens **before** `bulkAddTrades`, so each trade's `strategyId`, `selectedChecklistItems`, and `tags[]` reference the freshly-created ids.
- A single import run reuses anything it just created (no double-creates within the same file).
- Result object gains four counters: `strategiesCreated`, `checklistItemsCreated`, `categoriesCreated`, `tagsCreated`. The success toast in `AccountImportModal` shows them when > 0.

## Technical implementation

Files touched:

1. `src/contexts/StrategiesContext.tsx`
  - Add `addStrategyWithChecklist(name, checklistItems)` returning the new `Strategy` (single save, avoids racing two state updates).
2. `src/contexts/CategoriesContext.tsx`
  - Change `addCategory` to also return the created `Category` (or add `addCategoryReturning`) so the importer can grab the new id synchronously.
3. `src/contexts/TagsContext.tsx`
  - `addTag` already returns `Tag | null`; no change needed.
  - Add `bulkAddTags(items: { name, categoryId, description }[]): Tag[]` for a single localStorage write.
4. `src/lib/tradeValleyCsvImport.ts`
  - Update signature to accept the new context helpers (or accept callbacks: `createStrategy`, `appendChecklistItems`, `createCategory`, `createTag`).
  - **Pass 1 (discovery)**: parse all rows, walk Setup and Tag-Category columns, collect:
    - `setupName -> Set<checklistItem>`
    - `categoryName -> Set<tagName>`
  - **Pass 2 (reconcile)**: for each setup, find or create the Strategy; merge missing checklist items into its `checklistItems`. For each category, find or create the Category; for each tag in it, find or create the Tag. Build live lookup maps keyed by lowercased name.
  - **Pass 3 (insert)**: existing per-row trade build, but use the live lookup maps so even rows referencing newly-created entities resolve correctly.
  - Extend `TradeValleyImportResult` with the four new counters.
5. `src/components/settings/AccountImportModal.tsx`
  - Pass the new context helpers into `importTradeValleyCsv`.
  - Extend the success toast: e.g. *"Imported 42 trades. Created 2 setups, 5 checklist items, 1 category, 7 tags."*

## ASCII flow

```text
CSV rows
   |
   v
Pass 1: scan headers + cells
   - setups:    {Breakout: {item A, item B}, Reversal: {...}}
   - tagCats:   {Mistakes: {FOMO, Late entry}, Mood: {Calm}}
   |
   v
Pass 2: reconcile vs current state
   - for each setup: existing? merge checklist : create
   - for each category: existing? : create (assign color)
   - for each tag: existing in that category? : create
   |
   v
Pass 3: build trades using freshly-resolved ids
   |
   v
bulkAddTrades(...)  +  result counters
```

## Out of scope

- Renaming / merging similarly-named entities (e.g. "Breakout" vs "BreakOut " is matched case-insensitively after trim, but no fuzzy matching).
- Recreating checklist items that were defined on a strategy but never checked (CSV doesn't carry them).
- Tag descriptions / category colors beyond a default palette.

---

## IN-MEMORY LOOKUP CACHE

During import, maintain temporary maps:

- strategyMap
- categoryMap
- tagMap

All keyed by normalized name.

---

## RULE

Once an entity is created or resolved,  
it must be reused from the in-memory map  
for the rest of the import.

---

## GOAL

Avoid duplicate creation and unnecessary state writes

---

## CHECKLIST MERGE RULE

When updating an existing strategy:

- Only ADD missing checklist items
- NEVER remove or overwrite existing items

---

## GOAL

Preserve user-defined checklist integrity

&nbsp;

---

## IMPORT ATOMICITY (SOFT GUARANTEE)

If any critical failure occurs during Pass 2:

- Do NOT proceed to trade insertion
- Abort import gracefully
- Return error message

---

## GOAL

Prevent partial inconsistent state