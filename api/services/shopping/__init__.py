"""
Módulo de estrategias de extracción de productos multi-tienda.
Implementa el patrón Strategy y Open/Closed Principle (OCP).
"""
from ports.extractors.product_extractor_port import IProductExtractor
from services.shopping.mercadolibre_extractor import MercadoLibreExtractor
from services.shopping.generic_extractor import GenericECommerceExtractor
from services.shopping.extractor_registry import ProductExtractorRegistry

__all__ = [
    "IProductExtractor",
    "MercadoLibreExtractor",
    "GenericECommerceExtractor",
    "ProductExtractorRegistry",
]
