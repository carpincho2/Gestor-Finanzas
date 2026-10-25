/**
 * Generador Oficial de Reportes de Deuda Técnica y Mantenibilidad (Markdown, HTML y PDF).
 * Implementa las 7 fórmulas académicas de la plantilla oficial siguiendo principios SOLID y PHAME.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Encapsulación (PHAME) de las variables globales de la plantilla.
 */
class MetricsConfig {
    constructor(kFactor = 0.01, hourlySalary = 20.0, hoursPerMonth = 160) {
        this.kFactor = kFactor;
        this.hourlySalary = hourlySalary;
        this.hoursPerMonth = hoursPerMonth;
    }

    /**
     * 5. Interés Anual = 10 * (14 - 7) * Salario por Hora
     */
    get annualInterest() {
        return 10.0 * (14.0 - 7.0) * this.hourlySalary;
    }
}

/**
 * Responsabilidad Única (SRP): Medir LOC (sin blancos ni comentarios) y Complejidad Ciclomática (G).
 */
class CodeComplexityAnalyzer {
    static EXCLUDED_DIRS = new Set([
        'venv', '.venv', 'fluxo_venv', 'test_env', 'node_modules', '__pycache__',
        '.git', '.pytest_cache', 'dist', 'build', '.vscode', '.idea', 'site-packages', 'mobile'
    ]);

    static analyzePython(filepath) {
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            let loc = 0;
            let inDocstring = false;
            let docstringDelim = '';

            for (const rawLine of content.split(/\r?\n/)) {
                const stripped = rawLine.trim();
                if (!stripped) continue;

                if (!inDocstring && (stripped.startsWith('"""') || stripped.startsWith("'''"))) {
                    const delim = stripped.slice(0, 3);
                    const count = stripped.split(delim).length - 1;
                    if (count >= 2 && stripped.length > 3) {
                        continue;
                    }
                    inDocstring = true;
                    docstringDelim = delim;
                    continue;
                }

                if (inDocstring) {
                    if (stripped.includes(docstringDelim)) {
                        inDocstring = false;
                    }
                    continue;
                }

                if (stripped.startsWith('#')) continue;
                loc++;
            }

            const matches = content.match(/\b(if|elif|for|while|and|or|except|with)\b/g);
            const g = 1 + (matches ? matches.length : 0);
            return { loc, g };
        } catch {
            return { loc: 0, g: 1 };
        }
    }

    static analyzeCStyle(filepath) {
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            let loc = 0;
            let inBlockComment = false;

            for (const rawLine of content.split(/\r?\n/)) {
                const stripped = rawLine.trim();
                if (!stripped) continue;

                if (!inBlockComment && stripped.startsWith('/*')) {
                    if (!stripped.slice(2).includes('*/')) {
                        inBlockComment = true;
                    }
                    continue;
                }

                if (inBlockComment) {
                    if (stripped.includes('*/')) {
                        inBlockComment = false;
                    }
                    continue;
                }

                if (stripped.startsWith('//') || stripped.startsWith('*')) continue;
                loc++;
            }

            const branchKeywords = (content.match(/\b(if|for|while|case|catch)\b/g) || []).length;
            const logicalOps = (content.match(/(\&\&|\|\||\?(?!\.|\?))/g) || []).length;
            const g = 1 + branchKeywords + logicalOps;
            return { loc, g };
        } catch {
            return { loc: 0, g: 1 };
        }
    }
}

/**
 * Responsabilidad Única (SRP): Aplicar las 7 fórmulas exactas de la plantilla.
 */
class FormulaCalculator {
    constructor(config) {
        this.config = config;
    }

    compute(relativePath, category, loc, g) {
        // 1. Índice de Mantenibilidad (MI)
        // MI = max(0, ((171 - 25 * ln(LOC) - 0.23 * G) / 171) * 100)
        const miRaw = ((171.0 - 25.0 * Math.log(Math.max(1, loc)) - 0.23 * g) / 171.0) * 100.0;
        const mi = Math.max(0.0, miRaw);

        // 2. Deuda Técnica en Horas
        // Deuda Técnica (Horas) = max(0, (75 - MI) * LOC * K)
        const debtHours = Math.max(0.0, (75.0 - mi) * loc * this.config.kFactor);

        // 3. Costo Financiero (Costo de Reparación)
        // Costo de Reparación = Deuda Técnica (Horas) * Salario por Hora
        const repairCost = debtHours * this.config.hourlySalary;

        // 4. Tiempo Equivalente en Meses
        // Meses = Deuda Técnica (Horas) / Horas por Mes
        const monthsEquiv = debtHours / this.config.hoursPerMonth;

        // 5. Interés Anual
        // Interés Anual = 10 * (14 - 7) * Salario por Hora
        const annualInterest = this.config.annualInterest;

        // 6. Tiempo de Payback
        // Tiempo de Payback = Costo de Reparación / Interés Anual
        const paybackYears = annualInterest > 0 ? repairCost / annualInterest : 0.0;

        // 7. ROI (Retorno de Inversión Proyectado)
        // ROI = 100 * (((Interés Anual * 2) - Costo de Reparación) / Costo de Reparación)
        const roiPercent = repairCost > 0
            ? 100.0 * (((annualInterest * 2.0) - repairCost) / repairCost)
            : 100.0;

        return {
            relativePath: relativePath.replace(/\\/g, '/'),
            category,
            loc,
            complexityG: g,
            mi: Number(mi.toFixed(2)),
            debtHours: Number(debtHours.toFixed(2)),
            repairCost: Number(repairCost.toFixed(2)),
            monthsEquiv: Number(monthsEquiv.toFixed(2)),
            annualInterest: Number(annualInterest.toFixed(2)),
            paybackYears: Number(paybackYears.toFixed(2)),
            roiPercent: Number(roiPercent.toFixed(1))
        };
    }
}

function walkDirectory(dirPath, validExts, results = []) {
    if (!fs.existsSync(dirPath)) return results;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        if (CodeComplexityAnalyzer.EXCLUDED_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkDirectory(fullPath, validExts, results);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (validExts.has(ext)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

function scanProjectFiles(baseDir, calculator) {
    const targets = [
        { folder: 'api', category: 'Backend (Python)', exts: new Set(['.py']) },
        { folder: 'js', category: 'Frontend (TypeScript / JS)', exts: new Set(['.ts', '.js']) }
    ];

    const metrics = [];

    for (const target of targets) {
        const rootDir = path.join(baseDir, target.folder);
        const files = walkDirectory(rootDir, target.exts);
        for (const fullPath of files) {
            const ext = path.extname(fullPath).toLowerCase();
            const relPath = path.relative(baseDir, fullPath);
            const { loc, g } = ext === '.py'
                ? CodeComplexityAnalyzer.analyzePython(fullPath)
                : CodeComplexityAnalyzer.analyzeCStyle(fullPath);

            if (loc <= 0) continue;
            metrics.push(calculator.compute(relPath, target.category, loc, g));
        }
    }

    return metrics;
}

function formatNumber(num, decimals = 2) {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function generateMarkdownReport(metrics, config) {
    const totalLoc = metrics.reduce((acc, m) => acc + m.loc, 0);
    const totalDebt = metrics.reduce((acc, m) => acc + m.debtHours, 0);
    const totalCost = metrics.reduce((acc, m) => acc + m.repairCost, 0);
    const totalMonths = totalDebt / config.hoursPerMonth;
    const avgMi = metrics.length ? metrics.reduce((acc, m) => acc + m.mi, 0) / metrics.length : 0.0;

    let md = '# Reporte Oficial de Deuda Técnica y Mantenibilidad\n\n';
    md += 'Generado automáticamente aplicando las **7 fórmulas oficiales** sobre el código fuente real del proyecto (excluyendo `venv`, `fluxo_venv`, `node_modules` y artefactos compilados).\n\n';
    md += '## Glosario y Parámetros Globales\n';
    md += `- **K (Factor de corrección):** \`${config.kFactor}\`\n`;
    md += `- **Salario por Hora:** \`$${config.hourlySalary.toFixed(2)} USD\`\n`;
    md += `- **Horas por Mes:** \`${config.hoursPerMonth} hs\`\n`;
    md += `- **Interés Anual por Módulo:** \`$${config.annualInterest.toFixed(2)} USD\` ($10 \\times (14 - 7) \\times \\text{Salario}$)\n\n`;

    md += '## Resumen Ejecutivo del Proyecto\n';
    md += `- **Archivos Analizados:** \`${metrics.length}\` (\`${totalLoc.toLocaleString('en-US')}\` LOC efectivos)\n`;
    md += `- **Índice de Mantenibilidad Promedio (MI):** \`${avgMi.toFixed(2)}\`\n`;
    md += `- **Deuda Técnica Total:** \`${totalDebt.toFixed(2)} horas\` (\`${totalMonths.toFixed(2)} meses\`)\n`;
    md += `- **Costo Total de Reparación:** \`$${formatNumber(totalCost, 2)} USD\`\n\n`;

    const categories = ['Backend (Python)', 'Frontend (TypeScript / JS)'];
    for (const cat of categories) {
        const catItems = metrics.filter(m => m.category === cat).sort((a, b) => b.debtHours - a.debtHours);
        if (!catItems.length) continue;

        md += `## ${cat} (${catItems.length} archivos)\n\n`;
        md += '| Archivo | LOC | G | 1. MI | 2. Deuda (Hs) | 3. Costo ($) | 4. Meses | 5. Interés Anual | 6. Payback (Años) | 7. ROI (%) |\n';
        md += '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';

        for (const m of catItems) {
            const icon = m.mi >= 65 ? '🟢' : m.mi >= 40 ? '🟡' : '🔴';
            md += `| \`${m.relativePath}\` | ${m.loc} | ${m.complexityG} | ${m.mi.toFixed(2)} ${icon} | ${m.debtHours.toFixed(2)} hs | $${formatNumber(m.repairCost, 2)} | ${m.monthsEquiv.toFixed(2)} m | $${formatNumber(m.annualInterest, 0)} | ${m.paybackYears.toFixed(2)} a | ${m.roiPercent.toFixed(1)}% |\n`;
        }

        const catDebt = catItems.reduce((acc, x) => acc + x.debtHours, 0);
        const catCost = catItems.reduce((acc, x) => acc + x.repairCost, 0);
        md += `\n**Subtotal ${cat}:** \`${catDebt.toFixed(2)} horas\` | **Costo:** \`$${formatNumber(catCost, 2)} USD\`\n\n`;
    }

    return md;
}

function formatRowHtml(m) {
    const miCls = m.mi >= 65 ? 'mi-high' : m.mi >= 40 ? 'mi-med' : 'mi-low';
    const roiCls = m.roiPercent >= 0 ? 'roi-pos' : 'roi-neg';
    return (
        `<tr>` +
        `<td>${m.relativePath}</td>` +
        `<td>${m.loc}</td>` +
        `<td>${m.complexityG}</td>` +
        `<td class="${miCls}">${m.mi.toFixed(2)}</td>` +
        `<td>${m.debtHours.toFixed(2)} hs</td>` +
        `<td>$${formatNumber(m.repairCost, 2)}</td>` +
        `<td>${m.monthsEquiv.toFixed(2)} m</td>` +
        `<td>$${formatNumber(m.annualInterest, 0)}</td>` +
        `<td>${m.paybackYears.toFixed(2)} a</td>` +
        `<td class="${roiCls}">${m.roiPercent.toFixed(1)}%</td>` +
        `</tr>`
    );
}

function generateHtmlReport(metrics, config) {
    const totalLoc = metrics.reduce((acc, m) => acc + m.loc, 0);
    const totalDebt = metrics.reduce((acc, m) => acc + m.debtHours, 0);
    const totalCost = metrics.reduce((acc, m) => acc + m.repairCost, 0);
    const totalMonths = totalDebt / config.hoursPerMonth;
    const avgMi = metrics.length ? metrics.reduce((acc, m) => acc + m.mi, 0) / metrics.length : 0.0;

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const topCritical = [...metrics].sort((a, b) => b.debtHours - a.debtHours).slice(0, 8);

    const rowsPerPage = 28;
    const sortedAll = [...metrics].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return b.debtHours - a.debtHours;
    });

    const chunks = [];
    for (let i = 0; i < sortedAll.length; i += rowsPerPage) {
        chunks.push(sortedAll.slice(i, i + rowsPerPage));
    }
    const totalPages = 1 + chunks.length;

    const tableHeader = (
        `<thead><tr>` +
        `<th>Archivo</th>` +
        `<th>LOC</th>` +
        `<th>G</th>` +
        `<th>1. MI</th>` +
        `<th>2. Deuda</th>` +
        `<th>3. Costo ($)</th>` +
        `<th>4. Meses</th>` +
        `<th>5. Interés</th>` +
        `<th>6. Payback</th>` +
        `<th>7. ROI</th>` +
        `</tr></thead>`
    );

    const topRowsHtml = topCritical.map(formatRowHtml).join('\n');

    let pagesHtml = `
    <div class="page">
        <div class="hero-banner">
            <h1>Reporte Oficial de Mantenibilidad y Deuda Técnica</h1>
            <p>Análisis Estático y Financiero del Código Fuente (Arquitectura Limpia, SOLID, PHAME) — Actualizado: ${dateStr}</p>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Deuda Técnica Total (2)</div>
                <div class="kpi-value">${formatNumber(totalDebt, 2)} hs</div>
                <div class="kpi-sub">Equivalente a <strong>${totalMonths.toFixed(2)} meses</strong> (4) sobre ${metrics.length} archivos (${totalLoc.toLocaleString('en-US')} LOC)</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Costo Total de Reparación (3)</div>
                <div class="kpi-value">$ ${formatNumber(totalCost, 2)}</div>
                <div class="kpi-sub">Calculado a razón de $${config.hourlySalary.toFixed(0)} USD / hora de desarrollo</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Índice Mantenibilidad Promedio (1)</div>
                <div class="kpi-value">${avgMi.toFixed(2)} / 100</div>
                <div class="kpi-sub">Interés Anual Base (5): <strong>$${formatNumber(config.annualInterest, 0)} USD</strong> por módulo</div>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-box">
                <div class="box-title">Variables Globales (Glosario)</div>
                <ul class="param-list">
                    <li>• <strong>LOC:</strong> Líneas de código (sin blancos ni comentarios)</li>
                    <li>• <strong>G:</strong> Complejidad ciclomática de McCabe</li>
                    <li>• <strong>K (Factor de Corrección):</strong> ${config.kFactor}</li>
                    <li>• <strong>Salario por Hora:</strong> $${config.hourlySalary.toFixed(2)} USD</li>
                    <li>• <strong>Horas por Mes:</strong> ${config.hoursPerMonth} horas laborables</li>
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
            ${tableHeader}
            <tbody>
                ${topRowsHtml}
            </tbody>
        </table>
        <p class="footnote">* Nota: Este reporte audita exclusivamente los archivos fuente propios del repositorio (directorios api/ y js/), excluyendo librerías de terceros (venv, fluxo_venv, node_modules) para reflejar el costo operativo real.</p>

        <div class="page-footer">
            <span>Reporte Oficial de Mantenibilidad y Deuda Técnica — Gestor de Finanzas</span>
            <span>Página 1 de ${totalPages}</span>
        </div>
    </div>
    `;

    chunks.forEach((chunk, index) => {
        const chunkRows = chunk.map(formatRowHtml).join('\n');
        const pageNum = index + 2;
        pagesHtml += `
        <div class="page">
            <div class="section-title">
                <span>Métricas Detalladas por Archivo (${index + 1}/${chunks.length})</span>
                <span class="section-badge">Todas las 7 Métricas Oficiales</span>
            </div>
            <table class="metrics-table">
                ${tableHeader}
                <tbody>
                    ${chunkRows}
                </tbody>
            </table>
            <div class="page-footer">
                <span>Reporte Oficial de Mantenibilidad y Deuda Técnica — Gestor de Finanzas</span>
                <span>Página ${pageNum} de ${totalPages}</span>
            </div>
        </div>
        `;
    });

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Mantenibilidad y Deuda Técnica</title>
    <link rel="stylesheet" href="../css/reporte_deuda.css">
</head>
<body>
${pagesHtml}
</body>
</html>
`;
}

function exportHtmlToPdf(htmlPath, pdfPath) {
    const browsers = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1179', 'chrome-win', 'chrome.exe')
    ];

    const browserExe = browsers.find(b => fs.existsSync(b));
    if (!browserExe) return false;

    const fileUrl = 'file:///' + path.resolve(htmlPath).replace(/\\/g, '/');
    const resolvedPdfPath = path.resolve(pdfPath);

    execFileSync(browserExe, [
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--print-to-pdf=${resolvedPdfPath}`,
        fileUrl
    ]);

    return fs.existsSync(resolvedPdfPath);
}

function main() {
    const baseDir = __dirname;
    const config = new MetricsConfig(0.01, 20.0, 160);
    const calculator = new FormulaCalculator(config);

    const metrics = scanProjectFiles(baseDir, calculator);

    const mdContent = generateMarkdownReport(metrics, config);
    fs.writeFileSync(path.join(baseDir, 'reporte_deuda.md'), mdContent, 'utf8');
    fs.writeFileSync(path.join(baseDir, 'reporte_metricas.md'), mdContent, 'utf8');

    const htmlDir = path.join(baseDir, 'html');
    if (!fs.existsSync(htmlDir)) fs.mkdirSync(htmlDir, { recursive: true });
    const htmlPath = path.join(htmlDir, 'reporte_deuda.html');
    const htmlContent = generateHtmlReport(metrics, config);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');

    const pdfPath = path.join(baseDir, 'Reporte de Deuda Técnica.pdf');
    const ok = exportHtmlToPdf(htmlPath, pdfPath);

    const totalDebt = metrics.reduce((acc, m) => acc + m.debtHours, 0);
    const totalCost = metrics.reduce((acc, m) => acc + m.repairCost, 0);
    console.log(`Archivos analizados: ${metrics.length}`);
    console.log(`Deuda Técnica Total: ${totalDebt.toFixed(2)} hs | Costo Total: $${formatNumber(totalCost, 2)} USD`);
    console.log(`PDF generado exitosamente: ${ok} -> ${pdfPath}`);
}

main();
