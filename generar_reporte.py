import os
import ast
import re
import math

# Configuracion
K = 0.01
SALARIO_HORA = 20 # USD
HORAS_MES = 160

def calculate_python_complexity(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Calcular LOC (ignorando comentarios y blancos)
        loc = 0
        in_docstring = False
        for line in content.split('\n'):
            stripped = line.strip()
            if not stripped: continue
            if stripped.startswith('"""') or stripped.startswith("'''"):
                if stripped.count('"""') == 2 or stripped.count("'''") == 2:
                    continue # single line docstring
                in_docstring = not in_docstring
                continue
            if in_docstring: continue
            if stripped.startswith('#'): continue
            loc += 1
            
        # Calcular Complejidad (G)
        try:
            tree = ast.parse(content)
            g = 1 # Base complexity
            for node in ast.walk(tree):
                if isinstance(node, (ast.If, ast.IfExp, ast.For, ast.While, ast.And, ast.Or, ast.ExceptHandler)):
                    g += 1
        except:
            # Fallback simple si hay error de sintaxis
            g = 1 + len(re.findall(r'\b(if|elif|for|while|and|or|except)\b', content))
            
        return loc, g
    except Exception as e:
        return 0, 1

def calculate_js_complexity(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Calcular LOC
        loc = 0
        in_comment = False
        for line in content.split('\n'):
            stripped = line.strip()
            if not stripped: continue
            if stripped.startswith('/*'):
                if not stripped.endswith('*/'):
                    in_comment = True
                continue
            if stripped.endswith('*/'):
                in_comment = False
                continue
            if in_comment: continue
            if stripped.startswith('//'): continue
            loc += 1
            
        # Calcular Complejidad (G) heuristica
        # Base 1 + ifs, loops, switch cases, logical operators
        g = 1 + len(re.findall(r'\b(if|for|while|case|catch)\b', content))
        g += len(re.findall(r'(\&\&|\|\||\?)', content))
        
        return loc, g
    except Exception:
        return 0, 1

def process_directory(directory, ext):
    results = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(ext):
                filepath = os.path.join(root, file)
                if ext == '.py':
                    loc, g = calculate_python_complexity(filepath)
                else:
                    loc, g = calculate_js_complexity(filepath)
                
                if loc == 0: continue
                
                # Fórmulas
                # MI = max(0, ((171 - 25 * ln(LOC) - 0.23 * G) / 171) * 100)
                try:
                    mi = max(0, ((171 - 25 * math.log(loc) - 0.23 * g) / 171) * 100)
                except ValueError:
                    mi = 100 # si loc es <= 0
                
                # Deuda Técnica (Horas) = max(0, (75 - MI) * LOC * K)
                deuda_horas = max(0, (75 - mi) * loc * K)
                
                # Costo de Reparación = Deuda Técnica * Salario
                costo_rep = deuda_horas * SALARIO_HORA
                
                # Tiempo Equivalente en Meses
                meses = deuda_horas / HORAS_MES
                
                # Interés Anual = 10 * (14-7) * Salario por Hora
                # Interés Anual = 10 * 7 * Salario = 70 * 20 = 1400 por cada archivo? 
                # Wait, el interés anual de la fórmula parece fijo independientemente del archivo, 
                # o tal vez es por el proyecto global. Vamos a calcularlo por archivo.
                interes_anual = 10 * 7 * SALARIO_HORA
                
                # Tiempo de Payback
                payback = costo_rep / interes_anual if interes_anual > 0 else 0
                
                # ROI
                if costo_rep > 0:
                    roi = 100 * (((interes_anual * 2) - costo_rep) / costo_rep)
                else:
                    roi = 100 # Si no hay deuda, ROI es óptimo
                    
                results.append({
                    'file': os.path.relpath(filepath, directory),
                    'loc': loc,
                    'g': g,
                    'mi': round(mi, 2),
                    'deuda_horas': round(deuda_horas, 2),
                    'costo_rep': round(costo_rep, 2),
                    'meses': round(meses, 2),
                    'interes_anual': interes_anual,
                    'payback': round(payback, 2),
                    'roi': round(roi, 2)
                })
    return results

def generate_markdown(results_py, results_js):
    md = "# Reporte de Deuda Técnica y Mantenibilidad\n\n"
    md += "Este reporte fue generado automáticamente aplicando las fórmulas oficiales del análisis de deuda técnica.\n\n"
    md += "## Parámetros Utilizados\n"
    md += f"- **K (Factor de corrección):** {K}\n"
    md += f"- **Salario por Hora:** ${SALARIO_HORA} USD\n"
    md += f"- **Horas por Mes:** {HORAS_MES} hs\n\n"
    
    def render_table(title, data):
        if not data: return ""
        # Ordenar por Deuda Técnica descendente
        data.sort(key=lambda x: x['deuda_horas'], reverse=True)
        
        t = f"## {title}\n\n"
        t += "| Archivo | LOC | G | MI | Deuda (Hs) | Costo ($) | ROI (%) |\n"
        t += "|---|---|---|---|---|---|---|\n"
        
        total_deuda = 0
        total_costo = 0
        
        for d in data:
            mi_color = "🟢" if d['mi'] > 75 else "🟡" if d['mi'] > 50 else "🔴"
            t += f"| `{d['file']}` | {d['loc']} | {d['g']} | {d['mi']} {mi_color} | {d['deuda_horas']} hs | ${d['costo_rep']} | {d['roi']}% |\n"
            total_deuda += d['deuda_horas']
            total_costo += d['costo_rep']
            
        t += f"\n**Total Deuda Técnica:** {round(total_deuda, 2)} horas\n"
        t += f"**Costo Total de Reparación:** ${round(total_costo, 2)}\n\n"
        return t

    md += render_table("Backend (Python)", results_py)
    md += render_table("Frontend (JavaScript)", results_js)
    
    return md

if __name__ == "__main__":
    base_dir = r"H:\Gestor de Finanzas"
    results_py = process_directory(os.path.join(base_dir, "api"), ".py")
    results_js = process_directory(os.path.join(base_dir, "js"), ".js")
    
    report_md = generate_markdown(results_py, results_js)
    
    with open(os.path.join(base_dir, "reporte_deuda.md"), "w", encoding="utf-8") as f:
        f.write(report_md)
    print("Reporte generado con exito.")
