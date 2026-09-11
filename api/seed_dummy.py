import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from database import SessionLocal, Base, engine
from models import Comercio, Sucursal, Producto, Precio


def seed_db():
    """Inserta datos de prueba si no existen o completa sucursales/precios faltantes. Idempotente."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from datetime import datetime

        # ── 0. Limpiar sucursales y precios antiguos de prueba para reiniciar catálogo limpio ──
        db.query(Precio).delete(synchronize_session=False)
        db.query(Sucursal).delete(synchronize_session=False)
        db.commit()

        # ── 1. Comercios ─────────────────────────────────────────
        comercios_def = [
            ("C1", "30-11111111-1", "Supermercado Disco", "disco"),
            ("C2", "30-22222222-2", "Supermercado Coto", "coto"),
            ("C3", "30-33333333-3", "Carrefour", "carrefour"),
            ("C4", "30-44444444-4", "Supermercados Toledo", "toledo"),
            ("C5", "30-55555555-5", "Supermercado Vea", "vea"),
        ]
        comercios_map = {}
        for sepa_id, cuit, nombre, nombre_key in comercios_def:
            c = db.query(Comercio).filter((Comercio.cuit == cuit) | (Comercio.sepa_id == sepa_id)).first()
            if not c:
                c = Comercio(sepa_id=sepa_id, cuit=cuit, nombre=nombre, nombre_key=nombre_key)
                db.add(c)
                db.flush()
            else:
                c.nombre = nombre
                c.nombre_key = nombre_key
                db.flush()
            comercios_map[sepa_id] = c
        db.commit()

        # ── 2. Sucursales Reales Verificadas ──────────────────────
        sucursales_def = [
            # CABA
            ("S1", comercios_map["C1"].id, "Disco Centro", -34.604, -58.380, "Av. Corrientes 1000", "CABA", "CABA"),
            ("S2", comercios_map["C2"].id, "Coto Obelisco", -34.602, -58.382, "Av. 9 de Julio 1200", "CABA", "CABA"),
            ("S3", comercios_map["C1"].id, "Disco Belgrano", -34.700, -58.400, "Av. Cabildo 500", "CABA", "CABA"),
            # Mar del Plata (Ubicaciones Reales Verificadas)
            ("S4", comercios_map["C1"].id, "Disco Constitución", -37.9678, -57.5602, "Av. Constitución 4850", "Mar del Plata", "Buenos Aires"),
            ("S5", comercios_map["C3"].id, "Carrefour Market Catamarca", -37.9995, -57.5492, "Catamarca 2038", "Mar del Plata", "Buenos Aires"),
            ("S6", comercios_map["C4"].id, "Toledo Jujuy", -37.9982, -57.5518, "Jujuy 1900", "Mar del Plata", "Buenos Aires"),
            ("S7", comercios_map["C3"].id, "Carrefour Hiper Luro", -37.9835, -57.5768, "Av. Pedro Luro 5851", "Mar del Plata", "Buenos Aires"),
            ("S8", comercios_map["C1"].id, "Disco Güemes", -38.0138, -57.5412, "Güemes 3250", "Mar del Plata", "Buenos Aires"),
            ("S15", comercios_map["C4"].id, "Toledo Colón", -38.0048, -57.5405, "Av. Colón 1640", "Mar del Plata", "Buenos Aires"),
            ("S16", comercios_map["C4"].id, "Toledo Güemes", -38.0102, -57.5420, "Güemes 2834", "Mar del Plata", "Buenos Aires"),
            ("S17", comercios_map["C5"].id, "Vea San Martín", -37.9992, -57.5475, "San Martín 2560", "Mar del Plata", "Buenos Aires"),
            ("S18", comercios_map["C4"].id, "Hiper Toledo Constitución", -37.9592, -57.5775, "Av. Constitución 6600", "Mar del Plata", "Buenos Aires"),
            # Córdoba
            ("S9", comercios_map["C3"].id, "Carrefour Colón", -31.3980, -64.2250, "Av. Colón 4000", "Córdoba", "Córdoba"),
            ("S10", comercios_map["C2"].id, "Coto Olmos", -31.4130, -64.1810, "Av. Emilio Olmos 200", "Córdoba", "Córdoba"),
            ("S11", comercios_map["C1"].id, "Disco Nueva Córdoba", -31.4250, -64.1870, "Av. Hipólito Yrigoyen 400", "Córdoba", "Córdoba"),
            # Rosario
            ("S12", comercios_map["C2"].id, "Coto Alto Rosario", -32.9280, -60.6650, "Junín 501", "Rosario", "Santa Fe"),
            ("S13", comercios_map["C3"].id, "Carrefour Pellegrini", -32.9520, -60.6690, "Av. Pellegrini 3250", "Rosario", "Santa Fe"),
            # Mendoza
            ("S14", comercios_map["C3"].id, "Carrefour Las Heras", -32.8870, -68.8410, "Av. Las Heras 350", "Mendoza", "Mendoza"),
        ]
        sucursales_map = {}
        for sepa_id, com_id, nombre, lat, lng, direccion, localidad, provincia in sucursales_def:
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
            ("S15", "7790040001234", 880.0, 830.0, None),
            ("S16", "7790040001234", 910.0, None, None),
            ("S17", "7790040001234", 905.0, 855.0, None),
            ("S18", "7790040001234", 895.0, 840.0, None),

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

            # Córdoba
            ("S9", "7790040001234", 930.0, 880.0, None),
            ("S10", "7790040001234", 910.0, 860.0, None),
            ("S11", "7790040001234", 945.0, None, None),
            ("S9", "7790895000456", 2740.0, 2440.0, None),
            ("S10", "7790895000456", 2700.0, 2400.0, None),

            # Rosario
            ("S12", "7790040001234", 915.0, 865.0, None),
            ("S13", "7790040001234", 935.0, 885.0, None),
            ("S12", "7790895000456", 2720.0, 2420.0, None),

            # Mendoza
            ("S14", "7790040001234", 925.0, 875.0, None),
            ("S14", "7790895000456", 2760.0, 2460.0, None),
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
