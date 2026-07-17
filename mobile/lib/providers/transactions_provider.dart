import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/transaction.dart';
import '../services/api_service.dart';

class TransactionsState {
  final bool isLoading;
  final String? error;
  final List<AppTransaction> transactions;
  TransactionsState({this.isLoading = false, this.error, this.transactions = const []});
  TransactionsState copyWith({bool? isLoading, String? error, List<AppTransaction>? transactions}) =>
    TransactionsState(isLoading: isLoading ?? this.isLoading, error: error, transactions: transactions ?? this.transactions);
}

class TransactionsNotifier extends Notifier<TransactionsState> {
  @override TransactionsState build() { return TransactionsState(); }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final r = await ApiService().get('/api/transactions');
      if (r['ok'] == true) {
        final list = (r['transactions'] as List).map((e) => AppTransaction.fromJson(e)).toList();
        state = state.copyWith(isLoading: false, transactions: list);
      } else {
        state = state.copyWith(isLoading: false, error: r['error'] ?? 'Error');
      }
    } catch (e) { state = state.copyWith(isLoading: false, error: e.toString()); }
  }

  Future<bool> add(Map<String, dynamic> data) async {
    try {
      final r = await ApiService().post('/api/transactions', data);
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }

  Future<bool> delete(int id) async {
    try {
      final r = await ApiService().delete('/api/transactions/$id');
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }

  Future<bool> update(int id, Map<String, dynamic> data) async {
    try {
      final r = await ApiService().put('/api/transactions/$id', data);
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }
}

final transactionsProvider = NotifierProvider<TransactionsNotifier, TransactionsState>(() => TransactionsNotifier());
