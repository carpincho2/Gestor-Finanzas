import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/accounts_provider.dart';
import '../models/account.dart';

class AccountsScreen extends ConsumerStatefulWidget {
  const AccountsScreen({super.key});
  @override ConsumerState<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends ConsumerState<AccountsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(accountsProvider.notifier).fetch());
  }

  String _formatARS(double v) => NumberFormat.currency(locale: 'es_AR', symbol: '\$', decimalDigits: 0).format(v);

  static const _typeLabels = {
    'efectivo': 'Efectivo', 'banco': 'Banco', 'tarjeta_credito': 'Tarjeta Crédito',
    'tarjeta_debito': 'Tarjeta Débito', 'inversion': 'Inversión', 'crypto': 'Crypto', 'otro': 'Otro',
  };

  static const _typeIcons = {
    'efectivo': Icons.money, 'banco': Icons.account_balance, 'tarjeta_credito': Icons.credit_card,
    'tarjeta_debito': Icons.credit_card_outlined, 'inversion': Icons.trending_up,
    'crypto': Icons.currency_bitcoin, 'otro': Icons.wallet,
  };

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(accountsProvider);
    final total = state.accounts.fold(0.0, (s, a) => s + a.balance);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Column(children: [
        Container(
          width: double.infinity,
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF1E293B), Color(0xFF0F172A)]),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white10),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Patrimonio total', style: TextStyle(color: Colors.white54, fontSize: 14)),
            const SizedBox(height: 6),
            Text(_formatARS(total), style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('${state.accounts.length} cuentas', style: const TextStyle(color: Colors.white38, fontSize: 12)),
          ]),
        ),
        Expanded(
          child: state.isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
            : RefreshIndicator(
                onRefresh: () => ref.read(accountsProvider.notifier).fetch(),
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: state.accounts.length,
                  itemBuilder: (_, i) => _accountCard(state.accounts[i]),
                ),
              ),
        ),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddAccountSheet(context),
        backgroundColor: const Color(0xFF10B981),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nueva Cuenta', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _accountCard(AppAccount acc) {
    final icon = _typeIcons[acc.type] ?? Icons.wallet;
    final label = _typeLabels[acc.type] ?? acc.type;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(color: const Color(0xFF38BDF8).withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: const Color(0xFF38BDF8)),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(acc.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 2),
          Text('$label · ${acc.currency}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
          if (acc.bank != null && acc.bank!.isNotEmpty)
            Text(acc.bank!, style: const TextStyle(color: Colors.white38, fontSize: 11)),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(_formatARS(acc.balance),
            style: TextStyle(color: acc.balance >= 0 ? Colors.white : const Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 4),
          Row(children: [
            GestureDetector(
              onTap: () => _showEditSheet(context, acc),
              child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(6)), child: const Icon(Icons.edit_outlined, color: Colors.white54, size: 16)),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => _confirmDelete(context, acc),
              child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(6)), child: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 16)),
            ),
          ]),
        ]),
      ]),
    );
  }

  void _confirmDelete(BuildContext ctx, AppAccount acc) {
    showDialog(context: ctx, builder: (_) => AlertDialog(
      backgroundColor: const Color(0xFF1E293B),
      title: const Text('Eliminar cuenta', style: TextStyle(color: Colors.white)),
      content: Text('¿Borrar "${acc.name}"? Se eliminarán también sus transacciones.', style: const TextStyle(color: Colors.white70)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          onPressed: () async {
            await ref.read(accountsProvider.notifier).delete(acc.id);
            if (ctx.mounted) Navigator.pop(ctx);
          },
          child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
        ),
      ],
    ));
  }

  void _showAddAccountSheet(BuildContext context) => _showAccountSheet(context, null);
  void _showEditSheet(BuildContext context, AppAccount acc) => _showAccountSheet(context, acc);

  void _showAccountSheet(BuildContext context, AppAccount? existing) {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final bankCtrl = TextEditingController(text: existing?.bank ?? '');
    final balCtrl = TextEditingController(text: existing != null ? existing.balance.toStringAsFixed(0) : '');
    String type = existing?.type ?? 'efectivo';
    String currency = existing?.currency ?? 'ARS';
    final types = ['efectivo', 'banco', 'tarjeta_credito', 'tarjeta_debito', 'inversion', 'crypto', 'otro'];

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setModal) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(existing == null ? 'Nueva Cuenta' : 'Editar Cuenta', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          _input(nameCtrl, 'Nombre de la cuenta', Icons.label_outline),
          const SizedBox(height: 10),
          _input(bankCtrl, 'Banco (opcional)', Icons.account_balance_outlined),
          const SizedBox(height: 10),
          _input(balCtrl, 'Saldo inicial', Icons.attach_money, isNumber: true),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: type,
            dropdownColor: const Color(0xFF0F172A),
            style: const TextStyle(color: Colors.white),
            decoration: _dropDecor('Tipo'),
            items: types.map((t) => DropdownMenuItem(value: t, child: Text(_typeLabels[t] ?? t))).toList(),
            onChanged: (v) => setModal(() => type = v!),
          ),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), padding: const EdgeInsets.all(14)),
            onPressed: () async {
              final data = {'name': nameCtrl.text.trim(), 'type': type, 'bank': bankCtrl.text.trim(), 'balance': double.tryParse(balCtrl.text.replaceAll(',', '.')) ?? 0.0, 'currency': currency, 'limit': 0.0};
              bool ok;
              if (existing != null) {
                ok = await ref.read(accountsProvider.notifier).update(existing.id, data);
              } else {
                ok = await ref.read(accountsProvider.notifier).add(data);
              }
              if (ctx.mounted) {
                Navigator.pop(ctx);
                if (ok) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Cuenta guardada'), backgroundColor: Color(0xFF10B981)));
              }
            },
            child: const Text('Guardar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          )),
        ]),
      )),
    );
  }

  Widget _input(TextEditingController c, String hint, IconData icon, {bool isNumber = false}) => TextField(
    controller: c,
    keyboardType: isNumber ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
    style: const TextStyle(color: Colors.white),
    decoration: InputDecoration(
      hintText: hint, hintStyle: const TextStyle(color: Colors.white38),
      prefixIcon: Icon(icon, color: Colors.white38),
      filled: true, fillColor: const Color(0xFF0F172A),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
    ),
  );

  InputDecoration _dropDecor(String l) => InputDecoration(
    labelText: l, labelStyle: const TextStyle(color: Colors.white54),
    filled: true, fillColor: const Color(0xFF0F172A),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
  );
}
