import '../domain/models/reward_models.dart';
import 'reward_repository.dart';

class InMemoryRewardRepository implements RewardRepository {
  final List<RewardLedgerEntry> _entries = [];

  List<RewardLedgerEntry> get allEntries => List.unmodifiable(_entries);

  @override
  Future<void> addLedgerEntry(RewardLedgerEntry entry) async {
    if (await hasEntryForQuotation(entry.quotationId)) {
      throw RewardException('This quotation has already been marked as sold.');
    }
    _entries.insert(0, entry);
  }

  @override
  Future<List<RewardLedgerEntry>> getLedgerEntriesForUser(
    String requesterId,
  ) async {
    final list = _entries
        .where((entry) => entry.requesterId == requesterId)
        .toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  @override
  Future<int> getBalanceForUser(String requesterId) async {
    var earned = 0;
    var redeemed = 0;
    for (final entry in _entries) {
      if (entry.requesterId != requesterId) continue;
      if (entry.type == RewardLedgerType.earned) {
        earned += entry.points;
      } else if (entry.type == RewardLedgerType.redeemed) {
        redeemed += entry.points;
      }
    }
    return earned - redeemed;
  }

  @override
  Future<bool> hasEntryForQuotation(String quotationId) async =>
      _entries.any((entry) => entry.quotationId == quotationId);

  @override
  Future<RewardLedgerEntry?> entryForQuotation(String quotationId) async {
    for (final entry in _entries) {
      if (entry.quotationId == quotationId) return entry;
    }
    return null;
  }

  void clear() => _entries.clear();
}
