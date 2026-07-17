import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/budget.dart';
import '../services/api_service.dart';

class BudgetsState {
  final bool isLoading;
  final String? error;
  final List<AppBudget> budgets;
  BudgetsState({this.isLoading = false, this.error, this.budgets = const []});
  BudgetsState copyWith({bool? isLoading, String? error, List<AppBudget>? budgets}) =>
    BudgetsState(isLoading: isLoading ?? this.isLoading, error: error, budgets: budgets ?? this.budgets);
}

class BudgetsNotifier extends Notifier<BudgetsState> {
  @override BudgetsState build() => BudgetsState();

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final r = await ApiService().get('/api/budgets');
      if (r['ok'] == true) {
        final list = (r['budgets'] as List).map((e) => AppBudget.fromJson(e)).toList();
        state = state.copyWith(isLoading: false, budgets: list);
      } else { state = state.copyWith(isLoading: false, error: r['error']); }
    } catch (e) { state = state.copyWith(isLoading: false, error: e.toString()); }
  }

  Future<bool> add(Map<String, dynamic> data) async {
    try {
      final r = await ApiService().post('/api/budgets', data);
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }

  Future<bool> delete(int id) async {
    try {
      final r = await ApiService().delete('/api/budgets/$id');
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }
}

final budgetsProvider = NotifierProvider<BudgetsNotifier, BudgetsState>(() => BudgetsNotifier());
