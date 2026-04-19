import { useState, useCallback, useRef, DragEvent } from 'react';
import { Upload, Link2, Trash2, ImageIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useScreenshotTagsContext } from '@/contexts/ScreenshotTagsContext';
import { TradeScreenshot } from '@/types/trade';
import { cn } from '@/lib/utils';
import { nowISO } from '@/lib/datetime';

interface ScreenshotsTabProps {
  screenshots: TradeScreenshot[];
  onScreenshotsChange: (screenshots: TradeScreenshot[]) => void;
}

export const ScreenshotsTab = ({ screenshots, onScreenshotsChange }: ScreenshotsTabProps) => {
  const { screenshotTags } = useScreenshotTagsContext();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewingScreenshot, setViewingScreenshot] = useState<TradeScreenshot | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract TradingView snapshot ID from URL or text
  const extractTradingViewId = (input: string): string | null => {
    const trimmed = input.trim();
    
    // Direct ID pattern (e.g., "DgJL3X5F")
    if (/^[A-Za-z0-9]{8}$/.test(trimmed)) {
      return trimmed;
    }
    
    // URL patterns
    const patterns = [
      /tradingview\.com\/x\/([A-Za-z0-9]{8})/,
      /s3\.tradingview\.com\/snapshots\/[a-z]\/([A-Za-z0-9]{8})\.png/,
      /tradingview\.com\/chart\/.*\/([A-Za-z0-9]{8})/,
    ];
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  };

  // Add a screenshot
  const addScreenshot = useCallback((imageData: string) => {
    const newScreenshot: TradeScreenshot = {
      id: crypto.randomUUID(),
      imageData,
      createdAt: nowISO(),
    };
    onScreenshotsChange([...screenshots, newScreenshot]);
    setInputValue('');
    setError(null);
  }, [screenshots, onScreenshotsChange]);

  // Fetch TradingView snapshot
  const fetchTradingViewSnapshot = async (snapshotId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const firstChar = snapshotId[0].toLowerCase();
      const imageUrl = `https://s3.tradingview.com/snapshots/${firstChar}/${snapshotId}.png`;
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Snapshot not found');
      }
      
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        addScreenshot(base64);
      };
      reader.onerror = () => {
        setError('Failed to process image');
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setError('Failed to fetch TradingView snapshot. Please check the link or ID.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle grab button click
  const handleGrab = () => {
    const snapshotId = extractTradingViewId(inputValue);
    if (snapshotId) {
      fetchTradingViewSnapshot(snapshotId);
    } else if (inputValue.trim()) {
      // Check if it's a valid image URL
      if (/\.(jpg|jpeg|png|gif|webp)$/i.test(inputValue.trim())) {
        fetchImageFromUrl(inputValue.trim());
      } else {
        setError('Invalid TradingView link or image URL');
      }
    }
  };

  // Fetch image from any URL
  const fetchImageFromUrl = async (url: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        addScreenshot(reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch {
      setError('Failed to fetch image from URL');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file input
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          addScreenshot(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // Handle paste event
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            addScreenshot(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  }, [addScreenshot]);

  // Handle drag and drop
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  // Remove screenshot
  const removeScreenshot = (id: string) => {
    onScreenshotsChange(screenshots.filter(s => s.id !== id));
  };

  // Update screenshot tag
  const updateScreenshotTag = (screenshotId: string, tagId: string) => {
    onScreenshotsChange(
      screenshots.map(s => 
        s.id === screenshotId 
          ? { ...s, tagId: tagId || undefined }
          : s
      )
    );
  };

  // Get tag by ID
  const getTagById = (tagId?: string) => {
    if (!tagId) return null;
    return screenshotTags.find(t => t.id === tagId);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Add Screenshot</h3>
        
        {/* Input Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-6 transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border",
            "hover:border-muted-foreground/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            
            <div className="text-center">
              <p className="text-sm text-foreground font-medium">
                Drop image, paste, or enter TradingView link
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports TradingView URLs, snapshot IDs, or direct image files
              </p>
            </div>

            {/* TradingView Link Input */}
            <div className="w-full flex gap-2">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGrab()}
                  placeholder="https://www.tradingview.com/x/DgJL3X5F or DgJL3X5F"
                  className="pl-10 h-10 bg-input border-border"
                />
              </div>
              <Button
                onClick={handleGrab}
                disabled={!inputValue.trim() || isLoading}
                className="h-10 px-4"
              >
                {isLoading ? 'Loading...' : 'Grab'}
              </Button>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            {/* File Upload Button */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">or</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Screenshots List - Full Width */}
      {screenshots.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">
            Screenshots ({screenshots.length})
          </h3>
          
          <div className="space-y-4">
            {screenshots.map((screenshot) => {
              const tag = getTagById(screenshot.tagId);
              return (
                <div
                  key={screenshot.id}
                  className="relative group rounded-lg overflow-hidden border border-border"
                >
                  <img
                    src={screenshot.imageData}
                    alt="Trade screenshot"
                    className="w-full object-contain cursor-pointer"
                    onClick={() => setViewingScreenshot(screenshot)}
                  />
                  
                  {/* Tag badge (always visible if tagged) */}
                  {tag && (
                    <div 
                      className="absolute top-3 left-3 px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </div>
                  )}
                  
                  {/* Overlay controls (visible on hover) */}
                  <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Select 
                      value={screenshot.tagId || "none"} 
                      onValueChange={(val) => updateScreenshotTag(screenshot.id, val === "none" ? "" : val)}
                    >
                      <SelectTrigger className="h-8 w-[140px] bg-background/90 backdrop-blur border-border text-xs">
                        <SelectValue placeholder="Add tag" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No tag</SelectItem>
                        {screenshotTags.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2.5 h-2.5 rounded-full" 
                                style={{ backgroundColor: t.color }}
                              />
                              {t.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <button
                      onClick={() => removeScreenshot(screenshot.id)}
                      className="p-2 rounded-md bg-background/90 backdrop-blur hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fullscreen View Dialog */}
      <Dialog open={!!viewingScreenshot} onOpenChange={(open) => !open && setViewingScreenshot(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur">
          {viewingScreenshot && (
            <img
              src={viewingScreenshot.imageData}
              alt="Trade screenshot fullscreen"
              className="w-full h-full object-contain max-h-[85vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
