import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import {
  DiaryNote,
  DiaryFolder,
  DiaryNoteFormData,
  VIRTUAL_FOLDERS,
  DEFAULT_FOLDER_IDS,
} from '@/types/diary';
import { useTradesContext } from '@/contexts/TradesContext';
import { useAuth } from '@/contexts/AuthContext';
import { nowISO, auditISOValues } from '@/lib/datetime';

interface DiaryContextType {
  notes: DiaryNote[];
  folders: DiaryFolder[];
  selectedFolderId: string;
  selectedNoteId: string | null;
  setSelectedFolderId: (id: string) => void;
  setSelectedNoteId: (id: string | null) => void;
  getNotesForFolder: (folderId: string) => DiaryNote[];
  createNote: (data?: Partial<DiaryNoteFormData>) => DiaryNote | null;
  updateNote: (id: string, data: Partial<DiaryNoteFormData>) => void;
  deleteNote: (id: string) => void;
  linkNoteToTrade: (noteId: string, tradeId: string) => void;
  unlinkNoteFromTrade: (noteId: string) => void;
  linkNoteToDay: (noteId: string, date: string) => void;
  getNoteByTradeId: (tradeId: string) => DiaryNote | undefined;
  getSelectedNote: () => DiaryNote | undefined;
  createFolder: (name: string) => DiaryFolder | null;
  deleteFolder: (id: string) => void;
}

const DiaryContext = createContext<DiaryContextType | undefined>(undefined);

const NOTES_KEY = (userId: string) => `diary_notes_v1_${userId}`;
const FOLDERS_KEY = (userId: string) => `diary_folders_v1_${userId}`;
const LEGACY_NOTES_KEY = 'diary_notes';
const LEGACY_FOLDERS_KEY = 'diary_folders';

/** Coerce a folderId so it's either null or a real custom-folder id (never a virtual id). */
function sanitizeFolderId(folderId: string | null | undefined): string | null {
  if (!folderId) return null;
  if (DEFAULT_FOLDER_IDS.has(folderId)) return null;
  return folderId;
}

export const DiaryProvider = ({ children }: { children: ReactNode }) => {
  const { trades } = useTradesContext();
  const { user } = useAuth();
  const userId = user?.userId ?? null;

  const [notes, setNotes] = useState<DiaryNote[]>([]);
  const [customFolders, setCustomFolders] = useState<DiaryFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all-notes');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load (and one-time migrate) per-user data when the signed-in user changes.
  useEffect(() => {
    setHydrated(false);
    if (!userId) {
      setNotes([]);
      setCustomFolders([]);
      setSelectedFolderId('all-notes');
      setSelectedNoteId(null);
      setHydrated(true);
      return;
    }

    const notesKey = NOTES_KEY(userId);
    const foldersKey = FOLDERS_KEY(userId);

    let loadedNotes: DiaryNote[] = [];
    let loadedFolders: DiaryFolder[] = [];

    try {
      const raw = localStorage.getItem(notesKey);
      if (raw) loadedNotes = JSON.parse(raw);
    } catch { loadedNotes = []; }

    try {
      const raw = localStorage.getItem(foldersKey);
      if (raw) loadedFolders = JSON.parse(raw);
    } catch { loadedFolders = []; }

    // One-time legacy migration: if scoped storage is empty but legacy global keys exist,
    // adopt them for this user and stamp userId.
    const hasScopedData = loadedNotes.length > 0 || loadedFolders.length > 0;
    if (!hasScopedData) {
      let legacyNotes: Array<Partial<DiaryNote>> = [];
      let legacyFolders: Array<Partial<DiaryFolder>> = [];
      try {
        const raw = localStorage.getItem(LEGACY_NOTES_KEY);
        if (raw) legacyNotes = JSON.parse(raw);
      } catch { /* ignore */ }
      try {
        const raw = localStorage.getItem(LEGACY_FOLDERS_KEY);
        if (raw) legacyFolders = JSON.parse(raw);
      } catch { /* ignore */ }

      if (legacyNotes.length > 0 || legacyFolders.length > 0) {
        loadedNotes = legacyNotes.map(n => ({
          id: n.id ?? crypto.randomUUID(),
          userId,
          title: n.title ?? 'Untitled',
          content: n.content ?? '',
          folderId: sanitizeFolderId(n.folderId ?? null),
          linkedTradeId: n.linkedTradeId ?? null,
          linkedDate: n.linkedDate ?? null,
          createdAt: n.createdAt ?? nowISO(),
          updatedAt: n.updatedAt ?? nowISO(),
        }));
        loadedFolders = legacyFolders
          .filter(f => f.id && !DEFAULT_FOLDER_IDS.has(f.id))
          .map(f => ({
            id: f.id!,
            userId,
            name: f.name ?? 'Folder',
            type: 'custom',
            isDefault: false,
            createdAt: f.createdAt ?? nowISO(),
          }));
        // Remove legacy keys after migration so we don't migrate again.
        localStorage.removeItem(LEGACY_NOTES_KEY);
        localStorage.removeItem(LEGACY_FOLDERS_KEY);
      }
    }

    // Defensive: backfill userId on any record missing it (e.g. older scoped data from before this change).
    loadedNotes = loadedNotes.map(n => ({
      ...n,
      userId: n.userId || userId,
      folderId: sanitizeFolderId(n.folderId),
    }));
    loadedFolders = loadedFolders.map(f => ({
      ...f,
      userId: f.userId || userId,
    }));

    auditISOValues('DiaryContext.notes', loadedNotes.flatMap(n => [n.createdAt, n.updatedAt]));

    setNotes(loadedNotes);
    setCustomFolders(loadedFolders);
    setSelectedFolderId('all-notes');
    setSelectedNoteId(null);
    setHydrated(true);
  }, [userId]);

  // Persist notes (per-user). Skip until hydrated and only when signed in.
  useEffect(() => {
    if (!hydrated || !userId) return;
    localStorage.setItem(NOTES_KEY(userId), JSON.stringify(notes));
  }, [notes, userId, hydrated]);

  // Persist custom folders (per-user).
  useEffect(() => {
    if (!hydrated || !userId) return;
    localStorage.setItem(FOLDERS_KEY(userId), JSON.stringify(customFolders));
  }, [customFolders, userId, hydrated]);

  // FK cleanup parity with Postgres ON DELETE SET NULL: if a linked trade no longer exists, null the link.
  useEffect(() => {
    if (!hydrated) return;
    const tradeIds = new Set(trades.map(t => t.id));
    setNotes(prev => {
      let changed = false;
      const next = prev.map(n => {
        if (n.linkedTradeId && !tradeIds.has(n.linkedTradeId)) {
          changed = true;
          return { ...n, linkedTradeId: null, updatedAt: nowISO() };
        }
        return n;
      });
      return changed ? next : prev;
    });
  }, [trades, hydrated]);

  // Combine virtual folders with the user's custom folders for UI.
  const folders = useMemo<DiaryFolder[]>(() => {
    const virtual: DiaryFolder[] = VIRTUAL_FOLDERS.map(f => ({ ...f, userId: userId ?? '' }));
    return [...virtual, ...customFolders];
  }, [customFolders, userId]);

  // Get notes for a specific folder
  const getNotesForFolder = useCallback((folderId: string): DiaryNote[] => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];

    const sortByCreatedDesc = (a: DiaryNote, b: DiaryNote) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    switch (folder.type) {
      case 'all':
        return [...notes].sort(sortByCreatedDesc);
      case 'trade':
        return notes.filter(n => n.linkedTradeId !== null).sort(sortByCreatedDesc);
      case 'day':
        return notes.filter(n => n.linkedDate !== null).sort(sortByCreatedDesc);
      case 'custom':
        return notes.filter(n => n.folderId === folderId).sort(sortByCreatedDesc);
      default:
        return [];
    }
  }, [notes, folders]);

  // Create a new note
  const createNote = useCallback((data?: Partial<DiaryNoteFormData>): DiaryNote | null => {
    if (!userId) return null;
    const now = nowISO();

    let defaultTitle = 'Untitled';
    if (data?.linkedTradeId) {
      const trade = trades.find(t => t.id === data.linkedTradeId);
      if (trade) {
        const openDate = trade.entries[0]?.datetime
          ? new Date(trade.entries[0].datetime).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : '';
        defaultTitle = `${trade.symbol} : ${openDate}`;
      }
    } else if (data?.title) {
      defaultTitle = data.title;
    }

    const newNote: DiaryNote = {
      id: crypto.randomUUID(),
      userId,
      title: defaultTitle,
      content: data?.content || '',
      folderId: sanitizeFolderId(data?.folderId ?? null),
      linkedTradeId: data?.linkedTradeId || null,
      linkedDate: data?.linkedDate || null,
      createdAt: now,
      updatedAt: now,
    };

    setNotes(prev => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
    return newNote;
  }, [trades, userId]);

  // Update a note
  const updateNote = useCallback((id: string, data: Partial<DiaryNoteFormData>) => {
    setNotes(prev => prev.map(note => {
      if (note.id !== id) return note;
      const sanitized: Partial<DiaryNoteFormData> = { ...data };
      if ('folderId' in data) {
        sanitized.folderId = sanitizeFolderId(data.folderId ?? null);
      }
      return {
        ...note,
        ...sanitized,
        updatedAt: nowISO(),
      };
    }));
  }, []);

  // Delete a note
  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
  }, [selectedNoteId]);

  // Link a note to a trade
  const linkNoteToTrade = useCallback((noteId: string, tradeId: string) => {
    setNotes(prev => prev.map(note => {
      if (note.id !== noteId) return note;

      const trade = trades.find(t => t.id === tradeId);
      let title = note.title;

      if (trade) {
        const openDate = trade.entries[0]?.datetime
          ? new Date(trade.entries[0].datetime).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : '';
        title = `${trade.symbol} : ${openDate}`;
      }

      return {
        ...note,
        title,
        linkedTradeId: tradeId,
        linkedDate: null,
        updatedAt: nowISO(),
      };
    }));
  }, [trades]);

  // Unlink a note from a trade
  const unlinkNoteFromTrade = useCallback((noteId: string) => {
    setNotes(prev => prev.map(note => {
      if (note.id !== noteId) return note;
      return {
        ...note,
        linkedTradeId: null,
        updatedAt: nowISO(),
      };
    }));
  }, []);

  // Link a note to a day
  const linkNoteToDay = useCallback((noteId: string, date: string) => {
    setNotes(prev => prev.map(note => {
      if (note.id !== noteId) return note;
      return {
        ...note,
        linkedDate: date,
        linkedTradeId: null,
        updatedAt: nowISO(),
      };
    }));
  }, []);

  const getNoteByTradeId = useCallback((tradeId: string): DiaryNote | undefined => {
    return notes.find(n => n.linkedTradeId === tradeId);
  }, [notes]);

  const getSelectedNote = useCallback((): DiaryNote | undefined => {
    if (!selectedNoteId) return undefined;
    return notes.find(n => n.id === selectedNoteId);
  }, [notes, selectedNoteId]);

  // Create a custom folder
  const createFolder = useCallback((name: string): DiaryFolder | null => {
    if (!userId) return null;
    const newFolder: DiaryFolder = {
      id: crypto.randomUUID(),
      userId,
      name,
      type: 'custom',
      isDefault: false,
      createdAt: nowISO(),
    };
    setCustomFolders(prev => [...prev, newFolder]);
    return newFolder;
  }, [userId]);

  // Delete a custom folder
  const deleteFolder = useCallback((id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder?.isDefault) return;

    setCustomFolders(prev => prev.filter(f => f.id !== id));

    // Move notes from deleted folder to no folder (parity with ON DELETE SET NULL)
    setNotes(prev => prev.map(note => {
      if (note.folderId !== id) return note;
      return { ...note, folderId: null, updatedAt: nowISO() };
    }));

    if (selectedFolderId === id) {
      setSelectedFolderId('all-notes');
    }
  }, [folders, selectedFolderId]);

  return (
    <DiaryContext.Provider value={{
      notes,
      folders,
      selectedFolderId,
      selectedNoteId,
      setSelectedFolderId,
      setSelectedNoteId,
      getNotesForFolder,
      createNote,
      updateNote,
      deleteNote,
      linkNoteToTrade,
      unlinkNoteFromTrade,
      linkNoteToDay,
      getNoteByTradeId,
      getSelectedNote,
      createFolder,
      deleteFolder,
    }}>
      {children}
    </DiaryContext.Provider>
  );
};

export const useDiaryContext = (): DiaryContextType => {
  const context = useContext(DiaryContext);
  if (context === undefined) {
    throw new Error('useDiaryContext must be used within DiaryProvider');
  }
  return context;
};
