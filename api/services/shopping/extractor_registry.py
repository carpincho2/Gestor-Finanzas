from typing import List, Optional

from ports.extractors.product_extractor_port import IProductExtractor
from services.shopping.mercadolibre_extractor import MercadoLibreExtractor
from services.shopping.generic_extractor import GenericECommerceExtractor


class ProductExtractorRegistry:
    """
    Registro y Fábrica de Extractores de Productos (Patrón Registry + Strategy).
    Garantiza el cumplimiento de Open/Closed Principle (OCP):
    Nuevos extractores pueden ser registrados sin modificar el código de los servicios existentes.
    """

    def __init__(self, extractors: Optional[List[IProductExtractor]] = None):
        if extractors is not None:
            self._extractors = list(extractors)
        else:
            # Orden de prioridad: extractores especializados primero, extractor genérico como fallback
            self._extractors = [
                MercadoLibreExtractor(),
                GenericECommerceExtractor(),
            ]

    def register(self, extractor: IProductExtractor, index: Optional[int] = None) -> None:
        """Registra un nuevo extractor en el orden indicado."""
        if index is not None:
            self._extractors.insert(index, extractor)
        else:
            # Insertar antes del último (que usualmente es el genérico)
            if len(self._extractors) > 0 and isinstance(self._extractors[-1], GenericECommerceExtractor):
                self._extractors.insert(len(self._extractors) - 1, extractor)
            else:
                self._extractors.append(extractor)

    def get_extractor(self, url: str) -> IProductExtractor:
        """Retorna el extractor más adecuado para la URL suministrada."""
        for ext in self._extractors:
            try:
                if ext.can_handle(url):
                    return ext
            except Exception:
                continue
        return GenericECommerceExtractor()
