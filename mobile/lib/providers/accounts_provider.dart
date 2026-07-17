import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/account.dart';
import '../services/api_service.dart';

class AccountsState {
  final bool isLoading;
  final String? error;
  final List<AppAccount> accounts;
  AccountsState({this.isLoading = false, this.error, this.accounts = const []});
  AccountsState copyWith({bool? isLoading, String? error, List<AppAccount>? accounts}) =>
    AccountsState(isLoading: isLoading ?? this.isLoading, error: error, accounts: accounts ?? this.accounts);
}

class AccountsNotifier extends Notifier<AccountsState> {
  @override AccountsState build() { return AccountsState(); }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final r = await ApiService().get('/api/accounts');
      if (r['ok'] == true) {
        final list = (r['accounts'] as List).map((e) => AppAccount.fromJson(e)).toList();
        state = state.copyWith(isLoading: false, accounts: list);
      } else {
        state = state.copyWith(isLoading: false, error: r['error'] ?? 'Error');
      }
    } catch (e) { state = state.copyWith(isLoading: false, error: e.toString()); }
  }

  Future<bool> add(Map<String, dynamic> data) async {
    try {
      final r = await ApiService().post('/api/accounts', data);
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }

  Future<bool> update(int id, Map<String, dynamic> data) async {
    try {
      final r = await ApiService().put('/api/accounts/$id', data);
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }

  Future<bool> delete(int id) async {
    try {
      final r = await ApiService().delete('/api/accounts/$id');
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }
}

final accountsProvider = NotifierProvider<AccountsNotifier, AccountsState>(() => AccountsNotifier());
