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
            # Verificar si faltan productos (caso de seed parcial anterior)
            productos_count = db.query(Producto).count()
            if productos_count >= 4:
                print("Datos de prueba ya existen y están completos.")
                return
            else:
                print(f"Seed parcial detectado ({productos_count} productos). Completando...")
                _seed_productos_faltantes(db, existing)
                return

        print("Insertando datos de prueba SEPA...")

        from datetime import datetime

        c1 = Comercio(sepa_id="C1", cuit="30-11111111-1", nombre="Supermercado Disco", nombre_key="disco")
        c2 = Comercio(sepa_id="C2", cuit="30-22222222-2", nombre="Supermercado Coto", nombre_key="coto")
        db.add(c1)
        db.add(c2)
        db.commit()

        s1 = Sucursal(sepa_id="S1", comercio_id=c1.id, nombre="Disco Centro", lat=-34.604, lng=-58.380, direccion="Av. Corrientes 1000", localidad="CABA", provincia="CABA", activa=True)
        s2 = Sucursal(sepa_id="S2", comercio_id=c2.id, nombre="Coto Obelisco", lat=-34.602, lng=-58.382, direccion="Av. 9 de Julio 1200", localidad="CABA", provincia="CABA", activa=True)
        s3 = Sucursal(sepa_id="S3", comercio_id=c1.id, nombre="Disco Lejos", lat=-34.700, lng=-58.400, direccion="Av. Lejos 500", localidad="CABA", provincia="CABA", activa=True)
        db.add(s1)
        db.add(s2)
        db.add(s3)
        db.commit()

        p1 = Producto(ean="7790040001234", nombre="Leche Entera La Serenisima 1L", nombre_normalizado="leche entera la serenisima 1l", marca="La Serenisima")
        p2 = Producto(ean="7790040001241", nombre="Leche Deslactosada La Serenisima 1L", nombre_normalizado="leche deslactosada la serenisima 1l", marca="La Serenisima")
        p3 = Producto(ean="7790895000456", nombre="Coca Cola Sabor Original 2.25L", nombre_normalizado="coca cola sabor original 2.25l", marca="Coca Cola")
        p4 = Producto(ean="7790070008012", nombre="Aceite de Girasol Natura 900ml", nombre_normalizado="aceite de girasol natura 900ml", marca="Natura")
        db.add_all([p1, p2, p3, p4])
        db.commit()

        now = datetime.now()
        precios = [
            Precio(sucursal_id=s1.id, producto_id=p1.id, precio_unitario=950.0, precio_promo_a=900.0, fecha_vigencia=now),
            Precio(sucursal_id=s2.id, producto_id=p1.id, precio_unitario=900.0, precio_promo_a=850.0, fecha_vigencia=now),
            Precio(sucursal_id=s3.id, producto_id=p1.id, precio_unitario=1050.0, fecha_vigencia=now),
            Precio(sucursal_id=s1.id, producto_id=p2.id, precio_unitario=1100.0, precio_promo_a=1000.0, fecha_vigencia=now),
            Precio(sucursal_id=s2.id, producto_id=p2.id, precio_unitario=1050.0, precio_promo_a=980.0, fecha_vigencia=now),
            Precio(sucursal_id=s1.id, producto_id=p3.id, precio_unitario=2800.0, precio_promo_a=2500.0, fecha_vigencia=now),
            Precio(sucursal_id=s2.id, producto_id=p3.id, precio_unitario=2700.0, precio_promo_a=2400.0, fecha_vigencia=now),
            Precio(sucursal_id=s1.id, producto_id=p4.id, precio_unitario=1800.0, fecha_vigencia=now),
        ]
        db.add_all(precios)
        db.commit()

        print(f"Datos de prueba insertados exitosamente: {db.query(Producto).count()} productos, {db.query(Precio).count()} precios.")

    except Exception as e:
        db.rollback()
        print(f"ERROR en seed_db: {e}")
    finally:
        db.close()


def _seed_productos_faltantes(db, comercio_disco):
    """Completa productos faltantes en un seed parcial."""
    from datetime import datetime

    # Obtener sucursales existentes
    sucursales = db.query(Sucursal).order_by(Sucursal.id).all()
    if len(sucursales) < 2:
        print("WARNING: No hay suficientes sucursales para completar el seed.")
        db.close()
        return

    s1, s2 = sucursales[0], sucursales[1]
    now = datetime.now()

    productos_seed = [
        ("7790040001234", "Leche Entera La Serenisima 1L", "leche entera la serenisima 1l", "La Serenisima",
         [(s1.id, 950.0, 900.0), (s2.id, 900.0, 850.0)]),
        ("7790040001241", "Leche Deslactosada La Serenisima 1L", "leche deslactosada la serenisima 1l", "La Serenisima",
         [(s1.id, 1100.0, 1000.0), (s2.id, 1050.0, 980.0)]),
        ("7790895000456", "Coca Cola Sabor Original 2.25L", "coca cola sabor original 2.25l", "Coca Cola",
         [(s1.id, 2800.0, 2500.0), (s2.id, 2700.0, 2400.0)]),
        ("7790070008012", "Aceite de Girasol Natura 900ml", "aceite de girasol natura 900ml", "Natura",
         [(s1.id, 1800.0, None)]),
    ]

    insertados = 0
    for ean, nombre, norm, marca, precios_data in productos_seed:
        existing = db.query(Producto).filter_by(ean=ean).first()
        if existing:
            continue

        p = Producto(ean=ean, nombre=nombre, nombre_normalizado=norm, marca=marca)
        db.add(p)
        db.commit()

        for sid, precio_lista, precio_promo in precios_data:
            pr = Precio(sucursal_id=sid, producto_id=p.id, precio_unitario=precio_lista,
                        precio_promo_a=precio_promo, fecha_vigencia=now)
            db.add(pr)
        db.commit()
        insertados += 1

    print(f"Seed completado: {insertados} productos insertados. Total: {db.query(Producto).count()} productos.")
    db.close()


if __name__ == "__main__":
    seed_db()
