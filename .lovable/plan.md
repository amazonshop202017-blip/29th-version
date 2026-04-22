

## Make Diary Data Model PostgreSQL-Ready

### Problem found

Reviewing `DiaryContext`, `DiaryNote`, and `DiaryFolder`, the diary storage has issues that will block a clean automatic migration to Postgres:

1. **No `userId` on notes or folders** — every other persisted entity (transactions, accounts) carries `userId`. Diary data is currently global to the browser, so two users on the same device share notes. In Postgres this becomes a missing required FK and a privacy bug.
2. **Default folders mixed with real folders** — `DEFAULT_FOLDERS` (`all-notes`, `trade-notes`, `day-notes`) are saved as `folderId` on a note in some flows. They are virtual buckets, not real rows. Inserting them into a `diary_folders` table would either duplicate them per user or break FK integrity. The `folderId` column on a note must only ever reference a **real custom folder**.
3. **Storage key not user-scoped** — `diary_notes` / `diary_folders` keys are shared across all logged-in users on the same browser. Should be `diary_notes_v1_{userId}` like other contexts.
4. **No FK cleanup** — when a trade is deleted, `linkedTradeId` on notes is left dangling. Postgres with `ON DELETE SET NULL` handles this; locally we never clear it, which means after migration the cleanup runs once and silently nulls links that should have been cleared long ago.
5. **`linkedDate` shape** — already correctly stored as `YYYY-MM-DD` (calendar key, not timestamp). Good — maps cleanly to Postgres `DATE`. Keep as-is, just document.
6. **`updateNote` accepts arbitrary `DiaryNoteFormData`** — including `folderId`. Today nothing prevents a caller from setting `folderId = 'trade-notes'` (a virtual id). Need a guard.

### Changes

**`src/types/diary.ts`**
- Add `userId: string` to `DiaryNote` and `DiaryFolder`.
- Add JSDoc making it explicit: `folderId` MUST be `null` or reference a row in the custom folders table — never a default folder id.
- Remove `DEFAULT_FOLDERS` from being a persisted shape. Keep them as a `VIRTUAL_FOLDERS` constant (UI-only buckets) with a clear comment that they are not stored in the future Postgres `diary_folders` table.
- Export `DEFAULT_FOLDER_IDS` set (`'all-notes' | 'trade-notes' | 'day-notes'`) as the single source of truth (currently duplicated inline in `DiaryNotesList.tsx`).

**`src/contexts/DiaryContext.tsx`**
- Pull `user` from `useAuth()`.
- User-scope storage keys: `diary_notes_v1_{userId}` and `diary_folders_v1_{userId}`. Skip persistence when no user.
- Reload notes/folders when `user.userId` changes (login/logout).
- Stamp `userId` on every `createNote` and `createFolder`.
- In `createNote`, sanitize `folderId`: if the incoming value is in `DEFAULT_FOLDER_IDS`, store `null` instead. (Default folders are virtual.)
- In `updateNote`, apply the same sanitization to `folderId` if present in the patch.
- One-time migration on mount: read the legacy unscoped keys (`diary_notes`, `diary_folders`); if present and current user has no scoped data yet, copy them in with `userId` stamped, then remove the legacy keys.
- Add a `useEffect` that, when `trades` changes, nulls `linkedTradeId` on any note whose linked trade no longer exists (FK cleanup parity with `ON DELETE SET NULL`).
- `folders` memo continues to merge `VIRTUAL_FOLDERS` with the user's custom folders for UI; only custom folders are persisted.

**`src/components/diary/DiaryNotesList.tsx`**
- Replace the local `DEFAULT_FOLDER_IDS` constant with the import from `@/types/diary`.
- No behavior change — `folderIdForNewNote` already correctly resolves to `null` for default folders.

### Resulting shape (maps 1:1 to Postgres)

```text
diary_folders                    diary_notes
─────────────                    ───────────
id           uuid PK             id              uuid PK
user_id      uuid FK auth.users  user_id         uuid FK auth.users
name         text                title           text
type         text ('custom')     content         text
created_at   timestamptz         folder_id       uuid FK diary_folders NULL
                                 linked_trade_id uuid FK trades        NULL
                                 linked_date     date                  NULL
                                 created_at      timestamptz
                                 updated_at      timestamptz
```

Future RLS: `user_id = auth.uid()` on both tables. `folder_id` becomes a real FK because we never store virtual ids in it. `linked_trade_id` and `linked_date` stay nullable (a note can be unlinked, linked to a trade, or linked to a day — never both).

### Out of scope

- Actually creating the Postgres tables / Supabase migration (the user said "when switching … in future").
- Renaming/editing custom folders, multi-select bulk actions.
- Backfilling `userId` for notes created before login — handled by the one-time legacy-key migration only for the currently signed-in user.

