# Account Lifecycle Status + Hierarchy Display

## 1. Type updates (`AccountsContext.tsx`)

Extend `PropFirmStatus`:

```ts
export type PropFirmStatus = 'active' | 'completed' | 'breached' | 'funded';
```

Also widen the `patchAccount` signature so `status` can be patched (currently it isn't in the `Pick<>` allowlist):

```ts
patchAccount: (id, patch: Partial<Pick<Account,
  'name'|'phase'|'step'|'status'|'breachReason'|'breachedAt'|'isArchived'>>) => void;
```

(`status` is already there — verify, no change if so.)

## 2. Step transition logic (`PropFirmAccounts.tsx`)

### `moveToStep2(account)` — replace current body

- `patchAccount(account.id, { status: 'completed', isArchived: true })` (instead of just `archiveAccount`)
- `addAccount(... { step:'2', phase:'evaluation', status:'active' })`
- Navigate to new account.

### `moveToFunding(account)` — rewrite the loop

For every account where `challengeId === account.challengeId`:

- If current `status === 'active'` → `patchAccount(a.id, { status: 'completed', isArchived: true })`
- Else (`completed` or `breached`) → `patchAccount(a.id, { isArchived: true })` (preserve status)

Then create the funded account with `status: 'funded'` (not `'active'`):

```ts
addAccount(..., { step:'funded', phase:'funded', status:'funded' })
```

Then `updateChallenge(challengeId, { status: 'funded' })`.

## 3. Breach logic — already correct

Existing `handleConfirmFailed` already:

- sets status `breached`, archives target + all siblings,
- updates challenge to `breached`.
No flow change. Progression button is already hidden when `account.status === 'breached'`. Add an extra guard so progression is also hidden if the **challenge** itself is `'breached'` (defensive — covers archived breached + later actions).

## 4. Accounts page — top-level hierarchy display

Currently `realByTab.Evaluations / Funded` filter by `!isArchived`, so the latest active per challenge is naturally what's shown. But to satisfy the explicit "one row per challenge by priority" rule and handle edge cases (e.g. funded account with `status:'funded'` not being filtered out), refactor the buckets:

Add a helper inside `PropFirmAccounts.tsx`:

```ts
function pickLatestForChallenge(group: Account[]): Account {
  // Priority: breached > active funded > active step 2 > active step 1 > newest
  const breached = group.find(a => a.status === 'breached');
  if (breached) return breached;
  const fundedActive = group.find(a => a.step === 'funded' && (a.status === 'active' || a.status === 'funded'));
  if (fundedActive) return fundedActive;
  const step2Active = group.find(a => a.step === '2' && a.status === 'active');
  if (step2Active) return step2Active;
  const step1Active = group.find(a => a.step === '1' && a.status === 'active');
  if (step1Active) return step1Active;
  return [...group].sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt))[0];
}
```

Group `allRealPropfirmAccounts` by `challengeId`, pick one per group, then bucket:

- **Evaluations** tab: picks where chosen account `phase === 'evaluation' && status !== 'breached'`
- **Funded** tab: picks where `phase === 'funded' && status !== 'breached'`
- **Breached** tab: picks where `status === 'breached'`

Stand-alone (no challengeId) accounts fall through unchanged.

This guarantees:

- One row per challenge.
- Funded account (status `funded`) appears in Funded tab.
- After breach, only the breached row shows (in Breached tab).
- `completed` accounts are never shown on the accounts list — only inside detail tabs.

## 5. Detail page tabs (`RealPropFirmAccountDetails.tsx`)

No structural change — tabs already derive from all challenge accounts (incl. archived) and show "Archived" pill. The new `'completed'` status will simply appear as an archived tab; full historical data still loads. Verify the `phasePill` text still makes sense (`Evaluation Account` / `Funded Account` based on `phase`, which is unchanged).

## 6. Files touched

- `src/contexts/AccountsContext.tsx` — add `'completed'` to `PropFirmStatus`.
- `src/components/propfirm/PropFirmAccounts.tsx` — update `moveToStep2`, `moveToFunding`, add `pickLatestForChallenge`, regroup buckets.

No DB/storage migration needed: existing accounts keep their current status; `'completed'` only appears for newly-progressed accounts going forward.

## Edge cases

- **Instant Funded** (`steps === 0`): single funded account with `status:'funded'` — appears in Funded tab via priority fallback.
- **Breached mid-Step-2**: Step 1 may be `'completed'` and Step 2 `'breached'` → Breached tab shows the Step 2 row only.
- **Already-funded challenge then Mark as Failed**: existing breach loop archives all and sets the funded account to breached → Breached tab shows it. 

&nbsp;

## FINAL IMPLEMENTATION NOTES (IMPORTANT)

1. STATE UPDATE SAFETY

- Ensure all account updates use functional state updates:

  setAccounts(prev => ...)

- Do NOT use stale state when calling patchAccount multiple times in sequence.

-----------------------------------

2. NO OVERWRITING OF STATUS

- Never overwrite:

  - 'breached' → should remain breached

  - 'completed' → should remain completed

- Only update:

  - 'active' → 'completed' during progression

-----------------------------------

3. FUNDED ACCOUNT CONSISTENCY

- Funded accounts must ALWAYS have:

  - step = 'funded'

  - phase = 'funded'

  - status = 'funded'

- Do NOT treat funded accounts as 'active'

-----------------------------------

4. BREACHED ACCOUNT SELECTION (IMPORTANT)

- When selecting breached account in pickLatestForChallenge:

  - If multiple exist, select the MOST RECENT (by createdAt)

- Do NOT rely on .find() alone

-----------------------------------

5. PREVENT DUPLICATE ACCOUNT CREATION

- Before creating:

  - Step 2 account → check if one already exists for this challenge

  - Funded account → check if one already exists

- If already exists → do NOT create another

-----------------------------------

6. IDENTITY & RELATIONSHIP RULE

- Always use [account.id](http://account.id) (UUID) for relationships

- Never rely on account name or step text for matching

-----------------------------------

7. ACCOUNTS PAGE DISPLAY GUARANTEE

- Ensure exactly ONE account per challenge is rendered

- Do NOT allow multiple rows for the same challenge

-----------------------------------

8. COMPLETED ACCOUNTS VISIBILITY

- Accounts with status 'completed':

  - must NOT appear in Accounts page lists

  - must ONLY appear in detailed page tabs

-----------------------------------

9. SORTING CONSISTENCY

- When grouping accounts:

  - Always sort by createdAt DESC before fallback selection

-----------------------------------

10. NO BREAKING EXISTING DATA

- Existing accounts without 'completed' status should continue working

- Do NOT mutate historical data unexpectedly

- Only apply 'completed' status during new transitions

-----------------------------------

GOAL OF THESE RULES

- Prevent inconsistent states

- Avoid duplicate accounts

- Ensure clean UI hierarchy

- Maintain reliable lifecycle transitions