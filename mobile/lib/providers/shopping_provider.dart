import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

// Estado de la pantalla de compras
class ShoppingState {
  final bool isLoading;
  final String? error;
  final Map<String, dynamic>? data;

  ShoppingState({this.isLoading = false, this.error, this.data});

  ShoppingState copyWith({bool? isLoading, String? error, Map<String, dynamic>? data}) {
    return ShoppingState(
      isLoading: isLoading ?? this.isLoading,
      error: error, // Permitir borrar el error
      data: data ?? this.data,
    );
  }
}

class ShoppingNotifier extends StateNotifier<ShoppingState> {
  ShoppingNotifier() : super(ShoppingState());

  Future<void> analyzeUrl({
    required String url,
    required int installments,
    required double discount,
    required double tna,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final api = ApiService();
      final response = await api.post('/api/shopping/analyze-url', {
        'url': url,
        'installments_without_interest': installments,
        'discount_percentage': discount,
        'custom_tna': tna,
      });

      if (response['ok'] == true) {
        state = state.copyWith(isLoading: false, data: response);
      } else {
        state = state.copyWith(isLoading: false, error: response['error'] ?? 'Error desconocido');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final shoppingProvider = StateNotifierProvider<ShoppingNotifier, ShoppingState>((ref) {
  return ShoppingNotifier();
});
