from typing import List, Optional, Any
from sqlalchemy.orm import Session
from services.sepa.comparador import (
    buscar_productos_con_precios,
    comparar_precios,
    buscar_producto_por_texto,
)
from domain.entities.product import (
    ProductWithPricesEntity,
    StorePriceEntity,
    SingleProductComparisonEntity,
    SingleStorePriceDetailEntity,
    StoreChainEntity,
)
from ports.repositories.price_repository_port import PriceRepositoryPort
from models import Comercio


class SQLAlchemyPriceRepository(PriceRepositoryPort):
    """Implementación de acceso a datos de precios usando SQLAlchemy."""

    def __init__(self, db: Session):
        self.db = db

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
        res = buscar_productos_con_precios(
            query=query,
            lat=lat,
            lng=lng,
            radio_km=radio_km,
            db=self.db,
            limite_productos=limite_productos,
            limite_sucursales=limite_sucursales * 2 if cadena_filter else limite_sucursales,
            fecha=fecha,
        )

        domain_products: List[ProductWithPricesEntity] = []
        for p in res.productos:
            stores: List[StorePriceEntity] = []
            for s in p.sucursales:
                # Filtrado opcional por cadena de comercio
                if cadena_filter and cadena_filter.lower() not in s.comercio.lower():
                    continue

                stores.append(
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
                )

            # Si se filtró por cadena y este producto no tiene sucursales para esa cadena, omitir
            if cadena_filter and not stores:
                continue

            # Ordenamiento de sucursales según preferencia del usuario
            if sort_by == "distancia":
                stores.sort(key=lambda x: x.distancia_km)
            elif sort_by == "ahorro":
                stores.sort(key=lambda x: x.ahorro_pct, reverse=True)
            else:
                stores.sort(key=lambda x: x.precio_final)

            # Re-evaluar cuál es la mejor sucursal
            stores = stores[:limite_sucursales]
            for idx, store in enumerate(stores):
                store.es_mejor = (idx == 0)

            final_prices = [s.precio_final for s in stores]
            mejor_precio = min(final_prices) if final_prices else p.mejor_precio
            precio_promedio = (
                round(sum(final_prices) / len(final_prices), 2)
                if final_prices
                else p.precio_promedio
            )

            domain_products.append(
                ProductWithPricesEntity(
                    ean=p.ean,
                    nombre=p.nombre,
                    marca=p.marca,
                    mejor_precio=mejor_precio,
                    precio_promedio=precio_promedio,
                    total_sucursales=len(stores),
                    sucursales=stores,
                )
            )

        return domain_products

    def compare_single_product(
        self,
        ean: Optional[str],
        query: Optional[str],
        lat: float,
        lng: float,
        radio_km: float = 10.0,
        fecha: Optional[Any] = None,
    ) -> Optional[SingleProductComparisonEntity]:
        # Si no se pasó EAN pero sí texto de búsqueda, resolver EAN
        target_ean = ean
        if not target_ean and query:
            productos = buscar_producto_por_texto(query=query, db=self.db, limite=1)
            if not productos:
                return None
            target_ean = productos[0].ean

        if not target_ean:
            return None

        busqueda = comparar_precios(
            ean=target_ean,
            lat=lat,
            lng=lng,
            radio_km=radio_km,
            db=self.db,
            fecha=fecha,
        )

        if busqueda is None:
            return None

        mejor_valor_id = busqueda.mejor_valor.sucursal_id if busqueda.mejor_valor else None
        precio_min_global = busqueda.precio_mas_bajo

        items: List[SingleStorePriceDetailEntity] = []
        for r in busqueda.resultados:
            items.append(
                SingleStorePriceDetailEntity(
                    sucursal_id=r.sucursal_id,
                    comercio=r.comercio_nombre,
                    sucursal=r.sucursal_nombre,
                    direccion=r.direccion,
                    localidad=r.localidad,
                    lat=r.lat,
                    lng=r.lng,
                    distancia_km=r.distancia_km,
                    precio_lista=r.precios.precio_lista,
                    precio_promo_a=r.precios.precio_promo_a,
                    precio_promo_b=r.precios.precio_promo_b,
                    precio_bancario=r.precios.precio_bancario,
                    precio_minimo=r.precios.precio_minimo,
                    promo_bancaria_desc=r.precios.promo_bancaria.descripcion if r.precios.promo_bancaria else None,
                    promo_bancaria_tag=r.precios.promo_bancaria.tag_corto if r.precios.promo_bancaria else None,
                    ahorro_pct=r.precios.ahorro_pct,
                    valor_total=r.valor_total,
                    es_precio_mas_bajo=(r.precios.precio_minimo == precio_min_global),
                    es_mejor_valor=(r.sucursal_id == mejor_valor_id),
                )
            )

        return SingleProductComparisonEntity(
            producto=busqueda.producto,
            total_sucursales=len(items),
            precio_mas_bajo=busqueda.precio_mas_bajo,
            precio_mas_alto=busqueda.precio_mas_alto,
            resultados=items,
        )

    def get_available_chains(self) -> List[StoreChainEntity]:
        comercios = (
            self.db.query(Comercio)
            .order_by(Comercio.nombre)
            .all()
        )
        return [
            StoreChainEntity(key=c.nombre_key, nombre=c.nombre)
            for c in comercios
        ]

    def get_popular_suggestions(self) -> List[str]:
        return [
            "Leche",
            "Aceite",
            "Café",
            "Yerba",
            "Arroz",
            "Fideos",
            "Azúcar",
            "Harina",
            "Coca Cola",
            "Galletitas",
            "Detergente",
        ]
