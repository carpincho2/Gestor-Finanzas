import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../providers/accounts_provider.dart';
import '../providers/transactions_provider.dart';
import '../models/account.dart';
import '../models/transaction.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});
  @override ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(accountsProvider.notifier).fetch();
      ref.read(transactionsProvider.notifier).fetch();
    });
  }

  String _formatARS(double v) => NumberFormat.currency(locale: 'es_AR', symbol: '\$', decimalDigits: 0).format(v);

  @override
  Widget build(BuildContext context) {
    final accState = ref.watch(accountsProvider);
    final txState = ref.watch(transactionsProvider);
    final now = DateTime.now();

    final accounts = accState.accounts;
    final txs = txState.transactions;
    final monthTxs = txs.where((t) { final d = DateTime.tryParse(t.date); return d != null && d.month == now.month && d.year == now.year; }).toList();
    final income = monthTxs.where((t) => t.type == 'income').fold(0.0, (s, t) => s + t.amount);
    final expenses = monthTxs.where((t) => t.type == 'expense').fold(0.0, (s, t) => s + t.amount);
    final totalBalance = accounts.fold(0.0, (s, a) => s + a.balance);
    final recentTxs = [...txs]..sort((a, b) => b.date.compareTo(a.date));

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(accountsProvider.notifier).fetch();
        await ref.read(transactionsProvider.notifier).fetch();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Balance card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF1E3A5F), Color(0xFF0F172A)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.2)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Balance Total', style: TextStyle(color: Colors.white60, fontSize: 14)),
              const SizedBox(height: 8),
              Text(_formatARS(totalBalance), style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: _miniStat('Ingresos mes', income, const Color(0xFF10B981), Icons.arrow_downward)),
                const SizedBox(width: 12),
                Expanded(child: _miniStat('Gastos mes', expenses, const Color(0xFFEF4444), Icons.arrow_upward)),
              ]),
            ]),
          ),
          const SizedBox(height: 20),

          // Pie chart accounts
          if (accounts.isNotEmpty) ...[
            const Text('Distribución de cuentas', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Container(
              height: 200,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white10)),
              child: PieChart(PieChartData(
                sectionsSpace: 2,
                centerSpaceRadius: 40,
                sections: _chartSections(accounts),
              )),
            ),
            const SizedBox(height: 20),
          ],

          // Recent transactions
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Últimas transacciones', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            Text('${txs.length} total', style: const TextStyle(color: Colors.white38, fontSize: 12)),
          ]),
          const SizedBox(height: 12),
          if (txState.isLoading || accState.isLoading)
            const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
          else if (recentTxs.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12)),
              child: const Center(child: Column(children: [
                Text('💸', style: TextStyle(fontSize: 40)),
                SizedBox(height: 8),
                Text('Sin transacciones aún', style: TextStyle(color: Colors.white54)),
              ])),
            )
          else
            ...recentTxs.take(10).map((tx) => _txRow(tx, accounts)),
        ]),
      ),
    );
  }

  Widget _miniStat(String label, double value, Color color, IconData icon) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
    child: Row(children: [
      Icon(icon, color: color, size: 16),
      const SizedBox(width: 6),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: color.withOpacity(0.8), fontSize: 10)),
        Text(_formatARS(value), style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13)),
      ])),
    ]),
  );

  Widget _txRow(AppTransaction tx, List<AppAccount> accounts) {
    final isIncome = tx.type == 'income';
    final acc = accounts.firstWhere((a) => a.id == tx.accountId, orElse: () => AppAccount(id: 0, name: '---', type: '', balance: 0, currency: 'ARS'));
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white10)),
      child: Row(children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: isIncome ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFFEF4444).withOpacity(0.15),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(isIncome ? Icons.arrow_downward : Icons.arrow_upward, color: isIncome ? const Color(0xFF10B981) : const Color(0xFFEF4444), size: 16),
        ),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tx.desc, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis),
          Text('${tx.cat} · ${acc.name}', style: const TextStyle(color: Colors.white54, fontSize: 11)),
        ])),
        Text(
          '${isIncome ? "+" : "-"}${_formatARS(tx.amount)}',
          style: TextStyle(color: isIncome ? const Color(0xFF10B981) : const Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 13),
        ),
      ]),
    );
  }

  List<PieChartSectionData> _chartSections(List<AppAccount> accounts) {
    final colors = [const Color(0xFF38BDF8), const Color(0xFF10B981), const Color(0xFFF59E0B), const Color(0xFF8B5CF6), const Color(0xFFEC4899)];
    final total = accounts.fold(0.0, (s, a) => s + a.balance.abs());
    if (total == 0) return [PieChartSectionData(color: Colors.white24, value: 1, title: '')];
    return List.generate(accounts.length, (i) {
      final pct = accounts[i].balance.abs() / total * 100;
      return PieChartSectionData(
        color: colors[i % colors.length], value: accounts[i].balance.abs(),
        title: '${pct.toStringAsFixed(0)}%', radius: 45,
        titleStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
      );
    });
  }
}
