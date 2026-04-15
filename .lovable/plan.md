

# Transaction userId Fix

## Change 1 — `src/contexts/AccountsContext.tsx`

**Interface**: Change `userId?: string` to `userId: string` in the `Transaction` interface.

**`addTransaction` method**: Add `user` from auth context (already available in the provider). Before creating the transaction, check `if (!user?.userId) return;` to prevent storing invalid data. Set `userId: user.userId` on the new transaction object.

## Files touched

| File | Change |
|------|--------|
| `src/contexts/AccountsContext.tsx` | Make `userId` required, guard `addTransaction` with early return if no user |

One file, two small edits. No other changes.

