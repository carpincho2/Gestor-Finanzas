from typing import List, Optional, Any
from ports.repositories.price_repository_port import PriceRepositoryPort
from domain.entities.product import (
    ProductWithPricesEntity,
    SingleProductComparisonEntity,
    StoreChainEntity,
)

DEFAULT_LAT = -34.6037
DEFAULT_LNG = -58.3816


class SepaUseCases:
    """
    Casos de uso para el Buscador de Precios SEPA.
    Encapsula la lógica de negocio, validaciones y orquestación
    siguiendo los principios SOLID y la arquitectura PHAME.
    """

    def __init__(self, price_repo: PriceRepositoryPort):
        self.price_repo = price_repo

    def search_products(
        self,
        query: str,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radio_km: float = 10.0,
        cadena_filter: Optional[str] = None,
        sort_by: Optional[str] = None,
        limite_productos: int = 15,
        limite_sucursales: int = 5,
        fecha: Optional[Any] = None,
    ) -> List[ProductWithPricesEntity]:
        """
        Búsqueda de múltiples productos con mejores precios por sucursal cercana.
        Permite filtrado por cadena de supermercado y ordenamiento personalizado.
        """
        cleaned_query = query.strip()
        if not cleaned_query:
            return []

        # Fallback de coordenadas si no están presentes o están fuera de rango
        effective_lat, effective_lng = self._resolve_coordinates(lat, lng)
        effective_radio = max(0.5, min(radio_km, 50.0))

        return self.price_repo.search_products_with_prices(
            query=cleaned_query,
            lat=effective_lat,
            lng=effective_lng,
            radio_km=effective_radio,
            cadena_filter=cadena_filter.strip() if cadena_filter else None,
            sort_by=sort_by,
            limite_productos=limite_productos,
            limite_sucursales=limite_sucursales,
            fecha=fecha,
        )

    def compare_single_product(
        self,
        ean: Optional[str] = None,
        query: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radio_km: float = 10.0,
        fecha: Optional[Any] = None,
    ) -> Optional[SingleProductComparisonEntity]:
        """
        Compara un producto específico (por código EAN o texto) en todas las sucursales cercanas,
        calculando el costo total de traslado, promociones bancarias y mejor valor.
        """
        cleaned_ean = ean.strip() if ean else None
        cleaned_query = query.strip() if query else None

        if not cleaned_ean and not cleaned_query:
            return None

        effective_lat, effective_lng = self._resolve_coordinates(lat, lng)
        effective_radio = max(0.5, min(radio_km, 50.0))

        return self.price_repo.compare_single_product(
            ean=cleaned_ean,
            query=cleaned_query,
            lat=effective_lat,
            lng=effective_lng,
            radio_km=effective_radio,
            fecha=fecha,
        )

    def get_available_chains(self) -> List[StoreChainEntity]:
        """Devuelve la lista de cadenas de supermercados registradas."""
        return self.price_repo.get_available_chains()

    def get_popular_suggestions(self) -> List[str]:
        """Devuelve las sugerencias y categorías rápidas de búsqueda."""
        return self.price_repo.get_popular_suggestions()

    @staticmethod
    def _resolve_coordinates(lat: Optional[float], lng: Optional[float]) -> tuple[float, float]:
        """Valida que las coordenadas estén dentro del territorio argentino o aplica fallback seguro."""
        if lat is None or lng is None:
            return DEFAULT_LAT, DEFAULT_LNG

        # Argentina bounds: lat [-55.0, -21.0], lng [-74.0, -53.0]
        if -55.0 <= lat <= -21.0 and -74.0 <= lng <= -53.0:
            return lat, lng

        return DEFAULT_LAT, DEFAULT_LNG
