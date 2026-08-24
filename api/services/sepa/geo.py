"""
Utilidades geográficas.

Haversine: fórmula estándar para distancia entre dos puntos en la esfera terrestre.
Bounding box: pre-filtro cuadrado para reducir el universo antes de aplicar Haversine.
  → En una tabla con 50k sucursales es 10-100x más rápido filtrar primero por lat/lng
    dentro de un cuadrado y después calcular la distancia real solo para esos candidatos.
"""

from math import radians, sin, cos, sqrt, atan2
from dataclasses import dataclass


EARTH_RADIUS_KM = 6371.0


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en km entre dos coordenadas."""
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return EARTH_RADIUS_KM * 2 * atan2(sqrt(a), sqrt(1 - a))


@dataclass
class BoundingBox:
    lat_min: float
    lat_max: float
    lng_min: float
    lng_max: float


def bounding_box(lat: float, lng: float, radio_km: float) -> BoundingBox:
    """
    Genera un cuadrado delimitador alrededor de un punto.
    1 grado de latitud ≈ 111 km (constante).
    1 grado de longitud ≈ 111 km × cos(lat) (varía con la latitud).

    Ejemplo de uso en SQLAlchemy:
        query.filter(
            Sucursal.lat.between(bb.lat_min, bb.lat_max),
            Sucursal.lng.between(bb.lng_min, bb.lng_max),
        )
    Luego aplicar haversine() sobre los resultados para distancia exacta.
    """
    from math import cos, radians

    delta_lat = radio_km / 111.0
    delta_lng = radio_km / (111.0 * cos(radians(lat)))

    return BoundingBox(
        lat_min=lat - delta_lat,
        lat_max=lat + delta_lat,
        lng_min=lng - delta_lng,
        lng_max=lng + delta_lng,
    )


def sucursales_en_radio(
    sucursales: list[dict],
    lat: float,
    lng: float,
    radio_km: float,
) -> list[dict]:
    """
    Filtra una lista de sucursales (dicts con 'lat' y 'lng') dentro del radio.
    Agrega el campo 'distancia_km' a cada resultado.
    Ordena de más cercana a más lejana.
    """
    bb = bounding_box(lat, lng, radio_km)
    candidatos = [
        s for s in sucursales
        if bb.lat_min <= s["lat"] <= bb.lat_max
        and bb.lng_min <= s["lng"] <= bb.lng_max
    ]
    resultado = []
    for s in candidatos:
        dist = haversine(lat, lng, s["lat"], s["lng"])
        if dist <= radio_km:
            resultado.append({**s, "distancia_km": round(dist, 2)})

    resultado.sort(key=lambda x: x["distancia_km"])
    return resultado
