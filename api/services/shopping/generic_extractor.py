import re
import json
import requests
from urllib.parse import urlparse, unquote
from typing import Dict, Any, Optional, List

from ports.extractors.product_extractor_port import IProductExtractor


def parse_price_string(val_str: str) -> Optional[float]:
    """
    Parsea de forma robusta cadenas de precio de diferentes formatos regionales
    (ej: '$ 1.250.000,50', '1,250.00', '49999', 'ARS 85.000').
    """
    if not val_str:
        return None
    # Eliminar símbolos de moneda y espacios
    clean = re.sub(r'[^\d,\.]', '', str(val_str)).strip()
    if not clean:
        return None

    try:
        # Caso 1: Tiene puntos y comas (ej: 1.250.000,50 o 1,250,000.50)
        if '.' in clean and ',' in clean:
            if clean.rfind(',') > clean.rfind('.'):
                # Formato latino/europeo: 1.250,50 -> quitar puntos y cambiar coma por punto
                clean = clean.replace('.', '').replace(',', '.')
            else:
                # Formato anglosajón: 1,250.50 -> quitar comas
                clean = clean.replace(',', '')
        # Caso 2: Solo tiene coma (ej: 1250,50 o 1,250)
        elif ',' in clean:
            parts = clean.split(',')
            if len(parts[-1]) == 2:  # Dos decimales
                clean = clean.replace(',', '.')
            else:  # Separador de miles
                clean = clean.replace(',', '')
        # Caso 3: Solo tiene puntos (ej: 1.250.000 o 125.50)
        elif '.' in clean:
            parts = clean.split('.')
            if len(parts) > 2:  # Múltiples puntos -> son miles (ej: 1.500.000)
                clean = clean.replace('.', '')
            elif len(parts) == 2 and len(parts[1]) == 3:  # Ej: 150.000
                clean = clean.replace('.', '')

        parsed = float(clean)
        return parsed if parsed > 0 else None
    except Exception:
        return None


class GenericECommerceExtractor(IProductExtractor):
    """
    Extractor universal para tiendas online (Amazon, Frávega, Cetrogar, Garbarino, Tiendamia,
    plataformas Shopify, WooCommerce, VTEX, Magento, etc.).
    Aprovecha estándares web semánticos: Schema.org (JSON-LD), Open Graph y Microdata.
    """

    def can_handle(self, url: str) -> bool:
        url_lower = url.lower().strip()
        return url_lower.startswith("http://") or url_lower.startswith("https://") or ("." in url_lower and "/" in url_lower)

    def extract(self, url: str, user_id: Optional[int] = None, user_token: Optional[str] = None) -> Dict[str, Any]:
        target_url = url.strip()
        if not target_url.startswith(("http://", "https://")):
            target_url = "https://" + target_url

        parsed = urlparse(target_url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]

        # 1. Extraer título legible del slug de la URL
        slug_title = None
        try:
            path_segments = [p for p in parsed.path.split('/') if p]
            # Tomar el último segmento o el penúltimo si el último es un ID
            if path_segments:
                cand = path_segments[-1]
                if re.match(r'^\d+$', cand) and len(path_segments) > 1:
                    cand = path_segments[-2]
                cand = unquote(cand)
                cand = re.sub(r'\.(html|htm|php|aspx)$', '', cand, flags=re.IGNORECASE)
                cand = re.sub(r'^(?:sku|item|prod|id)-?\d+-?', '', cand, flags=re.IGNORECASE)
                cand = re.sub(r'[-_]\d{4,}$', '', cand)
                cand = re.sub(r'[\-_]+', ' ', cand).strip()
                if len(cand) > 3:
                    slug_title = cand.title()
        except Exception:
            pass

        # 2. Extraer precio de la query de la URL si estuviese presente
        query_price = None
        try:
            price_param = re.search(r'(?:price|precio|p|amount)=([\d\.,]+)', parsed.query, re.IGNORECASE)
            if price_param:
                query_price = parse_price_string(price_param.group(1))
        except Exception:
            pass

        title = slug_title or f"Producto en {domain.title() if domain else 'Tienda Web'}"
        price = query_price or 0.0
        currency_id = "ARS"
        found = price > 0
        source = "url_query" if found else "url_slug"

        # 3. Petición HTTP al sitio para extraer metadatos semánticos (JSON-LD / Open Graph)
        browser_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-AR,es-419;q=0.9,es;q=0.8,en;q=0.7",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        }

        html_text = ""
        try:
            resp = requests.get(target_url, headers=browser_headers, timeout=6, allow_redirects=True)
            if resp.status_code == 200:
                html_text = resp.text
        except Exception:
            html_text = ""

        if html_text:
            # --- Estrategia A: Schema.org JSON-LD (<script type="application/ld+json">) ---
            ld_scripts = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html_text, re.DOTALL | re.IGNORECASE)
            for raw_json in ld_scripts:
                try:
                    data = json.loads(raw_json.strip())
                    items = data if isinstance(data, list) else [data]
                    # Si tiene @graph, expandir
                    if isinstance(data, dict) and "@graph" in data and isinstance(data["@graph"], list):
                        items = data["@graph"]

                    for item in items:
                        if not isinstance(item, dict):
                            continue
                        item_type = str(item.get("@type", ""))
                        if "Product" in item_type or item.get("offers"):
                            if item.get("name") and not found:
                                title = str(item.get("name")).strip()

                            offers = item.get("offers")
                            if isinstance(offers, list) and offers:
                                offers = offers[0]
                            if isinstance(offers, dict):
                                p_raw = offers.get("price") or offers.get("lowPrice") or offers.get("highPrice")
                                if p_raw:
                                    parsed_p = parse_price_string(str(p_raw))
                                    if parsed_p:
                                        price = parsed_p
                                        currency_id = offers.get("priceCurrency") or currency_id
                                        found = True
                                        source = "schema_org_json_ld"
                                        break
                    if found:
                        break
                except Exception:
                    continue

            # --- Estrategia B: Open Graph & Twitter Card Meta Tags ---
            if not found or price == 0:
                og_price = (
                    re.search(r'<meta[^>]+property=["\'](?:og:price:amount|product:price:amount)["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE) or
                    re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\'](?:og:price:amount|product:price:amount)["\']', html_text, re.IGNORECASE) or
                    re.search(r'<meta[^>]+name=["\'](?:twitter:data1|price)["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE)
                )
                if og_price:
                    parsed_p = parse_price_string(og_price.group(1))
                    if parsed_p:
                        price = parsed_p
                        found = True
                        source = "opengraph_meta"

                og_currency = (
                    re.search(r'<meta[^>]+property=["\'](?:og:price:currency|product:price:currency)["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE) or
                    re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\'](?:og:price:currency|product:price:currency)["\']', html_text, re.IGNORECASE)
                )
                if og_currency:
                    currency_id = og_currency.group(1).upper()

            # --- Estrategia C: Microdata (itemprop="price") ---
            if not found or price == 0:
                micro_price = (
                    re.search(r'<[^>]+itemprop=["\']price["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE) or
                    re.search(r'<[^>]+content=["\']([^"\']+)["\'][^>]+itemprop=["\']price["\']', html_text, re.IGNORECASE) or
                    re.search(r'<[^>]+itemprop=["\']price["\'][^>]*>([^<]+)<', html_text, re.IGNORECASE)
                )
                if micro_price:
                    parsed_p = parse_price_string(micro_price.group(1))
                    if parsed_p:
                        price = parsed_p
                        found = True
                        source = "microdata"

            # --- Extracción de Título desde itemprop="name", <meta> o <title> ---
            itemprop_name = re.search(r'<[^>]+itemprop=["\']name["\'][^>]*>([^<]+)<', html_text, re.IGNORECASE)
            if itemprop_name and len(itemprop_name.group(1).strip()) > 3:
                title = itemprop_name.group(1).strip()
            else:
                html_title_match = (
                    re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE) or
                    re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']', html_text, re.IGNORECASE) or
                    re.search(r'<meta[^>]+name=["\']twitter:title["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE) or
                    re.search(r'<title>([^<]+)</title>', html_text, re.IGNORECASE)
                )
                if html_title_match:
                    clean_t = html_title_match.group(1).split('|')[0].split(' - ')[0].split(' – ')[0].strip()
                    if len(clean_t) > 3:
                        title = clean_t

            # --- Estrategia E: Heurística CSS para precio en HTML ---
            if not found or price == 0:
                css_price = re.search(r'class=["\'][^"\']*(?:product-price|sales-price|sale-price|current-price|price-tag|price_amount|precio-actual)[^"\']*["\'][^>]*>([^<]+)<', html_text, re.IGNORECASE)
                if css_price:
                    parsed_p = parse_price_string(css_price.group(1))
                    if parsed_p:
                        price = parsed_p
                        found = True
                        source = "html_heuristics"

        return {
            "ok": bool(found and price > 0),
            "item_id": None,
            "title": title,
            "price": price,
            "currency_id": currency_id,
            "domain": domain,
            "has_mp_token": False,
            "source": source,
            "message": None if (found and price > 0) else f"Por seguridad de {domain}, ingresá el precio publicado para calcular cuotas vs inflación."
        }
