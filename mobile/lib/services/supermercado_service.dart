import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/supermercado_model.dart';
import 'api_config.dart';

class SupermercadoService {
  Future<BusquedaMultiProductoResponse> buscarProductos(String query, double lat, double lng, {double radio = 10.0}) async {
    final encodedQuery = Uri.encodeComponent(query.trim());

    // Usar el nuevo endpoint multi-producto
    final uri = Uri.parse('${ApiConfig.baseUrl}/precios/buscar?q=$encodedQuery&lat=$lat&lng=$lng&radio=$radio');
    
    final response = await http.get(uri);
    
    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return BusquedaMultiProductoResponse.fromJson(json);
    } else {
      // Intentar extraer el mensaje de error del backend
      try {
        final json = jsonDecode(response.body);
        throw Exception(json['detail'] ?? 'Error al buscar precios: ${response.statusCode}');
      } catch (e) {
        if (e is Exception) rethrow;
        throw Exception('Error al buscar precios: ${response.statusCode}');
      }
    }
  }
}
