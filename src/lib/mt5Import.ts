import { TradeFormData, TradeEntry } from '@/types/trade';

export interface MT5ImportResult {
  success: boolean;
  tradesImported: number;
  rowsSkipped: number;
  errors: string[];
  importedSymbols: string[];
}

// ========================
// STEP 1 — HTML → CSV
// ========================

export function parseMT5HtmlToCSV(htmlContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  const rows = doc.querySelectorAll('tr');
  const capturedRows: string[][] = [];
  let capturing = false;
  
  for (const row of rows) {
    // Check for section headers (th with colspan)
    const thElements = row.querySelectorAll('th[colspan]');
    
    for (const th of thElements) {
      const headerText = th.textContent?.trim() || '';
      
      if (headerText === 'Positions') {
        capturing = true;
        continue;
      }
      
      // Stop capturing when another colspan header is encountered after capture started
      if (capturing && headerText !== 'Positions' && headerText.length > 0) {
        capturing = false;
        break;
      }
    }
    
    if (!capturing) continue;
    
    // Capture cells from this row
    const cells = row.querySelectorAll('td, th');
    const rowData: string[] = [];
    
    for (const cell of cells) {
      // Exclude cells with class "hidden"
      if (cell.classList.contains('hidden')) continue;
      
      const cellText = cell.textContent?.trim() || '';
      rowData.push(cellText);
    }
    
    // Add row only if it contains at least one cell
    if (rowData.length > 0) {
      capturedRows.push(rowData);
    }
  }
  
  if (capturedRows.length === 0) {
    throw new Error('No Positions section found in MT5 HTML file');
  }
  
  // Construct CSV
  const csvLines = capturedRows.map(row => 
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  );
  
  return csvLines.join('\n');
}

// ========================
// STEP 2 — CSV → Trades
// ========================

interface ColumnIndexes {
  time1: number;      // Entry time
  time2: number;      // Exit time
  symbol: number;
  type: number;
  volume: number;
  price1: number;     // Entry price
  price2: number;     // Exit price
  commission: number;
  profit: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function findColumnIndexes(headers: string[]): ColumnIndexes {
  // Store headers as array with indexes to handle duplicate column names
  // MT5 has duplicate "Time" and "Price" columns
  const headerEntries: { name: string; index: number }[] = headers.map((h, i) => ({
    name: h.toLowerCase().trim(),
    index: i,
  }));
  
  // Find all Time columns (first = entry, second = exit)
  const timeIndexes: number[] = headerEntries
    .filter(h => h.name === 'time')
    .map(h => h.index);
  
  // Find all Price columns (first = entry, second = exit)
  const priceIndexes: number[] = headerEntries
    .filter(h => h.name === 'price')
    .map(h => h.index);
  
  // Find unique columns by their first occurrence
  const symbolIndex = headerEntries.find(h => h.name === 'symbol')?.index ?? -1;
  const typeIndex = headerEntries.find(h => h.name === 'type')?.index ?? -1;
  const volumeIndex = headerEntries.find(h => h.name === 'volume')?.index ?? -1;
  const commissionIndex = headerEntries.find(h => h.name === 'commission')?.index ?? -1;
  const profitIndex = headerEntries.find(h => h.name === 'profit')?.index ?? -1;
  
  // Validate required columns
  const missing: string[] = [];
  
  // Time and Price require exactly 2 columns each (duplicates expected)
  if (timeIndexes.length < 2) missing.push(`Time (found ${timeIndexes.length}, need 2)`);
  if (priceIndexes.length < 2) missing.push(`Price (found ${priceIndexes.length}, need 2)`);
  
  // Unique columns must exist
  if (symbolIndex === -1) missing.push('Symbol');
  if (typeIndex === -1) missing.push('Type');
  if (volumeIndex === -1) missing.push('Volume');
  if (commissionIndex === -1) missing.push('Commission');
  if (profitIndex === -1) missing.push('Profit');
  
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }
  
  return {
    time1: timeIndexes[0],      // Entry time (first occurrence)
    time2: timeIndexes[1],      // Exit time (second occurrence)
    symbol: symbolIndex,
    type: typeIndex,
    volume: volumeIndex,
    price1: priceIndexes[0],    // Entry price (first occurrence)
    price2: priceIndexes[1],    // Exit price (second occurrence)
    commission: commissionIndex,
    profit: profitIndex,
  };
}

function parseMT5DateTime(dateTimeStr: string): string {
  // Format: YYYY.MM.DD HH:MM:SS → ISO format
  const cleaned = dateTimeStr.trim();
  const [datePart, timePart] = cleaned.split(' ');
  
  if (!datePart || !timePart) {
    throw new Error(`Invalid datetime format: ${dateTimeStr}`);
  }
  
  const [year, month, day] = datePart.split('.');
  const isoDate = `${year}-${month}-${day}T${timePart}`;
  
  return isoDate;
}

function parseNumber(value: string): number {
  const cleaned = value.trim().replace(/\s/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function findHeaderRowIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    
    // Normalize cells: remove quotes, trim whitespace
    const normalizedCells = cells.map(c => c.replace(/^["']|["']$/g, '').trim());
    
    // Count non-empty cells
    const nonEmptyCells = normalizedCells.filter(c => c.length > 0);
    if (nonEmptyCells.length < 5) continue;
    
    // Check if row contains both "Time" and "Symbol" (case-insensitive)
    const lowerCells = normalizedCells.map(c => c.toLowerCase());
    const hasTime = lowerCells.includes('time');
    const hasSymbol = lowerCells.includes('symbol');
    
    if (hasTime && hasSymbol) {
      return i;
    }
  }
  
  return -1; // Header not found
}

export function parseCSVToTrades(
  csvContent: string,
  accountId: string,
  accountBalanceSnapshot: number,
  contractSizes?: Record<string, number>
): { trades: TradeFormData[]; skipped: number } {
  const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }
  
  // Find the header row dynamically
  const headerRowIndex = findHeaderRowIndex(lines);
  
  if (headerRowIndex === -1) {
    throw new Error('Could not locate MT5 Positions header row in CSV.');
  }
  
  const headerLine = lines[headerRowIndex];
  const headers = parseCSVLine(headerLine).map(h => h.replace(/^["']|["']$/g, '').trim());
  const indexes = findColumnIndexes(headers);
  
  const trades: TradeFormData[] = [];
  let skipped = 0;
  
  // Data rows start after the header row
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const values = parseCSVLine(line);
    
    try {
      const entryTimeStr = values[indexes.time1];
      const exitTimeStr = values[indexes.time2];
      const symbol = values[indexes.symbol]?.trim();
      const typeStr = values[indexes.type]?.toLowerCase().trim();
      const volumeStr = values[indexes.volume];
      const entryPriceStr = values[indexes.price1];
      const exitPriceStr = values[indexes.price2];
      const commissionStr = values[indexes.commission];
      const profitStr = values[indexes.profit];
      
      // Validate required fields
      const entryPrice = parseNumber(entryPriceStr);
      const exitPrice = parseNumber(exitPriceStr);
      const volume = parseNumber(volumeStr);
      const profit = parseNumber(profitStr);
      
      if (!entryPrice || !exitPrice || !volume) {
        skipped++;
        continue;
      }
      
      // Parse direction
      const side: 'LONG' | 'SHORT' = typeStr === 'buy' ? 'LONG' : 'SHORT';
      
      // Parse dates
      const entryDateTime = parseMT5DateTime(entryTimeStr);
      const exitDateTime = parseMT5DateTime(exitTimeStr);
      
      // Parse fees (commission is typically negative in MT5)
      const commission = Math.abs(parseNumber(commissionStr));
      
      // Calculate gross PnL: netPnl = grossPnl - fees, so grossPnl = netPnl + fees
      const netPnl = profit;
      const grossPnl = netPnl + commission;
      
      // Create entry and exit trades
      const entries: TradeEntry[] = [];
      
      if (side === 'LONG') {
        // LONG: Entry = BUY, Exit = SELL
        entries.push({
          id: crypto.randomUUID(),
          type: 'BUY',
          datetime: entryDateTime,
          quantity: volume,
          price: entryPrice,
          charges: commission / 2, // Split commission between entry and exit
        });
        entries.push({
          id: crypto.randomUUID(),
          type: 'SELL',
          datetime: exitDateTime,
          quantity: volume,
          price: exitPrice,
          charges: commission / 2,
        });
      } else {
        // SHORT: Entry = SELL, Exit = BUY
        entries.push({
          id: crypto.randomUUID(),
          type: 'SELL',
          datetime: entryDateTime,
          quantity: volume,
          price: entryPrice,
          charges: commission / 2,
        });
        entries.push({
          id: crypto.randomUUID(),
          type: 'BUY',
          datetime: exitDateTime,
          quantity: volume,
          price: exitPrice,
          charges: commission / 2,
        });
      }
      
      // Calculate Return % at import time based on ACCOUNT BALANCE (not invested amount)
      // Return % = (Net P&L / Account Balance at Trade Time) * 100
      // This ensures consistency with manual trades and prevents inflated percentages
      const calculatedReturnPercent = accountBalanceSnapshot > 0 
        ? (netPnl / accountBalanceSnapshot) * 100 
        : 0;
      
      // Calculate R-Multiple if we have trade risk (MT5 doesn't provide this, so it stays 0)
      const calculatedRMultiple = 0; // No trade risk from MT5, so R-Multiple is not applicable
      
      const trade: TradeFormData = {
        symbol,
        side,
        entries,
        tradeRisk: 0,
        tradeTarget: 0,
        accountId,
        tags: [],
        notes: '',
        manualGrossPnl: grossPnl,
        // Persist Return % calculated at import time using account balance
        savedReturnPercent: calculatedReturnPercent,
        savedRMultiple: calculatedRMultiple,
        // Store account balance snapshot for potential recalculation on edit
        accountBalanceSnapshot,
        // Snapshot contract size from registry at import time
        contractSize: contractSizes?.[symbol] ?? 1,
        mfeTickPip: null,
        maeTickPip: null,
      };
      
      trades.push(trade);
    } catch (err) {
      skipped++;
      continue;
    }
  }
  
  return { trades, skipped };
}

// Main import function
export async function importMT5Trades(
  file: File,
  accountId: string,
  accountBalanceSnapshot: number,
  bulkAddTrades: (tradesData: TradeFormData[]) => void,
  contractSizes?: Record<string, number>
): Promise<MT5ImportResult> {
  const errors: string[] = [];
  
  try {
    const htmlContent = await file.text();
    
    // Step 1: HTML → CSV
    const csvContent = parseMT5HtmlToCSV(htmlContent);
    
    // Step 2: CSV → Trades (pass account balance for Return % calculation)
    const { trades, skipped } = parseCSVToTrades(csvContent, accountId, accountBalanceSnapshot, contractSizes);
    
    if (trades.length === 0) {
      return {
        success: false,
        tradesImported: 0,
        rowsSkipped: skipped,
        errors: ['No valid trades found in the file'],
        importedSymbols: [],
      };
    }
    
    // Add all trades at once (single state update)
    bulkAddTrades(trades);

    // Collect unique symbols from imported trades
    const importedSymbols = Array.from(new Set(trades.map(t => t.symbol).filter(Boolean)));
    
    return {
      success: true,
      tradesImported: trades.length,
      rowsSkipped: skipped,
      errors: [],
      importedSymbols,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    errors.push(errorMessage);
    
    return {
      success: false,
      tradesImported: 0,
      rowsSkipped: 0,
      errors,
      importedSymbols: [],
    };
  }
}
