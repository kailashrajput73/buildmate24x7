import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SearchHistory extends StateNotifier<List<String>> {
  SearchHistory() : super(const []) {
    _load();
  }
  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) state = prefs.getStringList('recentProductSearches') ?? [];
  }

  Future<void> remember(String input) async {
    final q = input.trim();
    if (q.isEmpty) return;
    state =
        [
          q,
          ...state.where((s) => s.toLowerCase() != q.toLowerCase()),
        ].take(8).toList();
    await (await SharedPreferences.getInstance()).setStringList(
      'recentProductSearches',
      state,
    );
  }

  Future<void> clear() async {
    state = [];
    await (await SharedPreferences.getInstance()).remove(
      'recentProductSearches',
    );
  }
}

final searchHistoryProvider =
    StateNotifierProvider<SearchHistory, List<String>>(
      (ref) => SearchHistory(),
    );
