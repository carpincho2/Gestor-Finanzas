import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/goals_provider.dart';
import '../models/goal.dart';

class GoalsScreen extends ConsumerStatefulWidget {
  const GoalsScreen({super.key});
  @override ConsumerState<GoalsScreen> createState() => _GoalsScreenState();
}

class _GoalsScreenState extends ConsumerState<GoalsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(goalsProvider.notifier).fetch());
  }

  String _formatARS(double v) => NumberFormat.currency(locale: 'es_AR', symbol: '\$', decimalDigits: 0).format(v);

  Color _hexColor(String hex) {
    try { return Color(int.parse('FF${hex.replaceAll("#", "")}', radix: 16)); }
    catch (_) { return const Color(0xFF38BDF8); }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(goalsProvider);
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: state.isLoading
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
        : RefreshIndicator(
            onRefresh: () => ref.read(goalsProvider.notifier).fetch(),
            child: state.goals.isEmpty
              ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Text('🎯', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 12),
                  const Text('Sin objetivos aún', style: TextStyle(color: Colors.white54)),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => _showAddSheet(context),
                    icon: const Icon(Icons.add), label: const Text('Crear objetivo'),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), foregroundColor: Colors.white),
                  ),
                ]))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: state.goals.length,
                  itemBuilder: (_, i) => _goalCard(context, state.goals[i]),
                ),
          ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddSheet(context),
        backgroundColor: const Color(0xFF10B981),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Objetivo', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _goalCard(BuildContext context, AppGoal goal) {
    final color = _hexColor(goal.color);
    final pct = goal.progress;
    final remaining = goal.target - goal.current;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            Text(goal.emoji, style: const TextStyle(fontSize: 28)),
            const SizedBox(width: 10),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(goal.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
              if (goal.deadline != null && goal.deadline!.isNotEmpty)
                Text('📅 ${goal.deadline}', style: const TextStyle(color: Colors.white54, fontSize: 11)),
            ]),
          ]),
          Row(children: [
            GestureDetector(
              onTap: () => _showContribSheet(context, goal),
              child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: color.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                child: Text('+Aporte', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold))),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => ref.read(goalsProvider.notifier).delete(goal.id),
              child: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 20),
            ),
          ]),
        ]),
        const SizedBox(height: 12),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(_formatARS(goal.current), style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16)),
          Text(_formatARS(goal.target), style: const TextStyle(color: Colors.white38, fontSize: 14)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(value: pct, minHeight: 10, backgroundColor: Colors.white12, valueColor: AlwaysStoppedAnimation<Color>(color)),
        ),
        const SizedBox(height: 6),
        Text(
          pct >= 1 ? '✅ ¡Meta alcanzada!' : 'Falta: ${_formatARS(remaining)} · ${(pct * 100).toStringAsFixed(0)}%',
          style: TextStyle(color: pct >= 1 ? const Color(0xFF10B981) : Colors.white54, fontSize: 12),
        ),
      ]),
    );
  }

  void _showContribSheet(BuildContext context, AppGoal goal) {
    final amtCtrl = TextEditingController();
    final today = DateTime.now().toIso8601String().split('T').first;
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Agregar aporte a "${goal.name}"', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(controller: amtCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Monto', hintStyle: const TextStyle(color: Colors.white38),
              prefixIcon: const Icon(Icons.attach_money, color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), padding: const EdgeInsets.all(14)),
            onPressed: () async {
              final amt = double.tryParse(amtCtrl.text.replaceAll(',', '.')) ?? 0;
              if (amt <= 0) return;
              await ref.read(goalsProvider.notifier).addContribution(goal.id, amt, today);
              if (ctx.mounted) { Navigator.pop(ctx); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Aporte registrado'), backgroundColor: Color(0xFF10B981))); }
            },
            child: const Text('Guardar Aporte', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          )),
        ]),
      ),
    );
  }

  void _showAddSheet(BuildContext context) {
    final nameCtrl = TextEditingController();
    final targetCtrl = TextEditingController();
    final deadlineCtrl = TextEditingController();
    String emoji = '🎯';
    String color = '#38BDF8';
    String cat = 'Ahorro';

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Nuevo Objetivo', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(controller: nameCtrl, style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Nombre del objetivo', hintStyle: const TextStyle(color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 10),
          TextField(controller: targetCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Meta (\$)', hintStyle: const TextStyle(color: Colors.white38),
              prefixIcon: const Icon(Icons.flag_outlined, color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 10),
          TextField(controller: deadlineCtrl, style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: 'Fecha límite (YYYY-MM-DD)', hintStyle: const TextStyle(color: Colors.white38),
              prefixIcon: const Icon(Icons.calendar_today_outlined, color: Colors.white38),
              filled: true, fillColor: const Color(0xFF0F172A), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none))),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), padding: const EdgeInsets.all(14)),
            onPressed: () async {
              final ok = await ref.read(goalsProvider.notifier).add({'name': nameCtrl.text.trim(), 'cat': cat, 'emoji': emoji, 'color': color, 'target': double.tryParse(targetCtrl.text.replaceAll(',', '.')) ?? 0, 'current': 0, 'deadline': deadlineCtrl.text.trim(), 'notes': '', 'status': 'active'});
              if (ctx.mounted) { Navigator.pop(ctx); if (ok) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Objetivo creado'), backgroundColor: Color(0xFF10B981))); }
            },
            child: const Text('Crear Objetivo', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          )),
        ]),
      ),
    );
  }
}
