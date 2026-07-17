class AppGoal {
  final int id;
  final String name;
  final String cat;
  final String emoji;
  final String color;
  final double target;
  double current;
  final String? deadline;
  final String? notes;
  final String status;

  AppGoal({required this.id, required this.name, required this.cat, required this.emoji, required this.color, required this.target, required this.current, this.deadline, this.notes, required this.status});

  double get progress => target > 0 ? (current / target).clamp(0.0, 1.0) : 0;

  factory AppGoal.fromJson(Map<String, dynamic> j) => AppGoal(
    id: j['id'] as int,
    name: j['name'] as String,
    cat: j['cat'] as String? ?? '',
    emoji: j['emoji'] as String? ?? '🎯',
    color: j['color'] as String? ?? '#38BDF8',
    target: (j['target'] as num).toDouble(),
    current: (j['current'] as num?)?.toDouble() ?? 0.0,
    deadline: j['deadline'] as String?,
    notes: j['notes'] as String?,
    status: j['status'] as String? ?? 'active',
  );

  Map<String, dynamic> toJson() => {'name': name, 'cat': cat, 'emoji': emoji, 'color': color, 'target': target, 'current': current, 'deadline': deadline ?? '', 'notes': notes ?? '', 'status': status};
}
