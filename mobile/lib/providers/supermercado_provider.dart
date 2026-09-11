import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../models/supermercado_model.dart';
import '../services/supermercado_service.dart';

final supermercadoServiceProvider = Provider((ref) => SupermercadoService());

class SupermercadoState {
  final bool isLoading;
  final String? error;
  final BusquedaMultiProductoResponse? response;
  final String? ubicacionTexto;
  final double? lat;
  final double? lng;
  
  SupermercadoState({
    this.isLoading = false,
    this.error,
    this.response,
    this.ubicacionTexto,
    this.lat,
    this.lng,
  });
  
  SupermercadoState copyWith({
    bool? isLoading,
    String? error,
    BusquedaMultiProductoResponse? response,
    String? ubicacionTexto,
    double? lat,
    double? lng,
  }) {
    return SupermercadoState(
      isLoading: isLoading ?? this.isLoading,
      error: error, // Permitir borrar el error pasando null
      response: response ?? this.response,
      ubicacionTexto: ubicacionTexto ?? this.ubicacionTexto,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
    );
  }
}

class SupermercadoNotifier extends Notifier<SupermercadoState> {
  @override
  SupermercadoState build() {
    // Detectar ubicación al iniciar
    Future.microtask(() => detectarUbicacion());
    return SupermercadoState();
  }

  Future<Position?> detectarUbicacion() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          state = state.copyWith(ubicacionTexto: "Permisos de ubicación denegados");
          return null;
        }
      }
      
      if (permission == LocationPermission.deniedForever) {
        state = state.copyWith(ubicacionTexto: "Permisos de ubicación denegados permanentemente");
        return null;
      }
      
      final Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high
      );

      String ubiLabel = "${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}";
      if (position.latitude >= -38.1 && position.latitude <= -37.8 && position.longitude >= -57.7 && position.longitude <= -57.4) {
        ubiLabel = "Mar del Plata ($ubiLabel)";
      } else if (position.latitude >= -34.7 && position.latitude <= -34.5 && position.longitude >= -58.5 && position.longitude <= -58.3) {
        ubiLabel = "CABA ($ubiLabel)";
      }
      
      state = state.copyWith(
        ubicacionTexto: ubiLabel,
        lat: position.latitude,
        lng: position.longitude,
      );
      return position;
    } catch (e) {
      state = state.copyWith(ubicacionTexto: "Error al detectar ubicación");
      return null;
    }
  }

  Future<void> buscarProducto(String query) async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      double? lat = state.lat;
      double? lng = state.lng;

      if (lat == null || lng == null) {
        final pos = await detectarUbicacion();
        if (pos != null) {
          lat = pos.latitude;
          lng = pos.longitude;
        } else {
          throw Exception("No se pudo obtener la ubicación actual");
        }
      }
      
      // Buscar múltiples productos
      final service = ref.read(supermercadoServiceProvider);
      final response = await service.buscarProductos(query, lat, lng);
      
      state = state.copyWith(isLoading: false, response: response);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final supermercadoProvider = NotifierProvider<SupermercadoNotifier, SupermercadoState>(() {
  return SupermercadoNotifier();
});

