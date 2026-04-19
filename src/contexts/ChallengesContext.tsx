import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toISO, auditISOValues, type ISODateString } from '@/lib/datetime';

// ─── Types ───────────────────────────────────────────────────────

export type DrawdownType = 'static' | 'eod' | 'trailing';
export type UnitType = 'percent' | 'amount';

export interface TargetValue {
  type: UnitType;
  value: number | null;
}

export interface DrawdownValue {
  type: DrawdownType;
  mode: UnitType;
  value: number | null;
}

export interface StepRules {
  minTradingDays: number | null;
  tradingPeriodDays: number | null;
  isUnlimited: boolean;
  profitTarget: TargetValue;
  maxDailyLoss: TargetValue;
  maxDrawdown: DrawdownValue;
  consistency: number | null;
}

export interface FundedRules {
  sameAsStep1: boolean;
  minTradingDays?: number | null;
  maxDailyLoss?: TargetValue;
  maxDrawdown?: DrawdownValue;
  consistency?: number | null;
}

export interface ChallengeRulesSchema {
  step1: StepRules;
  step2: StepRules | null;
  funded: FundedRules;
}

export type ChallengeSteps = 0 | 1 | 2; // 0 = Instant Funded, 1 = 1 Step, 2 = 2 Steps
export type ChallengeStatus = 'active' | 'breached' | 'funded';

export interface Challenge {
  challengeId: string;
  userId: string;
  nickname: string;
  firm: string;
  balanceAmount: number;
  steps: ChallengeSteps;
  status: ChallengeStatus;
  setups: string[];
  /** Full ISO 8601 UTC timestamp. */
  startDate: ISODateString;
  evaluationFee: number;
  activationFee: number;
  rules: ChallengeRulesSchema;
  createdAt: ISODateString;
}

// ─── Context ─────────────────────────────────────────────────────

interface ChallengesContextType {
  challenges: Challenge[];
  addChallenge: (challenge: Challenge) => void;
  updateChallenge: (challengeId: string, updates: Partial<Challenge>) => void;
  removeChallenge: (challengeId: string) => void;
  getChallengeById: (challengeId: string) => Challenge | undefined;
}

const ChallengesContext = createContext<ChallengesContextType | undefined>(undefined);

const STORAGE_KEY = 'propfirm-challenges-v2';

export const ChallengesProvider = ({ children }: { children: ReactNode }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Challenge[] = JSON.parse(stored);
        // Migrate legacy data
        let didNormalizeDates = false;
        const migrated = parsed.map(c => {
          const nextStart = toISO(c.startDate) || c.startDate;
          const nextCreated = toISO(c.createdAt) || c.createdAt;
          if (nextStart !== c.startDate || nextCreated !== c.createdAt) didNormalizeDates = true;
          return {
            ...c,
            steps: migrateSteps(c.steps),
            status: migrateStatus(c.status),
            startDate: nextStart,
            createdAt: nextCreated,
          };
        });
        setChallenges(migrated);
        // Always persist (migrateSteps/Status may have changed values too); harmless if identical.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        if (didNormalizeDates) {
          console.log('[ChallengesContext] Normalized legacy date fields to ISO UTC.');
        }
        auditISOValues('ChallengesContext', migrated.flatMap(c => [c.startDate, c.createdAt]));
      }
    } catch (e) {
      console.error('Error loading challenges:', e);
    }
  }, []);

  const save = useCallback((next: Challenge[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setChallenges(next);
  }, []);

  const addChallenge = useCallback((challenge: Challenge) => {
    save([...challenges, challenge]);
  }, [challenges, save]);

  const updateChallenge = useCallback((challengeId: string, updates: Partial<Challenge>) => {
    save(challenges.map(c => c.challengeId === challengeId ? { ...c, ...updates } : c));
  }, [challenges, save]);

  const removeChallenge = useCallback((challengeId: string) => {
    save(challenges.filter(c => c.challengeId !== challengeId));
  }, [challenges, save]);

  const getChallengeById = useCallback((challengeId: string) => {
    return challenges.find(c => c.challengeId === challengeId);
  }, [challenges]);

  return (
    <ChallengesContext.Provider value={{ challenges, addChallenge, updateChallenge, removeChallenge, getChallengeById }}>
      {children}
    </ChallengesContext.Provider>
  );
};

export const useChallengesContext = () => {
  const ctx = useContext(ChallengesContext);
  if (!ctx) throw new Error('useChallengesContext must be used within ChallengesProvider');
  return ctx;
};

// ─── Helpers ─────────────────────────────────────────────────────

/** Convert legacy string-based steps to numeric */
function migrateSteps(val: unknown): ChallengeSteps {
  if (val === 0 || val === 1 || val === 2) return val;
  if (val === '1 Step') return 1;
  if (val === '2 Steps') return 2;
  if (val === 'Instant Funded') return 0;
  return 1;
}

/** Convert legacy capitalized status to lowercase */
function migrateStatus(val: unknown): ChallengeStatus {
  if (val === 'active' || val === 'breached' || val === 'funded') return val;
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower === 'active' || lower === 'breached' || lower === 'funded') return lower;
  }
  return 'active';
}

/** Map numeric steps to UI label */
export function stepsToLabel(steps: ChallengeSteps): string {
  if (steps === 0) return 'Instant Funded';
  if (steps === 2) return '2 Steps';
  return '1 Step';
}

export function generateChallengeId(): string {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

export function createDefaultStepRules(): StepRules {
  return {
    minTradingDays: null,
    tradingPeriodDays: null,
    isUnlimited: false,
    profitTarget: { type: 'amount', value: null },
    maxDailyLoss: { type: 'amount', value: null },
    maxDrawdown: { type: 'static', mode: 'amount', value: null },
    consistency: null,
  };
}

export function createDefaultFundedRules(): FundedRules {
  return { sameAsStep1: true };
}
