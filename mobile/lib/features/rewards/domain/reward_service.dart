import '../../../core/state/quotation_controller.dart';
import '../data/reward_repository.dart';
import 'models/reward_models.dart';
import 'reward_calculator.dart';

/// Business logic for sale-confirmed rewards.
/// UI must call this — never calculate points or write ledger entries directly.
class RewardService {
  RewardService({
    required QuotationController quotationController,
    required RewardRepository rewardRepository,
  })  : _quotations = quotationController,
        _rewards = rewardRepository;

  final QuotationController _quotations;
  final RewardRepository _rewards;

  int calculatePoints(double grandTotal) =>
      RewardCalculator.pointsFromGrandTotal(grandTotal);

  Future<int> getBalanceForUser(String requesterId) =>
      _rewards.getBalanceForUser(requesterId);

  Future<List<RewardLedgerEntry>> getLedgerEntriesForUser(String requesterId) =>
      _rewards.getLedgerEntriesForUser(requesterId);

  /// Marks quotation sold and credits points exactly once.
  Future<RewardMarkSoldResult> markQuotationAsSold(String quotationId) async {
    final quotation = _quotations.byId(quotationId);
    if (quotation == null) {
      throw RewardException('Quotation not found.');
    }

    if (quotation.isSold ||
        await _rewards.hasEntryForQuotation(quotationId)) {
      throw RewardException(
        'This quotation has already been marked as sold.',
      );
    }

    final points = calculatePoints(quotation.grandTotal);
    final soldAt = DateTime.now();

    final updated = _quotations.markSold(
      quotationId: quotationId,
      soldAt: soldAt,
    );
    if (updated == null) {
      throw RewardException(
        'This quotation has already been marked as sold.',
      );
    }

    RewardLedgerEntry? entry;
    if (points > 0) {
      entry = RewardLedgerEntry(
        id: 'rw-${soldAt.millisecondsSinceEpoch}',
        requesterId: updated.requesterId,
        quotationId: updated.id,
        points: points,
        type: RewardLedgerType.earned,
        createdAt: soldAt,
        quotationDisplayId: updated.quotationLabel,
        quotationGrandTotal: updated.grandTotal,
        description: 'Sale confirmed',
      );
      await _rewards.addLedgerEntry(entry);
    }

    return RewardMarkSoldResult(
      quotation: updated,
      pointsCredited: points,
      ledgerEntry: entry,
    );
  }
}
