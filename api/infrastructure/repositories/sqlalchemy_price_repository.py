from typing import List
from sqlalchemy.orm import Session
from services.sepa.comparador import buscar_productos_con_precios
from domain.entities.product import ProductWithPricesEntity, StorePriceEntity
from ports.repositories.price_repository_port import PriceRepositoryPort

class SQLAlchemyPriceRepository(PriceRepositoryPort):
    def __init__(self, db: Session):
        self.db = db

    def search_products_with_prices(
        self,
        query: str,
        lat: float,
        lng: float,
        radio_km: float = 10.0,
        limite_productos: int = 15,
        limite_sucursales: int = 5,
    ) -> List[ProductWithPricesEntity]:
        res = buscar_productos_con_precios(
            query=query,
            lat=lat,
            lng=lng,
            radio_km=radio_km,
            db=self.db,
            limite_productos=limite_productos,
            limite_sucursales=limite_sucursales,
        )

        domain_products = []
        for p in res.productos:
            stores = [
                StorePriceEntity(
                    sucursal_id=s.sucursal_id,
                    comercio=s.comercio,
                    sucursal=s.sucursal,
                    direccion=s.direccion,
                    lat=s.lat,
                    lng=s.lng,
                    distancia_km=s.distancia_km,
                    precio_lista=s.precio_lista,
                    precio_final=s.precio_final,
                    ahorro_pct=s.ahorro_pct,
                    promo_tag=s.promo_tag,
                    es_mejor=s.es_mejor,
                )
                for s in p.sucursales
            ]

            domain_products.append(ProductWithPricesEntity(
                ean=p.ean,
                nombre=p.nombre,
                marca=p.marca,
                mejor_precio=p.mejor_precio,
                precio_promedio=p.precio_promedio,
                total_sucursales=p.total_sucursales,
                sucursales=stores,
            ))

        return domain_products
