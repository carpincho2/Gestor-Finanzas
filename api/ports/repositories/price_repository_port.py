from typing import Protocol, List, Optional, Any
from domain.entities.product import (
    ProductWithPricesEntity,
    SingleProductComparisonEntity,
    StoreChainEntity,
)


class PriceRepositoryPort(Protocol):
    """Puerto que define las operaciones de acceso a datos para precios y comercios del SEPA."""

    def search_products_with_prices(
        self,
        query: str,
        lat: float,
        lng: float,
        radio_km: float = 10.0,
        cadena_filter: Optional[str] = None,
        sort_by: Optional[str] = None,
        limite_productos: int = 15,
        limite_sucursales: int = 5,
        fecha: Optional[Any] = None,
    ) -> List[ProductWithPricesEntity]:
        """Busca productos y sus precios en sucursales cercanas."""
        ...

    def compare_single_product(
        self,
        ean: Optional[str],
        query: Optional[str],
        lat: float,
        lng: float,
        radio_km: float = 10.0,
        fecha: Optional[Any] = None,
    ) -> Optional[SingleProductComparisonEntity]:
        """Compara precios y costos de traslado para un producto específico en todas las sucursales cercanas."""
        ...

    def get_available_chains(self) -> List[StoreChainEntity]:
        """Obtiene las cadenas de supermercados registradas."""
        ...

    def get_popular_suggestions(self) -> List[str]:
        """Obtiene sugerencias y categorías populares de productos."""
        ...
