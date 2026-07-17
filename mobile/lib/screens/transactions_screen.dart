import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/transactions_provider.dart';
import '../providers/accounts_provider.dart';
import '../models/transaction.dart';
import '../models/account.dart';

class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});
  @override ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> {
  String _filter = 'all';
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(transactionsProvider.notifier).fetch();
      ref.read(accountsProvider.notifier).fetch();
    });
  }

  String _formatARS(double amount) => NumberFormat.currency(locale: 'es_AR', symbol: '\$', decimalDigits: 0).format(amount);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(transactionsProvider);
    final accounts = ref.watch(accountsProvider).accounts;

    var txs = state.transactions;
    if (_filter == 'income') txs = txs.where((t) => t.type == 'income').toList();
    if (_filter == 'expense') txs = txs.where((t) => t.type == 'expense').toList();
    if (_searchQuery.isNotEmpty) txs = txs.where((t) => t.desc.toLowerCase().contains(_searchQuery.toLowerCase()) || t.cat.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
    txs.sort((a, b) => b.date.compareTo(a.date));

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Column(children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Column(children: [
            TextField(
              onChanged: (v) => setState(() => _searchQuery = v),
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Buscar transacciones...',
                hintStyle: const TextStyle(color: Colors.white38),
                prefixIcon: const Icon(Icons.search, color: Colors.white38),
                filled: true, fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
            const SizedBox(height: 8),
            Row(children: [
              _filterChip('Todos', 'all'),
              const SizedBox(width: 8),
              _filterChip('Ingresos', 'income'),
              const SizedBox(width: 8),
              _filterChip('Gastos', 'expense'),
            ]),
          ]),
        ),
        Expanded(
          child: state.isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
            : RefreshIndicator(
                onRefresh: () => ref.read(transactionsProvider.notifier).fetch(),
                child: txs.isEmpty
                  ? const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text('💸', style: TextStyle(fontSize: 48)),
                      SizedBox(height: 12),
                      Text('Sin transacciones', style: TextStyle(color: Colors.white54)),
                    ]))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: txs.length,
                      itemBuilder: (_, i) => _txCard(txs[i], accounts),
                    ),
              ),
        ),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddTxSheet(context, accounts),
        backgroundColor: const Color(0xFF10B981),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Agregar', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _filterChip(String label, String value) {
    final selected = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF38BDF8) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: TextStyle(color: selected ? Colors.black : Colors.white70, fontWeight: selected ? FontWeight.bold : FontWeight.normal, fontSize: 13)),
      ),
    );
  }

  Widget _txCard(AppTransaction tx, List<AppAccount> accounts) {
    final isIncome = tx.type == 'income';
    final acc = accounts.firstWhere((a) => a.id == tx.accountId, orElse: () => AppAccount(id: 0, name: 'Cuenta', type: '', balance: 0, currency: 'ARS'));
    return Dismissible(
      key: Key('tx-${tx.id}'),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(color: Colors.red.shade800, borderRadius: BorderRadius.circular(12)),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      onDismissed: (_) => ref.read(transactionsProvider.notifier).delete(tx.id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white10),
        ),
        child: Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: isIncome ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFFEF4444).withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(isIncome ? Icons.arrow_downward : Icons.arrow_upward, color: isIncome ? const Color(0xFF10B981) : const Color(0xFFEF4444), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tx.desc, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text('${tx.cat} · ${acc.name}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
            Text(tx.date, style: const TextStyle(color: Colors.white38, fontSize: 11)),
          ])),
          Text(
            '${isIncome ? '+' : '-'}${_formatARS(tx.amount)}',
            style: TextStyle(color: isIncome ? const Color(0xFF10B981) : const Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 15),
          ),
        ]),
      ),
    );
  }

  void _showAddTxSheet(BuildContext context, List<AppAccount> accounts) {
    final descCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    String type = 'expense';
    String cat = 'Varios';
    int? accountId = accounts.isNotEmpty ? accounts.first.id : null;
    String date = DateTime.now().toIso8601String().split('T').first;

    final cats = ['Alimentación', 'Transporte', 'Salud', 'Educación', 'Entretenimiento', 'Ropa', 'Hogar', 'Trabajo', 'Varios'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Nueva Transacción', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: GestureDetector(
                onTap: () => setModalState(() => type = 'expense'),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: type == 'expense' ? const Color(0xFFEF4444) : const Color(0xFF0F172A), borderRadius: BorderRadius.circular(10)),
                  child: const Text('Gasto', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              )),
              const SizedBox(width: 12),
              Expanded(child: GestureDetector(
                onTap: () => setModalState(() => type = 'income'),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: type == 'income' ? const Color(0xFF10B981) : const Color(0xFF0F172A), borderRadius: BorderRadius.circular(10)),
                  child: const Text('Ingreso', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              )),
            ]),
            const SizedBox(height: 12),
            _inputField(descCtrl, 'Descripción', Icons.notes),
            const SizedBox(height: 10),
            _inputField(amountCtrl, 'Monto', Icons.attach_money, isNumber: true),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: cat,
              dropdownColor: const Color(0xFF0F172A),
              style: const TextStyle(color: Colors.white),
              decoration: _dropDecor('Categoría'),
              items: cats.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (v) => setModalState(() => cat = v!),
            ),
            const SizedBox(height: 10),
            if (accounts.isNotEmpty) DropdownButtonFormField<int>(
              value: accountId,
              dropdownColor: const Color(0xFF0F172A),
              style: const TextStyle(color: Colors.white),
              decoration: _dropDecor('Cuenta'),
              items: accounts.map((a) => DropdownMenuItem(value: a.id, child: Text(a.name))).toList(),
              onChanged: (v) => setModalState(() => accountId = v),
            ),
            const SizedBox(height: 16),
            SizedBox(width: double.infinity, child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), padding: const EdgeInsets.all(14)),
              onPressed: () async {
                if (descCtrl.text.isEmpty || amountCtrl.text.isEmpty) return;
                final ok = await ref.read(transactionsProvider.notifier).add({
                  'type': type, 'desc': descCtrl.text.trim(),
                  'amount': double.tryParse(amountCtrl.text.replaceAll(',', '.')) ?? 0,
                  'cat': cat, 'date': date, 'account_id': accountId,
                });
                if (ctx.mounted) {
                  Navigator.pop(ctx);
                  if (ok) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Transacción guardada'), backgroundColor: Color(0xFF10B981)));
                }
              },
              child: const Text('Guardar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
            )),
          ]),
        ),
      ),
    );
  }

  Widget _inputField(TextEditingController ctrl, String hint, IconData icon, {bool isNumber = false}) {
    return TextField(
      controller: ctrl,
      keyboardType: isNumber ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        hintText: hint, hintStyle: const TextStyle(color: Colors.white38),
        prefixIcon: Icon(icon, color: Colors.white38),
        filled: true, fillColor: const Color(0xFF0F172A),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
      ),
    );
  }

  InputDecoration _dropDecor(String label) => InputDecoration(
    labelText: label, labelStyle: const TextStyle(color: Colors.white54),
    filled: true, fillColor: const Color(0xFF0F172A),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
  );
}
