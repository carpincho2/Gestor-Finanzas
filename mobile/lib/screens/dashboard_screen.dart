import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/dashboard_provider.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(dashboardProvider.notifier).fetchAccounts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(dashboardProvider);

    if (state.isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)));
    }

    if (state.error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
            const SizedBox(height: 16),
            Text(state.error!, style: const TextStyle(color: Colors.redAccent)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => ref.read(dashboardProvider.notifier).fetchAccounts(),
              child: const Text('Reintentar'),
            )
          ],
        ),
      );
    }

    final accounts = state.accounts ?? [];
    double totalBalance = accounts.fold(0.0, (sum, acc) => sum + (acc['balance'] ?? 0.0));

    return RefreshIndicator(
      onRefresh: () => ref.read(dashboardProvider.notifier).fetchAccounts(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Balance Total',
              style: TextStyle(color: Colors.white70, fontSize: 16),
            ),
            const SizedBox(height: 8),
            Text(
              '\$${totalBalance.toStringAsFixed(2)}',
              style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 32),
            
            // Gráfico
            if (accounts.isNotEmpty)
              Container(
                height: 250,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: PieChart(
                  PieChartData(
                    sectionsSpace: 2,
                    centerSpaceRadius: 50,
                    sections: _generateChartData(accounts),
                  ),
                ),
              ),

            const SizedBox(height: 32),
            const Text(
              'Tus Cuentas',
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            
            ...accounts.map((acc) => _buildAccountCard(acc)).toList(),
          ],
        ),
      ),
    );
  }

  List<PieChartSectionData> _generateChartData(List<dynamic> accounts) {
    final colors = [
      const Color(0xFF38BDF8),
      const Color(0xFF10B981),
      const Color(0xFFF59E0B),
      const Color(0xFF8B5CF6),
      const Color(0xFFEC4899),
    ];

    double total = accounts.fold(0.0, (sum, acc) => sum + (acc['balance'] ?? 0.0));
    if (total == 0) total = 1; // Evitar división por cero

    return List.generate(accounts.length, (i) {
      final acc = accounts[i];
      final balance = (acc['balance'] ?? 0.0) as double;
      final percentage = (balance / total) * 100;
      
      return PieChartSectionData(
        color: colors[i % colors.length],
        value: balance,
        title: '${percentage.toStringAsFixed(0)}%',
        radius: 40,
        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      );
    });
  }

  Widget _buildAccountCard(dynamic acc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  acc['type'] == 'tarjeta_credito' ? Icons.credit_card : Icons.account_balance_wallet,
                  color: const Color(0xFF38BDF8),
                ),
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(acc['name'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(acc['type'], style: const TextStyle(color: Colors.white54, fontSize: 12)),
                ],
              ),
            ],
          ),
          Text('\$${(acc['balance'] ?? 0.0).toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        ],
      ),
    );
  }
}
