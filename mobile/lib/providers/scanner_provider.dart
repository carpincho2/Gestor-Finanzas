import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

class ScannerState {
  final bool isLoading;
  final String? error;
  final List<dynamic>? scannedItems;

  ScannerState({this.isLoading = false, this.error, this.scannedItems});

  ScannerState copyWith({bool? isLoading, String? error, List<dynamic>? scannedItems}) {
    return ScannerState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      scannedItems: scannedItems ?? this.scannedItems,
    );
  }
}

class ScannerNotifier extends Notifier<ScannerState> {
  @override
  ScannerState build() {
    return ScannerState();
  }

  Future<void> scanTicket(String filePath) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final api = ApiService();
      final response = await api.postMultipart('/api/ocr/scan-ticket', filePath);

      if (response['ok'] == true) {
        state = state.copyWith(isLoading: false, scannedItems: response['items']);
      } else {
        state = state.copyWith(isLoading: false, error: response['error'] ?? 'Error procesando ticket');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Error de red: $e');
    }
  }

  void reset() {
    state = ScannerState();
  }
}

final scannerProvider = NotifierProvider<ScannerNotifier, ScannerState>(() {
  return ScannerNotifier();
});
