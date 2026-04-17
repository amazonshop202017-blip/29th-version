

## Plan: Prop Firm account menu actions + Edit/Mark-as-Failed flows

### Goal
Update the 3-dot menu on each Prop Firm account (table + grid views) and wire two new flows: an **Edit Challenge** flow that reuses the existing TrackAccountModal in edit mode, and a **Mark as Failed** confirmation popup matching the provided screenshot. Disable Delete for now. Add a new **Move to Funding** menu item under "View Details".

### Menu changes (`src/components/propfirm/PropFirmAccounts.tsx`)
New menu order:
1. **View Details** — keeps current behavior (opens account details)
2. **Move to Funding** — *(new)* placeholder, no action yet (UI only as scope is unspecified — will show a `toast.info("Coming soon")`)
3. **Mark as Failed** — opens new confirmation popup
4. **Edit Challenge** — opens TrackAccountModal in edit mode
5. **Delete Challenge** — **disabled** (greyed out, non-clickable, tooltip "Disabled")

`ThreeDotMenu` will be refactored to accept callbacks (`onViewDetails`, `onMoveToFunding`, `onMarkAsFailed`, `onEditChallenge`) and the `accountName` (e.g. "e8") for the failed-popup header.

### TrackAccountModal — add edit mode (`src/components/propfirm/TrackAccountModal.tsx`)
- Add optional prop: `mode?: 'create' | 'edit'` and `initialChallenge?: Partial<ChallengeFormData>` (or simpler: just initial values passed from parent: `nickname`, `firm`, `balance`, `phase`, `steps`, `status`, `startDate`, `fees`, `rules`).
- When `mode === 'edit'`:
  - Modal title: **"Edit Challenge"** (instead of "Add Challenge")
  - Footer button: **"Save"** (instead of "Create challenge")
  - On save: call a new `updateChallenge` path that overwrites the existing challenge values (reuse `useChallengesContext().updateChallenge`) and shows `toast.success('Challenge updated')`
- A `useEffect` will hydrate all form state when `initialChallenge` changes / modal opens in edit mode.

Since the demo accounts in `PropFirmAccounts.tsx` are hard-coded (not yet linked to `ChallengesContext`), edit mode will pre-fill from a small mock object derived from the row clicked (firm name, step, balance, status). The "save" action will call `updateChallenge` if the row maps to a real challenge, otherwise just close + toast — keeping the UI fully functional for the demo data.

### New component: MarkAsFailedDialog (`src/components/propfirm/MarkAsFailedDialog.tsx`)
Match the attached screenshot exactly using existing shadcn Dialog primitives:

```text
┌────────────────────────────────────────────┐
│ Mark Evaluation Account as failed?     [×] │
│ This will mark this Evaluation Account as  │
│ failed and lock the current phase.         │
│ ┌────────────────────────────────────────┐ │
│ │ Account: e8 • Use "e8 markets"         │ │  ← muted card
│ └────────────────────────────────────────┘ │
│ Why did this Evaluation Account fail?      │
│  ○ Broke max drawdown                      │
│  ○ Overtrading / Forcing trades            │
│  ○ Time pressure                           │
│  ○ Lack of risk management                 │
│  ○ Other: [ Enter custom reason ]          │
│ ┌────────────────────────────────────────┐ │
│ │ ℹ This reason will be used in your    │ │  ← blue info card
│ │   analytics and insights to help you   │ │
│ │   improve your passing rate.           │ │
│ └────────────────────────────────────────┘ │
│                  [Cancel] [Mark as failed] │
└────────────────────────────────────────────┘
```

Implementation details:
- Built on `Dialog` + `RadioGroup` from `@/components/ui/*`
- Local state: `selectedReason`, `customReason`. **No persistence** — clicking "Mark as failed" simply toasts and closes (per request: "don't store any value from this popup as of now").
- "Mark as failed" button uses `bg-primary` (purple) matching the screenshot
- Info banner uses `bg-blue-50 border-blue-200 text-blue-700` (or theme-aware `bg-primary/5 border-primary/20`) with `Info` lucide icon
- Props: `open`, `onOpenChange`, `accountName`, `accountSubtitle`

### Files
- **Edit:** `src/components/propfirm/PropFirmAccounts.tsx` — refactor `ThreeDotMenu`, add Move to Funding + disabled Delete, wire dialogs/modal opening; track which row is acted upon for the failed/edit popups.
- **Edit:** `src/components/propfirm/TrackAccountModal.tsx` — add `mode` + `initialChallenge` props, conditional title/button text, hydration effect.
- **Create:** `src/components/propfirm/MarkAsFailedDialog.tsx` — the new confirmation popup.

### Out of scope
- Persistence of the failure reason (explicitly excluded by user)
- Real "Move to Funding" flow (placeholder only)
- Wiring delete (disabled per request)

