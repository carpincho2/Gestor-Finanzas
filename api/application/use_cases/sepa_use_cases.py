from typing import List
from ports.repositories.price_repository_port import PriceRepositoryPort
from domain.entities.product import ProductWithPricesEntity

class SepaUseCases:
    def __init__(self, price_repo: PriceRepositoryPort):
        self.price_repo = price_repo

    def search_products(
        self,
        query: str,
        lat: float,
        lng: float,
        radio_km: float = 10.0,
    ) -> List[ProductWithPricesEntity]:
        return self.price_repo.search_products_with_prices(
            query=query,
            lat=lat,
            lng=lng,
            radio_km=radio_km,
        )
