

## Diary: Enable "New Note" in Custom Folders

Currently, the "New note" button only appears in the default **Trade Notes** and **Day Notes** folders. Custom folders created by the user have no way to add notes. This plan extends note creation to all custom folders with a small chooser to pick the note type.

### What changes for the user

1. **Custom folders** (and "All Notes") now show the **+ New note** button at the top of the notes list, just like Trade Notes / Day Notes.
2. Clicking **+ New note** in a custom folder opens a small dialog asking:
   - **Trade Note** — creates a blank trade note in this folder (linked to a trade later via the existing link flow).
   - **Day Note** — opens the existing "Select Day" modal, then creates a day note linked to that date in this folder.
3. The new note is saved into the **currently selected folder** (`folderId` set), so it appears under that folder immediately.
4. Behavior in default Trade Notes / Day Notes folders is unchanged.

### Implementation details

**File: `src/components/diary/DiaryNotesList.tsx`**

- Replace the `canCreateNote` gate so the **+ New note** button shows for: `trade`, `day`, `all`, and `custom` folder types (every folder).
- Add new state: `isNoteTypeChooserOpen: boolean` and `pendingFolderId: string | null`.
- Update `handleNewNote()`:
  - If `currentFolder.type === 'trade'` → keep current behavior (create blank trade note, no `folderId`… see note below).
  - If `currentFolder.type === 'day'` → open `SelectDayModal` as today.
  - If `currentFolder.type === 'custom'` or `'all'` → open new **Note Type Chooser** dialog.
- Pass the active `folderId` into both creation paths so notes are stored in the selected custom folder:
  - Trade note path: `createNote({ title: '', content: '', folderId: selectedFolderId })` (only set folderId when not a default folder; for default Trade Notes folder leave as today).
  - Day note path (`handleDayNoteCreate`): include `folderId: selectedFolderId` when the active folder is custom.
- Add a new lightweight inline component **`NoteTypeChooserDialog`** (built with existing `Dialog` from `@/components/ui/dialog`) with two large buttons: **Trade Note** and **Day Note**. Selecting Day Note closes this dialog and opens `SelectDayModal`.

**Folder assignment rule (kept simple):**
- Default folders (`all-notes`, `trade-notes`, `day-notes`) are virtual buckets — notes are filtered into them by `linkedTradeId` / `linkedDate`. So when creating from those, do **not** set `folderId`.
- Custom folders — set `folderId: selectedFolderId` so `getNotesForFolder` returns it.

**No changes needed to** `DiaryContext`, `DiaryFolderSidebar`, or `types/diary.ts` — `DiaryNote.folderId` and `createNote` already support this.

### Edge cases handled

- "All Notes" also gets the **+ New note** button (chooser dialog), since users may want a quick capture there. Created note has no `folderId` (lives only in All Notes view) but is typed as trade or day note correctly.
- Cancelling either dialog leaves no partial note.
- Existing keyboard/escape behavior of `Dialog` is reused.

### Out of scope

- Renaming custom folders, drag-to-move notes between folders, multi-select bulk actions — not requested.

