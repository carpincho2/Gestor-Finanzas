import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/budgets_provider.dart';
import '../providers/transactions_provider.dart';
import '../models/budget.dart';

class BudgetsScreen extends ConsumerStatefulWidget {
  const BudgetsScreen({super.key});
  @override ConsumerState<BudgetsScreen> createState() => _BudgetsScreenState();
}

class _BudgetsScreenState extends ConsumerState<BudgetsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(budgetsProvider.notifier).fetch();
      ref.read(transactionsProvider.notifier).fetch();
    });
  }

  String _formatARS(double v) => NumberFormat.currency(locale: 'es_AR', symbol: '\$', decimalDigits: 0).format(v);

  Color _hexColor(String hex) {
    try {
      final h = hex.replaceAll('#', '');
      return Color(int.parse('FF$h', radix: 16));
    } catch (_) { return const Color(0xFF38BDF8); }
  }

  double _spent(String cat) {
    final now = DateTime.now();
    return ref.read(transactionsProvider).transactions
      .where((t) => t.type == 'expense' && t.cat == cat && DateTime.tryParse(t.date)?.month == now.month && DateTime.tryParse(t.date)?.year == now.year)
      .fold(0.0, (s, t) => s + t.amount);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(budgetsProvider);
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: state.isLoading
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
        : RefreshIndicator(
            onRefresh: () => ref.read(budgetsProvider.notifier).fetch(),
            child: state.budgets.isEmpty
              ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Text('📊', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 12),
                  const Text('Sin presupuestos aún', style: TextStyle(color: Colors.white54)),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => _showAddSheet(context),
                    icon: const Icon(Icons.add), label: const Text('Crear presupuesto'),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), foregroundColor: Colors.white),
                  ),
                ]))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: state.budgets.length,
                  itemBuilder: (_, i) => _budgetCard(state.budgets[i]),
                ),
          ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddSheet(context),
        backgroundColor: const Color(0xFF10B981),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Presupuesto', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _budgetCard(AppBudget bgt) {
    final spent = _spent(bgt.cat);
    final pct = bgt.limit > 0 ? (spent / bgt.limit).clamp(0.0, 1.0) : 0.0;
    final remaining = bgt.limit - spent;
    final color = _hexColor(bgt.color);
    final isOverBudget = spent > bgt.limit;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isOverBudget ? Colors.red.withOpacity(0.5) : Colors.white10),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            Text(bgt.icon, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 10),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(bgt.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
              Text(bgt.cat, style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ]),
          ]),
          GestureDetector(
            onTap: () async {
              await ref.read(budgetsProvider.notifier).delete(bgt.id);
            },
            child: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 20),
          ),
        ]),
        const SizedBox(height: 12),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(_formatARS(spent), style: TextStyle(color: isOverBudget ? Colors.red : Colors.white70, fontSize: 13)),
          Text(_formatARS(bgt.limit), style: const TextStyle(color: Colors.white38, fontSize: 13)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 8,
            backgroundColor: Colors.white12,
            valueColor: AlwaysStoppedAnimation<Color>(isOverBudget ? Colors.red : color),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          isOverBudget ? '⚠️ Excedido en ${_formatARS(spent - bgt.limit)}' : 'Disponible: ${_formatARS(remaining)}',
          style: TextStyle(color: isOverBudget ? Colors.red.shade300 : const Color(0xFF10B981), fontSize: 12),
        ),
      ]),
    );
  }

  void _showAddSheet(BuildContext context) {
    final nameCtrl = TextEditingController();
    final limitCtrl = TextEditingController();
    String cat = 'Varios';
    String icon = '📦';
    String color = '#38BDF8';
    final cats = ['Alimentación', 'Transporte', 'Salud', 'Educación', 'Entretenimiento', 'Ropa', 'Hogar', 'Trabajo', 'Varios'];
    final icons = ['📦', '🍔', '🚗', '💊', '📚', '🎮', 'ORopa', '🏠', '💼'];

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setModal) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Nuevo Presupuesto', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(controller: nameCtrl, style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Nombre', hintStyle: const TextStyle(color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 10),
          TextField(controller: limitCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Límite mensual', hintStyle: const TextStyle(color: Colors.white38),
              prefixIcon: const Icon(Icons.attach_money, color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: cat, dropdownColor: const Color(0xFF0F172A), style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(labelText: 'Categoría', labelStyle: const TextStyle(color: Colors.white54), filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none)),
            items: cats.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
            onChanged: (v) => setModal(() => cat = v!),
          ),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), padding: const EdgeInsets.all(14)),
            onPressed: () async {
              final ok = await ref.read(budgetsProvider.notifier).add({'name': nameCtrl.text.trim(), 'cat': cat, 'icon': '📦', 'limit': double.tryParse(limitCtrl.text.replaceAll(',', '.')) ?? 0, 'color': color, 'notes': ''});
              if (ctx.mounted) {
                Navigator.pop(ctx);
                if (ok) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Presupuesto creado'), backgroundColor: Color(0xFF10B981)));
              }
            },
            child: const Text('Guardar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          )),
        ]),
      )),
    );
  }
}
