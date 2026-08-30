/// Respuesta del endpoint multi-producto /precios/buscar
class BusquedaMultiProductoResponse {
  final String query;
  final int totalProductos;
  final List<ProductoConPrecios> productos;

  BusquedaMultiProductoResponse({
    required this.query,
    required this.totalProductos,
    required this.productos,
  });

  factory BusquedaMultiProductoResponse.fromJson(Map<String, dynamic> json) {
    return BusquedaMultiProductoResponse(
      query: json['query'] ?? '',
      totalProductos: json['total_productos'] ?? 0,
      productos: (json['productos'] as List?)
              ?.map((e) => ProductoConPrecios.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class ProductoConPrecios {
  final String ean;
  final String nombre;
  final String? marca;
  final double mejorPrecio;
  final double precioPromedio;
  final int totalSucursales;
  final List<SucursalResumen> sucursales;

  ProductoConPrecios({
    required this.ean,
    required this.nombre,
    this.marca,
    required this.mejorPrecio,
    required this.precioPromedio,
    required this.totalSucursales,
    required this.sucursales,
  });

  factory ProductoConPrecios.fromJson(Map<String, dynamic> json) {
    return ProductoConPrecios(
      ean: json['ean'] ?? '',
      nombre: json['nombre'] ?? '',
      marca: json['marca'],
      mejorPrecio: (json['mejor_precio'] ?? 0).toDouble(),
      precioPromedio: (json['precio_promedio'] ?? 0).toDouble(),
      totalSucursales: json['total_sucursales'] ?? 0,
      sucursales: (json['sucursales'] as List?)
              ?.map((e) => SucursalResumen.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class SucursalResumen {
  final int sucursalId;
  final String comercio;
  final String? sucursal;
  final String? direccion;
  final double lat;
  final double lng;
  final double distanciaKm;
  final double precioLista;
  final double precioFinal;
  final double ahorroPct;
  final String? promoTag;
  final bool esMejor;

  SucursalResumen({
    required this.sucursalId,
    required this.comercio,
    this.sucursal,
    this.direccion,
    required this.lat,
    required this.lng,
    required this.distanciaKm,
    required this.precioLista,
    required this.precioFinal,
    required this.ahorroPct,
    this.promoTag,
    required this.esMejor,
  });

  factory SucursalResumen.fromJson(Map<String, dynamic> json) {
    return SucursalResumen(
      sucursalId: json['sucursal_id'] ?? 0,
      comercio: json['comercio'] ?? '',
      sucursal: json['sucursal'],
      direccion: json['direccion'],
      lat: (json['lat'] ?? 0).toDouble(),
      lng: (json['lng'] ?? 0).toDouble(),
      distanciaKm: (json['distancia_km'] ?? 0).toDouble(),
      precioLista: (json['precio_lista'] ?? 0).toDouble(),
      precioFinal: (json['precio_final'] ?? 0).toDouble(),
      ahorroPct: (json['ahorro_pct'] ?? 0).toDouble(),
      promoTag: json['promo_tag'],
      esMejor: json['es_mejor'] ?? false,
    );
  }
}
