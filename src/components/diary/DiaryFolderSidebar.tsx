import { FileText, BarChart3, Calendar, FolderPlus, MoreHorizontal, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useDiaryContext } from '@/contexts/DiaryContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const getFolderIcon = (type: string) => {
  switch (type) {
    case 'all':
      return FileText;
    case 'trade':
      return BarChart3;
    case 'day':
      return Calendar;
    default:
      return FileText;
  }
};

export const DiaryFolderSidebar = () => {
  const { folders, selectedFolderId, setSelectedFolderId, createFolder, deleteFolder, getNotesForFolder } = useDiaryContext();
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    folders: true,
    custom: true,
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddFolderOpen(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const defaultFolders = folders.filter(f => f.isDefault);
  const customFolders = folders.filter(f => !f.isDefault);

  return (
    <div className="h-full flex flex-col border-r border-border/50 bg-card/30">
      {/* Add Folder Button */}
      <div className="p-3 border-b border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-accent-foreground hover:bg-accent [&_svg]:text-muted-foreground hover:[&_svg]:text-accent-foreground transition-colors"
          onClick={() => setIsAddFolderOpen(true)}
        >
          <FolderPlus className="h-4 w-4" />
          Add folder
        </Button>
      </div>

      {/* Folders Section */}
      <div className="flex-1 overflow-y-auto">
        {/* Default Folders */}
        <div className="py-2">
          <button
            onClick={() => toggleSection('folders')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {expandedSections.folders ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Folders
          </button>
          
          {expandedSections.folders && (
            <div className="mt-1 space-y-0.5">
              {defaultFolders.map(folder => {
                const Icon = getFolderIcon(folder.type);
                const noteCount = getNotesForFolder(folder.id).length;
                const isSelected = selectedFolderId === folder.id;

                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                      isSelected 
                        ? "bg-primary/10 text-primary border-l-2 border-primary" 
                        : "text-muted-foreground hover:bg-muted/50 border-l-2 border-transparent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{folder.name}</span>
                    {noteCount > 0 && (
                      <span className="text-xs text-muted-foreground">{noteCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Folders */}
        {customFolders.length > 0 && (
          <div className="py-2 border-t border-border/50">
            <button
              onClick={() => toggleSection('custom')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expandedSections.custom ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              My Notes
            </button>

            {expandedSections.custom && (
              <div className="mt-1 space-y-0.5">
                {customFolders.map(folder => {
                  const noteCount = getNotesForFolder(folder.id).length;
                  const isSelected = selectedFolderId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer",
                        isSelected 
                          ? "bg-primary/10 text-primary border-l-2 border-primary" 
                          : "text-muted-foreground hover:bg-muted/50 border-l-2 border-transparent"
                      )}
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="flex-1 text-left truncate">{folder.name}</span>
                      {noteCount > 0 && (
                        <span className="text-xs text-muted-foreground">{noteCount}</span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover z-50">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFolder(folder.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Folder Dialog */}
      <Dialog open={isAddFolderOpen} onOpenChange={setIsAddFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
