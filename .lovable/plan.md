# Prop Firm Transactions — Full Implementation Plan

## 1. New context — `TransactionsContext.tsx`

Create `src/contexts/TransactionsContext.tsx` (separate from the existing deposit/withdraw `Transaction` in `AccountsContext`, which we'll leave untouched).

```ts
export type TxType = 'income' | 'expense';
export type TxStatus = 'reviewed' | 'not_reviewed' | 'ignored';
export type TxCategory =
  | 'evaluation_fee' | 'activation_fee' | 'payout'
  | 'refund' | 'commission' | 'other_income' | 'other_expense';

export interface PropFirmTransaction {
  id: string; userId: string;
  accountId?: string; challengeId?: string;
  firm: string;
  type: TxType; category: TxCategory;
  description?: string;
  amount: number;       // ALWAYS positive
  date: string;         // ISO
  status: TxStatus;
  createdAt: string; updatedAt: string;
}
```

Storage key: `propfirm-transactions-v1` (localStorage). All mutations use functional `setState(prev => …)` like `AccountsContext`.

API:

- `transactions`, `addTransaction(input)`, `updateTransaction(id, patch)`, `deleteTransaction(id)`, `bulkUpdateStatus(ids, status)`, `bulkDelete(ids)`
- `getByChallengeId(id)`, `getByAccountId(id)`

Wire provider in `App.tsx` inside `<ChallengesProvider>` (after, since transactions reference challenges).

## 2. Auto-transactions hook — `useChallengeAutoTransactions`

A small effect-based reconciler that runs once on app load + on challenge add. For every challenge:

- If `evaluationFee > 0` and no transaction with `(challengeId, category:'evaluation_fee')` exists → create one (`type:'expense'`, `status:'reviewed'`, date = `challenge.createdAt`).
- If `activationFee > 0` and no transaction with `(challengeId, category:'activation_fee')` exists → create one similarly.

Place the hook inside a small wrapper component `<TransactionsAutoSync/>` rendered once below the providers, so it never re-creates duplicates (idempotent via the existence check).

## 3. Update `PayoutModal.tsx` — make it functional

Wire it to real state instead of static UI:

- Challenge dropdown (from `useChallengesContext`)
- Amount (positive number, validated)
- Date (uses Shadcn DatePicker → existing pattern in repo)
- On confirm → `addTransaction({ type:'income', category:'payout', amount, challengeId, firm: challenge.firm, accountId: latestAccountForChallenge?.id, status:'reviewed', date })`

## 4. Rewrite `PropFirmTransactions.tsx`

Replace the mock array + UI with a fully wired implementation. Keep current visual design (cards, tabs, table, pagination).

### State

- `filterTab: 'all' | 'income' | 'expense' | 'needs_review'`
- `search: string`
- `selectedIds: Set<string>` (bulk)
- `page`, `pageSize` (default 10)
- `editingTx`, `addOpen` (modal)

### Derived data

1. `visibleTxs` = transactions where `status !== 'ignored'` (the "ignored" filter is reachable only via a future tab; per spec, ignored are excluded from cards & tabs).
2. Apply tab filter:
  - `all` → visibleTxs
  - `income` → `type==='income'`
  - `expense` → `type==='expense'`
  - `needs_review` → `status==='not_reviewed'`
3. Apply search across challenge nickname, account name, firm, category label, description.

### Summary cards (reactive, not hard-coded)

Computed from filtered (post-tab, post-search) but always excluding `ignored`:

- Total Transactions: count, volume = Σ amounts (any type)
- Total Income: Σ where type income
- Total Spent: Σ where type expense
- Net Cash Flow: income − expense (color-coded green/red)

### Table

Columns from spec. Account/challenge resolved via `getAccountById` and `getChallengeById`. Empty resolution shows `—`.

- Type badge (income/expense)
- Status badge (reviewed = green, not_reviewed = amber, ignored = grey)
- Amount: green `+$x` for income, red `−$x` for expense
- Row checkbox + master checkbox
- Action menu: Edit / Mark reviewed / Mark not reviewed / Mark ignored / Mark unignored / Delete (with confirm)

### Empty states

- Zero transactions overall → centered "No transactions yet" + "Add transaction" CTA
- Zero after filter → "No matching transactions"

### Bulk actions

Bar visible when `selectedIds.size > 0`: Mark reviewed, Mark not reviewed, Mark ignored, Delete.

### Pagination

Slice on `page * pageSize`. Page-size dropdown (10 / 25 / 50). Prev/Next + "1 – N of M".

## 5. New `AddEditTransactionModal.tsx`

Single modal handles both create + edit (mirrors `TrackAccountModal` styling).

Fields:

- **Type** segmented toggle (Income / Expense)
- **Challenge** dropdown (from challenges)
- **Account** dropdown — populated from `getAccountsByChallengeId(challengeId)` after challenge selected (optional)
- **Firm** auto-filled from challenge, editable
- **Category** dropdown — Income: payout / refund / commission / other_income; Expense: evaluation_fee / activation_fee / other_expense
- **Amount** numeric (positive only)
- **Date** Shadcn DatePicker (`pointer-events-auto`)
- **Description** textarea (optional, ≤500 chars)
- **Status** segmented (default `reviewed`)

Validation (zod):

- `type` required, `amount > 0`, `date` required, `firm.trim()` required
- `description.max(500)`, `amount.max(1_000_000)`

Submit → `addTransaction(...)` or `updateTransaction(id, ...)`.

## 6. Files touched / created

Created:

- `src/contexts/TransactionsContext.tsx`
- `src/components/propfirm/AddEditTransactionModal.tsx`
- `src/components/propfirm/TransactionsAutoSync.tsx`

Modified:

- `src/components/propfirm/PropFirmTransactions.tsx` — full rewrite per above
- `src/components/propfirm/PayoutModal.tsx` — wire to TransactionsContext
- `src/App.tsx` — add `<TransactionsProvider>` + `<TransactionsAutoSync/>`

## 7. Edge cases handled

- **Existing challenges** at first run: auto-sync creates eval/activation fee transactions retroactively (idempotent).
- **Challenge deleted** (`removeChallenge` exists): transactions remain but show `—` for challenge name; user can delete or re-link via edit.
- **No accounts on challenge** (e.g. all archived in detail view): account dropdown still allows selection from full account list filtered by `challengeId`.
- **Negative amount entry**: rejected by zod; type controls direction.
- **Ignored rows**: hidden from cards & non-"All" tabs; visible in `All` (greyed badge) so user can unignore.
- **Bulk delete**: confirms via `AlertDialog` before deletion.

&nbsp;

## “Ignored visibility” contradiction

Your plan says:

```
visibleTxs = status !== 'ignored'
```

But later:

```
Ignored rows visible in All tab
```

---

### ❗ Conflict

You can’t both:

-   
exclude ignored  

-   
and show them in “All”  


---

### ✅ Fix

```
const visibleTxs = transactions; // include all

// then filter:
if (tab === 'all') → include ALL (including ignored)
if (tab !== 'all') → exclude ignored
```