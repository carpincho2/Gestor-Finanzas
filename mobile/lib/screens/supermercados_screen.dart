import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/supermercado_provider.dart';

class SupermercadosScreen extends ConsumerStatefulWidget {
  const SupermercadosScreen({super.key});

  @override
  ConsumerState<SupermercadosScreen> createState() => _SupermercadosScreenState();
}

class _SupermercadosScreenState extends ConsumerState<SupermercadosScreen> {
  final _eanController = TextEditingController();

  void _buscar() {
    if (_eanController.text.isNotEmpty) {
      ref.read(supermercadoProvider.notifier).buscarProducto(_eanController.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(supermercadoProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Buscador SEPA', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF1E293B),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _eanController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Ingresar EAN o Código...',
                      hintStyle: const TextStyle(color: Colors.white54),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      prefixIcon: const Icon(Icons.search, color: Colors.white54),
                    ),
                    keyboardType: TextInputType.number,
                    onSubmitted: (_) => _buscar(),
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: _buscar,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF38BDF8),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.send, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          
          if (state.isLoading)
            const Expanded(child: Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8))))
          else if (state.error != null)
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Text(
                    state.error!,
                    style: const TextStyle(color: Colors.redAccent, fontSize: 16),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            )
          else if (state.response != null)
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: state.response!.resultados.length,
                itemBuilder: (context, index) {
                  final item = state.response!.resultados[index];
                  return Card(
                    color: item.esMejorValor ? const Color(0xFF1E293B) : const Color(0xFF0F172A),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(
                        color: item.esMejorValor ? const Color(0xFF10B981) : Colors.white10,
                        width: item.esMejorValor ? 2 : 1,
                      ),
                    ),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                item.comercio,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if (item.esMejorValor)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF10B981).withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Mejor Opción',
                                    style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${item.sucursal} • ${item.direccion}',
                            style: const TextStyle(color: Colors.white70, fontSize: 14),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'A ${item.distanciaKm.toStringAsFixed(1)} km',
                            style: const TextStyle(color: Colors.white54, fontSize: 12),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Precio Lista', style: TextStyle(color: Colors.white54, fontSize: 12)),
                                  Text(
                                    '\$${item.precios.precioLista.toStringAsFixed(2)}',
                                    style: TextStyle(
                                      color: Colors.white54,
                                      fontSize: 14,
                                      decoration: item.precios.precioLista > item.precios.precioMinimo ? TextDecoration.lineThrough : null,
                                    ),
                                  ),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  const Text('Precio Final', style: TextStyle(color: Colors.white54, fontSize: 12)),
                                  Text(
                                    '\$${item.precios.precioMinimo.toStringAsFixed(2)}',
                                    style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 22, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          if (item.precios.promoBancariaTag != null)
                            Container(
                              margin: const EdgeInsets.only(top: 12),
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFF8B5CF6).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFF8B5CF6).withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.local_offer, color: Color(0xFF8B5CF6), size: 16),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Incluye promo ${item.precios.promoBancariaTag} (-${item.precios.ahorroPct}%)',
                                      style: const TextStyle(color: Color(0xFF8B5CF6), fontSize: 12),
                                    ),
                                  ),
                                ],
                              ),
                            )
                        ],
                      ),
                    ),
                  );
                },
              ),
            )
          else
            const Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.shopping_basket_outlined, size: 64, color: Colors.white24),
                    SizedBox(height: 16),
                    Text(
                      'Busca un producto por su código\npara encontrar el supermercado más barato',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white54, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
