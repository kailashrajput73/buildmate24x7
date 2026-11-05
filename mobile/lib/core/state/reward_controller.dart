import 'package:flutter/foundation.dart';

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
  }) : _repository = repository ?? InMemoryRewardRepository() {
    _service = RewardService(
      quotationController: quotationController,
      rewardRepository: _repository,
    );
  }

  final RewardRepository _repository;
  late final RewardService _service;

  RewardService get service => _service;

  int _balance = 0;
  List<RewardLedgerEntry> _entries = const [];
  String? _loadedForUserId;
  String? _lastCustomerRewardMessage;

  int get balance => _balance;
  List<RewardLedgerEntry> get entries => List.unmodifiable(_entries);
  String? get lastCustomerRewardMessage => _lastCustomerRewardMessage;

  void clearCustomerRewardMessage() {
    if (_lastCustomerRewardMessage == null) return;
    _lastCustomerRewardMessage = null;
    notifyListeners();
  }

  Future<void> refreshForUser(String requesterId) async {
    _balance = await _service.getBalanceForUser(requesterId);
    _entries = await _service.getLedgerEntriesForUser(requesterId);
    _loadedForUserId = requesterId;
    notifyListeners();
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
