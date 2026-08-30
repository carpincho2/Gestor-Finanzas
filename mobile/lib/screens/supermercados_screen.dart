import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/supermercado_provider.dart';
import '../models/supermercado_model.dart';

class SupermercadosScreen extends ConsumerStatefulWidget {
  const SupermercadosScreen({super.key});

  @override
  ConsumerState<SupermercadosScreen> createState() => _SupermercadosScreenState();
}

class _SupermercadosScreenState extends ConsumerState<SupermercadosScreen> {
  final _queryController = TextEditingController();
  final Set<int> _expandedProducts = {0}; // Auto-expandir el primero

  void _buscar() {
    if (_queryController.text.isNotEmpty) {
      setState(() {
        _expandedProducts.clear();
        _expandedProducts.add(0);
      });
      ref.read(supermercadoProvider.notifier).buscarProducto(_queryController.text);
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
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _queryController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Buscar producto: leche, coca, aceite...',
                      hintStyle: const TextStyle(color: Colors.white54),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      prefixIcon: const Icon(Icons.search, color: Colors.white54),
                    ),
                    keyboardType: TextInputType.text,
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
          
          // Content
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
          else if (state.response != null && state.response!.productos.isNotEmpty)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Results header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${state.response!.totalProductos} producto${state.response!.totalProductos != 1 ? 's' : ''}',
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          '"${state.response!.query}"',
                          style: const TextStyle(color: Colors.white54, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  // Product list
                  Expanded(
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: state.response!.productos.length,
                      itemBuilder: (context, index) {
                        final producto = state.response!.productos[index];
                        final isExpanded = _expandedProducts.contains(index);
                        return _buildProductCard(producto, index, isExpanded);
                      },
                    ),
                  ),
                ],
              ),
            )
          else if (state.response != null && state.response!.productos.isEmpty)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.search_off, size: 64, color: Colors.white24),
                    const SizedBox(height: 16),
                    Text(
                      'No se encontraron productos\npara "${state.response!.query}"',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white54, fontSize: 14),
                    ),
                  ],
                ),
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
                      'Buscá un producto por nombre\npara comparar precios en supermercados',
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

  Widget _buildProductCard(ProductoConPrecios producto, int index, bool isExpanded) {
    final marca = producto.marca != null ? ' · ${producto.marca}' : '';

    return Card(
      color: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isExpanded ? const Color(0xFF38BDF8) : Colors.white10,
          width: isExpanded ? 1.5 : 1,
        ),
      ),
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Product header (tappable)
          InkWell(
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedProducts.remove(index);
                } else {
                  _expandedProducts.add(index);
                }
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          producto.nombre,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${producto.totalSucursales} supermercado${producto.totalSucursales != 1 ? 's' : ''}$marca',
                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Desde', style: TextStyle(color: Colors.white54, fontSize: 11)),
                      Text(
                        '\$${producto.mejorPrecio.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: Color(0xFF10B981),
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  AnimatedRotation(
                    turns: isExpanded ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(Icons.expand_more, color: Colors.white54),
                  ),
                ],
              ),
            ),
          ),

          // Sucursales list (expandable)
          if (isExpanded)
            ...producto.sucursales.map((s) => _buildSucursalRow(s)),
        ],
      ),
    );
  }

  Widget _buildSucursalRow(SucursalResumen s) {
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.06))),
        color: s.esMejor ? const Color(0xFF10B981).withOpacity(0.04) : null,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          if (s.esMejor)
            const Padding(
              padding: EdgeInsets.only(right: 6),
              child: Text('🏆', style: TextStyle(fontSize: 13)),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      s.comercio,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (s.promoTag != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF8B5CF6).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${s.promoTag} -${s.ahorroPct}%',
                          style: const TextStyle(color: Color(0xFF8B5CF6), fontSize: 10),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '${s.sucursal ?? ''} ${s.direccion != null ? '· ${s.direccion}' : ''} · ${s.distanciaKm.toStringAsFixed(1)} km',
                  style: const TextStyle(color: Colors.white54, fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (s.precioLista > s.precioFinal)
                Text(
                  '\$${s.precioLista.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: Colors.white38,
                    fontSize: 11,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
              Text(
                '\$${s.precioFinal.toStringAsFixed(2)}',
                style: TextStyle(
                  color: s.esMejor ? const Color(0xFF10B981) : const Color(0xFF38BDF8),
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
