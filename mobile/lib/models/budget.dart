class AppBudget {
  final int id;
  final String cat;
  final String name;
  final String icon;
  final double limit;
  final String color;
  final String? notes;

  AppBudget({required this.id, required this.cat, required this.name, required this.icon, required this.limit, required this.color, this.notes});

  factory AppBudget.fromJson(Map<String, dynamic> j) => AppBudget(
    id: j['id'] as int,
    cat: j['cat'] as String,
    name: j['name'] as String,
    icon: j['icon'] as String? ?? '📦',
    limit: (j['limit'] as num).toDouble(),
    color: j['color'] as String,
    notes: j['notes'] as String?,
  );

  Map<String, dynamic> toJson() => {'cat': cat, 'name': name, 'icon': icon, 'limit': limit, 'color': color, 'notes': notes ?? ''};
}
