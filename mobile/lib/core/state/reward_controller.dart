import 'package:flutter/foundation.dart';

import '../network/api_client.dart';

import '../../features/rewards/data/in_memory_reward_repository.dart';
import '../../features/rewards/data/reward_repository.dart';
import '../../features/rewards/domain/models/reward_models.dart';
import '../../features/rewards/domain/reward_service.dart';
import 'quotation_controller.dart';

/// UI-facing reward state. Balance is always derived from the ledger.
class RewardController extends ChangeNotifier {
  RewardController({
    required QuotationController quotationController,
    RewardRepository? repository,
    ApiClient? apiClient,
  })  : _repository = repository ?? InMemoryRewardRepository(),
        _api = apiClient ?? ApiClient() {
    _service = RewardService(
      quotationController: quotationController,
      rewardRepository: _repository,
    );
  }

  final RewardRepository _repository;
  final ApiClient _api;
  late final RewardService _service;

  RewardService get service => _service;

  int _balance = 0;
  List<RewardLedgerEntry> _entries = const [];
  String? _loadedForUserId;
  String? _lastCustomerRewardMessage;
  String? _error;

  /// Set when the reward points could not be loaded from the server.
  String? get error => _error;

  int get balance => _balance;
  List<RewardLedgerEntry> get entries => List.unmodifiable(_entries);
  String? get lastCustomerRewardMessage => _lastCustomerRewardMessage;

  void clearCustomerRewardMessage() {
    if (_lastCustomerRewardMessage == null) return;
    _lastCustomerRewardMessage = null;
    notifyListeners();
  }

  /// Balance and history come from the server (`GET /api/account/rewards`,
  /// `/api/account/rewards/history`) for the signed-in customer. On failure the
  /// screen shows 0 / no history and [error] — never made-up points.
  Future<void> refreshForUser(String requesterId) async {
    _loadedForUserId = requesterId;
    try {
      final summary = await _api.getJson('/account/rewards');
      final history = await _api.getJson(
        '/account/rewards/history',
        queryParameters: const {'page': '1'},
      );
      final rows = history is Map ? history['items'] : history;
      _balance = _num(summary is Map ? summary['balance'] : null).floor();
      _entries = [
        if (rows is List)
          for (final row in rows.whereType<Map>())
            _fromServer(Map<String, dynamic>.from(row), requesterId),
      ];
      _error = null;
    } catch (e) {
      _balance = 0;
      _entries = const [];
      _error = 'Could not load your reward points. Pull to refresh.';
    }
    notifyListeners();
  }

  static double _num(Object? v) =>
      v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;

  static RewardLedgerEntry _fromServer(
    Map<String, dynamic> row,
    String requesterId,
  ) {
    final points = _num(row['points']);
    final type = row['type']?.toString() ?? '';
    final orderNo = row['orderNo']?.toString() ?? '';
    final note = row['note']?.toString() ?? '';
    return RewardLedgerEntry(
      id: row['id']?.toString() ?? '',
      requesterId: requesterId,
      quotationId: row['orderId']?.toString() ?? '',
      quotationDisplayId: orderNo,
      points: points.abs().round(),
      type: points >= 0 ? RewardLedgerType.earned : RewardLedgerType.redeemed,
      createdAt: DateTime.tryParse(row['createdAt']?.toString() ?? '')?.toLocal() ??
          DateTime.now(),
      description: note.isNotEmpty ? note : type,
      title: orderNo.isNotEmpty ? 'Order #$orderNo' : (type.isEmpty ? 'Reward points' : type),
    );
  }

  Future<RewardMarkSoldResult> markQuotationAsSold({
    required String quotationId,
    required String customerDisplayName,
  }) async {
    final result = await _service.markQuotationAsSold(quotationId);
    if (result.pointsCredited > 0) {
      _lastCustomerRewardMessage =
          '🎉 You earned ${_formatPoints(result.pointsCredited)} reward points!';
    }
    if (_loadedForUserId != null) {
      await refreshForUser(_loadedForUserId!);
    } else {
      notifyListeners();
    }
    return result;
  }

  static String _formatPoints(int points) {
    return points.toString().replaceAllMapped(
          RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
          (m) => '${m[1]},',
        );
  }
}
