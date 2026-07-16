import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

class DashboardState {
  final bool isLoading;
  final String? error;
  final List<dynamic>? accounts;

  DashboardState({this.isLoading = false, this.error, this.accounts});

  DashboardState copyWith({bool? isLoading, String? error, List<dynamic>? accounts}) {
    return DashboardState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      accounts: accounts ?? this.accounts,
    );
  }
}

class DashboardNotifier extends StateNotifier<DashboardState> {
  DashboardNotifier() : super(DashboardState());

  Future<void> fetchAccounts() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final api = ApiService();
      // Since it's a GET, we should add a get method to ApiService.
      // But for now, since we only have post, I will add get to ApiService in the next step.
      final response = await api.get('/api/accounts');

      if (response['ok'] == true) {
        state = state.copyWith(isLoading: false, accounts: response['accounts']);
      } else {
        state = state.copyWith(isLoading: false, error: response['error'] ?? 'Error fetching accounts');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Error de red: $e');
    }
  }
}

final dashboardProvider = StateNotifierProvider<DashboardNotifier, DashboardState>((ref) {
  return DashboardNotifier();
});
