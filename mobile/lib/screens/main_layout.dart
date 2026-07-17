import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dashboard_screen.dart';
import 'transactions_screen.dart';
import 'accounts_screen.dart';
import 'budgets_screen.dart';
import 'goals_screen.dart';
import 'reports_screen.dart';
import 'profile_screen.dart';
import 'scanner_screen.dart';
import 'shopping_screen.dart';
import '../providers/auth_provider.dart';

class MainLayout extends ConsumerStatefulWidget {
  const MainLayout({super.key});
  @override ConsumerState<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends ConsumerState<MainLayout> {
  int _currentIndex = 0;

  final List<_NavItem> _navItems = [
    _NavItem('Inicio', Icons.dashboard_outlined, Icons.dashboard),
    _NavItem('Transacciones', Icons.receipt_long_outlined, Icons.receipt_long),
    _NavItem('Cuentas', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet),
    _NavItem('Más', Icons.grid_view_outlined, Icons.grid_view),
  ];

  Widget _buildScreen(int index) {
    switch (index) {
      case 0: return const DashboardScreen();
      case 1: return const TransactionsScreen();
      case 2: return const AccountsScreen();
      case 3: return const _MoreScreen();
      default: return const DashboardScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: Row(children: [
          Image.asset('assets/logo.png', width: 28, height: 28, errorBuilder: (_, __, ___) => const Icon(Icons.account_balance_wallet, color: Color(0xFF38BDF8), size: 28)),
          const SizedBox(width: 10),
          const Text('Flujo', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 20)),
        ]),
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner, color: Colors.white70),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ScannerScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white70),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: IndexedStack(index: _currentIndex, children: List.generate(4, _buildScreen)),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Colors.white10, width: 1)),
          color: Color(0xFF1E293B),
        ),
        child: SafeArea(
          child: Row(
            children: List.generate(_navItems.length, (i) {
              final item = _navItems[i];
              final selected = _currentIndex == i;
              return Expanded(child: GestureDetector(
                onTap: () => setState(() => _currentIndex = i),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(selected ? item.activeIcon : item.icon, color: selected ? const Color(0xFF38BDF8) : Colors.white38, size: 22),
                    const SizedBox(height: 4),
                    Text(item.label, style: TextStyle(color: selected ? const Color(0xFF38BDF8) : Colors.white38, fontSize: 10, fontWeight: selected ? FontWeight.bold : FontWeight.normal)),
                  ]),
                ),
              ));
            }),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final String label;
  final IconData icon;
  final IconData activeIcon;
  const _NavItem(this.label, this.icon, this.activeIcon);
}

class _MoreScreen extends StatelessWidget {
  const _MoreScreen();

  @override
  Widget build(BuildContext context) {
    final options = [
      _MoreOption('Presupuestos', Icons.pie_chart_outline, const Color(0xFF8B5CF6), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BudgetsScreen()))),
      _MoreOption('Objetivos', Icons.flag_outlined, const Color(0xFF10B981), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GoalsScreen()))),
      _MoreOption('Reportes', Icons.bar_chart_outlined, const Color(0xFFF59E0B), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReportsScreen()))),
      _MoreOption('Asistente IA', Icons.shopping_cart_outlined, const Color(0xFF38BDF8), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ShoppingScreen()))),
      _MoreOption('Scanner', Icons.document_scanner_outlined, const Color(0xFFEC4899), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ScannerScreen()))),
      _MoreOption('Mi Perfil', Icons.person_outline, const Color(0xFF64748B), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()))),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Más funciones', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 20),
          GridView.count(
            crossAxisCount: 2, shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.3,
            children: options.map((opt) => _moreCard(opt)).toList(),
          ),
        ]),
      ),
    );
  }

  Widget _moreCard(_MoreOption opt) => GestureDetector(
    onTap: opt.onTap,
    child: Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: opt.color.withOpacity(0.3)),
      ),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: opt.color.withOpacity(0.15), shape: BoxShape.circle),
          child: Icon(opt.icon, color: opt.color, size: 28),
        ),
        const SizedBox(height: 10),
        Text(opt.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
      ]),
    ),
  );
}

class _MoreOption {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _MoreOption(this.label, this.icon, this.color, this.onTap);
}
