import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/supermercado_model.dart';
import 'api_config.dart';

class SupermercadoService {
  Future<SupermercadoResponse> buscarPrecios(String ean, double lat, double lng, {double radio = 10.0}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/precios?ean=$ean&lat=$lat&lng=$lng&radio=$radio');
    
    final response = await http.get(uri);
    
    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return SupermercadoResponse.fromJson(json);
    } else {
      throw Exception('Error al buscar precios: ${response.statusCode} - ${response.body}');
    }
  }
}
