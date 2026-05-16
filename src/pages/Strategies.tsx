import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Check, X, Target, ChevronRight, MoreVertical, ClipboardList, LayoutList, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useStrategiesContext } from '@/contexts/StrategiesContext';
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useNavigate } from 'react-router-dom';
import { calculateStrategyStats } from '@/lib/strategyStats';
import { StrategyChecklistEditor } from '@/components/strategy/StrategyChecklistEditor';
import { SetupCard } from '@/components/strategy/SetupCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Strategies = () => {
  const { strategies, addStrategy, removeStrategy, updateStrategy, updateStrategyChecklist } = useStrategiesContext();
  const { filteredTrades } = useFilteredTrades();
  const { formatCurrency } = useGlobalFilters();
  const navigate = useNavigate();
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [checklistEditorOpen, setChecklistEditorOpen] = useState(false);
  const [editingChecklistStrategy, setEditingChecklistStrategy] = useState<{ id: string; name: string; items: string[] } | null>(null);

  const formatPercent = (value: number) => {
    return `${Math.round(value)}%`;
  };

  // Calculate stats for all strategies using filtered trades
  const strategiesWithStats = useMemo(() => {
    return strategies.map(strategy => ({
      ...strategy,
      stats: calculateStrategyStats(strategy.id, filteredTrades),
    }));
  }, [strategies, filteredTrades]);

  const handleAddStrategy = () => {
    if (newName.trim()) {
      addStrategy(newName.trim(), newDescription.trim());
      setNewName('');
      setNewDescription('');
      setShowAddForm(false);
    }
  };

  const startEditing = (id: string, name: string, description: string) => {
    setEditingId(id);
    setEditName(name);
    setEditDescription(description);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateStrategy(editingId, editName.trim(), editDescription.trim());
    }
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const openChecklistEditor = (strategyId: string, strategyName: string, items: string[]) => {
    setEditingChecklistStrategy({ id: strategyId, name: strategyName, items });
    setChecklistEditorOpen(true);
  };

  const handleSaveChecklist = (items: string[]) => {
    if (editingChecklistStrategy) {
      updateStrategyChecklist(editingChecklistStrategy.id, items);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center">
          <div className="flex items-center gap-1 border border-border rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Table view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Setup
        </Button>
      </div>

      {/* Add Strategy Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold mb-4">New Setup</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Setup Name</label>
                <Input
                  placeholder="Enter setup name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-input border-border"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
                <Textarea
                  placeholder="Describe your setup..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="bg-input border-border resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStrategy} disabled={!newName.trim()}>
                  Create Setup
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Strategies Table */}
      {viewMode === 'table' && (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">Your Setups</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Click a setup to view its performance</p>
          </div>
        </div>

        {strategies.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No setups created yet</p>
            <p className="text-sm">Add your first setup to start organizing trades</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              {/* Table Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div>Title</div>
                <div className="text-right">Average Loser</div>
                <div className="text-right">Average Winner</div>
                <div className="text-right">Total Net P&L</div>
                <div className="text-right">Profit Factor</div>
                <div className="text-right">Trades</div>
                <div className="text-right">Expectancy</div>
                <div className="text-right">Win Rate</div>
                <div className="w-8"></div>
              </div>

              {/* Table Body */}
              <AnimatePresence>
                {strategiesWithStats.map((strategy) => (
                  <motion.div
                    key={strategy.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b border-border hover:bg-muted/20 transition-colors group"
                  >
                    {editingId === strategy.id ? (
                      <div className="col-span-11 space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="bg-background border-border h-8"
                          autoFocus
                        />
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="bg-background border-border resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="default" onClick={saveEdit}>
                            <Check className="w-4 h-4 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => navigate(`/strategies/${strategy.id}`)}
                        >
                          <span className="font-medium text-foreground hover:text-primary transition-colors">
                            {strategy.name.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right text-sm flex items-center justify-end">
                          <span className={strategy.stats.avgLoser < 0 ? 'text-loss' : 'text-muted-foreground'}>
                            {formatCurrency(strategy.stats.avgLoser)}
                          </span>
                        </div>
                        <div className="text-right text-sm flex items-center justify-end">
                          <span className={strategy.stats.avgWinner > 0 ? 'text-profit' : 'text-muted-foreground'}>
                            {formatCurrency(strategy.stats.avgWinner)}
                          </span>
                        </div>
                        <div className="text-right text-sm flex items-center justify-end">
                          <span className={strategy.stats.totalNetPnL >= 0 ? 'text-profit' : 'text-loss'}>
                            {formatCurrency(strategy.stats.totalNetPnL)}
                          </span>
                        </div>
                        <div className="text-right text-sm text-muted-foreground flex items-center justify-end">
                          {strategy.stats.profitFactor.toFixed(2)}
                        </div>
                        <div className="text-right text-sm text-muted-foreground flex items-center justify-end">
                          {strategy.stats.totalTrades}
                        </div>
                        <div className="text-right text-sm flex items-center justify-end">
                          <span className={strategy.stats.expectancy >= 0 ? 'text-profit' : 'text-loss'}>
                            {formatCurrency(strategy.stats.expectancy)}
                          </span>
                        </div>
                        <div className="text-right text-sm text-muted-foreground flex items-center justify-end">
                          {formatPercent(strategy.stats.winRate)}
                        </div>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/strategies/${strategy.id}`); }}>
                                <ChevronRight className="w-4 h-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startEditing(strategy.id, strategy.name, strategy.description); }}>
                                <Edit2 className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openChecklistEditor(strategy.id, strategy.name, strategy.checklistItems || []); }}>
                                <ClipboardList className="w-4 h-4 mr-2" /> Edit Checklist
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); removeStrategy(strategy.id); }} className="text-loss focus:text-loss">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Mobile/Tablet Card Layout */}
            <div className="lg:hidden divide-y divide-border">
              <AnimatePresence>
                {strategiesWithStats.map((strategy) => (
                  <motion.div
                    key={strategy.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-4"
                  >
                    {editingId === strategy.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="bg-background border-border h-8"
                          autoFocus
                        />
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="bg-background border-border resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="default" onClick={saveEdit}>
                            <Check className="w-4 h-4 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className="font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                            onClick={() => navigate(`/strategies/${strategy.id}`)}
                          >
                            {strategy.name.toUpperCase()}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/strategies/${strategy.id}`); }}>
                                <ChevronRight className="w-4 h-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startEditing(strategy.id, strategy.name, strategy.description); }}>
                                <Edit2 className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openChecklistEditor(strategy.id, strategy.name, strategy.checklistItems || []); }}>
                                <ClipboardList className="w-4 h-4 mr-2" /> Edit Checklist
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); removeStrategy(strategy.id); }} className="text-loss focus:text-loss">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Net P&L</p>
                            <p className={cn("font-medium", strategy.stats.totalNetPnL >= 0 ? 'text-profit' : 'text-loss')}>
                              {formatCurrency(strategy.stats.totalNetPnL)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Win Rate</p>
                            <p className="font-medium">{formatPercent(strategy.stats.winRate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Trades</p>
                            <p className="font-medium">{strategy.stats.totalTrades}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Profit Factor</p>
                            <p className="font-medium">{strategy.stats.profitFactor.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
      )}

      {/* Setup Overview Cards */}
      {viewMode === 'card' && strategiesWithStats.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold">Setup Overview</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">At-a-glance performance per setup</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {strategiesWithStats.map((s) => (
              <SetupCard
                key={s.id}
                id={s.id}
                name={s.name}
                description={s.description}
                stats={s.stats}
                onOpen={() => navigate(`/strategies/${s.id}`)}
                onEdit={() => startEditing(s.id, s.name, s.description)}
                onEditChecklist={() => openChecklistEditor(s.id, s.name, s.checklistItems || [])}
                onDelete={() => removeStrategy(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {editingChecklistStrategy && (
        <StrategyChecklistEditor
          isOpen={checklistEditorOpen}
          onClose={() => {
            setChecklistEditorOpen(false);
            setEditingChecklistStrategy(null);
          }}
          strategyName={editingChecklistStrategy.name}
          checklistItems={editingChecklistStrategy.items}
          onSave={handleSaveChecklist}
        />
      )}
    </div>
  );
};

export default Strategies;
