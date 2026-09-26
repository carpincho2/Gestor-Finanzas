$K = 0.01
$SalarioHora = 20.0
$InteresAnual = 10 * 7 * $SalarioHora

$output = @()
$output += "# Reporte Oficial de Mantenibilidad y Deuda Técnica"
$output += ""
$output += "Generado automáticamente utilizando las fórmulas proporcionadas. Asunciones: Salario = `$20/hr, K = 0.01."
$output += ""
$output += "| Archivo | LOC | Complejidad (G) | MI | Deuda (Horas) | Costo de Reparacion | Payback (Meses) | ROI |"
$output += "|---|---|---|---|---|---|---|---|"

$totalDeuda = 0
$totalCosto = 0

$files = Get-ChildItem -Path "api", "js" -Recurse -Include *.py, *.js
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if (-not $content) { continue }
    
    $loc = ($content -split '\n' | Where-Object { $_.Trim() -ne '' -and -not $_.Trim().StartsWith('#') -and -not $_.Trim().StartsWith('//') }).Count
    if ($loc -eq 0) { continue }
    
    $g = 1 + ([regex]::Matches($content, '(?i)\b(if|for|while|case|catch|and|or|except)\b|\&\&|\|\||\?')).Count
    
    $mi_val = ((171 - 25 * [math]::Log($loc) - 0.23 * $g) / 171) * 100
    if ($mi_val -lt 0) { $mi_val = 0 }
    
    $deuda = (75 - $mi_val) * $loc * $K
    if ($deuda -lt 0) { $deuda = 0 }
    
    $costo = $deuda * $SalarioHora
    
    $meses = $deuda / 160
    
    if ($costo -gt 0) {
        $roi = 100 * ((($InteresAnual * 2) - $costo) / $costo)
    } else {
        $roi = 100
    }
    
    if ($InteresAnual -gt 0) {
        $payback = $costo / $InteresAnual
    } else {
        $payback = 0
    }
    
    $totalDeuda += $deuda
    $totalCosto += $costo
    
    $mi_str = "{0:N2}" -f $mi_val
    $color = if ($mi_val -gt 75) { "V" } elseif ($mi_val -gt 50) { "A" } else { "R" }
    $deuda_str = "{0:N2} hs" -f $deuda
    $costo_str = "${0:N2}" -f $costo
    $payback_str = "{0:N2}" -f ($payback * 12)
    $roi_str = "{0:N2}%" -f $roi
    $relPath = $file.FullName.Replace("H:\Gestor de Finanzas\", "").Replace("\", "/")
    
    $output += "| $($relPath) | $loc | $g | $mi_str $color | $deuda_str | $costo_str | $payback_str | $roi_str |"
}

$output += ""
$output += "Total Deuda Técnica: $(" {0:N2}" -f $totalDeuda) horas"
$output += "Costo Total de Reparacion: `$$(" {0:N2}" -f $totalCosto)"

$output | Out-File "reporte_deuda.md" -Encoding utf8
