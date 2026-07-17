import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../providers/transactions_provider.dart';
import '../models/transaction.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});
  @override ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  int _selectedMonth = DateTime.now().month;
  int _selectedYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(transactionsProvider.notifier).fetch());
  }

  String _formatARS(double v) => NumberFormat.currency(locale: 'es_AR', symbol: '\$', decimalDigits: 0).format(v);

  List<AppTransaction> get _monthTxs => ref.read(transactionsProvider).transactions.where((t) {
    final d = DateTime.tryParse(t.date);
    return d != null && d.month == _selectedMonth && d.year == _selectedYear;
  }).toList();

  @override
  Widget build(BuildContext context) {
    ref.watch(transactionsProvider);
    final txs = _monthTxs;
    final income = txs.where((t) => t.type == 'income').fold(0.0, (s, t) => s + t.amount);
    final expenses = txs.where((t) => t.type == 'expense').fold(0.0, (s, t) => s + t.amount);
    final balance = income - expenses;

    final catMap = <String, double>{};
    for (final t in txs.where((t) => t.type == 'expense')) {
      catMap[t.cat] = (catMap[t.cat] ?? 0) + t.amount;
    }
    final cats = catMap.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    final monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Month selector
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            IconButton(
              icon: const Icon(Icons.chevron_left, color: Colors.white),
              onPressed: () => setState(() {
                if (_selectedMonth == 1) { _selectedMonth = 12; _selectedYear--; }
                else _selectedMonth--;
              }),
            ),
            Text('${monthNames[_selectedMonth]} $_selectedYear', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            IconButton(
              icon: const Icon(Icons.chevron_right, color: Colors.white),
              onPressed: () => setState(() {
                if (_selectedMonth == 12) { _selectedMonth = 1; _selectedYear++; }
                else _selectedMonth++;
              }),
            ),
          ]),
          const SizedBox(height: 16),
          // Summary cards
          Row(children: [
            Expanded(child: _statCard('Ingresos', income, const Color(0xFF10B981))),
            const SizedBox(width: 10),
            Expanded(child: _statCard('Gastos', expenses, const Color(0xFFEF4444))),
            const SizedBox(width: 10),
            Expanded(child: _statCard('Balance', balance, balance >= 0 ? const Color(0xFF38BDF8) : const Color(0xFFEF4444))),
          ]),
          const SizedBox(height: 20),
          // Pie chart by category
          if (cats.isNotEmpty) ...[
            const Text('Gastos por categoría', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            SizedBox(
              height: 220,
              child: PieChart(PieChartData(
                sectionsSpace: 2,
                centerSpaceRadius: 45,
                sections: List.generate(cats.length.clamp(0, 6), (i) {
                  final colors = [const Color(0xFF38BDF8), const Color(0xFF10B981), const Color(0xFFF59E0B), const Color(0xFF8B5CF6), const Color(0xFFEC4899), const Color(0xFFEF4444)];
                  return PieChartSectionData(
                    color: colors[i % colors.length],
                    value: cats[i].value,
                    title: cats[i].key.length > 6 ? '${cats[i].key.substring(0, 6)}..' : cats[i].key,
                    radius: 55,
                    titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                  );
                }),
              )),
            ),
            const SizedBox(height: 16),
            // Category list
            ...cats.map((e) => _catRow(e.key, e.value, expenses)),
          ] else
            const Center(child: Padding(padding: EdgeInsets.all(40), child: Text('Sin gastos este mes', style: TextStyle(color: Colors.white54)))),
        ]),
      ),
    );
  }

  Widget _statCard(String label, double value, Color color) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white10)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
      const SizedBox(height: 4),
      Text(_formatARS(value), style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14)),
    ]),
  );

  Widget _catRow(String cat, double amount, double total) {
    final pct = total > 0 ? amount / total : 0.0;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(cat, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 4),
          LinearProgressIndicator(value: pct, backgroundColor: Colors.white12, color: const Color(0xFF38BDF8), minHeight: 4),
        ])),
        const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(_formatARS(amount), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
          Text('${(pct * 100).toStringAsFixed(0)}%', style: const TextStyle(color: Colors.white38, fontSize: 11)),
        ]),
      ]),
    );
  }
}
