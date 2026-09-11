from typing import Protocol, List, Optional
from domain.entities.product import ProductWithPricesEntity

class PriceRepositoryPort(Protocol):
    def search_products_with_prices(
        self,
        query: str,
        lat: float,
        lng: float,
        radio_km: float = 10.0,
        limite_productos: int = 15,
        limite_sucursales: int = 5,
    ) -> List[ProductWithPricesEntity]:
        ...
