
## Plan: Real data-driven Prop Firm account cards (alongside demo cards)

### Goal
Render **real** Prop Firm accounts on the Accounts page in the same Evaluations / Funded / Breached tabs, using existing `AccountsContext` + `ChallengesContext` + `TradesContext` data. Demo cards stay completely untouched as visual reference.

### Approach
Create a single new component `RealAccountCard.tsx` that mirrors the existing `EvalAccountCard` / `FundedAccountCard` design 1:1, but takes a real `Account` + `Challenge` + computed stats. In `PropFirmAccounts.tsx`, add a real-accounts row above the demo cards in **both views**:
- **Grid view:** real cards rendered first via `flex flex-wrap gap-4` (same wrapper) followed by the existing demo card
- **List view:** real rows appended/prepended into the same `TableView` (extend `accounts` array passed in)

### Data flow

1. **Pull**:
   ```ts
   const { user } = useAuth();
   const { accounts, removeAccount } = useAccountsContext();
   const { challenges, getChallengeById, updateChallenge, removeChallenge } = useChallengesContext();
   const { trades } = useTradesContext();
   ```
2. **Filter** real accounts:
   ```ts
   const realPropfirm = accounts.filter(a =>
     a.accountMode === 'propfirm' &&
     a.userId === user?.userId &&
     !a.isArchived
   );
   ```
3. **Bucket per active tab**:
   - Evaluations → `phase === 'evaluation' && status === 'active'`
   - Funded → `phase === 'funded' && status === 'active'`
   - Breached → `status === 'breached'`

4. **Compute per-card stats** (memoized helper `computeAccountStats(account, challenge, trades)`):
   - `accountTrades = trades.filter(t => t.accountId === account.id)`
   - `pnl = sum(calculateTradeMetrics(t).netPnl)`
   - `currentBalance = challenge.balanceAmount + pnl`
   - `tradingDays = new Set(accountTrades.map(t => t.closeDate.slice(0,10))).size`
   - `profitTargetAmount` derived from `challenge.rules.step{N}.profitTarget` (`%` → `balanceAmount * value/100`, `$` → `value`); `progressPct = clamp(pnl / target * 100)`
   - `maxDD` derived from `challenge.rules.step{N}.maxDrawdown` (same %/$ resolution)
   - `currentDD = max(0, peakBalance - currentBalance)` where `peakBalance` walks accountTrades chronologically
   - `consistencyTarget = challenge.rules.step{N}.consistency`
   - For Funded phase use `challenge.rules.funded` (resolving `sameAsStep1` → `step1`)

### New component: `RealAccountCard.tsx`
Single component (not split eval/funded) — renders the right progress rows based on `phase`. Visual structure copied verbatim from `EvalAccountCard` / `FundedAccountCard`:
- Header row: `firm` (large bold) + step badge ("STEP 1" / "STEP 2" / "FUNDED") + 3-dot menu
- Balance line: `Balance: $X (+/-$Y)` + right-side `Use "{firm}"` hint (uses `challenge.firm`)
- Time-limit pill (Clock icon): "No time limit" if `rules.step1.isUnlimited` else "{tradingPeriodDays} days limit", subline "Started on {createdAt formatted}"
- Account meta line: `Account: {account.name}`
- `<ProgressRow>` rows (reuse existing component) for: Profit Target, Max Daily Loss, Max Drawdown (eval) — or Min Trading Days + Max Daily Loss (funded)

### List-view row reuse
Extend the `accounts` array shape passed into `TableView` so real accounts produce the same row structure (`firm`, `step`, `status`, `balance`, `pnl`, `pnlPositive`, `target`, `pnlBarValue`, `tradingDays`, `drawdown`, `consistency`). A small `accountToRow(account, challenge, stats)` adapter does the mapping. Real rows render **above** the demo row inside the existing `<tbody>`.

### Menu actions wiring (real accounts only)
Pass real callbacks through the same `ThreeDotMenu`:
- **View Details** → `onSelectAccount()` (existing handler — uses the same hard-coded `PropFirmAccountDetails` page; out of scope to wire details to real data per the "don't modify" rule)
- **Move to Funding** → `updateAccount` step→'funded' & phase→'funded' & `updateChallenge(challengeId, { status: 'funded' })`, toast success
- **Mark as Failed** → opens existing `MarkAsFailedDialog`; on confirm: `updateAccount` status→'breached' + write `breachReason` + `breachedAt` (need a small extension to `updateAccount` OR direct context patch — see Technical Notes)
- **Edit Challenge** → opens `TrackAccountModal` in `mode="edit"` pre-loaded with the selected challenge (requires extending modal — see Technical Notes)
- **Delete Challenge** → `removeChallenge(challengeId)` + `removeAccount(accountId)`, with `AlertDialog` confirm (replaces the currently-disabled menu item ONLY for real accounts; demo card keeps it disabled)

### Technical Notes / small required extensions

1. **`AccountsContext.updateAccount`** currently only accepts `(id, name, startingBalance, accountMode)`. Add an overload / new method:
   ```ts
   patchAccount: (id: string, patch: Partial<Pick<Account, 'phase'|'step'|'status'|'breachReason'|'breachedAt'|'name'>>) => void;
   ```
   Used by Mark-as-Failed and Move-to-Funding.

2. **`TrackAccountModal`** edit mode is currently a UI-only flag (title + button label). Extend it to actually load + save when `mode==='edit'`:
   - New props: `challengeId?: string` (when edit)
   - On open, hydrate all form fields from `getChallengeById(challengeId)` (reverse the schema → form converters)
   - On Save: call `updateChallenge(challengeId, {...})` + `updateAccount` name if firm/nickname changed, instead of `addChallenge`+`addAccount`
   - Reset behavior remains for create mode

3. **Demo cards behavior**: leave `EvalAccountCard` / `FundedAccountCard` and the hard-coded `evaluationAccounts` / `fundedAccounts` arrays exactly as-is. Their `ThreeDotMenu` still uses the existing `makeActions` (toast placeholders + dialog opens with no persistence) — this satisfies "demo cards remain non-functional".

4. **Tab counts**: update `accountTabs` counts to be `demoCount + realCount` per bucket so the tab label reflects total.

5. **Empty states**: when a tab has 0 real accounts, no extra empty state is shown (the demo card is still there). When Breached has 0 real and the demo array is empty (current state), keep the existing empty-state block.

### Files

**Create**
- `src/components/propfirm/RealAccountCard.tsx` — visual twin of demo cards driven by props
- `src/lib/propFirmStats.ts` — `computeAccountStats(account, challenge, trades)` + helpers `resolveTarget`, `resolveDrawdown`, `accountToRow`

**Edit**
- `src/components/propfirm/PropFirmAccounts.tsx` — pull real data, build per-tab arrays, render real cards/rows above demo, wire real menu actions, update tab counts
- `src/components/propfirm/TrackAccountModal.tsx` — accept `challengeId`, hydrate form on open in edit mode, branch to `updateChallenge` on save
- `src/contexts/AccountsContext.tsx` — add `patchAccount(id, partial)` method (typed against safe subset)

### Out of scope
- Changing `PropFirmAccountDetails.tsx` (still shows hard-coded data even when reached from a real card — explicitly preserved per "do not modify")
- Migrating screenshots / fees / payouts to real data
- Persisting `MarkAsFailedDialog` reasons globally beyond the breach fields on the account
