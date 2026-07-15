import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/shopping_screen.dart';

void main() {
  // Envolvemos la app en un ProviderScope para que Riverpod funcione en toda la jerarquía
  runApp(const ProviderScope(child: FlujoApp()));
}

class FlujoApp extends StatelessWidget {
  const FlujoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gestor de Finanzas',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF38BDF8), brightness: Brightness.dark),
        useMaterial3: true,
        fontFamily: 'Inter',
      ),
      home: const ShoppingScreen(),
    );
  }
}
