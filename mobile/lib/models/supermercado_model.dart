class SupermercadoResponse {
  final Map<String, dynamic> producto;
  final int totalSucursales;
  final double precioMasBajo;
  final double precioMasAlto;
  final List<SucursalPrecio> resultados;

  SupermercadoResponse({
    required this.producto,
    required this.totalSucursales,
    required this.precioMasBajo,
    required this.precioMasAlto,
    required this.resultados,
  });

  factory SupermercadoResponse.fromJson(Map<String, dynamic> json) {
    return SupermercadoResponse(
      producto: json['producto'] ?? {},
      totalSucursales: json['total_sucursales'] ?? 0,
      precioMasBajo: (json['precio_mas_bajo'] ?? 0).toDouble(),
      precioMasAlto: (json['precio_mas_alto'] ?? 0).toDouble(),
      resultados: (json['resultados'] as List?)
              ?.map((e) => SucursalPrecio.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class SucursalPrecio {
  final int sucursalId;
  final String comercio;
  final String sucursal;
  final String direccion;
  final double distanciaKm;
  final double valorTotal;
  final bool esPrecioMasBajo;
  final bool esMejorValor;
  final PrecioPromo precios;

  SucursalPrecio({
    required this.sucursalId,
    required this.comercio,
    required this.sucursal,
    required this.direccion,
    required this.distanciaKm,
    required this.valorTotal,
    required this.esPrecioMasBajo,
    required this.esMejorValor,
    required this.precios,
  });

  factory SucursalPrecio.fromJson(Map<String, dynamic> json) {
    return SucursalPrecio(
      sucursalId: json['sucursal_id'] ?? 0,
      comercio: json['comercio'] ?? '',
      sucursal: json['sucursal'] ?? '',
      direccion: json['direccion'] ?? '',
      distanciaKm: (json['distancia_km'] ?? 0).toDouble(),
      valorTotal: (json['valor_total'] ?? 0).toDouble(),
      esPrecioMasBajo: json['es_precio_mas_bajo'] ?? false,
      esMejorValor: json['es_mejor_valor'] ?? false,
      precios: PrecioPromo.fromJson(json['precios'] ?? {}),
    );
  }
}

class PrecioPromo {
  final double precioMinimo;
  final double precioLista;
  final double? precioBancario;
  final String? promoBancariaTag;
  final double ahorroPct;

  PrecioPromo({
    required this.precioMinimo,
    required this.precioLista,
    this.precioBancario,
    this.promoBancariaTag,
    required this.ahorroPct,
  });

  factory PrecioPromo.fromJson(Map<String, dynamic> json) {
    return PrecioPromo(
      precioMinimo: (json['precio_minimo'] ?? 0).toDouble(),
      precioLista: (json['precio_lista'] ?? 0).toDouble(),
      precioBancario: json['precio_bancario'] != null ? (json['precio_bancario'] as num).toDouble() : null,
      promoBancariaTag: json['promo_bancaria_tag'],
      ahorroPct: (json['ahorro_pct'] ?? 0).toDouble(),
    );
  }
}
