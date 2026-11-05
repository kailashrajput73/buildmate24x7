import '../domain/models/reward_models.dart';
import 'reward_repository.dart';

/// In-memory ledger for the demo. Ledger is the source of truth.
class InMemoryRewardRepository implements RewardRepository {
  InMemoryRewardRepository() : _seedForAnyUser = false;

  /// Seeded with display-only mock history, used only by the real app shell —
  /// kept out of the default constructor so tests that exercise the ledger
  /// from a clean slate aren't affected. The mock auth flow produces varying
  /// user ids, so the seed is copied onto each user the first time they're
  /// queried.
  InMemoryRewardRepository.withDemoSeed() : _seedForAnyUser = true;

  final bool _seedForAnyUser;
  final Set<String> _seededUsers = {};

  static final List<RewardLedgerEntry> _mockSeedEntries = [
    RewardLedgerEntry(
      id: 'seed-ledger-6',
      requesterId: '',
      quotationId: 'seed-qt-1058',
      quotationDisplayId: 'QT-1058',
      quotationGrandTotal: 18400,
      points: 150,
      type: RewardLedgerType.earned,
      createdAt: DateTime(2026, 9, 24),
      description: 'Sale confirmed',
    ),
    RewardLedgerEntry(
      id: 'seed-ledger-5',
      requesterId: '',
      quotationId: 'seed-perk-quotation-off-200',
      quotationDisplayId: 'RWD-1609',
      points: 250,
      type: RewardLedgerType.redeemed,
      createdAt: DateTime(2026, 9, 16),
      description: 'Redeemed: ₹200 off',
    ),
    RewardLedgerEntry(
      id: 'seed-ledger-4',
      requesterId: '',
      quotationId: 'seed-qt-1042',
      quotationDisplayId: 'QT-1042',
      quotationGrandTotal: 36000,
      points: 300,
      type: RewardLedgerType.earned,
      createdAt: DateTime(2026, 9, 10),
      description: 'Sale confirmed',
    ),
    RewardLedgerEntry(
      id: 'seed-ledger-3',
      requesterId: '',
      quotationId: 'seed-perk-free-delivery',
      quotationDisplayId: 'RWD-2208',
      points: 230,
      type: RewardLedgerType.redeemed,
      createdAt: DateTime(2026, 8, 22),
      description: 'Redeemed: Free delivery',
    ),
    RewardLedgerEntry(
      id: 'seed-ledger-2',
      requesterId: '',
      quotationId: 'seed-qt-1035',
      quotationDisplayId: 'QT-1035',
      quotationGrandTotal: 27500,
      points: 250,
      type: RewardLedgerType.earned,
      createdAt: DateTime(2026, 8, 20),
      description: 'Sale confirmed',
    ),
    RewardLedgerEntry(
      id: 'seed-ledger-1',
      requesterId: '',
      quotationId: 'seed-qt-1021',
      quotationDisplayId: 'QT-1021',
      quotationGrandTotal: 52000,
      points: 420,
      type: RewardLedgerType.earned,
      createdAt: DateTime(2026, 7, 28),
      description: 'Sale confirmed',
    ),
  ];

  void _ensureSeeded(String requesterId) {
    if (!_seedForAnyUser || !_seededUsers.add(requesterId)) return;
    for (final e in _mockSeedEntries) {
      _entries.add(RewardLedgerEntry(
        id: '${e.id}-$requesterId',
        requesterId: requesterId,
        quotationId: '${e.quotationId}-$requesterId',
        quotationDisplayId: e.quotationDisplayId,
        quotationGrandTotal: e.quotationGrandTotal,
        points: e.points,
        type: e.type,
        createdAt: e.createdAt,
        description: e.description,
      ));
    }
  }

  final List<RewardLedgerEntry> _entries = [];

  List<RewardLedgerEntry> get allEntries => List.unmodifiable(_entries);

  @override
  Future<void> addLedgerEntry(RewardLedgerEntry entry) async {
    // Hard guard: never allow a second earned entry for the same quotation.
    if (await hasEntryForQuotation(entry.quotationId)) {
      throw RewardException(
        'This quotation has already been marked as sold.',
      );
    }
    _entries.insert(0, entry);
  }

  @override
  Future<List<RewardLedgerEntry>> getLedgerEntriesForUser(
    String requesterId,
  ) async {
    _ensureSeeded(requesterId);
    final list =
        _entries.where((e) => e.requesterId == requesterId).toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  @override
  Future<int> getBalanceForUser(String requesterId) async {
    _ensureSeeded(requesterId);
    var earned = 0;
    var redeemed = 0;
    for (final e in _entries) {
      if (e.requesterId != requesterId) continue;
      if (e.type == RewardLedgerType.earned) {
        earned += e.points;
      } else if (e.type == RewardLedgerType.redeemed) {
        redeemed += e.points;
      }
    }
    return earned - redeemed;
  }

  @override
  Future<bool> hasEntryForQuotation(String quotationId) async {
    return _entries.any((e) => e.quotationId == quotationId);
  }

  @override
  Future<RewardLedgerEntry?> entryForQuotation(String quotationId) async {
    for (final e in _entries) {
      if (e.quotationId == quotationId) return e;
    }
    return null;
  }

  void clear() => _entries.clear();
}
