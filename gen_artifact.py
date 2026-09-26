import os
import math
import re

K = 0.01
SALARIO = 20
HORAS_MES = 160

def calc_py(f):
    try:
        with open(f, 'r', encoding='utf-8') as file:
            c = file.read()
        loc = len([l for l in c.split('\n') if l.strip() and not l.strip().startswith('#')])
        g = 1 + len(re.findall(r'\b(if|for|while|and|or|except|elif)\b', c, re.I))
        return loc, g
    except: return 0,1

def calc_js(f):
    try:
        with open(f, 'r', encoding='utf-8') as file:
            c = file.read()
        loc = len([l for l in c.split('\n') if l.strip() and not l.strip().startswith('//') and not l.strip().startswith('/*') and not l.strip().startswith('*')])
        g = 1 + len(re.findall(r'\b(if|for|while|case|catch)\b|\&\&|\|\||\?', c, re.I))
        return loc, g
    except: return 0,1

results = []
for d in ['api', 'js']:
    for root, dirs, files in os.walk(d):
        if 'venv' in root or '.venv' in root or 'node_modules' in root or '__pycache__' in root:
            continue
        for file in files:
            f = os.path.join(root, file)
            if file.endswith('.py'):
                loc, g = calc_py(f)
            elif file.endswith('.js'):
                loc, g = calc_js(f)
            else:
                continue
            
            if loc == 0: continue
            
            mi = max(0, ((171 - 25 * math.log(loc) - 0.23 * g) / 171) * 100)
            deuda = max(0, (75 - mi) * loc * K)
            costo = deuda * SALARIO
            meses = deuda / HORAS_MES
            ia = 10 * 7 * SALARIO
            pb = costo / ia if ia else 0
            roi = 100 * (((ia * 2) - costo) / costo) if costo > 0 else 100
            
            color = "🟢" if mi > 75 else "🟡" if mi > 50 else "🔴"
            
            results.append(f"| `{f.replace(chr(92), '/')}` | {loc} | {g} | {mi:.2f} {color} | {deuda:.2f} hs | ${costo:.2f} | {pb*12:.1f}m | {roi:.1f}% |")

md = "# Reporte Académico de Mantenibilidad y Deuda Técnica\n\n"
md += "Este documento fue autogenerado aplicando las fórmulas provistas, excluyendo librerías externas (venvs) para reflejar únicamente el código fuente del proyecto.\n\n"
md += "**Variables aplicadas:** Salario=$20/hr, K=0.01, Jornada=160hs/mes\n\n"
md += "| Archivo | LOC | Complejidad (G) | MI | Deuda (Horas) | Costo ($) | Payback | ROI |\n"
md += "|---|---|---|---|---|---|---|---|\n"
md += "\n".join(results)

with open(r"C:\Users\carpi\.gemini\antigravity\brain\64f60ad4-e2cc-4b85-b50b-a7d232f929b2\reporte_mantenibilidad.md", "w", encoding="utf-8") as f:
    f.write(md)
