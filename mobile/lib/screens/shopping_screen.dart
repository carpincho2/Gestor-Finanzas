import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/shopping_provider.dart';

class ShoppingScreen extends ConsumerStatefulWidget {
  const ShoppingScreen({super.key});

  @override
  ConsumerState<ShoppingScreen> createState() => _ShoppingScreenState();
}

class _ShoppingScreenState extends ConsumerState<ShoppingScreen> {
  final TextEditingController _urlController = TextEditingController();
  final TextEditingController _discountController = TextEditingController(text: '0');
  final TextEditingController _tnaController = TextEditingController(text: '40');
  
  int _selectedInstallments = 1;

  void _analyzeShopping() {
    FocusScope.of(context).unfocus(); // Cerrar teclado
    
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingresá el link de Mercado Libre')));
      return;
    }

    final discount = double.tryParse(_discountController.text) ?? 0.0;
    final tna = double.tryParse(_tnaController.text) ?? 40.0;

    ref.read(shoppingProvider.notifier).analyzeUrl(
      url: url,
      installments: _selectedInstallments,
      discount: discount,
      tna: tna,
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(shoppingProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        title: const Text('Asistente de Compras', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1E293B), // Slate 800
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.shopping_bag_outlined, size: 64, color: Color(0xFF38BDF8)),
            const SizedBox(height: 16),
            const Text(
              'Pegá el link de Mercado Libre y te diremos cómo pagar para ganarle a la inflación.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70, fontSize: 16),
            ),
            const SizedBox(height: 32),
            
            // Tarjeta de Formulario
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Link de Mercado Libre', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _urlController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'https://articulo.mercadolibre...',
                      hintStyle: const TextStyle(color: Colors.white30),
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Cuotas sin interés', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<int>(
                              value: _selectedInstallments,
                              dropdownColor: const Color(0xFF1E293B),
                              style: const TextStyle(color: Colors.white),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFF0F172A),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                              ),
                              items: [1, 3, 6, 9, 12, 18, 24].map((e) => DropdownMenuItem(
                                value: e,
                                child: Text(e == 1 ? '1 pago' : '$e cuotas'),
                              )).toList(),
                              onChanged: (val) {
                                if (val != null) setState(() => _selectedInstallments = val);
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        flex: 1,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('TNA (%)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            TextField(
                              controller: _tnaController,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(color: Colors.white),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFF0F172A),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 24),
                  
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: state.isLoading ? null : _analyzeShopping,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF38BDF8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: state.isLoading 
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Analizar Opciones', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ),
            
            if (state.error != null) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.red.withOpacity(0.3))),
                child: Text(state.error!, style: const TextStyle(color: Colors.redAccent)),
              )
            ],

            if (state.data != null) ...[
              const SizedBox(height: 32),
              const Text('Análisis del Producto', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              
              // Datos del producto
              Text(state.data!['product']['title'] ?? 'Producto', style: const TextStyle(color: Colors.white70, fontSize: 16)),
              const SizedBox(height: 4),
              Text('\$${state.data!['product']['price']}', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
              
              const SizedBox(height: 24),
              const Text('Recomendación', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              
              if (state.data!['recommendation'] != null)
                _buildWinnerCard(state.data!['recommendation'])
              else
                const Text('No hay fondos suficientes en tus cuentas.', style: TextStyle(color: Colors.redAccent)),
            ]
          ],
        ),
      ),
    );
  }

  Widget _buildWinnerCard(Map<String, dynamic> rec) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF059669), Color(0xFF10B981)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: const Color(0xFF10B981).withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.star, color: Colors.yellow, size: 28),
              const SizedBox(width: 8),
              Expanded(child: Text(rec['account_name'], style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold))),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Costo real estimado:', style: TextStyle(color: Colors.white70)),
          Text('\$${rec['vpn_cost'].toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(20)),
            child: Text('¡Ahorrás \$${rec['savings'].toStringAsFixed(2)}!', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
