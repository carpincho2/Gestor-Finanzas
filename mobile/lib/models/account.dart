class AppAccount {
  final int id;
  final String name;
  final String type;
  final String? bank;
  double balance;
  final String currency;
  final double? limit;

  AppAccount({required this.id, required this.name, required this.type, this.bank, required this.balance, required this.currency, this.limit});

  factory AppAccount.fromJson(Map<String, dynamic> j) => AppAccount(
    id: j['id'] as int,
    name: j['name'] as String,
    type: j['type'] as String,
    bank: j['bank'] as String?,
    balance: (j['balance'] as num).toDouble(),
    currency: j['currency'] as String? ?? 'ARS',
    limit: j['limit'] != null ? (j['limit'] as num).toDouble() : null,
  );

  Map<String, dynamic> toJson() => {'name': name, 'type': type, 'bank': bank, 'balance': balance, 'currency': currency, 'limit': limit ?? 0.0};
}
