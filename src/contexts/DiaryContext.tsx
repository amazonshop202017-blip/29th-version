import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { DiaryNote, DiaryFolder, DiaryNoteFormData, DEFAULT_FOLDERS, DiaryFolderType } from '@/types/diary';
import { useTradesContext } from '@/contexts/TradesContext';
import { nowISO } from '@/lib/datetime';

interface DiaryContextType {
  notes: DiaryNote[];
  folders: DiaryFolder[];
  selectedFolderId: string;
  selectedNoteId: string | null;
  setSelectedFolderId: (id: string) => void;
  setSelectedNoteId: (id: string | null) => void;
  getNotesForFolder: (folderId: string) => DiaryNote[];
  createNote: (data?: Partial<DiaryNoteFormData>) => DiaryNote;
  updateNote: (id: string, data: Partial<DiaryNoteFormData>) => void;
  deleteNote: (id: string) => void;
  linkNoteToTrade: (noteId: string, tradeId: string) => void;
  unlinkNoteFromTrade: (noteId: string) => void;
  linkNoteToDay: (noteId: string, date: string) => void;
  getNoteByTradeId: (tradeId: string) => DiaryNote | undefined;
  getSelectedNote: () => DiaryNote | undefined;
  createFolder: (name: string) => DiaryFolder;
  deleteFolder: (id: string) => void;
}

const DiaryContext = createContext<DiaryContextType | undefined>(undefined);

const STORAGE_KEY = 'diary_notes';
const FOLDERS_STORAGE_KEY = 'diary_folders';

export const DiaryProvider = ({ children }: { children: ReactNode }) => {
  const { trades } = useTradesContext();

  // Load notes from localStorage
  const [notes, setNotes] = useState<DiaryNote[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Load custom folders from localStorage (merge with defaults)
  const [customFolders, setCustomFolders] = useState<DiaryFolder[]>(() => {
    const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Combine default folders with custom folders
  const folders = useMemo(() => [...DEFAULT_FOLDERS, ...customFolders], [customFolders]);

  const [selectedFolderId, setSelectedFolderId] = useState<string>('all-notes');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Persist notes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Persist custom folders to localStorage
  useEffect(() => {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(customFolders));
  }, [customFolders]);

  // Get notes for a specific folder
  const getNotesForFolder = useCallback((folderId: string): DiaryNote[] => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];

    let filtered: DiaryNote[];

    switch (folder.type) {
      case 'all':
        // All notes, sorted by date (newest first)
        filtered = [...notes].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'trade':
        // Only notes linked to trades
        filtered = notes
          .filter(n => n.linkedTradeId !== null)
          .sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        break;
      case 'day':
        // Only notes linked to specific days
        filtered = notes
          .filter(n => n.linkedDate !== null)
          .sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        break;
      case 'custom':
        // Notes in this custom folder
        filtered = notes
          .filter(n => n.folderId === folderId)
          .sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        break;
      default:
        filtered = [];
    }

    return filtered;
  }, [notes, folders]);

  // Create a new note
  const createNote = useCallback((data?: Partial<DiaryNoteFormData>): DiaryNote => {
    const now = nowISO();
    
    // Determine default title based on linked data
    let defaultTitle = 'Untitled';
    
    // If linking to a trade, use "SYMBOL : DATE" format
    if (data?.linkedTradeId) {
      const trade = trades.find(t => t.id === data.linkedTradeId);
      if (trade) {
        // Display in user's local time (toLocaleDateString uses local tz automatically)
        const openDate = trade.entries[0]?.datetime 
          ? new Date(trade.entries[0].datetime).toLocaleDateString('en-US', { 
              month: 'short', 
              day: '2-digit', 
              year: 'numeric' 
            })
          : '';
        defaultTitle = `${trade.symbol} : ${openDate}`;
      }
    } else if (data?.title) {
      // Use provided title (for Day Notes)
      defaultTitle = data.title;
    }
    
    const newNote: DiaryNote = {
      id: crypto.randomUUID(),
      title: defaultTitle,
      content: data?.content || '',
      folderId: data?.folderId || null,
      linkedTradeId: data?.linkedTradeId || null,
      linkedDate: data?.linkedDate || null,
      createdAt: now,
      updatedAt: now,
    };

    setNotes(prev => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
    return newNote;
  }, [trades]);

  // Update a note
  const updateNote = useCallback((id: string, data: Partial<DiaryNoteFormData>) => {
    setNotes(prev => prev.map(note => {
      if (note.id !== id) return note;
      return {
        ...note,
        ...data,
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
      
      // Find the trade to update title
      const trade = trades.find(t => t.id === tradeId);
      let title = note.title;
      
      if (trade) {
        const openDate = trade.entries[0]?.datetime 
          ? new Date(trade.entries[0].datetime).toLocaleDateString('en-US', { 
              month: 'short', 
              day: '2-digit', 
              year: 'numeric' 
            })
          : '';
        title = `${trade.symbol} : ${openDate}`;
      }

      return {
        ...note,
        title,
        linkedTradeId: tradeId,
        linkedDate: null, // Clear day link when linking to trade
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
        linkedTradeId: null, // Clear trade link when linking to day
        updatedAt: nowISO(),
      };
    }));
  }, []);

  // Get a note by trade ID
  const getNoteByTradeId = useCallback((tradeId: string): DiaryNote | undefined => {
    return notes.find(n => n.linkedTradeId === tradeId);
  }, [notes]);

  // Get the currently selected note
  const getSelectedNote = useCallback((): DiaryNote | undefined => {
    if (!selectedNoteId) return undefined;
    return notes.find(n => n.id === selectedNoteId);
  }, [notes, selectedNoteId]);

  // Create a custom folder
  const createFolder = useCallback((name: string): DiaryFolder => {
    const newFolder: DiaryFolder = {
      id: crypto.randomUUID(),
      name,
      type: 'custom',
      isDefault: false,
      createdAt: nowISO(),
    };
    setCustomFolders(prev => [...prev, newFolder]);
    return newFolder;
  }, []);

  // Delete a custom folder
  const deleteFolder = useCallback((id: string) => {
    // Don't delete default folders
    const folder = folders.find(f => f.id === id);
    if (folder?.isDefault) return;

    setCustomFolders(prev => prev.filter(f => f.id !== id));
    
    // Move notes from deleted folder to no folder
    setNotes(prev => prev.map(note => {
      if (note.folderId !== id) return note;
      return { ...note, folderId: null };
    }));

    // Reset selection if viewing deleted folder
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
