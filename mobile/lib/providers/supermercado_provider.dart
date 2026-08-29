import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../models/supermercado_model.dart';
import '../services/supermercado_service.dart';

final supermercadoServiceProvider = Provider((ref) => SupermercadoService());

class SupermercadoState {
  final bool isLoading;
  final String? error;
  final SupermercadoResponse? response;
  
  SupermercadoState({this.isLoading = false, this.error, this.response});
  
  SupermercadoState copyWith({bool? isLoading, String? error, SupermercadoResponse? response}) {
    return SupermercadoState(
      isLoading: isLoading ?? this.isLoading,
      error: error, // Permitir borrar el error pasando null
      response: response ?? this.response,
    );
  }
}

class SupermercadoNotifier extends Notifier<SupermercadoState> {
  @override
  SupermercadoState build() => SupermercadoState();

  Future<void> buscarProducto(String query) async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      // 1. Obtener ubicación
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception("Permisos de ubicación denegados");
        }
      }
      
      if (permission == LocationPermission.deniedForever) {
        throw Exception("Permisos de ubicación denegados permanentemente");
      }
      
      final Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high
      );
      
      // 2. Buscar (auto-detectar si es EAN o nombre)
      final service = ref.read(supermercadoServiceProvider);
      final response = await service.buscarPrecios(query, position.latitude, position.longitude);
      
      state = state.copyWith(isLoading: false, response: response);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final supermercadoProvider = NotifierProvider<SupermercadoNotifier, SupermercadoState>(() {
  return SupermercadoNotifier();
});

