import { nowISO, type ISODateString } from '@/lib/datetime';

export type DiaryFolderType = 'all' | 'trade' | 'day' | 'custom';

/**
 * A custom user-created folder. Maps 1:1 to a future Postgres `diary_folders` row.
 *
 * Default folders ("All Notes", "Trade Notes", "Day Notes") are NOT persisted
 * as DiaryFolder records — they are virtual UI buckets, see `VIRTUAL_FOLDERS`.
 */
export interface DiaryFolder {
  id: string;
  /** Owner. Required for Postgres FK + RLS (`user_id = auth.uid()`). */
  userId: string;
  name: string;
  type: DiaryFolderType;
  isDefault: boolean;
  createdAt: ISODateString;
}

export interface DiaryNote {
  id: string;
  /** Owner. Required for Postgres FK + RLS (`user_id = auth.uid()`). */
  userId: string;
  title: string;
  content: string; // HTML content from rich text editor
  /**
   * MUST be `null` or reference the `id` of a real custom folder owned by this user.
   * NEVER a virtual/default folder id (`all-notes`, `trade-notes`, `day-notes`) —
   * those are UI buckets and would break FK integrity in Postgres.
   */
  folderId: string | null;
  /** Link to a specific trade. Postgres equivalent: ON DELETE SET NULL. */
  linkedTradeId: string | null;
  /** Calendar-day key in YYYY-MM-DD form (NOT a timestamp — intentionally tz-naive). Maps to Postgres DATE. */
  linkedDate: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface DiaryNoteFormData {
  title: string;
  content: string;
  folderId?: string | null;
  linkedTradeId?: string | null;
  linkedDate?: string | null;
}

/** IDs of the virtual default folders. Used to sanitize incoming `folderId` values. */
export const DEFAULT_FOLDER_IDS = new Set<string>(['all-notes', 'trade-notes', 'day-notes']);

/**
 * Virtual UI buckets. NOT stored in the future Postgres `diary_folders` table.
 * The notes list filters real notes into these views by `linkedTradeId` / `linkedDate`.
 */
export const VIRTUAL_FOLDERS: Omit<DiaryFolder, 'userId'>[] = [
  {
    id: 'all-notes',
    name: 'All Notes',
    type: 'all',
    isDefault: true,
    createdAt: nowISO(),
  },
  {
    id: 'trade-notes',
    name: 'Trade Notes',
    type: 'trade',
    isDefault: true,
    createdAt: nowISO(),
  },
  {
    id: 'day-notes',
    name: 'Day Notes',
    type: 'day',
    isDefault: true,
    createdAt: nowISO(),
  },
];

/** @deprecated Kept for backwards-compat imports. Use `VIRTUAL_FOLDERS` instead. */
export const DEFAULT_FOLDERS = VIRTUAL_FOLDERS;
