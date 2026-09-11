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
      try {
        final url = Uri.parse(
          'https://nominatim.openstreetmap.org/reverse?lat=${position.latitude}&lon=${position.longitude}&format=json&zoom=10&accept-language=es'
        );
        final res = await http.get(url, headers: {'User-Agent': 'GestorFinanzasApp/1.0'}).timeout(const Duration(seconds: 4));
        if (res.statusCode == 200) {
          final data = jsonDecode(res.body);
          final address = data['address'];
          if (address != null) {
            final city = address['city'] ?? address['town'] ?? address['village'] ?? address['county'] ?? address['state'] ?? '';
            final stateName = address['state'] ?? '';
            if (city.toString().isNotEmpty) {
              ubiLabel = "$city${stateName.toString().isNotEmpty && stateName != city ? ', $stateName' : ''} (${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)})";
            }
          }
        }
      } catch (_) {
        // Fallback a coordenadas en caso de timeout
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

