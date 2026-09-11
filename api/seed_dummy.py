import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from database import SessionLocal, Base, engine
from models import Comercio, Sucursal, Producto, Precio


def seed_db():
    """Inserta datos de prueba si no existen o completa sucursales/precios faltantes (MDP, etc.). Idempotente."""
    db = SessionLocal()
    try:
        from datetime import datetime

        # ── 1. Comercios ─────────────────────────────────────────
        comercios_def = [
            ("C1", "30-11111111-1", "Supermercado Disco", "disco"),
            ("C2", "30-22222222-2", "Supermercado Coto", "coto"),
            ("C3", "30-33333333-3", "Carrefour", "carrefour"),
            ("C4", "30-44444444-4", "Toledo", "toledo"),
        ]
        comercios_map = {}
        for sepa_id, cuit, nombre, nombre_key in comercios_def:
            c = db.query(Comercio).filter((Comercio.cuit == cuit) | (Comercio.sepa_id == sepa_id)).first()
            if not c:
                c = Comercio(sepa_id=sepa_id, cuit=cuit, nombre=nombre, nombre_key=nombre_key)
                db.add(c)
                db.flush()
            comercios_map[sepa_id] = c
        db.commit()

        # ── 2. Sucursales ─────────────────────────────────────────
        sucursales_def = [
            # CABA
            ("S1", comercios_map["C1"].id, "Disco Centro", -34.604, -58.380, "Av. Corrientes 1000", "CABA", "CABA"),
            ("S2", comercios_map["C2"].id, "Coto Obelisco", -34.602, -58.382, "Av. 9 de Julio 1200", "CABA", "CABA"),
            ("S3", comercios_map["C1"].id, "Disco Belgrano", -34.700, -58.400, "Av. Cabildo 500", "CABA", "CABA"),
            # Mar del Plata
            ("S4", comercios_map["C3"].id, "Carrefour Constitución", -38.0055, -57.5426, "Av. Constitución 6020", "Mar del Plata", "Buenos Aires"),
            ("S5", comercios_map["C2"].id, "Coto Mar del Plata", -37.9977, -57.5483, "Av. Colón 3100", "Mar del Plata", "Buenos Aires"),
            ("S6", comercios_map["C4"].id, "Toledo Centro", -37.9838, -57.5507, "San Martín 2600", "Mar del Plata", "Buenos Aires"),
            ("S7", comercios_map["C1"].id, "Disco Mar del Plata", -37.9950, -57.5550, "Av. Independencia 1800", "Mar del Plata", "Buenos Aires"),
            ("S8", comercios_map["C3"].id, "Carrefour Güemes", -37.9890, -57.5730, "Güemes 3200", "Mar del Plata", "Buenos Aires"),
        ]
        sucursales_map = {}
        for sepa_id, com_id, nombre, lat, lng, direccion, localidad, provincia in sucursales_def:
            s = db.query(Sucursal).filter(Sucursal.sepa_id == sepa_id).first()
            if not s:
                s = Sucursal(
                    sepa_id=sepa_id, comercio_id=com_id, nombre=nombre,
                    lat=lat, lng=lng, direccion=direccion,
                    localidad=localidad, provincia=provincia, activa=True
                )
                db.add(s)
                db.flush()
            sucursales_map[sepa_id] = s
        db.commit()

        # ── 3. Productos ─────────────────────────────────────────
        productos_def = [
            ("7790040001234", "Leche Entera La Serenisima 1L", "leche entera la serenisima 1l", "La Serenisima"),
            ("7790040001241", "Leche Deslactosada La Serenisima 1L", "leche deslactosada la serenisima 1l", "La Serenisima"),
            ("7790895000456", "Coca Cola Sabor Original 2.25L", "coca cola sabor original 2.25l", "Coca Cola"),
            ("7790070008012", "Aceite de Girasol Natura 900ml", "aceite de girasol natura 900ml", "Natura"),
            ("7790250052487", "Yerba Mate Taragüi 1Kg", "yerba mate taragui 1kg", "Taragüi"),
            ("7790580391607", "Galletitas Terrabusi Variedad 400g", "galletitas terrabusi variedad 400g", "Terrabusi"),
            ("7790895001231", "Coca Cola Zero 1.5L", "coca cola zero 1.5l", "Coca Cola"),
            ("7790040001258", "Leche Descremada La Serenisima 1L", "leche descremada la serenisima 1l", "La Serenisima"),
            ("7791290007895", "Fideos Matarazzo Spaghetti 500g", "fideos matarazzo spaghetti 500g", "Matarazzo"),
            ("7790310982150", "Arroz Gallo Oro 1Kg", "arroz gallo oro 1kg", "Gallo"),
        ]
        productos_map = {}
        for ean, nombre, norm, marca in productos_def:
            p = db.query(Producto).filter(Producto.ean == ean).first()
            if not p:
                p = Producto(ean=ean, nombre=nombre, nombre_normalizado=norm, marca=marca)
                db.add(p)
                db.flush()
            productos_map[ean] = p
        db.commit()

        # ── 4. Precios ───────────────────────────────────────────
        now = datetime.now()
        precios_def = [
            # CABA
            ("S1", "7790040001234", 950.0, 900.0, None),
            ("S2", "7790040001234", 900.0, 850.0, None),
            ("S3", "7790040001234", 1050.0, None, None),
            ("S1", "7790040001241", 1100.0, 1000.0, None),
            ("S2", "7790040001241", 1050.0, 980.0, None),
            ("S1", "7790895000456", 2800.0, 2500.0, None),
            ("S2", "7790895000456", 2700.0, 2400.0, None),
            ("S1", "7790070008012", 1800.0, None, None),

            # Mar del Plata
            ("S4", "7790040001234", 920.0, 870.0, None),
            ("S5", "7790040001234", 960.0, 910.0, None),
            ("S6", "7790040001234", 890.0, None, None),
            ("S7", "7790040001234", 940.0, 880.0, None),
            ("S8", "7790040001234", 950.0, None, None),

            ("S4", "7790040001241", 1080.0, 990.0, None),
            ("S5", "7790040001241", 1120.0, 1020.0, None),
            ("S6", "7790040001241", 1050.0, None, None),
            ("S7", "7790040001241", 1100.0, 1010.0, None),

            ("S4", "7790040001258", 980.0, 920.0, None),
            ("S5", "7790040001258", 1000.0, None, None),
            ("S6", "7790040001258", 950.0, 900.0, None),

            ("S4", "7790895000456", 2750.0, 2450.0, None),
            ("S5", "7790895000456", 2850.0, 2550.0, None),
            ("S6", "7790895000456", 2600.0, None, None),
            ("S7", "7790895000456", 2780.0, 2480.0, None),
            ("S8", "7790895000456", 2700.0, 2380.0, None),

            ("S4", "7790895001231", 2200.0, 1980.0, None),
            ("S5", "7790895001231", 2300.0, None, None),
            ("S6", "7790895001231", 2100.0, 1890.0, None),
            ("S7", "7790895001231", 2250.0, None, None),

            ("S4", "7790070008012", 1750.0, 1600.0, None),
            ("S5", "7790070008012", 1820.0, None, None),
            ("S6", "7790070008012", 1680.0, None, None),
            ("S7", "7790070008012", 1790.0, 1650.0, None),

            ("S4", "7790250052487", 3200.0, 2900.0, None),
            ("S5", "7790250052487", 3350.0, 3050.0, None),
            ("S6", "7790250052487", 3100.0, None, None),
            ("S7", "7790250052487", 3250.0, None, None),
            ("S8", "7790250052487", 3180.0, 2850.0, None),

            ("S4", "7790580391607", 1500.0, 1350.0, None),
            ("S5", "7790580391607", 1580.0, None, None),
            ("S6", "7790580391607", 1450.0, None, None),
            ("S8", "7790580391607", 1520.0, 1380.0, None),

            ("S4", "7791290007895", 1200.0, 1080.0, None),
            ("S5", "7791290007895", 1250.0, None, None),
            ("S6", "7791290007895", 1150.0, None, None),
            ("S7", "7791290007895", 1220.0, 1100.0, None),

            ("S4", "7790310982150", 1400.0, 1260.0, None),
            ("S5", "7790310982150", 1480.0, None, None),
            ("S6", "7790310982150", 1350.0, None, None),
            ("S8", "7790310982150", 1420.0, 1280.0, None),
        ]

        for s_sepa_id, p_ean, unit, promo_a, promo_b in precios_def:
            suc = sucursales_map.get(s_sepa_id)
            prod = productos_map.get(p_ean)
            if suc and prod:
                p_obj = db.query(Precio).filter_by(sucursal_id=suc.id, producto_id=prod.id).first()
                if not p_obj:
                    db.add(Precio(
                        sucursal_id=suc.id,
                        producto_id=prod.id,
                        precio_unitario=unit,
                        precio_promo_a=promo_a,
                        precio_promo_b=promo_b,
                        fecha_vigencia=now,
                    ))
        db.commit()

        total_p = db.query(Producto).count()
        total_pr = db.query(Precio).count()
        total_s = db.query(Sucursal).count()
        print(f"Seed DB completado exitosamente: {total_p} productos, {total_s} sucursales, {total_pr} precios.")
    except Exception as e:
        db.rollback()
        print(f"ERROR en seed_db: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()



if __name__ == "__main__":
    seed_db()
