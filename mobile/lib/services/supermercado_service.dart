import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/supermercado_model.dart';
import 'api_config.dart';

class SupermercadoService {
  Future<SupermercadoResponse> buscarPrecios(String query, double lat, double lng, {double radio = 10.0}) async {
    // Auto-detectar si es EAN (solo dígitos, 8-14 chars) o nombre
    final isEan = RegExp(r'^\d{8,14}$').hasMatch(query.trim());
    final paramKey = isEan ? 'ean' : 'q';
    final encodedQuery = Uri.encodeComponent(query.trim());

    final uri = Uri.parse('${ApiConfig.baseUrl}/precios?$paramKey=$encodedQuery&lat=$lat&lng=$lng&radio=$radio');
    
    final response = await http.get(uri);
    
    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return SupermercadoResponse.fromJson(json);
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

