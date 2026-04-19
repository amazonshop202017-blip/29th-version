import { nowISO, type ISODateString } from '@/lib/datetime';

export type DiaryFolderType = 'all' | 'trade' | 'day' | 'custom';

export interface DiaryFolder {
  id: string;
  name: string;
  type: DiaryFolderType;
  isDefault: boolean;
  createdAt: ISODateString;
}

export interface DiaryNote {
  id: string;
  title: string;
  content: string; // HTML content from rich text editor
  folderId: string | null; // null means it's in "All Notes" only
  linkedTradeId: string | null; // Link to a specific trade
  /** Calendar-day key in YYYY-MM-DD form (NOT a timestamp — intentionally tz-naive). */
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

// Default folders that cannot be deleted
export const DEFAULT_FOLDERS: DiaryFolder[] = [
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
