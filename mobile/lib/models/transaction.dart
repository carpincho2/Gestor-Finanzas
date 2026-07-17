class AppTransaction {
  final int id;
  final int? accountId;
  final String type;
  final String desc;
  final double amount;
  final String cat;
  final String date;

  AppTransaction({required this.id, this.accountId, required this.type, required this.desc, required this.amount, required this.cat, required this.date});

  factory AppTransaction.fromJson(Map<String, dynamic> j) => AppTransaction(
    id: j['id'] as int,
    accountId: j['account_id'] as int?,
    type: j['type'] as String,
    desc: j['desc'] as String,
    amount: (j['amount'] as num).toDouble(),
    cat: j['cat'] as String,
    date: j['date'] as String,
  );

  Map<String, dynamic> toJson() => {'account_id': accountId, 'type': type, 'desc': desc, 'amount': amount, 'cat': cat, 'date': date};
}
