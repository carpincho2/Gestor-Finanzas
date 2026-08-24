import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from database import SessionLocal, Base, engine
from models import Comercio, Sucursal, Producto, Precio

print("Creando tablas...")
Base.metadata.create_all(bind=engine)

def seed_db():
    db = SessionLocal()
    
    # Check if dummy data exists
    if db.query(Comercio).filter(Comercio.cuit == "30-11111111-1").first():
        print("Datos de prueba ya existen.")
        db.close()
        return

    print("Insertando datos de prueba...")
    
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

    p = Producto(ean="7790040001234", nombre="Leche Entera La Serenisima 1L", nombre_normalizado="leche entera la serenisima 1l", marca="La Serenisima")
    db.add(p)
    db.commit()
    
    now = datetime.now()
    pr1 = Precio(sucursal_id=s1.id, producto_id=p.id, precio_unitario=950.0, precio_promo_a=900.0, fecha_vigencia=now)
    pr2 = Precio(sucursal_id=s2.id, producto_id=p.id, precio_unitario=900.0, precio_promo_a=850.0, fecha_vigencia=now)
    pr3 = Precio(sucursal_id=s3.id, producto_id=p.id, precio_unitario=1050.0, fecha_vigencia=now)
    db.add(pr1)
    db.add(pr2)
    db.add(pr3)
    db.commit()

    print("Datos de prueba insertados exitosamente.")
    db.close()

if __name__ == "__main__":
    seed_db()
