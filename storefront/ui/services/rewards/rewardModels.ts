/** Flutter `RewardLedgerType` (features/rewards/domain/models/reward_models.dart). */
export type RewardLedgerType = 'earned' | 'redeemed';

/** Flutter `RewardLedgerEntry`. `createdAt` is an ISO date string. */
export interface RewardLedgerEntry {
  id: string;
  requesterId: string;
  quotationId: string;
  points: number;
  type: RewardLedgerType;
  createdAt: string;
  quotationDisplayId: string;
  quotationGrandTotal: number;
  description: string;
}

/** Flutter `RewardLedgerEntry.isEarned`. */
export const isEarned = (entry: RewardLedgerEntry) => entry.type === 'earned';
