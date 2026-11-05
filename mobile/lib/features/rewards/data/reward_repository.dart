import '../domain/models/reward_models.dart';

/// Abstraction so an API can replace the in-memory source later.
abstract class RewardRepository {
  Future<void> addLedgerEntry(RewardLedgerEntry entry);

  Future<List<RewardLedgerEntry>> getLedgerEntriesForUser(String requesterId);

  Future<int> getBalanceForUser(String requesterId);

  Future<bool> hasEntryForQuotation(String quotationId);

  Future<RewardLedgerEntry?> entryForQuotation(String quotationId);
}
