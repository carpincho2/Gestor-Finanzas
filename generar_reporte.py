"""
Generador Oficial de Reportes de Deuda Técnica y Mantenibilidad (Markdown, HTML y PDF).
Implementa las 7 fórmulas académicas de la plantilla oficial siguiendo principios SOLID y PHAME.
"""

import ast
import math
import os
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime
from typing import List, Tuple


@dataclass(frozen=True)
class MetricsConfig:
    """Encapsulación (PHAME) de las variables globales de la plantilla."""
    k_factor: float = 0.01
    hourly_salary: float = 20.0
    hours_per_month: int = 160

    @property
    def annual_interest(self) -> float:
        """5. Interés Anual = 10 * (14 - 7) * Salario por Hora."""
        return 10.0 * (14.0 - 7.0) * self.hourly_salary


@dataclass(frozen=True)
class FileMetrics:
    """Entidad inmutable con las 7 métricas calculadas para un archivo."""
    relative_path: str
    category: str
    loc: int
    complexity_g: int
    mi: float
    debt_hours: float
    repair_cost: float
    months_equiv: float
    annual_interest: float
    payback_years: float
    roi_percent: float


class CodeComplexityAnalyzer:
    """Responsabilidad Única (SRP): Medir LOC (sin blancos ni comentarios) y Complejidad Ciclomática (G)."""

    EXCLUDED_DIRS = {
        "venv", ".venv", "fluxo_venv", "test_env", "node_modules", "__pycache__",
        ".git", ".pytest_cache", "dist", "build", ".vscode", ".idea", "site-packages", "mobile"
    }

    @staticmethod
    def analyze_python(filepath: str) -> Tuple[int, int]:
        """Calcula LOC y G para archivos Python usando AST."""
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            loc = 0
            in_docstring = False
            docstring_delim = ""

            for line in content.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                if not in_docstring and (stripped.startswith('"""') or stripped.startswith("'''")):
                    delim = stripped[:3]
                    if stripped.count(delim) >= 2 and len(stripped) > 3:
                        continue
                    in_docstring = True
                    docstring_delim = delim
                    continue
                if in_docstring:
                    if docstring_delim in stripped:
                        in_docstring = False
                    continue
                if stripped.startswith("#"):
                    continue
                loc += 1

            try:
                tree = ast.parse(content)
                g = 1
                for node in ast.walk(tree):
                    if isinstance(
                        node,
                        (ast.If, ast.IfExp, ast.For, ast.AsyncFor, ast.While, ast.ExceptHandler, ast.With, ast.AsyncWith)
                    ):
                        g += 1
                    elif isinstance(node, ast.BoolOp):
                        g += max(1, len(node.values) - 1)
            except SyntaxError:
                g = 1 + len(re.findall(r"\b(if|elif|for|while|and|or|except)\b", content))

            return loc, g
        except OSError:
            return 0, 1

    @staticmethod
    def analyze_c_style(filepath: str) -> Tuple[int, int]:
        """Calcula LOC y G para archivos TypeScript, JavaScript y Dart."""
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            loc = 0
            in_block_comment = False

            for line in content.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                if not in_block_comment and stripped.startswith("/*"):
                    if "*/" not in stripped[2:]:
                        in_block_comment = True
                    continue
                if in_block_comment:
                    if "*/" in stripped:
                        in_block_comment = False
                    continue
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                loc += 1

            branch_keywords = len(re.findall(r"\b(if|for|while|case|catch)\b", content))
            logical_ops = len(re.findall(r"(\&\&|\|\||\?(?!\.|\?))", content))
            g = 1 + branch_keywords + logical_ops
            return loc, g
        except OSError:
            return 0, 1


class FormulaCalculator:
    """Responsabilidad Única (SRP): Aplicar las 7 fórmulas exactas de la plantilla."""

    def __init__(self, config: MetricsConfig):
        self.config = config

    def compute(self, relative_path: str, category: str, loc: int, g: int) -> FileMetrics:
        """Calcula MI, Deuda (Horas), Costo, Meses, Interés Anual, Payback y ROI."""
        # 1. Índice de Mantenibilidad (MI)
        # MI = max(0, ((171 - 25 * ln(LOC) - 0.23 * G) / 171) * 100)
        mi_raw = ((171.0 - 25.0 * math.log(max(1, loc)) - 0.23 * g) / 171.0) * 100.0
        mi = max(0.0, mi_raw)

        # 2. Deuda Técnica en Horas
        # Deuda Técnica (Horas) = max(0, (75 - MI) * LOC * K)
        debt_hours = max(0.0, (75.0 - mi) * loc * self.config.k_factor)

        # 3. Costo Financiero (Costo de Reparación)
        # Costo de Reparación = Deuda Técnica (Horas) * Salario por Hora
        repair_cost = debt_hours * self.config.hourly_salary

        # 4. Tiempo Equivalente en Meses
        # Meses = Deuda Técnica (Horas) / Horas por Mes
        months_equiv = debt_hours / float(self.config.hours_per_month)

        # 5. Interés Anual
        # Interés Anual = 10 * (14 - 7) * Salario por Hora
        annual_interest = self.config.annual_interest

        # 6. Tiempo de Payback
        # Tiempo de Payback = Costo de Reparación / Interés Anual
        payback_years = repair_cost / annual_interest if annual_interest > 0 else 0.0

        # 7. ROI (Retorno de Inversión Proyectado)
        # ROI = 100 * (((Interés Anual * 2) - Costo de Reparación) / Costo de Reparación)
        if repair_cost > 0:
            roi_percent = 100.0 * (((annual_interest * 2.0) - repair_cost) / repair_cost)
        else:
            roi_percent = 100.0

        return FileMetrics(
            relative_path=relative_path.replace("\\", "/"),
            category=category,
            loc=loc,
            complexity_g=g,
            mi=round(mi, 2),
            debt_hours=round(debt_hours, 2),
            repair_cost=round(repair_cost, 2),
            months_equiv=round(months_equiv, 2),
            annual_interest=round(annual_interest, 2),
            payback_years=round(payback_years, 2),
            roi_percent=round(roi_percent, 1),
        )


def scan_project_files(base_dir: str, calculator: FormulaCalculator) -> List[FileMetrics]:
    """Escanea los directorios fuente del proyecto excluyendo entornos virtuales y librerías externas."""
    targets = [
        ("api", "Backend (Python)", {".py"}),
        ("js", "Frontend (TypeScript / JS)", {".ts", ".js"}),
    ]

    results: List[FileMetrics] = []

    for folder, category, valid_exts in targets:
        root_dir = os.path.join(base_dir, folder)
        if not os.path.exists(root_dir):
            continue

        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in CodeComplexityAnalyzer.EXCLUDED_DIRS]

            for file in sorted(files):
                ext = os.path.splitext(file)[1].lower()
                if ext not in valid_exts:
                    continue

                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, base_dir)

                if ext == ".py":
                    loc, g = CodeComplexityAnalyzer.analyze_python(full_path)
                else:
                    loc, g = CodeComplexityAnalyzer.analyze_c_style(full_path)

                if loc <= 0:
                    continue

                results.append(calculator.compute(rel_path, category, loc, g))

    return results


def generate_markdown_report(metrics: List[FileMetrics], config: MetricsConfig) -> str:
    """Genera el reporte en formato Markdown con las 7 métricas."""
    total_loc = sum(m.loc for m in metrics)
    total_debt = sum(m.debt_hours for m in metrics)
    total_cost = sum(m.repair_cost for m in metrics)
    total_months = total_debt / config.hours_per_month
    avg_mi = sum(m.mi for m in metrics) / len(metrics) if metrics else 0.0

    md = "# Reporte Oficial de Deuda Técnica y Mantenibilidad\n\n"
    md += "Generado automáticamente aplicando las **7 fórmulas oficiales** sobre el código fuente real del proyecto (excluyendo `venv`, `node_modules` y artefactos compilados).\n\n"
    md += "## Glosario y Parámetros Globales\n"
    md += f"- **K (Factor de corrección):** `{config.k_factor}`\n"
    md += f"- **Salario por Hora:** `${config.hourly_salary:.2f} USD`\n"
    md += f"- **Horas por Mes:** `{config.hours_per_month} hs`\n"
    md += f"- **Interés Anual por Módulo:** `${config.annual_interest:.2f} USD` ($10 \\times (14 - 7) \\times \\text{{Salario}}$)\n\n"

    md += "## Resumen Ejecutivo del Proyecto\n"
    md += f"- **Archivos Analizados:** `{len(metrics)}` (`{total_loc:,}` LOC efectivos)\n"
    md += f"- **Índice de Mantenibilidad Promedio (MI):** `{avg_mi:.2f}`\n"
    md += f"- **Deuda Técnica Total:** `{total_debt:.2f} horas` (`{total_months:.2f} meses`)\n"
    md += f"- **Costo Total de Reparación:** `${total_cost:,.2f} USD`\n\n"

    categories = ["Backend (Python)", "Frontend (TypeScript / JS)"]
    for cat in categories:
        cat_items = [m for m in metrics if m.category == cat]
        if not cat_items:
            continue
        cat_items.sort(key=lambda x: x.debt_hours, reverse=True)

        md += f"## {cat} ({len(cat_items)} archivos)\n\n"
        md += "| Archivo | LOC | G | 1. MI | 2. Deuda (Hs) | 3. Costo ($) | 4. Meses | 5. Interés Anual | 6. Payback (Años) | 7. ROI (%) |\n"
        md += "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n"

        for m in cat_items:
            icon = "🟢" if m.mi >= 65 else "🟡" if m.mi >= 40 else "🔴"
            md += (
                f"| `{m.relative_path}` | {m.loc} | {m.complexity_g} | {m.mi:.2f} {icon} | "
                f"{m.debt_hours:.2f} hs | ${m.repair_cost:,.2f} | {m.months_equiv:.2f} m | "
                f"${m.annual_interest:,.0f} | {m.payback_years:.2f} a | {m.roi_percent:.1f}% |\n"
            )

        cat_debt = sum(x.debt_hours for x in cat_items)
        cat_cost = sum(x.repair_cost for x in cat_items)
        md += f"\n**Subtotal {cat}:** `{cat_debt:.2f} horas` | **Costo:** `${cat_cost:,.2f} USD`\n\n"

    return md


def _format_row_html(m: FileMetrics) -> str:
    """Formatea una fila HTML con clases semánticas para MI y ROI."""
    mi_cls = "mi-high" if m.mi >= 65 else "mi-med" if m.mi >= 40 else "mi-low"
    roi_cls = "roi-pos" if m.roi_percent >= 0 else "roi-neg"
    return (
        f"<tr>"
        f"<td>{m.relative_path}</td>"
        f"<td>{m.loc}</td>"
        f"<td>{m.complexity_g}</td>"
        f"<td class='{mi_cls}'>{m.mi:.2f}</td>"
        f"<td>{m.debt_hours:.2f} hs</td>"
        f"<td>${m.repair_cost:,.2f}</td>"
        f"<td>{m.months_equiv:.2f} m</td>"
        f"<td>${m.annual_interest:,.0f}</td>"
        f"<td>{m.payback_years:.2f} a</td>"
        f"<td class='{roi_cls}'>{m.roi_percent:.1f}%</td>"
        f"</tr>"
    )


def generate_html_report(metrics: List[FileMetrics], config: MetricsConfig) -> str:
    """Genera el documento HTML vinculado a ../css/reporte_deuda.css para exportar a PDF."""
    total_loc = sum(m.loc for m in metrics)
    total_debt = sum(m.debt_hours for m in metrics)
    total_cost = sum(m.repair_cost for m in metrics)
    total_months = total_debt / config.hours_per_month
    avg_mi = sum(m.mi for m in metrics) / len(metrics) if metrics else 0.0
    date_str = datetime.now().strftime("%d/%m/%Y")

    top_critical = sorted(metrics, key=lambda x: x.debt_hours, reverse=True)[:8]

    rows_per_page = 28
    sorted_all = sorted(metrics, key=lambda x: (x.category, -x.debt_hours))
    chunks = [sorted_all[i:i + rows_per_page] for i in range(0, len(sorted_all), rows_per_page)]
    total_pages = 1 + len(chunks)

    table_header = (
        "<thead><tr>"
        "<th>Archivo</th>"
        "<th>LOC</th>"
        "<th>G</th>"
        "<th>1. MI</th>"
        "<th>2. Deuda</th>"
        "<th>3. Costo ($)</th>"
        "<th>4. Meses</th>"
        "<th>5. Interés</th>"
        "<th>6. Payback</th>"
        "<th>7. ROI</th>"
        "</tr></thead>"
    )

    top_rows_html = "\n".join(_format_row_html(m) for m in top_critical)

    pages_html = f"""
    <div class="page">
        <div class="hero-banner">
            <h1>Reporte Oficial de Mantenibilidad y Deuda Técnica</h1>
            <p>Análisis Estático y Financiero del Código Fuente (Arquitectura Limpia, SOLID, PHAME) — Actualizado: {date_str}</p>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Deuda Técnica Total (2)</div>
                <div class="kpi-value">{total_debt:,.2f} hs</div>
                <div class="kpi-sub">Equivalente a <strong>{total_months:.2f} meses</strong> (4) sobre {len(metrics)} archivos ({total_loc:,} LOC)</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Costo Total de Reparación (3)</div>
                <div class="kpi-value">$ {total_cost:,.2f}</div>
                <div class="kpi-sub">Calculado a razón de ${config.hourly_salary:.0f} USD / hora de desarrollo</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Índice Mantenibilidad Promedio (1)</div>
                <div class="kpi-value">{avg_mi:.2f} / 100</div>
                <div class="kpi-sub">Interés Anual Base (5): <strong>${config.annual_interest:,.0f} USD</strong> por módulo</div>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-box">
                <div class="box-title">Variables Globales (Glosario)</div>
                <ul class="param-list">
                    <li>• <strong>LOC:</strong> Líneas de código (sin blancos ni comentarios)</li>
                    <li>• <strong>G:</strong> Complejidad ciclomática de McCabe</li>
                    <li>• <strong>K (Factor de Corrección):</strong> {config.k_factor}</li>
                    <li>• <strong>Salario por Hora:</strong> ${config.hourly_salary:.2f} USD</li>
                    <li>• <strong>Horas por Mes:</strong> {config.hours_per_month} horas laborables</li>
                </ul>
            </div>
            <div class="status-box">
                <div class="box-title">✅ Plantilla Oficial de 7 Fórmulas Aplicada</div>
                <div class="formula-grid">
                    <div class="formula-item">1. MI = max(0, ((171 - 25·ln(LOC) - 0.23·G)/171)·100)</div>
                    <div class="formula-item">2. Deuda (Hs) = max(0, (75 - MI)·LOC·K)</div>
                    <div class="formula-item">3. Costo = Deuda (Hs) × Salario/Hora</div>
                    <div class="formula-item">4. Meses = Deuda (Hs) / Horas_Mes</div>
                    <div class="formula-item">5. Interés Anual = 10 × (14 - 7) × Salario</div>
                    <div class="formula-item">6. Payback = Costo / Interés Anual</div>
                    <div class="formula-item formula-wide">7. ROI = 100 × (((Interés Anual × 2) - Costo) / Costo)</div>
                </div>
            </div>
        </div>

        <div class="section-title">
            <span>Archivos con Mayor Deuda Técnica (Top 8 Prioritarios)</span>
            <span class="section-badge">Código Fuente Propio (Sin venv / node_modules)</span>
        </div>
        <table class="metrics-table">
            {table_header}
            <tbody>
                {top_rows_html}
            </tbody>
        </table>
        <p class="footnote">* Nota: Este reporte audita exclusivamente los archivos fuente propios del repositorio (directorios api/ y js/), excluyendo librerías de terceros (venv, node_modules) para reflejar el costo operativo real.</p>

        <div class="page-footer">
            <span>Reporte Oficial de Mantenibilidad y Deuda Técnica — Gestor de Finanzas</span>
            <span>Página 1 de {total_pages}</span>
        </div>
    </div>
    """

    for idx, chunk in enumerate(chunks, start=1):
        chunk_rows = "\n".join(_format_row_html(m) for m in chunk)
        page_num = idx + 1
        pages_html += f"""
        <div class="page">
            <div class="section-title">
                <span>Métricas Detalladas por Archivo ({idx}/{len(chunks)})</span>
                <span class="section-badge">Todas las 7 Métricas Oficiales</span>
            </div>
            <table class="metrics-table">
                {table_header}
                <tbody>
                    {chunk_rows}
                </tbody>
            </table>
            <div class="page-footer">
                <span>Reporte Oficial de Mantenibilidad y Deuda Técnica — Gestor de Finanzas</span>
                <span>Página {page_num} de {total_pages}</span>
            </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Mantenibilidad y Deuda Técnica</title>
    <link rel="stylesheet" href="../css/reporte_deuda.css">
</head>
<body>
{pages_html}
</body>
</html>
"""


def export_html_to_pdf(html_path: str, pdf_path: str) -> bool:
    """Convierte el archivo HTML a PDF utilizando Chromium/Chrome/Edge headless."""
    browsers = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright\chromium-1179\chrome-win\chrome.exe"),
    ]
    browser_exe = next((b for b in browsers if os.path.exists(b)), None)
    if not browser_exe:
        return False

    file_url = "file:///" + os.path.abspath(html_path).replace("\\", "/")
    cmd = [
        browser_exe,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={os.path.abspath(pdf_path)}",
        file_url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return result.returncode == 0 and os.path.exists(pdf_path)


def main() -> None:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    config = MetricsConfig(k_factor=0.01, hourly_salary=20.0, hours_per_month=160)
    calculator = FormulaCalculator(config)

    metrics = scan_project_files(base_dir, calculator)

    # 1. Guardar Markdown completo
    md_content = generate_markdown_report(metrics, config)
    for md_name in ("reporte_deuda.md", "reporte_metricas.md"):
        with open(os.path.join(base_dir, md_name), "w", encoding="utf-8") as f:
            f.write(md_content)

    # 2. Guardar HTML vinculado a CSS externo
    html_dir = os.path.join(base_dir, "html")
    os.makedirs(html_dir, exist_ok=True)
    html_path = os.path.join(html_dir, "reporte_deuda.html")
    html_content = generate_html_report(metrics, config)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    # 3. Exportar a PDF
    pdf_path = os.path.join(base_dir, "Reporte de Deuda Técnica.pdf")
    ok = export_html_to_pdf(html_path, pdf_path)

    total_debt = sum(m.debt_hours for m in metrics)
    total_cost = sum(m.repair_cost for m in metrics)
    print(f"Archivos analizados: {len(metrics)}")
    print(f"Deuda Técnica Total: {total_debt:.2f} hs | Costo Total: ${total_cost:,.2f} USD")
    print(f"PDF generado exitosamente: {ok} -> {pdf_path}")


if __name__ == "__main__":
    main()
