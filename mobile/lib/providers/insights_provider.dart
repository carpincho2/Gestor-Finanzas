import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'transactions_provider.dart';
import 'accounts_provider.dart';
import 'budgets_provider.dart';
import 'goals_provider.dart';

class InsightCard {
  final String tipo;
  final String titulo;
  final String descripcion;
  final String icono;

  InsightCard({required this.tipo, required this.titulo, required this.descripcion, required this.icono});

  factory InsightCard.fromJson(Map<String, dynamic> json) {
    return InsightCard(
      tipo: json['tipo'] ?? 'info',
      titulo: json['titulo'] ?? '',
      descripcion: json['descripcion'] ?? '',
      icono: json['icono'] ?? '💡',
    );
  }
}

class ChatMessage {
  final String role;
  final String content;

  ChatMessage({required this.role, required this.content});

  Map<String, dynamic> toJson() => {'role': role, 'content': content};
}

class InsightsState {
  final bool isLoadingCards;
  final bool isLoadingChat;
  final String? error;
  final List<InsightCard> cards;
  final List<ChatMessage> chatHistory;

  InsightsState({
    this.isLoadingCards = false,
    this.isLoadingChat = false,
    this.error,
    this.cards = const [],
    this.chatHistory = const [],
  });

  InsightsState copyWith({
    bool? isLoadingCards,
    bool? isLoadingChat,
    String? error,
    List<InsightCard>? cards,
    List<ChatMessage>? chatHistory,
  }) {
    return InsightsState(
      isLoadingCards: isLoadingCards ?? this.isLoadingCards,
      isLoadingChat: isLoadingChat ?? this.isLoadingChat,
      error: error,
      cards: cards ?? this.cards,
      chatHistory: chatHistory ?? this.chatHistory,
    );
  }
}

class InsightsNotifier extends Notifier<InsightsState> {
  @override
  InsightsState build() {
    return InsightsState();
  }

  String _buildContext() {
    final txs = ref.read(transactionsProvider).transactions;
    final budgets = ref.read(budgetsProvider).budgets;
    final goals = ref.read(goalsProvider).goals;
    
    final now = DateTime.now();
    final monthFormat = DateFormat('MMMM yyyy', 'es_AR');
    final currency = NumberFormat.currency(locale: 'es_AR', symbol: '\$', decimalDigits: 0);

    final thisMonthTxs = txs.where((t) {
      final d = DateTime.tryParse(t.date) ?? DateTime.now();
      return d.month == now.month && d.year == now.year;
    }).toList();

    final income = thisMonthTxs.where((t) => t.type == 'income').fold(0.0, (s, t) => s + t.amount);
    final expense = thisMonthTxs.where((t) => t.type == 'expense').fold(0.0, (s, t) => s + t.amount);
    final balance = income - expense;
    final saveRate = income > 0 ? ((balance / income) * 100).round() : 0;

    final catMap = <String, double>{};
    for (var t in thisMonthTxs.where((t) => t.type == 'expense')) {
      catMap[t.cat] = (catMap[t.cat] ?? 0) + t.amount;
    }
    final catBreakdown = catMap.entries.map((e) => '${e.key}: ${currency.format(e.value)}').join(', ');

    final budgetStatus = budgets.map((b) {
      final spent = thisMonthTxs.where((t) => t.type == 'expense' && t.cat == b.category).fold(0.0, (s, t) => s + t.amount);
      final pct = b.limit > 0 ? ((spent / b.limit) * 100).round() : 0;
      return '${b.category}: gastado ${currency.format(spent)} de ${currency.format(b.limit)} ($pct%)';
    }).join('; ');

    final goalStatus = goals.map((g) {
      final saved = g.currentAmount;
      final pct = g.targetAmount > 0 ? ((saved / g.targetAmount) * 100).round() : 0;
      return '${g.name}: ${currency.format(saved)} de ${currency.format(g.targetAmount)} ($pct%)';
    }).join('; ');

    return '''CONTEXTO FINANCIERO DEL USUARIO (${monthFormat.format(now)}):
- Ingresos del mes: ${currency.format(income)}
- Gastos del mes: ${currency.format(expense)}
- Balance neto: ${currency.format(balance)}
- Tasa de ahorro: $saveRate%
- Gastos por categoría: ${catBreakdown.isEmpty ? 'Sin datos' : catBreakdown}
- Estado presupuestos: ${budgetStatus.isEmpty ? 'Sin presupuestos' : budgetStatus}
- Objetivos de ahorro: ${goalStatus.isEmpty ? 'Sin objetivos' : goalStatus}
- Total transacciones históricas: ${txs.length}''';
  }

  Future<void> fetchInsights() async {
    if (state.isLoadingCards) return;
    state = state.copyWith(isLoadingCards: true, error: null);

    try {
      final context = _buildContext();
      final r = await ApiService().post('/api/ai/insights', {'contexto_financiero': context});

      if (r['ok'] == true && r['cards'] != null) {
        final list = (r['cards'] as List).map((c) => InsightCard.fromJson(c)).toList();
        state = state.copyWith(isLoadingCards: false, cards: list);
      } else {
        state = state.copyWith(isLoadingCards: false, error: r['error'] ?? 'Error al generar insights');
      }
    } catch (e) {
      state = state.copyWith(isLoadingCards: false, error: e.toString());
    }
  }

  Future<void> sendMessage(String text) async {
    if (state.isLoadingChat || text.trim().isEmpty) return;
    
    final userMsg = ChatMessage(role: 'user', content: text.trim());
    final newHistory = List<ChatMessage>.from(state.chatHistory)..add(userMsg);
    
    state = state.copyWith(isLoadingChat: true, error: null, chatHistory: newHistory);

    try {
      final context = _buildContext();
      
      final historyToSend = state.chatHistory.map((m) => m.toJson()).toList();

      final r = await ApiService().post('/api/ai/chat', {
        'contexto_financiero': context,
        'pregunta': text.trim(),
        'historial': historyToSend,
      });

      if (r['ok'] == true) {
        final botMsg = ChatMessage(role: 'assistant', content: r['reply'] ?? 'Sin respuesta.');
        state = state.copyWith(isLoadingChat: false, chatHistory: [...newHistory, botMsg]);
      } else {
        final errorMsg = ChatMessage(role: 'assistant', content: '❌ Hubo un error: \${r["error"]}');
        state = state.copyWith(isLoadingChat: false, chatHistory: [...newHistory, errorMsg]);
      }
    } catch (e) {
      final errorMsg = ChatMessage(role: 'assistant', content: '❌ Hubo un error de red.');
      state = state.copyWith(isLoadingChat: false, chatHistory: [...newHistory, errorMsg]);
    }
  }
}

final insightsProvider = NotifierProvider<InsightsNotifier, InsightsState>(() => InsightsNotifier());
