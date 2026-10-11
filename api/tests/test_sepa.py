import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

from application.use_cases.sepa_use_cases import SepaUseCases, DEFAULT_LAT, DEFAULT_LNG
from domain.entities.product import (
    ProductWithPricesEntity,
    StorePriceEntity,
    SingleProductComparisonEntity,
    SingleStorePriceDetailEntity,
    StoreChainEntity,
)
from routers.sepa import router
from infrastructure.dependencies import get_sepa_use_cases


@pytest.fixture
def mock_repo():
    return MagicMock()


@pytest.fixture
def sepa_service(mock_repo):
    return SepaUseCases(mock_repo)


@pytest.fixture
def test_client(mock_repo):
    app = FastAPI()
    app.include_router(router)
    use_cases = SepaUseCases(mock_repo)
    app.dependency_overrides[get_sepa_use_cases] = lambda: use_cases
    return TestClient(app)


# ── Tests de SepaUseCases (Dominio / Aplicación) ──────────────────

def test_search_products_success(sepa_service, mock_repo):
    store = StorePriceEntity(
        sucursal_id=1,
        comercio="Coto",
        sucursal="Abasto",
        direccion="Av. Corrientes 3200",
        lat=-34.603,
        lng=-58.410,
        distancia_km=1.2,
        precio_lista=1200.0,
        precio_final=1000.0,
        ahorro_pct=16.7,
        promo_tag="VISA/MC",
        es_mejor=True,
    )
    product = ProductWithPricesEntity(
        ean="7791234567890",
        nombre="Leche Entera 1L",
        marca="La Serenísima",
        mejor_precio=1000.0,
        precio_promedio=1100.0,
        total_sucursales=1,
        sucursales=[store],
    )
    mock_repo.search_products_with_prices.return_value = [product]

    results = sepa_service.search_products("leche", lat=-34.60, lng=-58.38, radio_km=5.0)

    assert len(results) == 1
    assert results[0].nombre == "Leche Entera 1L"
    assert results[0].mejor_precio == 1000.0
    mock_repo.search_products_with_prices.assert_called_once_with(
        query="leche",
        lat=-34.60,
        lng=-58.38,
        radio_km=5.0,
        cadena_filter=None,
        sort_by=None,
        limite_productos=15,
        limite_sucursales=5,
        fecha=None,
    )


def test_search_products_empty_query(sepa_service, mock_repo):
    results = sepa_service.search_products("   ")
    assert results == []
    mock_repo.search_products_with_prices.assert_not_called()


def test_search_products_coordinate_fallback(sepa_service, mock_repo):
    mock_repo.search_products_with_prices.return_value = []

    # Coordenadas None -> usa DEFAULT_LAT, DEFAULT_LNG
    sepa_service.search_products("aceite", lat=None, lng=None)
    mock_repo.search_products_with_prices.assert_called_with(
        query="aceite",
        lat=DEFAULT_LAT,
        lng=DEFAULT_LNG,
        radio_km=10.0,
        cadena_filter=None,
        sort_by=None,
        limite_productos=15,
        limite_sucursales=5,
        fecha=None,
    )

    # Coordenadas fuera de Argentina -> usa fallback
    sepa_service.search_products("aceite", lat=40.7128, lng=-74.0060)
    mock_repo.search_products_with_prices.assert_called_with(
        query="aceite",
        lat=DEFAULT_LAT,
        lng=DEFAULT_LNG,
        radio_km=10.0,
        cadena_filter=None,
        sort_by=None,
        limite_productos=15,
        limite_sucursales=5,
        fecha=None,
    )


def test_compare_single_product_success(sepa_service, mock_repo):
    detail = SingleStorePriceDetailEntity(
        sucursal_id=1,
        comercio="Carrefour",
        sucursal="Palermo",
        direccion="Av. Santa Fe 3000",
        localidad="CABA",
        lat=-34.588,
        lng=-58.411,
        distancia_km=2.5,
        precio_lista=2500.0,
        precio_promo_a=None,
        precio_promo_b=None,
        precio_bancario=2250.0,
        precio_minimo=2250.0,
        promo_bancaria_desc="10% Cuenta DNI",
        promo_bancaria_tag="Cuenta DNI",
        ahorro_pct=10.0,
        valor_total=2350.0,
        es_precio_mas_bajo=True,
        es_mejor_valor=True,
    )
    comparison = SingleProductComparisonEntity(
        producto={"ean": "7790001", "nombre": "Café Molido 250g"},
        total_sucursales=1,
        precio_mas_bajo=2250.0,
        precio_mas_alto=2500.0,
        resultados=[detail],
    )
    mock_repo.compare_single_product.return_value = comparison

    res = sepa_service.compare_single_product(ean="7790001", lat=-34.60, lng=-58.38)

    assert res is not None
    assert res.producto["nombre"] == "Café Molido 250g"
    assert res.precio_mas_bajo == 2250.0
    assert len(res.resultados) == 1
    assert res.resultados[0].es_mejor_valor is True


def test_compare_single_product_missing_identifier(sepa_service, mock_repo):
    res = sepa_service.compare_single_product(ean=None, query=None)
    assert res is None
    mock_repo.compare_single_product.assert_not_called()


def test_get_available_chains(sepa_service, mock_repo):
    mock_repo.get_available_chains.return_value = [
        StoreChainEntity(key="coto", nombre="Coto"),
        StoreChainEntity(key="carrefour", nombre="Carrefour"),
    ]

    chains = sepa_service.get_available_chains()
    assert len(chains) == 2
    assert chains[0].key == "coto"
    assert chains[1].nombre == "Carrefour"


def test_get_popular_suggestions(sepa_service, mock_repo):
    mock_repo.get_popular_suggestions.return_value = ["Leche", "Aceite", "Café"]
    suggs = sepa_service.get_popular_suggestions()
    assert "Leche" in suggs


# ── Tests de Endpoints HTTP (Router FastAPI) ────────────────────

def test_api_buscar_productos(test_client, mock_repo):
    store = StorePriceEntity(
        sucursal_id=1,
        comercio="Dia",
        sucursal="San Telmo",
        direccion="Defensa 800",
        lat=-34.618,
        lng=-58.371,
        distancia_km=1.0,
        precio_lista=800.0,
        precio_final=720.0,
        ahorro_pct=10.0,
        promo_tag="Club Día",
        es_mejor=True,
    )
    product = ProductWithPricesEntity(
        ean="7795555555555",
        nombre="Arroz Blanco 1kg",
        marca="Gallo",
        mejor_precio=720.0,
        precio_promedio=750.0,
        total_sucursales=1,
        sucursales=[store],
    )
    mock_repo.search_products_with_prices.return_value = [product]

    resp = test_client.get("/api/precios/buscar?q=arroz&lat=-34.60&lng=-58.38&radio=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "arroz"
    assert data["total_productos"] == 1
    assert data["productos"][0]["nombre"] == "Arroz Blanco 1kg"
    assert data["productos"][0]["sucursales"][0]["comercio"] == "Dia"


def test_api_buscar_precios_single(test_client, mock_repo):
    detail = SingleStorePriceDetailEntity(
        sucursal_id=2,
        comercio="Jumbo",
        sucursal="Palermo",
        direccion="Bullrich 345",
        localidad="CABA",
        lat=-34.575,
        lng=-58.428,
        distancia_km=3.0,
        precio_lista=3000.0,
        precio_promo_a=None,
        precio_promo_b=None,
        precio_bancario=None,
        precio_minimo=3000.0,
        promo_bancaria_desc=None,
        promo_bancaria_tag=None,
        ahorro_pct=0.0,
        valor_total=3120.0,
        es_precio_mas_bajo=True,
        es_mejor_valor=True,
    )
    mock_repo.compare_single_product.return_value = SingleProductComparisonEntity(
        producto={"ean": "7791234567890", "nombre": "Yerba Mate 1kg"},
        total_sucursales=1,
        precio_mas_bajo=3000.0,
        precio_mas_alto=3000.0,
        resultados=[detail],
    )

    resp = test_client.get("/api/precios?ean=7791234567890&lat=-34.60&lng=-58.38")
    assert resp.status_code == 200
    data = resp.json()
    assert data["producto"]["nombre"] == "Yerba Mate 1kg"
    assert data["total_sucursales"] == 1
    assert data["resultados"][0]["comercio"] == "Jumbo"


def test_api_buscar_precios_400_missing_query(test_client):
    resp = test_client.get("/api/precios")
    assert resp.status_code == 400


def test_api_buscar_precios_404_not_found(test_client, mock_repo):
    mock_repo.compare_single_product.return_value = None
    resp = test_client.get("/api/precios?ean=7799999999999")
    assert resp.status_code == 404


def test_api_comercios_list(test_client, mock_repo):
    mock_repo.get_available_chains.return_value = [
        StoreChainEntity(key="coto", nombre="Coto"),
        StoreChainEntity(key="dia", nombre="Dia"),
    ]
    resp = test_client.get("/api/precios/comercios")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["key"] == "coto"


def test_api_sugerencias(test_client, mock_repo):
    mock_repo.get_popular_suggestions.return_value = ["Leche", "Aceite", "Yerba"]
    resp = test_client.get("/api/precios/sugerencias")
    assert resp.status_code == 200
    data = resp.json()
    assert "Leche" in data
