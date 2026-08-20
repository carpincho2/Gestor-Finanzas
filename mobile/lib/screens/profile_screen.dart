import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  Map<String, dynamic>? _userData;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final r = await ApiService().get('/api/auth/me');
      setState(() { _userData = r['user']; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  void _showEditNameSheet() {
    final ctrl = TextEditingController(text: _userData?['name'] ?? '');
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Editar Perfil', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(controller: ctrl, style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Nombre completo', hintStyle: const TextStyle(color: Colors.white38),
              prefixIcon: const Icon(Icons.person_outline, color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), padding: const EdgeInsets.all(14)),
            onPressed: () async {
              final r = await ApiService().put('/api/auth/profile', {'name': ctrl.text.trim()});
              if (ctx.mounted) {
                Navigator.pop(ctx);
                if (r['ok'] == true) { await _loadUser(); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Perfil actualizado'), backgroundColor: Color(0xFF10B981))); }
              }
            },
            child: const Text('Guardar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          )),
        ]),
      ),
    );
  }

  void _showChangePasswordSheet() {
    final curCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Cambiar Contraseña', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(controller: curCtrl, obscureText: true, style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Contraseña actual', hintStyle: const TextStyle(color: Colors.white38),
              prefixIcon: const Icon(Icons.lock_outline, color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 10),
          TextField(controller: newCtrl, obscureText: true, style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Nueva contraseña (mín. 8 car. con letras y números)', hintStyle: const TextStyle(color: Colors.white38),
              prefixIcon: const Icon(Icons.lock_open_outlined, color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), padding: const EdgeInsets.all(14)),
            onPressed: () async {
              final r = await ApiService().put('/api/auth/password', {'current_password': curCtrl.text, 'new_password': newCtrl.text});
              if (ctx.mounted) {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text(r['ok'] == true ? '✅ Contraseña actualizada' : '❌ ${r["error"] ?? "Error"}'),
                  backgroundColor: r['ok'] == true ? const Color(0xFF10B981) : Colors.red,
                ));
              }
            },
            child: const Text('Cambiar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          )),
        ]),
      ),
    );
  }

  void _showEmptyTransactionsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Vaciar Transacciones', style: TextStyle(color: Colors.white)),
        content: const Text(
          '¿Estás seguro de que querés vaciar TODAS tus transacciones y volver los saldos a cero? Esta acción NO se puede deshacer.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar', style: TextStyle(color: Colors.white70))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
            onPressed: () async {
              Navigator.pop(ctx);
              final r = await ApiService().delete('/api/transactions/all');
              if (mounted) {
                if (r['ok'] == true) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Transacciones eliminadas y saldos en 0'), backgroundColor: Color(0xFF10B981)));
                  // Se debería forzar recarga en los providers principales si se navega a ellos
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('❌ Error: \${r["error"]}'), backgroundColor: Colors.red));
                }
              }
            },
            child: const Text('Vaciar Datos', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Eliminar Cuenta', style: TextStyle(color: Colors.redAccent)),
        content: const Text(
          'Esta acción eliminará de forma PERMANENTE tu cuenta y TODOS tus datos financieros (cuentas, transacciones, presupuestos y objetivos). No se puede deshacer.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar', style: TextStyle(color: Colors.white70))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              final r = await ApiService().delete('/api/auth/me');
              if (mounted) {
                if (r['ok'] == true) {
                  ref.read(authProvider.notifier).logout();
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('❌ Error: \${r["error"]}'), backgroundColor: Colors.red));
                }
              }
            },
            child: const Text('Eliminar Cuenta', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = _userData?['name'] ?? '---';
    final email = _userData?['email'] ?? '---';
    final avatar = _userData?['avatar'] ?? name.substring(0, 1).toUpperCase();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
        : SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(children: [
              const SizedBox(height: 20),
              CircleAvatar(
                radius: 48,
                backgroundColor: const Color(0xFF38BDF8),
                child: Text(avatar, style: const TextStyle(color: Colors.black, fontSize: 32, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 16),
              Text(name, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(email, style: const TextStyle(color: Colors.white54, fontSize: 14)),
              const SizedBox(height: 32),

              _optionTile(Icons.person_outline, 'Editar nombre', _showEditNameSheet),
              const Divider(color: Colors.white12),
              _optionTile(Icons.lock_outline, 'Cambiar contraseña', _showChangePasswordSheet),
              const Divider(color: Colors.white12),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Zona de Peligro', style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    const Text('Acciones destructivas para tu cuenta y datos.', style: TextStyle(color: Colors.white54, fontSize: 13)),
                    const SizedBox(height: 16),
                    SizedBox(width: double.infinity, child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.orange),
                        padding: const EdgeInsets.all(12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: const Icon(Icons.delete_sweep, color: Colors.orange),
                      label: const Text('Vaciar Transacciones', style: TextStyle(color: Colors.orange, fontWeight: FontWeight.bold)),
                      onPressed: _showEmptyTransactionsDialog,
                    )),
                    const SizedBox(height: 12),
                    SizedBox(width: double.infinity, child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        padding: const EdgeInsets.all(12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: const Icon(Icons.delete_forever, color: Colors.white),
                      label: const Text('Eliminar Cuenta', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      onPressed: _showDeleteAccountDialog,
                    )),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(width: double.infinity, child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFEF4444)),
                  padding: const EdgeInsets.all(14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.logout, color: Color(0xFFEF4444)),
                label: const Text('Cerrar Sesión', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 16)),
                onPressed: () => ref.read(authProvider.notifier).logout(),
              )),
            ]),
          ),
    );
  }

  Widget _optionTile(IconData icon, String title, VoidCallback onTap) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(icon, color: const Color(0xFF38BDF8)),
    title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 15)),
    trailing: const Icon(Icons.chevron_right, color: Colors.white38),
    onTap: onTap,
  );
}
