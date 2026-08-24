import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from services.sepa.ingestion import ejecutar_ingesta
from database import Base, engine

print("Creando tablas si no existen...")
Base.metadata.create_all(bind=engine)
print("Tablas creadas. Iniciando ingesta...")
ejecutar_ingesta()
print("Ingesta finalizada.")
