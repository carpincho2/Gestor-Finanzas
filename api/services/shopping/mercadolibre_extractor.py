import re
import requests
from urllib.parse import urlparse, unquote, quote
from typing import Dict, Any, Optional

from ports.extractors.product_extractor_port import IProductExtractor


class MercadoLibreExtractor(IProductExtractor):
    """
    Extractor especializado para publicaciones y productos del ecosistema Mercado Libre.
    Aprovecha la integración OAuth con tokens de Mercado Pago y APIs oficiales de catálogo.
    """

    def can_handle(self, url: str) -> bool:
        url_lower = url.lower()
        if any(d in url_lower for d in ["mercadolibre", "mpago.li", "ml.com.ar"]):
            return True
        if re.search(r'(?:/p/|item_id=|\b)(ML[A-Z]-?\d{5,})\b', url, re.IGNORECASE):
            return True
        return False

    def extract(self, url: str, user_id: Optional[int] = None, user_token: Optional[str] = None) -> Dict[str, Any]:
        raw_url = url.strip()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/html, */*"
        }
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"

        target_url = raw_url

        # 1. Seguir redirección si es un enlace corto (ej: mpago.li, /sec/, etc.)
        if any(domain in target_url for domain in ["mpago.li", "/sec/", "ml.com.ar", "mercadolibre"]):
            if not re.search(r'ML[A-Z]-?\d{6,}', target_url, re.IGNORECASE):
                try:
                    res = requests.get(target_url, allow_redirects=True, headers=headers, timeout=5, stream=True)
                    if res.url:
                        target_url = res.url
                except Exception:
                    pass

        # 2. Extraer el ID específico del item o catálogo de la URL
        item_id = None
        query_item = re.search(r'(?:item_id|wid)%3A(MLA-?\d+)', target_url, re.IGNORECASE) or re.search(r'(?:item_id|wid)=(MLA-?\d+)', target_url, re.IGNORECASE)
        catalog_match = re.search(r'/p/(ML[A-Z]-?\d+)', target_url, re.IGNORECASE)
        general_match = re.search(r'(ML[A-Z]-?\d{6,})', target_url, re.IGNORECASE)

        if query_item:
            item_id = query_item.group(1).replace('-', '').upper()
        elif catalog_match:
            item_id = catalog_match.group(1).replace('-', '').upper()
        elif general_match:
            item_id = general_match.group(1).replace('-', '').upper()
        elif re.match(r'^ML[A-Z]-?\d+$', target_url, re.IGNORECASE):
            item_id = target_url.replace('-', '').upper()

        # 3. Extraer el título directamente del slug de la URL como fallback visual
        slug_title = None
        try:
            parsed = urlparse(target_url)
            path_parts = [p for p in parsed.path.split('/') if p and p != 'p']
            if path_parts:
                raw_slug = unquote(path_parts[0])
                clean_slug = re.sub(r'^ML[A-Z]-?\d+-?', '', raw_slug, flags=re.IGNORECASE)
                clean_slug = re.sub(r'_JM$', '', clean_slug, flags=re.IGNORECASE)
                clean_slug = re.sub(r'[\-_]+', ' ', clean_slug).strip()
                if len(clean_slug) > 3:
                    slug_title = clean_slug.title()
        except Exception:
            pass

        # 4. Extraer precio de los parámetros de la URL si viniera adjunto
        query_price = None
        try:
            parsed_query = urlparse(target_url).query
            price_param = re.search(r'(?:price|precio|p)=([\d\.]+)', parsed_query, re.IGNORECASE)
            if price_param:
                query_price = float(price_param.group(1).replace('.', ''))
        except Exception:
            pass

        price = query_price or 0.0
        title = slug_title or "Producto Mercado Libre"
        currency_id = "ARS"
        found = False
        source = "url_slug"

        if price > 0:
            found = True
            source = "url_param"

        # 5. Intentar consultar las APIs de Mercado Libre (aprovechando token de MP)
        if not found and item_id:
            try:
                resp = requests.get(f"https://api.mercadolibre.com/items/{item_id}", headers=headers, timeout=6)
                if resp.status_code == 200:
                    data = resp.json()
                    price = float(data.get("price") or price)
                    title = data.get("title") or title
                    currency_id = data.get("currency_id") or currency_id
                    if price > 0:
                        found = True
                        source = "mercadolibre_api_items"
            except Exception:
                pass

            if not found:
                try:
                    resp = requests.get(f"https://api.mercadolibre.com/products/{item_id}", headers=headers, timeout=6)
                    if resp.status_code == 200:
                        data = resp.json()
                        buy_box = data.get("buy_box_winner") or {}
                        price = float(buy_box.get("price") or data.get("price") or price)
                        title = data.get("name") or data.get("title") or title
                        currency_id = buy_box.get("currency_id") or data.get("currency_id") or currency_id
                        if price > 0:
                            found = True
                            source = "mercadolibre_api_products"
                except Exception:
                    pass

        # 6. Respaldo: Scrapear HTML directo
        if not found or price == 0:
            urls_to_try = [target_url]
            if item_id:
                if item_id.startswith("MLA"):
                    urls_to_try.append(f"https://articulo.mercadolibre.com.ar/{item_id[:3]}-{item_id[3:]}")
                urls_to_try.append(f"https://www.mercadolibre.com.ar/p/{item_id}")

            browser_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-AR,es-419;q=0.9,es;q=0.8",
            }

            for t_url in urls_to_try:
                if found and price > 0:
                    break
                try:
                    html_resp = requests.get(t_url, headers=browser_headers, timeout=5, allow_redirects=True)
                    if html_resp.status_code == 200:
                        html_text = html_resp.text

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
                                    source = "mercadolibre_html"
                            except ValueError:
                                pass

                        title_match = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', html_text) or re.search(r'<title>([^<]+)</title>', html_text)
                        if title_match:
                            clean_t = title_match.group(1).split('|')[0].split('- Mercado')[0].strip()
                            if len(clean_t) > 3 and title == "Producto Mercado Libre":
                                title = clean_t
                except Exception:
                    pass

        # 7. Respaldo por búsqueda de título en catálogo
        if (not found or price == 0) and title and title != "Producto Mercado Libre":
            try:
                search_api = f"https://api.mercadolibre.com/sites/MLA/search?q={quote(title)}&limit=1"
                search_resp = requests.get(search_api, headers=headers, timeout=5)
                if search_resp.status_code == 200:
                    s_data = search_resp.json()
                    s_results = s_data.get("results", [])
                    if s_results and s_results[0].get("price"):
                        price = float(s_results[0]["price"])
                        found = True
                        source = "mercadolibre_search_fallback"
            except Exception:
                pass

        return {
            "ok": bool(found and price > 0),
            "item_id": item_id,
            "title": title,
            "price": price,
            "currency_id": currency_id,
            "domain": "mercadolibre.com.ar",
            "has_mp_token": bool(user_token),
            "source": source
        }
