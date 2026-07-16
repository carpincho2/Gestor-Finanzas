import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String? _jwtToken;
  static const String _tokenKey = 'jwt_token';

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _jwtToken = prefs.getString(_tokenKey);
  }

  Future<void> setToken(String token) async {
    _jwtToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<void> clearToken() async {
    _jwtToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  bool get isAuthenticated => _jwtToken != null;

  String get baseUrl {
    // Apuntando directamente al servidor de producción en Render
    return 'https://gestor-finanzas-1tkf.onrender.com';
  }

  Map<String, String> get _headers {
    final headers = {'Content-Type': 'application/json'};
    if (_jwtToken != null) {
      headers['Authorization'] = 'Bearer $_jwtToken';
    }
    return headers;
  }

  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final response = await http.post(
      uri,
      headers: _headers,
      body: jsonEncode(body),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Error en API (${response.statusCode}): ${response.body}');
    }
  }

  Future<Map<String, dynamic>> get(String endpoint) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final response = await http.get(
      uri,
      headers: _headers,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Error en API (${response.statusCode}): ${response.body}');
    }
  }

  Future<Map<String, dynamic>> postMultipart(String endpoint, String filePath) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final request = http.MultipartRequest('POST', uri);
    
    if (_jwtToken != null) {
      request.headers['Authorization'] = 'Bearer $_jwtToken';
    }

    request.files.add(await http.MultipartFile.fromPath('file', filePath));

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Error en API (${response.statusCode}): ${response.body}');
    }
  }
}
