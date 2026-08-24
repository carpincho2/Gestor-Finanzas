import pandas as pd
import unicodedata
import re

def normalizar_nombre(nombre: str) -> str:
    """Convierte a minúsculas, quita acentos y espacios extra."""
    if pd.isna(nombre):
        return ""
    # A minúsculas
    n = str(nombre).lower().strip()
    # Quitar tildes
    n = ''.join(c for c in unicodedata.normalize('NFD', n) if unicodedata.category(c) != 'Mn')
    # Espacios multiples por simples
    n = re.sub(r'\s+', ' ', n)
    return n

def limpiar_precios(df: pd.DataFrame) -> pd.DataFrame:
    """Limpia el dataframe de precios."""
    # En precios, las columnas relevantes son id_sucursal, ean, precio, precio_promo_a, precio_promo_b
    if df.empty:
        return df
    
    # Renombrar columnas si el SEPA cambió los nombres, pero asumimos los originales
    col_mapping = {
        'precio_unitario_bulto_por_unidad_venta_con_iva': 'precio'
    }
    df = df.rename(columns=col_mapping)
    
    # Validar que exista precio
    if 'precio' not in df.columns:
        df['precio'] = 0.0
        
    # Llenar promos faltantes
    if 'precio_promo_a' not in df.columns:
        df['precio_promo_a'] = None
    if 'precio_promo_b' not in df.columns:
        df['precio_promo_b'] = None

    return df

def limpiar_sucursales(df: pd.DataFrame) -> pd.DataFrame:
    """Limpia el dataframe de sucursales."""
    if df.empty:
        return df
        
    df['latitud'] = pd.to_numeric(df['latitud'], errors='coerce')
    df['longitud'] = pd.to_numeric(df['longitud'], errors='coerce')
    
    # Filtrar sucursales sin lat/lng válida
    df = df.dropna(subset=['latitud', 'longitud'])
    return df

def limpiar_productos(df: pd.DataFrame) -> pd.DataFrame:
    """Limpia el dataframe de productos."""
    if df.empty:
        return df
        
    # Asegurar que el nombre normalizado exista
    if 'nombre' in df.columns:
        df['nombre_normalizado'] = df['nombre'].apply(normalizar_nombre)
    else:
        df['nombre'] = ''
        df['nombre_normalizado'] = ''
        
    return df
