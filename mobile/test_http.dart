import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  final uri = Uri.parse('https://gestor-finanzas-1tkf.onrender.com/api/auth/login');
  final response = await http.post(
    uri,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: jsonEncode({
      'email': 'paneg@gmail.com',
      'password': '123'
    }),
  );
  
  print('Status: ${response.statusCode}');
  print('Body: ${response.body}');
}
