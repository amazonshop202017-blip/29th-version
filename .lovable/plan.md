
# Prop Firm Account Progression — Implementation Plan

## Goal
Each phase (Step 1 / Step 2 / Funded) is its own account row tied to a `challengeId`. Progressing never overwrites an account — it archives the current one and creates a new one. The detail page builds tabs from all accounts (including archived) sharing the same `challengeId`.

---

## What we'll change

### 1. New helper on `AccountsContext` — `getAccountsByChallengeId(id)`
Returns all accounts (active + archived) linked to a challenge, used by the detail page to build tabs.

### 2. Initial account creation (`TrackAccountModal.tsx`)
Already creates one account per challenge. Update the create branch:
- `steps === 0` (Funded phase) → create one Funded account (already done, keep)
- `steps === 1` → create one Step 1 account (already done, keep)
- `steps === 2` → create one Step 1 account only (Step 2 created later via progression). Already correct.

No structural change here — just verify naming convention `${nickname} (Step 1)` / `(Step 2)` / `(Funded)`.

### 3. Step transition logic (`PropFirmAccounts.tsx` → `realActions`)
Replace the current `onMoveToFunding` handler with two new actions wired by button label, and add a new action `onMoveToStep2`.

**`onMoveToStep2`** (only enabled when `account.step === '1'` and `challenge.steps === 2`)
- `archiveAccount(account.id)` — archive Step 1
- `addAccount(\`${challenge.nickname} (Step 2)\`, challenge.balanceAmount, 'propfirm', { challengeId, step: '2', phase: 'evaluation', status: 'active' })`

**`onMoveToFunding`** (rewritten)
- For every account where `challengeId === account.challengeId`: `patchAccount(a.id, { isArchived: true })`
- `addAccount(\`${challenge.nickname} (Funded)\`, challenge.balanceAmount, 'propfirm', { challengeId, step: 'funded', phase: 'funded', status: 'active' })`
- `updateChallenge(challengeId, { status: 'funded' })`

### 4. Three-dot menu — dynamic button label
In `ThreeDotMenu`, replace the static "Move to Funding" item with a dynamic one based on the active account's step + challenge.steps:
- `step === '1'` && `challenge.steps === 2` → **"Move to Step 2"**
- `step === '1'` && `challenge.steps === 1` → **"Move to Funding"**
- `step === '2'` → **"Move to Funding"**
- `step === 'funded'` → hide the progression item entirely
- Already-breached accounts → hide both progression items

This requires passing the account+challenge into `ThreeDotMenu` (or computing the label/handler at the call site and feeding a single `progression?: { label, onClick }` field into `AccountActions`).

### 5. Detail page — dynamic tabs from accounts (`RealPropFirmAccountDetails.tsx`)
Currently tabs are derived from `challenge.steps`, and the page only shows data for the URL-routed account. Rework:

- Fetch **all** accounts linked via `challengeId` using the new context helper (includes archived ones).
- Build tabs from those accounts:
  - Account with `step === '1'` → **STEP 1** tab
  - Account with `step === '2'` → **STEP 2** tab
  - Account with `step === 'funded'` → **FUNDED** tab
- If only a Funded account exists (Instant Funded case), only render the FUNDED tab.
- Each tab is bound to its own `accountId`. Switching tabs swaps which account drives `accountTrades`, `stats`, `selectedRules`, `balanceSeries`, the trades table, and the path-to-funding card.
- Default tab = the tab matching the currently active (non-archived) account; falls back to the URL accountId.
- Archived accounts in tabs get a small visual hint (e.g. "Archived" pill) but still show full historical data.

### 6. Routing behaviour
`PropFirmAccountsPage` already routes to `/prop-firm/accounts/:accountId`. After progression, navigate to the new account's id so the URL stays consistent with the active account. The detail page will still render correctly for any historical account because tabs derive from the shared `challengeId`.

### 7. Archived accounts visibility
Already correct in `PropFirmAccounts.tsx`:
- Evaluations / Funded buckets filter out archived (`!a.isArchived`).
- Breached tab keeps archived. No change needed there.

---

## Files touched

- `src/contexts/AccountsContext.tsx` — add `getAccountsByChallengeId`
- `src/components/propfirm/TrackAccountModal.tsx` — verify create branch (no logic change expected)
- `src/components/propfirm/PropFirmAccounts.tsx` — rewrite `onMoveToFunding`, add `onMoveToStep2`, dynamic menu label, hide progression for breached/funded
- `src/components/propfirm/RealPropFirmAccountDetails.tsx` — derive tabs from accounts list (not from `challenge.steps`); per-tab data binding; handle Instant Funded
- `src/pages/propfirm/PropFirmAccountsPage.tsx` — no change (URL already keyed by accountId)

---

## Edge cases handled

- **Instant Funded** (`steps === 0`) — only Funded tab; no progression buttons.
- **Breached account** — progression items hidden in menu (already aligned with prior memory).
- **Re-entering details after progression** — old archived account still loads via its tab; new active account is the default tab.
- **Mark as Failed mid-Step-2** — existing logic already archives all challenge accounts and breaches the current one; remains compatible.
