// Prop Firm Transaction model
// Represents income/expenses tied to prop firms (payouts, fees, etc.)
// Distinct from Account deposit/withdraw transactions in AccountsContext.

export type PropFirmTransactionType = 'income' | 'expense';

export type PropFirmTransactionStatus = 'reviewed' | 'not_reviewed' | 'ignored';

export const PROP_FIRM_TRANSACTION_CATEGORIES = [
  'Payout',
  'Evaluation Fee',
  'Activation Fee',
  'Affiliation Income',
  'Other',
] as const;

export type PropFirmTransactionCategory =
  (typeof PROP_FIRM_TRANSACTION_CATEGORIES)[number];

export interface PropFirmTransaction {
  /** UUID */
  id: string;
  /** Owning user UUID */
  userId: string;
  /** Optional — links to an Account (UUID). May be undefined for firm-wide txns. */
  accountId?: string;
  /** Optional — links to a Challenge (UUID). May be undefined for standalone txns. */
  challengeId?: string;
  /** Firm slug or display name (e.g. "mffu", "e8") */
  firm: string;
  /** Money in vs. money out */
  type: PropFirmTransactionType;
  /** Fixed category — see PROP_FIRM_TRANSACTION_CATEGORIES */
  category: PropFirmTransactionCategory;
  /** Optional free-text note */
  description?: string;
  /** Always positive. Sign is derived from `type` at display time. */
  amount: number;
  /** ISO 8601 date string (YYYY-MM-DD or full ISO) */
  date: string;
  /** Review state */
  status: PropFirmTransactionStatus;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
}

/** Helper: ensure `amount` is stored positive regardless of input sign. */
export const normalizeAmount = (amount: number): number => Math.abs(amount);
