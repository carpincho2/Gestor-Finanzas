import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../providers/scanner_provider.dart';

class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key});

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen> {
  File? _imageFile;
  final ImagePicker _picker = ImagePicker();

  @override
  void dispose() {
    // Para limpiar la caché del escáner manualmente en lugar de autoDispose
    ref.read(scannerProvider.notifier).reset();
    super.dispose();
  }

  Future<void> _takePhoto() async {
    try {
      final XFile? photo = await _picker.pickImage(source: ImageSource.camera);
      if (photo != null) {
        setState(() {
          _imageFile = File(photo.path);
        });
        ref.read(scannerProvider.notifier).scanTicket(photo.path);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error al abrir la cámara: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(scannerProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Escáner de Tickets', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1E293B),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _imageFile == null
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.document_scanner, size: 80, color: Color(0xFF38BDF8)),
                          const SizedBox(height: 16),
                          const Text('Tomale una foto a tu ticket de compra', style: TextStyle(color: Colors.white70, fontSize: 16)),
                          const SizedBox(height: 32),
                          ElevatedButton.icon(
                            onPressed: _takePhoto,
                            icon: const Icon(Icons.camera_alt),
                            label: const Text('Abrir Cámara'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF38BDF8),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            ),
                          )
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        Expanded(
                          flex: 2,
                          child: Container(
                            width: double.infinity,
                            decoration: BoxDecoration(
                              image: DecorationImage(
                                image: FileImage(_imageFile!),
                                fit: BoxFit.cover,
                              ),
                            ),
                            child: state.isLoading
                                ? Container(
                                    color: Colors.black54,
                                    child: const Center(
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          CircularProgressIndicator(color: Color(0xFF38BDF8)),
                                          SizedBox(height: 16),
                                          Text('Analizando ticket con IA...', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                        ],
                                      ),
                                    ),
                                  )
                                : const SizedBox.shrink(),
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: Container(
                            color: const Color(0xFF0F172A),
                            padding: const EdgeInsets.all(16),
                            child: _buildResultsList(state),
                          ),
                        )
                      ],
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: _imageFile != null && !state.isLoading
          ? FloatingActionButton(
              backgroundColor: const Color(0xFF38BDF8),
              onPressed: _takePhoto,
              child: const Icon(Icons.refresh, color: Colors.white),
            )
          : null,
    );
  }

  Widget _buildResultsList(ScannerState state) {
    if (state.error != null) {
      return Center(child: Text(state.error!, style: const TextStyle(color: Colors.redAccent)));
    }

    if (state.scannedItems == null) {
      return const SizedBox.shrink();
    }

    if (state.scannedItems!.isEmpty) {
      return const Center(child: Text('No se encontraron productos.', style: TextStyle(color: Colors.white70)));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Productos detectados:', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Expanded(
          child: ListView.builder(
            itemCount: state.scannedItems!.length,
            itemBuilder: (context, index) {
              final item = state.scannedItems![index];
              return Card(
                color: const Color(0xFF1E293B),
                child: ListTile(
                  title: Text(item['name'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  trailing: Text('\$${item['price']}', style: const TextStyle(color: const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Guardado en base de datos (Demo)')));
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('Guardar Gastos', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        )
      ],
    );
  }
}
