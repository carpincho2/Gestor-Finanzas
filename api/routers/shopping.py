import requests
import re
from urllib.parse import urlparse, unquote
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from security import get_current_user_id
from models import Account, WalletConnection
from services.recommendation import evaluate_payment_options

router = APIRouter(prefix="/api/shopping", tags=["shopping"])

class AnalyzeUrlRequest(BaseModel):
    url: str
    discount_percentage: Optional[float] = 0.0
    installments_without_interest: Optional[int] = 0 # 0 = Autodetectar mejor cuota
    custom_tna: Optional[float] = 40.0 # Tasa nominal anual
    price: Optional[float] = None       # Precio manual opcional

class AnalyzeBarcodeRequest(BaseModel):
    barcode: str
    discount_percentage: Optional[float] = 0.0
    installments_without_interest: Optional[int] = 0
    custom_tna: Optional[float] = 40.0

@router.get("/search")
async def search_items(q: str = Query(...)):
    """Busca productos en Mercado Libre por palabra clave."""
    url = f"https://api.mercadolibre.com/sites/MLA/search?q={q}&limit=5"
    resp = requests.get(url)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Error fetching data from Mercado Libre")
    
    data = resp.json()
    results = []
    for item in data.get("results", []):
        results.append({
            "id": item.get("id"),
            "title": item.get("title"),
            "price": item.get("price"),
            "currency_id": item.get("currency_id"),
            "thumbnail": item.get("thumbnail"),
            "permalink": item.get("permalink")
        })
    return {"ok": True, "results": results}

@router.post("/analyze-url")
async def analyze_url(payload: AnalyzeUrlRequest, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Analiza una URL de ML y recomienda el mejor método de pago."""
    url = payload.url.strip()

    # 1. Si el usuario conectó Mercado Pago, recuperar su token para hacer requests autenticados a la API de ML
    user_token = None
    wallet = db.query(WalletConnection).filter(
        WalletConnection.user_id == user_id,
        WalletConnection.provider == "mercadopago",
        WalletConnection.status == "active"
    ).first()
    
    if wallet and wallet.access_token_encrypted:
        try:
            from security import token_crypto
            user_token = token_crypto.decrypt(wallet.access_token_encrypted)
        except Exception:
            pass

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html, */*"
    }
    if user_token:
        headers["Authorization"] = f"Bearer {user_token}"

    # 2. Seguir redirección si es un enlace corto (ej: mpago.li, /sec/, etc.)
    if any(domain in url for domain in ["mpago.li", "/sec/", "ml.com.ar", "mercadolibre"]):
        if not re.search(r'ML[A-Z]-?\d{6,}', url, re.IGNORECASE):
            try:
                res = requests.get(url, allow_redirects=True, headers=headers, timeout=5, stream=True)
                if res.url:
                    url = res.url
            except Exception:
                pass

    # 3. Extraer el ID específico del item o catálogo de la URL
    item_id = None
    
    # Check A: query string o pdp_filters (ej: pdp_filters=item_id%3AMLA2055538384 o wid=MLA2055538384)
    query_item = re.search(r'(?:item_id|wid)%3A(MLA-?\d+)', url, re.IGNORECASE) or re.search(r'(?:item_id|wid)=(MLA-?\d+)', url, re.IGNORECASE)
    # Check B: ruta de catálogo /p/MLA...
    catalog_match = re.search(r'/p/(ML[A-Z]-?\d+)', url, re.IGNORECASE)
    # Check C: ruta de artículo /MLA-123456789...
    general_match = re.search(r'(ML[A-Z]-?\d{6,})', url, re.IGNORECASE)

    if query_item:
        item_id = query_item.group(1).replace('-', '').upper()
    elif catalog_match:
        item_id = catalog_match.group(1).replace('-', '').upper()
    elif general_match:
        item_id = general_match.group(1).replace('-', '').upper()
    elif re.match(r'^ML[A-Z]-?\d+$', url, re.IGNORECASE):
        item_id = url.replace('-', '').upper()

    # 4. Extraer el título directamente del slug de la URL como fallback visual
    slug_title = None
    try:
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split('/') if p and p != 'p']
        if path_parts and not path_parts[0].startswith('MLA'):
            raw_slug = unquote(path_parts[0])
            clean_slug = re.sub(r'[\-_]+', ' ', raw_slug).strip()
            if len(clean_slug) > 4:
                slug_title = clean_slug.title()
    except Exception:
        pass

    raw_price = payload.price or 0.0
    # Corregir caso donde el usuario ingresa 194.799 pensando que son 194 mil pesos (separador de miles argentino)
    if 0 < raw_price < 1000 and round(raw_price * 1000, 2) >= 1000 and round(raw_price * 1000, 3) == float(f"{raw_price * 1000:.3f}"):
        price = float(round(raw_price * 1000, 2))
    else:
        price = raw_price

    title = slug_title or "Producto Mercado Libre"
    currency_id = "ARS"
    found = False

    # 5. Intentar consultar las APIs de Mercado Libre (Items y Productos)
    if item_id:
        # Intentar en /items/
        try:
            resp = requests.get(f"https://api.mercadolibre.com/items/{item_id}", headers=headers, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                price = float(data.get("price") or price)
                title = data.get("title") or title
                currency_id = data.get("currency_id") or currency_id
                found = True
        except Exception:
            pass

        # Intentar en /products/ si falló /items/
        if not found:
            try:
                resp = requests.get(f"https://api.mercadolibre.com/products/{item_id}", headers=headers, timeout=6)
                if resp.status_code == 200:
                    data = resp.json()
                    buy_box = data.get("buy_box_winner") or {}
                    price = float(buy_box.get("price") or data.get("price") or price)
                    title = data.get("name") or data.get("title") or title
                    currency_id = buy_box.get("currency_id") or data.get("currency_id") or currency_id
                    found = True
            except Exception:
                pass

    # 5.b Respaldo: Scrapear HTML directo si la API pública de ML bloqueó la petición
    if not found or price == 0:
        urls_to_try = [url]
        if item_id:
            if item_id.startswith("MLA"):
                urls_to_try.append(f"https://articulo.mercadolibre.com.ar/{item_id[:3]}-{item_id[3:]}")
            urls_to_try.append(f"https://www.mercadolibre.com.ar/p/{item_id}")
            
        browser_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-AR,es-419;q=0.9,es;q=0.8",
        }

        for target_url in urls_to_try:
            if found and price > 0:
                break
            try:
                html_resp = requests.get(target_url, headers=browser_headers, timeout=5, allow_redirects=True)
                if html_resp.status_code == 200:
                    html_text = html_resp.text
                    
                    # Extraer precio de schema JSON-LD, og:price:amount, itemprop o HTML de ML
                    price_match = (
                        re.search(r'"price":\s*"?(\d+(?:\.\d+)?)"?', html_text) or
                        re.search(r'property="og:price:amount"\s+content="([\d\.]+)"', html_text) or
                        re.search(r'itemprop="price"\s+content="([\d\.]+)"', html_text) or
                        re.search(r'class="andes-money-amount__fraction"[^>]*>([\d\.]+)', html_text)
                    )
                    if price_match:
                        raw_val = price_match.group(1).replace('.', '') if (',' in price_match.group(1) or price_match.group(1).count('.') > 1) else price_match.group(1)
                        try:
                            parsed_p = float(raw_val)
                            if parsed_p > 0:
                                price = parsed_p
                                found = True
                        except ValueError:
                            pass
                    
                    # Extraer título si aún es el genérico
                    title_match = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', html_text) or re.search(r'<title>([^<]+)</title>', html_text)
                    if title_match:
                        clean_t = title_match.group(1).split('|')[0].split('- Mercado')[0].strip()
                        if len(clean_t) > 3 and title == "Producto Mercado Libre":
                            title = clean_t
            except Exception:
                pass

    # 6. Manejo de fallbacks si Mercado Libre bloquea la consulta de API y HTML
    if price == 0:
        if not item_id and not slug_title:
            raise HTTPException(
                status_code=400,
                detail="No pudimos encontrar el ID de producto en el link. Copiá el link completo de la publicación."
            )
        # Si pudimos extraer el título pero no el precio (por bloqueo de API/Cloudflare de ML)
        raise HTTPException(
            status_code=422,
            detail=f"Identificamos '{title}', pero Mercado Libre requiere ingresar el precio manualmente en el campo 'Precio del producto' para calcular las cuotas."
        )

    # 7. Evaluar opciones de pago con la billetera del usuario
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    
    options = evaluate_payment_options(
        price=price,
        accounts=accounts,
        tna=payload.custom_tna,
        discount=payload.discount_percentage,
        installments=payload.installments_without_interest
    )
    
    return {
        "ok": True,
        "item": {
            "id": item_id or "MLA_LINK",
            "title": title,
            "price": price,
            "currency": currency_id
        },
        "recommendation": options
    }

@router.post("/analyze-barcode")
async def analyze_barcode(payload: AnalyzeBarcodeRequest, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Busca un producto por GTIN/EAN (código de barras) y recomienda el mejor método de pago."""
    
    search_resp = requests.get(f"https://api.mercadolibre.com/sites/MLA/search?gtin={payload.barcode}&limit=1")
    if search_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Error consultando Mercado Libre")
        
    search_data = search_resp.json()
    results = search_data.get("results", [])
    
    if not results:
        raise HTTPException(status_code=404, detail="No se encontraron publicaciones activas para este código de barras")
        
    item_data = results[0]
    price = item_data.get("price", 0.0)
    title = item_data.get("title", "")
    item_id = item_data.get("id", "")
    
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    
    options = evaluate_payment_options(
        price=price,
        accounts=accounts,
        tna=payload.custom_tna,
        discount=payload.discount_percentage,
        installments=payload.installments_without_interest
    )
    
    return {
        "ok": True,
        "item": {
            "id": item_id,
            "title": title,
            "price": price,
        },
        "recommendation": options
    }
