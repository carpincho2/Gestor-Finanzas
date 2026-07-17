import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/goal.dart';
import '../services/api_service.dart';

class GoalsState {
  final bool isLoading;
  final String? error;
  final List<AppGoal> goals;
  GoalsState({this.isLoading = false, this.error, this.goals = const []});
  GoalsState copyWith({bool? isLoading, String? error, List<AppGoal>? goals}) =>
    GoalsState(isLoading: isLoading ?? this.isLoading, error: error, goals: goals ?? this.goals);
}

class GoalsNotifier extends Notifier<GoalsState> {
  @override GoalsState build() => GoalsState();

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final r = await ApiService().get('/api/goals');
      if (r['ok'] == true) {
        final list = (r['goals'] as List).map((e) => AppGoal.fromJson(e)).toList();
        state = state.copyWith(isLoading: false, goals: list);
      } else { state = state.copyWith(isLoading: false, error: r['error']); }
    } catch (e) { state = state.copyWith(isLoading: false, error: e.toString()); }
  }

  Future<bool> add(Map<String, dynamic> data) async {
    try {
      final r = await ApiService().post('/api/goals', data);
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }

  Future<bool> addContribution(int goalId, double amount, String date) async {
    try {
      final r = await ApiService().post('/api/goals/$goalId/contributions', {'amount': amount, 'date': date});
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }

  Future<bool> delete(int id) async {
    try {
      final r = await ApiService().delete('/api/goals/$id');
      if (r['ok'] == true) { await fetch(); return true; }
      return false;
    } catch (_) { return false; }
  }
}

final goalsProvider = NotifierProvider<GoalsNotifier, GoalsState>(() => GoalsNotifier());
