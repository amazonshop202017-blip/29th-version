

## Plan: Wire Up Breach Flow with Archive + Detail UI

### 1. `MarkAsFailedDialog.tsx` — return raw value
Change `handleConfirm` to pass the raw enum (`max_drawdown`, `overtrading`, `time_pressure`, `risk_management`) or the trimmed custom string when `Other` is selected. Drop the label lookup — formatting moves to display layer.

### 2. New helper `src/lib/breachReason.ts`
Tiny module exporting:
```ts
const BREACH_REASON_LABELS: Record<string,string> = {
  max_drawdown: "Broke max drawdown",
  overtrading: "Overtrading / Forcing trades",
  time_pressure: "Time pressure",
  risk_management: "Lack of risk management",
};
formatBreachReason(raw) → label or raw passthrough
formatBreachDate(iso) → "Feb 10, 2026"
```

### 3. `PropFirmAccounts.tsx` — `handleConfirmFailed`
Update flow to:
1. `patchAccount(acc.id, { status: 'breached', breachReason: rawReason, breachedAt: new Date().toISOString() })` — already stores correctly, just receives raw value now.
2. If `acc.challengeId` → `updateChallenge(challengeId, { status: 'breached' })` (already done).
3. **NEW**: Archive ALL accounts linked to that challenge:
   ```ts
   accounts
     .filter(a => a.challengeId === acc.challengeId)
     .forEach(a => patchAccount(a.id, { isArchived: true }))
   ```
   (Requires extending `patchAccount`'s allowed keys to include `isArchived`, OR call existing `archiveAccount` per id — simpler.)

Use `archiveAccount(id)` from context — already exists.

### 4. `AccountsContext.tsx` — Breached tab visibility
Currently `realPropfirmAccounts` filters out `isArchived`. The Breached tab needs to **show breached-archived accounts**. Two options:
- **Chosen**: split filtering — keep `isArchived` filter only for Evaluations/Funded buckets; for `Breached` bucket, include archived breached accounts.

Update the bucketing in `PropFirmAccounts.tsx`:
```ts
const allPropfirm = accounts.filter(a => a.accountMode === 'propfirm' && a.userId === userId);
Evaluations: allPropfirm.filter(a => a.phase==='evaluation' && a.status==='active' && !a.isArchived)
Funded:      allPropfirm.filter(a => a.phase==='funded' && a.status==='active' && !a.isArchived)
Breached:    allPropfirm.filter(a => a.status==='breached')   // include archived
```

### 5. `RealPropFirmAccountDetails.tsx` — breach banner
At the top of the **"Path to funding"** card (line ~382), if `account.status === 'breached'`, render a small destructive-themed block above all `FundingItem` rows:
```
┌─────────────────────────────────────┐
│ Account Breached                    │
│ Reason: Broke max drawdown          │
│ Date:   Feb 10, 2026                │
└─────────────────────────────────────┘
```
Styling: `border-rose-500/30 bg-rose-500/5 rounded-lg p-3 mb-4`, AlertTriangle icon. Uses `formatBreachReason` + `formatBreachDate`.

Detail page remains fully accessible (no gating). Three-dot actions stay as-is for now (Move to Funding still visible — user marked it optional to disable).

### 6. Files touched
- `src/components/propfirm/MarkAsFailedDialog.tsx` — return raw value
- `src/lib/breachReason.ts` — NEW helper
- `src/components/propfirm/PropFirmAccounts.tsx` — archive linked accounts on breach, adjust Breached bucket filter
- `src/components/propfirm/RealPropFirmAccountDetails.tsx` — breach banner in Path to funding

### Acceptance
- Marking failed stores raw enum (or raw custom string) on the account
- Linked challenge flips to `breached`; all linked accounts archive
- Breached tab shows the account; Evaluations/Funded tabs do not
- Detail page opens normally with banner showing formatted reason + date

