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
  
  int _selectedInstallments = 0;

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
                              isExpanded: true,
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFF0F172A),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                              ),
                              items: [0, 1, 3, 6, 9, 12, 18, 24].map((e) => DropdownMenuItem(
                                value: e,
                                child: Text(
                                  e == 0 ? '✨ Autodetectar cuota' : (e == 1 ? '1 pago (Contado)' : 'Hasta $e cuotas'),
                                  overflow: TextOverflow.ellipsis,
                                ),
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
              
              // Datos del producto
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.inventory_2_outlined, color: Color(0xFF38BDF8), size: 32),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Producto detectado', style: TextStyle(color: Colors.white54, fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(
                            state.data!['item']?['title'] ?? 'Producto',
                            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '\$${state.data!['item']?['price'] ?? 0}',
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              
              // Recomendaciones de pago
              if (state.data!['recommendation'] != null && (state.data!['recommendation'] as List).isNotEmpty) ...[
                ..._buildRecommendationCards(state.data!['recommendation'] as List),
              ] else
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('No hay cuentas registradas para comparar.', style: TextStyle(color: Colors.white54), textAlign: TextAlign.center),
                ),
            ]
          ],
        ),
      ),
    );
  }

  List<Widget> _buildRecommendationCards(List recommendations) {
    final widgets = <Widget>[];
    
    // Encontrar el ganador
    final winner = recommendations.cast<Map<String, dynamic>>().where((r) => r['is_winner'] == true).firstOrNull;
    final others = recommendations.cast<Map<String, dynamic>>().where((r) => r['is_winner'] != true).toList();

    if (winner != null) {
      final savings = (winner['nominal_cost'] ?? 0) - (winner['real_cost'] ?? 0);
      
      widgets.add(
        Container(
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
                  Expanded(child: Text(winner['account_name'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold))),
                ],
              ),
              const SizedBox(height: 4),
              Text(winner['type'] ?? '', style: const TextStyle(color: Colors.white70, fontSize: 13)),
              const SizedBox(height: 16),
              const Text('Costo real estimado:', style: TextStyle(color: Colors.white70)),
              Text('\$${(winner['real_cost'] ?? 0).toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
              if (savings > 0) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(20)),
                  child: Text('¡Ahorrás \$${savings.toStringAsFixed(2)} vs contado!', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.black.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                child: Text(winner['reason'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4)),
              ),
            ],
          ),
        ),
      );
    }

    // Otras opciones
    if (others.isNotEmpty) {
      widgets.add(const SizedBox(height: 24));
      widgets.add(const Text('Otras opciones', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)));
      widgets.add(const SizedBox(height: 12));
      
      for (final opt in others) {
        final isViable = opt['is_viable'] == true;
        widgets.add(
          Opacity(
            opacity: isViable ? 1.0 : 0.6,
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white10),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(child: Text(opt['account_name'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600))),
                            if (!isViable) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: Colors.red.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
                                child: const Text('No recomendable', style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(opt['reason'] ?? '', style: const TextStyle(color: Colors.white54, fontSize: 13)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Costo Real', style: TextStyle(color: Colors.white54, fontSize: 11)),
                      Text('\$${(opt['real_cost'] ?? 0).toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      }
    }

    return widgets;
  }
}

