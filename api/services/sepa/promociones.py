"""
Motor de reglas de promociones.

En Argentina el precio real depende de:
  - Precio de lista (precio_unitario_bulto_por_unidad_venta_con_iva en el SEPA)
  - Precio promo A: promoción general (2x1, % descuento para todos)
  - Precio promo B: promoción segmentada (jubilados, tarjetas, fidelidad)
  - Calendario bancario: descuentos según día de la semana y medio de pago
  - Topes de reintegro: el ahorro tiene un máximo semanal/mensual por cliente

El SEPA incluye precio_promo_a y precio_promo_b en su CSV.
Las promociones bancarias son externas y se mantienen en esta tabla estática
(deberían actualizarse manualmente o vía scraping de las webs de los bancos).
"""

from datetime import date
from dataclasses import dataclass, field
from enum import IntEnum


class DiaSemana(IntEnum):
    LUNES = 0
    MARTES = 1
    MIERCOLES = 2
    JUEVES = 3
    VIERNES = 4
    SABADO = 5
    DOMINGO = 6


@dataclass
class PromocionBancaria:
    descripcion: str
    descuento_pct: float        # 0.10 = 10% de descuento
    tag_corto: str              # "VISA/MC", "Cuenta DNI", etc.
    tope_reintegro: float = 0   # 0 = sin tope declarado
    dias: list[int] = field(default_factory=list)  # DiaSemana values


# -------------------------------------------------------------------
# Tabla de promociones bancarias por cadena
# Fuente: sitios oficiales de cada supermercado (actualizar periódicamente)
# -------------------------------------------------------------------
PROMOS_BANCARIAS: dict[str, list[PromocionBancaria]] = {
    "coto": [
        PromocionBancaria("25% VISA / Mastercard débito", 0.25, "VISA/MC", tope_reintegro=10000, dias=[DiaSemana.LUNES]),
        PromocionBancaria("25% Banco Supervielle", 0.25, "Supervielle", dias=[DiaSemana.MARTES]),
        PromocionBancaria("15% Comunidad Coto", 0.15, "Comunidad Coto", dias=[DiaSemana.MIERCOLES]),
        PromocionBancaria("30% VISA Débito NFC", 0.30, "VISA Débito NFC", tope_reintegro=10000, dias=[DiaSemana.JUEVES]),
    ],
    "carrefour": [
        PromocionBancaria("Desc. Club La Nación", 0.18, "La Nación", dias=[DiaSemana.LUNES]),
        PromocionBancaria("10% Cuenta DNI", 0.10, "Cuenta DNI", dias=[DiaSemana.MIERCOLES]),
    ],
    "dia": [
        PromocionBancaria("10% Cuenta DNI", 0.10, "Cuenta DNI", dias=[DiaSemana.LUNES]),
        PromocionBancaria("Club Día 15%", 0.15, "Club Día", dias=[DiaSemana.MARTES]),
        PromocionBancaria("15% Mercado Pago", 0.15, "Mercado Pago", dias=[DiaSemana.MIERCOLES]),
    ],
    "jumbo": [
        PromocionBancaria("3 cuotas sin interés", 0.00, "3 CSI", dias=[DiaSemana.JUEVES]),
    ],
    "changomas": [
        PromocionBancaria("20% Cuenta DNI", 0.20, "Cuenta DNI", tope_reintegro=10000, dias=[DiaSemana.JUEVES]),
    ],
    "nini": [
        PromocionBancaria("15% Cuenta DNI martes", 0.15, "Cuenta DNI", dias=[DiaSemana.MARTES]),
    ],
}


@dataclass
class PrecioFinal:
    precio_lista: float
    precio_promo_a: float | None      # promo general del SEPA
    precio_promo_b: float | None      # promo segmentada del SEPA
    precio_bancario: float | None     # precio después de descuento bancario
    promo_bancaria: PromocionBancaria | None
    precio_minimo: float              # el más bajo de todos

    @property
    def ahorro_vs_lista(self) -> float:
        return round(self.precio_lista - self.precio_minimo, 2)

    @property
    def ahorro_pct(self) -> float:
        if self.precio_lista == 0:
            return 0.0
        return round((self.ahorro_vs_lista / self.precio_lista) * 100, 1)


def calcular_precio_final(
    precio_lista: float,
    precio_promo_a: float | None,
    precio_promo_b: float | None,
    cadena: str,
    fecha: date | None = None,
) -> PrecioFinal:
    """
    Calcula el precio mínimo real para un producto en una sucursal,
    considerando todas las capas de descuento disponibles.

    Args:
        precio_lista:  Precio de góndola sin descuentos.
        precio_promo_a: Promo general (del CSV SEPA, campo precio_promo_a).
        precio_promo_b: Promo segmentada (del CSV SEPA, campo precio_promo_b).
        cadena:        Nombre normalizado de la cadena (coto, carrefour, etc.).
        fecha:         Fecha a evaluar. Por defecto: hoy.
    """
    if fecha is None:
        fecha = date.today()

    dia = fecha.weekday()   # 0=lunes … 6=domingo

    # Precio bancario: buscar la mejor promo vigente hoy para esta cadena
    cadena_key = cadena.lower().replace(" ", "")
    promos_hoy = [
        p for p in PROMOS_BANCARIAS.get(cadena_key, [])
        if dia in p.dias and p.descuento_pct > 0
    ]
    mejor_promo = max(promos_hoy, key=lambda p: p.descuento_pct, default=None)
    precio_bancario = None
    if mejor_promo:
        base = precio_promo_a or precio_lista
        precio_bancario = round(base * (1 - mejor_promo.descuento_pct), 2)

    candidatos = [precio_lista]
    if precio_promo_a:
        candidatos.append(precio_promo_a)
    if precio_promo_b:
        candidatos.append(precio_promo_b)
    if precio_bancario:
        candidatos.append(precio_bancario)

    return PrecioFinal(
        precio_lista=precio_lista,
        precio_promo_a=precio_promo_a,
        precio_promo_b=precio_promo_b,
        precio_bancario=precio_bancario,
        promo_bancaria=mejor_promo,
        precio_minimo=min(candidatos),
    )
