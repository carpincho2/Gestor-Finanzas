import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from database import SessionLocal, Base, engine
from models import Comercio, Sucursal, Producto, Precio


def seed_db():
    """Inserta datos de prueba si no existen. Idempotente."""
    db = SessionLocal()

    try:
        # Check if dummy data exists
        existing = db.query(Comercio).filter(Comercio.cuit == "30-11111111-1").first()
        if existing:
            # Verificar si faltan sucursales de MDP (upgrade del seed)
            mdp_sucursal = db.query(Sucursal).filter(Sucursal.sepa_id == "S4").first()
            if mdp_sucursal:
                print("Datos de prueba ya existen y están completos (incluye MDP).")
                return
            else:
                print("Seed sin sucursales de Mar del Plata. Agregando...")
                _seed_mar_del_plata(db)
                return

        print("Insertando datos de prueba SEPA...")

        from datetime import datetime

        # ── Comercios ────────────────────────────────────────────
        c1 = Comercio(sepa_id="C1", cuit="30-11111111-1", nombre="Supermercado Disco", nombre_key="disco")
        c2 = Comercio(sepa_id="C2", cuit="30-22222222-2", nombre="Supermercado Coto", nombre_key="coto")
        c3 = Comercio(sepa_id="C3", cuit="30-33333333-3", nombre="Carrefour", nombre_key="carrefour")
        c4 = Comercio(sepa_id="C4", cuit="30-44444444-4", nombre="Toledo", nombre_key="toledo")
        db.add_all([c1, c2, c3, c4])
        db.commit()

        # ── Sucursales CABA ──────────────────────────────────────
        s1 = Sucursal(sepa_id="S1", comercio_id=c1.id, nombre="Disco Centro", lat=-34.604, lng=-58.380, direccion="Av. Corrientes 1000", localidad="CABA", provincia="CABA", activa=True)
        s2 = Sucursal(sepa_id="S2", comercio_id=c2.id, nombre="Coto Obelisco", lat=-34.602, lng=-58.382, direccion="Av. 9 de Julio 1200", localidad="CABA", provincia="CABA", activa=True)
        s3 = Sucursal(sepa_id="S3", comercio_id=c1.id, nombre="Disco Belgrano", lat=-34.700, lng=-58.400, direccion="Av. Cabildo 500", localidad="CABA", provincia="CABA", activa=True)

        # ── Sucursales Mar del Plata ─────────────────────────────
        s4 = Sucursal(sepa_id="S4", comercio_id=c3.id, nombre="Carrefour Constitución", lat=-38.0055, lng=-57.5426, direccion="Av. Constitución 6020", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        s5 = Sucursal(sepa_id="S5", comercio_id=c2.id, nombre="Coto Mar del Plata", lat=-37.9977, lng=-57.5483, direccion="Av. Colón 3100", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        s6 = Sucursal(sepa_id="S6", comercio_id=c4.id, nombre="Toledo Centro", lat=-37.9838, lng=-57.5507, direccion="San Martín 2600", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        s7 = Sucursal(sepa_id="S7", comercio_id=c1.id, nombre="Disco Mar del Plata", lat=-37.9950, lng=-57.5550, direccion="Av. Independencia 1800", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        s8 = Sucursal(sepa_id="S8", comercio_id=c3.id, nombre="Carrefour Güemes", lat=-37.9890, lng=-57.5730, direccion="Güemes 3200", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)

        db.add_all([s1, s2, s3, s4, s5, s6, s7, s8])
        db.commit()

        # ── Productos ────────────────────────────────────────────
        p1 = Producto(ean="7790040001234", nombre="Leche Entera La Serenisima 1L", nombre_normalizado="leche entera la serenisima 1l", marca="La Serenisima")
        p2 = Producto(ean="7790040001241", nombre="Leche Deslactosada La Serenisima 1L", nombre_normalizado="leche deslactosada la serenisima 1l", marca="La Serenisima")
        p3 = Producto(ean="7790895000456", nombre="Coca Cola Sabor Original 2.25L", nombre_normalizado="coca cola sabor original 2.25l", marca="Coca Cola")
        p4 = Producto(ean="7790070008012", nombre="Aceite de Girasol Natura 900ml", nombre_normalizado="aceite de girasol natura 900ml", marca="Natura")
        p5 = Producto(ean="7790250052487", nombre="Yerba Mate Taragüi 1Kg", nombre_normalizado="yerba mate taragui 1kg", marca="Taragüi")
        p6 = Producto(ean="7790580391607", nombre="Galletitas Terrabusi Variedad 400g", nombre_normalizado="galletitas terrabusi variedad 400g", marca="Terrabusi")
        p7 = Producto(ean="7790895001231", nombre="Coca Cola Zero 1.5L", nombre_normalizado="coca cola zero 1.5l", marca="Coca Cola")
        p8 = Producto(ean="7790040001258", nombre="Leche Descremada La Serenisima 1L", nombre_normalizado="leche descremada la serenisima 1l", marca="La Serenisima")
        p9 = Producto(ean="7791290007895", nombre="Fideos Matarazzo Spaghetti 500g", nombre_normalizado="fideos matarazzo spaghetti 500g", marca="Matarazzo")
        p10 = Producto(ean="7790310982150", nombre="Arroz Gallo Oro 1Kg", nombre_normalizado="arroz gallo oro 1kg", marca="Gallo")
        db.add_all([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10])
        db.commit()

        # ── Precios ──────────────────────────────────────────────
        now = datetime.now()
        precios = [
            # === CABA ===
            # Leche Entera
            Precio(sucursal_id=s1.id, producto_id=p1.id, precio_unitario=950.0, precio_promo_a=900.0, fecha_vigencia=now),
            Precio(sucursal_id=s2.id, producto_id=p1.id, precio_unitario=900.0, precio_promo_a=850.0, fecha_vigencia=now),
            Precio(sucursal_id=s3.id, producto_id=p1.id, precio_unitario=1050.0, fecha_vigencia=now),
            # Leche Deslactosada
            Precio(sucursal_id=s1.id, producto_id=p2.id, precio_unitario=1100.0, precio_promo_a=1000.0, fecha_vigencia=now),
            Precio(sucursal_id=s2.id, producto_id=p2.id, precio_unitario=1050.0, precio_promo_a=980.0, fecha_vigencia=now),
            # Coca Cola 2.25L
            Precio(sucursal_id=s1.id, producto_id=p3.id, precio_unitario=2800.0, precio_promo_a=2500.0, fecha_vigencia=now),
            Precio(sucursal_id=s2.id, producto_id=p3.id, precio_unitario=2700.0, precio_promo_a=2400.0, fecha_vigencia=now),
            # Aceite
            Precio(sucursal_id=s1.id, producto_id=p4.id, precio_unitario=1800.0, fecha_vigencia=now),

            # === MAR DEL PLATA ===
            # Leche Entera
            Precio(sucursal_id=s4.id, producto_id=p1.id, precio_unitario=920.0, precio_promo_a=870.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p1.id, precio_unitario=960.0, precio_promo_a=910.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p1.id, precio_unitario=890.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p1.id, precio_unitario=940.0, precio_promo_a=880.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p1.id, precio_unitario=950.0, fecha_vigencia=now),
            # Leche Deslactosada
            Precio(sucursal_id=s4.id, producto_id=p2.id, precio_unitario=1080.0, precio_promo_a=990.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p2.id, precio_unitario=1120.0, precio_promo_a=1020.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p2.id, precio_unitario=1050.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p2.id, precio_unitario=1100.0, precio_promo_a=1010.0, fecha_vigencia=now),
            # Leche Descremada
            Precio(sucursal_id=s4.id, producto_id=p8.id, precio_unitario=980.0, precio_promo_a=920.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p8.id, precio_unitario=1000.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p8.id, precio_unitario=950.0, precio_promo_a=900.0, fecha_vigencia=now),
            # Coca Cola 2.25L
            Precio(sucursal_id=s4.id, producto_id=p3.id, precio_unitario=2750.0, precio_promo_a=2450.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p3.id, precio_unitario=2850.0, precio_promo_a=2550.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p3.id, precio_unitario=2600.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p3.id, precio_unitario=2780.0, precio_promo_a=2480.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p3.id, precio_unitario=2700.0, precio_promo_a=2380.0, fecha_vigencia=now),
            # Coca Cola Zero 1.5L
            Precio(sucursal_id=s4.id, producto_id=p7.id, precio_unitario=2200.0, precio_promo_a=1980.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p7.id, precio_unitario=2300.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p7.id, precio_unitario=2100.0, precio_promo_a=1890.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p7.id, precio_unitario=2250.0, fecha_vigencia=now),
            # Aceite Natura
            Precio(sucursal_id=s4.id, producto_id=p4.id, precio_unitario=1750.0, precio_promo_a=1600.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p4.id, precio_unitario=1820.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p4.id, precio_unitario=1680.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p4.id, precio_unitario=1790.0, precio_promo_a=1650.0, fecha_vigencia=now),
            # Yerba Taragüi
            Precio(sucursal_id=s4.id, producto_id=p5.id, precio_unitario=3200.0, precio_promo_a=2900.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p5.id, precio_unitario=3350.0, precio_promo_a=3050.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p5.id, precio_unitario=3100.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p5.id, precio_unitario=3250.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p5.id, precio_unitario=3180.0, precio_promo_a=2850.0, fecha_vigencia=now),
            # Galletitas Terrabusi
            Precio(sucursal_id=s4.id, producto_id=p6.id, precio_unitario=1500.0, precio_promo_a=1350.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p6.id, precio_unitario=1580.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p6.id, precio_unitario=1450.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p6.id, precio_unitario=1520.0, precio_promo_a=1380.0, fecha_vigencia=now),
            # Fideos Matarazzo
            Precio(sucursal_id=s4.id, producto_id=p9.id, precio_unitario=1200.0, precio_promo_a=1080.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p9.id, precio_unitario=1250.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p9.id, precio_unitario=1150.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p9.id, precio_unitario=1220.0, precio_promo_a=1100.0, fecha_vigencia=now),
            # Arroz Gallo
            Precio(sucursal_id=s4.id, producto_id=p10.id, precio_unitario=1400.0, precio_promo_a=1260.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p10.id, precio_unitario=1480.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p10.id, precio_unitario=1350.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p10.id, precio_unitario=1420.0, precio_promo_a=1280.0, fecha_vigencia=now),
        ]
        db.add_all(precios)
        db.commit()

        total_p = db.query(Producto).count()
        total_pr = db.query(Precio).count()
        total_s = db.query(Sucursal).count()
        print(f"Datos de prueba insertados: {total_p} productos, {total_s} sucursales, {total_pr} precios.")

    except Exception as e:
        db.rollback()
        print(f"ERROR en seed_db: {e}")
    finally:
        db.close()


def _seed_mar_del_plata(db):
    """Agrega sucursales y precios de Mar del Plata a un seed existente."""
    from datetime import datetime

    try:
        # Crear comercios nuevos si no existen
        c3 = db.query(Comercio).filter(Comercio.cuit == "30-33333333-3").first()
        if not c3:
            c3 = Comercio(sepa_id="C3", cuit="30-33333333-3", nombre="Carrefour", nombre_key="carrefour")
            db.add(c3)
            db.commit()

        c4 = db.query(Comercio).filter(Comercio.cuit == "30-44444444-4").first()
        if not c4:
            c4 = Comercio(sepa_id="C4", cuit="30-44444444-4", nombre="Toledo", nombre_key="toledo")
            db.add(c4)
            db.commit()

        # Obtener comercios existentes
        c1 = db.query(Comercio).filter(Comercio.cuit == "30-11111111-1").first()  # Disco
        c2 = db.query(Comercio).filter(Comercio.cuit == "30-22222222-2").first()  # Coto

        # Crear sucursales de Mar del Plata
        s4 = Sucursal(sepa_id="S4", comercio_id=c3.id, nombre="Carrefour Constitución", lat=-38.0055, lng=-57.5426, direccion="Av. Constitución 6020", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        s5 = Sucursal(sepa_id="S5", comercio_id=c2.id, nombre="Coto Mar del Plata", lat=-37.9977, lng=-57.5483, direccion="Av. Colón 3100", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        s6 = Sucursal(sepa_id="S6", comercio_id=c4.id, nombre="Toledo Centro", lat=-37.9838, lng=-57.5507, direccion="San Martín 2600", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        s7 = Sucursal(sepa_id="S7", comercio_id=c1.id, nombre="Disco Mar del Plata", lat=-37.9950, lng=-57.5550, direccion="Av. Independencia 1800", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        s8 = Sucursal(sepa_id="S8", comercio_id=c3.id, nombre="Carrefour Güemes", lat=-37.9890, lng=-57.5730, direccion="Güemes 3200", localidad="Mar del Plata", provincia="Buenos Aires", activa=True)
        db.add_all([s4, s5, s6, s7, s8])
        db.commit()

        # Crear productos nuevos si no existen
        productos_nuevos = [
            ("7790250052487", "Yerba Mate Taragüi 1Kg", "yerba mate taragui 1kg", "Taragüi"),
            ("7790580391607", "Galletitas Terrabusi Variedad 400g", "galletitas terrabusi variedad 400g", "Terrabusi"),
            ("7790895001231", "Coca Cola Zero 1.5L", "coca cola zero 1.5l", "Coca Cola"),
            ("7790040001258", "Leche Descremada La Serenisima 1L", "leche descremada la serenisima 1l", "La Serenisima"),
            ("7791290007895", "Fideos Matarazzo Spaghetti 500g", "fideos matarazzo spaghetti 500g", "Matarazzo"),
            ("7790310982150", "Arroz Gallo Oro 1Kg", "arroz gallo oro 1kg", "Gallo"),
        ]
        for ean, nombre, norm, marca in productos_nuevos:
            if not db.query(Producto).filter_by(ean=ean).first():
                db.add(Producto(ean=ean, nombre=nombre, nombre_normalizado=norm, marca=marca))
        db.commit()

        # Obtener todos los productos por EAN
        def get_prod(ean):
            return db.query(Producto).filter_by(ean=ean).first()

        p1 = get_prod("7790040001234")  # Leche Entera
        p2 = get_prod("7790040001241")  # Leche Deslactosada
        p3 = get_prod("7790895000456")  # Coca Cola 2.25L
        p4 = get_prod("7790070008012")  # Aceite Natura
        p5 = get_prod("7790250052487")  # Yerba Taragüi
        p6 = get_prod("7790580391607")  # Galletitas Terrabusi
        p7 = get_prod("7790895001231")  # Coca Cola Zero
        p8 = get_prod("7790040001258")  # Leche Descremada
        p9 = get_prod("7791290007895")  # Fideos Matarazzo
        p10 = get_prod("7790310982150")  # Arroz Gallo

        now = datetime.now()
        precios_mdp = [
            # Leche Entera
            Precio(sucursal_id=s4.id, producto_id=p1.id, precio_unitario=920.0, precio_promo_a=870.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p1.id, precio_unitario=960.0, precio_promo_a=910.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p1.id, precio_unitario=890.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p1.id, precio_unitario=940.0, precio_promo_a=880.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p1.id, precio_unitario=950.0, fecha_vigencia=now),
            # Leche Deslactosada
            Precio(sucursal_id=s4.id, producto_id=p2.id, precio_unitario=1080.0, precio_promo_a=990.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p2.id, precio_unitario=1120.0, precio_promo_a=1020.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p2.id, precio_unitario=1050.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p2.id, precio_unitario=1100.0, precio_promo_a=1010.0, fecha_vigencia=now),
            # Leche Descremada
            Precio(sucursal_id=s4.id, producto_id=p8.id, precio_unitario=980.0, precio_promo_a=920.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p8.id, precio_unitario=1000.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p8.id, precio_unitario=950.0, precio_promo_a=900.0, fecha_vigencia=now),
            # Coca Cola 2.25L
            Precio(sucursal_id=s4.id, producto_id=p3.id, precio_unitario=2750.0, precio_promo_a=2450.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p3.id, precio_unitario=2850.0, precio_promo_a=2550.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p3.id, precio_unitario=2600.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p3.id, precio_unitario=2780.0, precio_promo_a=2480.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p3.id, precio_unitario=2700.0, precio_promo_a=2380.0, fecha_vigencia=now),
            # Coca Cola Zero
            Precio(sucursal_id=s4.id, producto_id=p7.id, precio_unitario=2200.0, precio_promo_a=1980.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p7.id, precio_unitario=2300.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p7.id, precio_unitario=2100.0, precio_promo_a=1890.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p7.id, precio_unitario=2250.0, fecha_vigencia=now),
            # Aceite Natura
            Precio(sucursal_id=s4.id, producto_id=p4.id, precio_unitario=1750.0, precio_promo_a=1600.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p4.id, precio_unitario=1820.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p4.id, precio_unitario=1680.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p4.id, precio_unitario=1790.0, precio_promo_a=1650.0, fecha_vigencia=now),
            # Yerba Taragüi
            Precio(sucursal_id=s4.id, producto_id=p5.id, precio_unitario=3200.0, precio_promo_a=2900.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p5.id, precio_unitario=3350.0, precio_promo_a=3050.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p5.id, precio_unitario=3100.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p5.id, precio_unitario=3250.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p5.id, precio_unitario=3180.0, precio_promo_a=2850.0, fecha_vigencia=now),
            # Galletitas Terrabusi
            Precio(sucursal_id=s4.id, producto_id=p6.id, precio_unitario=1500.0, precio_promo_a=1350.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p6.id, precio_unitario=1580.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p6.id, precio_unitario=1450.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p6.id, precio_unitario=1520.0, precio_promo_a=1380.0, fecha_vigencia=now),
            # Fideos Matarazzo
            Precio(sucursal_id=s4.id, producto_id=p9.id, precio_unitario=1200.0, precio_promo_a=1080.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p9.id, precio_unitario=1250.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p9.id, precio_unitario=1150.0, fecha_vigencia=now),
            Precio(sucursal_id=s7.id, producto_id=p9.id, precio_unitario=1220.0, precio_promo_a=1100.0, fecha_vigencia=now),
            # Arroz Gallo
            Precio(sucursal_id=s4.id, producto_id=p10.id, precio_unitario=1400.0, precio_promo_a=1260.0, fecha_vigencia=now),
            Precio(sucursal_id=s5.id, producto_id=p10.id, precio_unitario=1480.0, fecha_vigencia=now),
            Precio(sucursal_id=s6.id, producto_id=p10.id, precio_unitario=1350.0, fecha_vigencia=now),
            Precio(sucursal_id=s8.id, producto_id=p10.id, precio_unitario=1420.0, precio_promo_a=1280.0, fecha_vigencia=now),
        ]
        db.add_all(precios_mdp)
        db.commit()

        total_p = db.query(Producto).count()
        total_pr = db.query(Precio).count()
        total_s = db.query(Sucursal).count()
        print(f"MDP seed completado: {total_p} productos, {total_s} sucursales, {total_pr} precios.")

    except Exception as e:
        db.rollback()
        print(f"ERROR en _seed_mar_del_plata: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()
