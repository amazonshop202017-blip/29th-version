import { useInterfaceTheme } from '@/contexts/InterfaceThemeContext';

interface ChartGradientDefsProps {
  /** 'vertical' for vertical bar charts (bottom→top), 'horizontal' for horizontal bar charts (left→right) */
  direction?: 'vertical' | 'horizontal';
  /** Unique prefix to avoid ID collisions when multiple charts on same page */
  idPrefix?: string;
}

/**
 * SVG gradient definitions for bar charts.
 * Renders inside Recharts via <Customized component={() => <ChartGradientDefs ... />} />.
 * Only renders when gradient mode is enabled in Interface Theme.
 */
export const ChartGradientDefs = ({ direction = 'vertical', idPrefix = '' }: ChartGradientDefsProps) => {
  const { theme } = useInterfaceTheme();

  if (theme.mode !== 'gradient') return null;

  const profitId = `${idPrefix}profitGradient`;
  const lossId = `${idPrefix}lossGradient`;
  const primaryId = `${idPrefix}primaryGradient`;

  const positiveCoords = direction === 'horizontal'
    ? { x1: '0', y1: '0', x2: '1', y2: '0' }
    : { x1: '0', y1: '1', x2: '0', y2: '0' };

  const negativeCoords = direction === 'horizontal'
    ? { x1: '1', y1: '0', x2: '0', y2: '0' }
    : { x1: '0', y1: '0', x2: '0', y2: '1' };

  return (
    <defs>
      <linearGradient id={profitId} {...positiveCoords}>
        <stop offset="0%" stopColor="hsl(var(--profit))" stopOpacity={0.3} />
        <stop offset="100%" stopColor="hsl(var(--profit))" stopOpacity={0.85} />
      </linearGradient>
      <linearGradient id={lossId} {...negativeCoords}>
        <stop offset="0%" stopColor="hsl(var(--loss))" stopOpacity={0.3} />
        <stop offset="100%" stopColor="hsl(var(--loss))" stopOpacity={0.85} />
      </linearGradient>
      <linearGradient id={primaryId} {...positiveCoords}>
        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.85} />
      </linearGradient>
    </defs>
  );
};

/**
 * Hook that returns the correct fill value based on gradient mode.
 * @param idPrefix - same prefix passed to ChartGradientDefs
 */
export const useGradientFill = (idPrefix = '') => {
  const { theme } = useInterfaceTheme();
  const isGradient = theme.mode === 'gradient';

  const profitFill = isGradient ? `url(#${idPrefix}profitGradient)` : 'hsl(var(--profit))';
  const lossFill = isGradient ? `url(#${idPrefix}lossGradient)` : 'hsl(var(--loss))';
  const primaryFill = isGradient ? `url(#${idPrefix}primaryGradient)` : 'hsl(var(--chart-1))';

  const getFill = (isPositive: boolean) => isPositive ? profitFill : lossFill;

  return { profitFill, lossFill, primaryFill, getFill, isGradient };
};

/**
 * SVG gradient defs for bars with arbitrary colors (not profit/loss).
 * Each color gets its own gradient with 0.3→0.85 opacity, left→right.
 */
export const CustomColorGradientDefs = ({ colors, idPrefix = '' }: { colors: string[]; idPrefix?: string }) => {
  const { theme } = useInterfaceTheme();
  if (theme.mode !== 'gradient') return null;

  const unique = Array.from(new Set(colors));
  return (
    <defs>
      {unique.map((color, i) => (
        <linearGradient key={i} id={`${idPrefix}customGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.85} />
        </linearGradient>
      ))}
    </defs>
  );
};

/**
 * Returns fill for a custom color based on gradient mode.
 * colorIndex must match the index in the colors array passed to CustomColorGradientDefs.
 */
export const useCustomColorGradientFill = (idPrefix = '') => {
  const { theme } = useInterfaceTheme();
  const isGradient = theme.mode === 'gradient';

  const getCustomFill = (color: string, colorIndex: number) =>
    isGradient ? `url(#${idPrefix}customGrad-${colorIndex})` : color;

  return { getCustomFill, isGradient };
};
