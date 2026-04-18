import { useEffect } from 'react';
import { useChallengesContext } from '@/contexts/ChallengesContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';

/**
 * Idempotently syncs auto-generated transactions for challenges:
 * - Evaluation fee (expense) when challenge.evaluationFee > 0
 * - Activation fee (expense) when challenge.activationFee > 0
 */
export const TransactionsAutoSync = () => {
  const { challenges } = useChallengesContext();
  const { ensureTransaction } = useTransactionsContext();

  useEffect(() => {
    challenges.forEach(c => {
      if (c.evaluationFee && c.evaluationFee > 0) {
        ensureTransaction(
          t => t.challengeId === c.challengeId && t.category === 'evaluation_fee',
          () => ({
            challengeId: c.challengeId,
            firm: c.firm,
            type: 'expense',
            category: 'evaluation_fee',
            amount: c.evaluationFee,
            date: c.createdAt || c.startDate || new Date().toISOString(),
            status: 'reviewed',
            description: `Evaluation fee — ${c.nickname}`,
          }),
        );
      }
      if (c.activationFee && c.activationFee > 0) {
        ensureTransaction(
          t => t.challengeId === c.challengeId && t.category === 'activation_fee',
          () => ({
            challengeId: c.challengeId,
            firm: c.firm,
            type: 'expense',
            category: 'activation_fee',
            amount: c.activationFee,
            date: c.createdAt || c.startDate || new Date().toISOString(),
            status: 'reviewed',
            description: `Activation fee — ${c.nickname}`,
          }),
        );
      }
    });
  }, [challenges, ensureTransaction]);

  return null;
};
