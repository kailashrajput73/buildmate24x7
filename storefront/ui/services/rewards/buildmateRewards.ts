import { api } from '@/lib/api';
import type { RewardLedgerEntry } from './rewardModels';

/** BuildMate reward transaction (GET /api/account/rewards/history — customers and partners). */
interface RewardTxn {
  id: number;
  createdAt: string;
  type: 'Earned' | 'Redeemed' | 'Adjusted' | 'Reversed' | 'Referral' | string;
  points: number;
  balanceAfter: number;
  orderId?: number | null;
  orderNo?: string | null;
  note?: string | null;
}

interface RewardSummary { balance: number; lifetimeEarned: number; thisMonthEarned: number; pointValueRupees: number }

const toEntry = (t: RewardTxn): RewardLedgerEntry => ({
  id: String(t.id),
  requesterId: '',
  quotationId: t.orderId != null ? String(t.orderId) : '',
  points: Math.abs(t.points),
  type: t.points >= 0 ? 'earned' : 'redeemed',
  createdAt: t.createdAt,
  quotationDisplayId: t.orderNo ?? '',
  quotationGrandTotal: 0,
  description: t.note || (t.type === 'Earned' ? 'Order delivered' : t.type === 'Referral' ? 'Refer & Earn' : t.type),
});

/** Reward points from the BuildMate API (balance from the account, history from the ledger). */
export async function loadRewards(): Promise<{ balance: number; lifetimeEarned: number; pointValueRupees: number; entries: RewardLedgerEntry[] }> {
  const [summary, history] = await Promise.all([
    api<RewardSummary>('/api/account/rewards'),
    api<{ items: RewardTxn[] }>('/api/account/rewards/history?pageSize=100'),
  ]);
  return { balance: summary.balance, lifetimeEarned: summary.lifetimeEarned, pointValueRupees: summary.pointValueRupees, entries: history.items.map(toEntry) };
}
