import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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

export interface Challenge {
  challengeId: string;
  nickname: string;
  firm: string;
  balanceAmount: number;
  steps: '1 Step' | '2 Steps' | 'Instant Funded';
  status: 'Active' | 'Breached';
  setups: string[];
  startDate: string;
  evaluationFee: number;
  activationFee: number;
  rules: ChallengeRulesSchema;
  createdAt: string;
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
      if (stored) setChallenges(JSON.parse(stored));
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
