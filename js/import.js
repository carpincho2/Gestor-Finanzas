import { state, IS_SERVER, API_BASE, userKey } from './store/store.js';
import { showToast, formatCurrency } from './utils/utils.js';
import { apiFetch } from './api/apiClient.js';
// (Imports cruzados inyectados por refactor)

/* =====================================================
   IMPORT EXCEL/CSV
   ===================================================== */
let importTargetAccountId = null;
let importRawRows = [];
let importHeaders = [];

function openImportModal(accountId) {
  importTargetAccountId = accountId;
  if (!document.getElementById('importModalOverlay')) {
    injectImportModal();
  }
  
  const fileInput = document.getElementById('importFileInput');
  if (fileInput) fileInput.value = '';
  
  document.getElementById('importPreviewArea').style.display = 'none';
  document.getElementById('importFileSelectArea').style.display = 'block';
  document.getElementById('importModalOverlay').classList.add('open');
}

function closeImportModal() {
  document.getElementById('importModalOverlay').classList.remove('open');
}

function injectImportModal() {
  const html = `
    <div class="modal-overlay" id="importModalOverlay">
      <div class="modal" style="max-width:800px; width:90%; padding:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h2 style="margin:0;font-size:20px;">Importar Movimientos</h2>
          <button onclick="closeImportModal()" style="background:transparent;border:none;color:var(--text);font-size:20px;cursor:pointer;">×</button>
        </div>
        
        <div id="importFileSelectArea" style="text-align:center; padding:40px 20px; border:2px dashed var(--border); border-radius:12px; margin-bottom:20px;">
          <svg width="40" height="40" fill="none" stroke="var(--primary)" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom:16px;margin:auto;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          <div style="margin-bottom:16px; color:var(--text);">Seleccioná tu archivo Excel (.xlsx) o CSV descargado del banco</div>
          <input type="file" id="importFileInput" accept=".xlsx, .csv" style="display:none;" onchange="handleImportFileSelect(event)">
          <div style="display:flex;justify-content:center;">
             <button class="btn btn-primary" onclick="document.getElementById('importFileInput').click()" style="justify-content:center;">Seleccionar Archivo</button>
          </div>
        </div>
        
        <div id="importPreviewArea" style="display:none;">
          <div style="margin-bottom:16px;font-size:14px;color:var(--muted);">
            Identificamos estas columnas. Por favor, indicá cuál corresponde a cada dato.
          </div>
          
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-bottom:16px;">
            <div>
              <label class="field-label">Fecha</label>
              <select class="field-select" id="importColDate"></select>
            </div>
            <div>
              <label class="field-label">Descripción</label>
              <select class="field-select" id="importColDesc"></select>
            </div>
            <div>
              <label class="field-label">Monto</label>
              <select class="field-select" id="importColAmount"></select>
            </div>
            <div>
              <label class="field-label">Categoría (Opcional)</label>
              <select class="field-select" id="importColCat"></select>
            </div>
          </div>
          
          <div style="max-height:250px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; margin-bottom:16px;">
            <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;" id="importPreviewTable">
              <thead style="background:var(--surface2); position:sticky; top:0; z-index:1;">
                <tr id="importPreviewHead"></tr>
              </thead>
              <tbody id="importPreviewBody"></tbody>
            </table>
          </div>
          
          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn btn-ghost" onclick="document.getElementById('importFileSelectArea').style.display='block'; document.getElementById('importPreviewArea').style.display='none';">Atrás</button>
            <button class="btn btn-primary" onclick="executeImport()" id="executeImportBtn">Importar Transacciones</button>
          </div>
        </div>
        
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function handleImportFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  
  if (isCsv) {
    if (typeof Papa === 'undefined') {
      showToast("Error: El parser de CSV no cargó correctamente", true);
      return;
    }
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: function(results) {
        processImportData(results.data);
      },
      error: function(err) {
        console.error(err);
        showToast("Error leyendo CSV", true);
      }
    });
  } else {
    if (typeof ExcelJS === 'undefined') {
      showToast("Error: El parser de Excel no cargó correctamente", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target.result;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.worksheets[0];
        
        let rows = [];
        ws.eachRow((row, rowNumber) => {
          let r = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            r.push(cell.value != null ? cell.value : '');
          });
          rows.push(r);
        });
        processImportData(rows);
      } catch (err) {
        console.error(err);
        showToast("Error leyendo Excel", true);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function processImportData(data) {
  if (!data || data.length < 2) {
    showToast("El archivo está vacío o no tiene suficientes filas", true);
    return;
  }
  
  // Limpiar y estandarizar
  importRawRows = data.filter(row => row.some(cell => cell && String(cell).trim() !== ''));
  
  // Asumimos que la primera fila es encabezado
  importHeaders = importRawRows[0].map((h, i) => h ? String(h).trim() : \`Columna \${i+1}\`);
  
  buildMappingUI();
  
  document.getElementById('importFileSelectArea').style.display = 'none';
  document.getElementById('importPreviewArea').style.display = 'block';
}

function buildMappingUI() {
  const selects = ['importColDate', 'importColDesc', 'importColAmount', 'importColCat'];
  
  selects.forEach(selId => {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">-- Ignorar --</option>';
    importHeaders.forEach((h, i) => {
      sel.innerHTML += \`<option value="\${i}">\${h}</option>\`;
    });
  });
  
  // Auto-detect based on headers
  importHeaders.forEach((h, i) => {
    const hl = h.toLowerCase();
    if (hl.includes('fecha') || hl.includes('date')) document.getElementById('importColDate').value = i;
    else if (hl.includes('desc') || hl.includes('concepto') || hl.includes('detalle')) document.getElementById('importColDesc').value = i;
    else if (hl.includes('monto') || hl.includes('importe') || hl.includes('amount')) document.getElementById('importColAmount').value = i;
    else if (hl.includes('cat') || hl.includes('rubro')) document.getElementById('importColCat').value = i;
  });
  
  // Build preview table (first 5 rows)
  const headTr = document.getElementById('importPreviewHead');
  headTr.innerHTML = importHeaders.map(h => \`<th style="padding:8px; border-bottom:1px solid var(--border);">\${escHtml(h)}</th>\`).join('');
  
  const body = document.getElementById('importPreviewBody');
  body.innerHTML = importRawRows.slice(1, 6).map(row => {
    return '<tr>' + importHeaders.map((_, i) => \`<td style="padding:8px; border-bottom:1px solid var(--border);">\${escHtml(String(row[i] || ''))}</td>\`).join('') + '</tr>';
  }).join('');
}

async function executeImport() {
  const colDate = document.getElementById('importColDate').value;
  const colDesc = document.getElementById('importColDesc').value;
  const colAmount = document.getElementById('importColAmount').value;
  const colCat = document.getElementById('importColCat').value;
  
  if (colDate === '' || colDesc === '' || colAmount === '') {
    showToast("Fecha, Descripción y Monto son obligatorios", true);
    return;
  }
  
  const btn = document.getElementById('executeImportBtn');
  btn.disabled = true;
  btn.textContent = 'Importando...';
  
  let txsToCreate = [];
  
  // Procesar filas (saltar header)
  for (let i = 1; i < importRawRows.length; i++) {
    const row = importRawRows[i];
    
    let rawDate = row[colDate];
    let rawDesc = row[colDesc];
    let rawAmount = row[colAmount];
    let rawCat = colCat !== '' ? row[colCat] : '';
    
    if (!rawDate || !rawAmount) continue;
    
    let parsedDate = null;
    if (rawDate instanceof Date) {
      parsedDate = rawDate.toISOString().split('T')[0];
    } else {
      let dStr = String(rawDate).trim();
      let parts = dStr.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          parsedDate = \`\${parts[2]}-\${parts[1].padStart(2,'0')}-\${parts[0].padStart(2,'0')}\`;
        } else if (parts[0].length === 4) {
          parsedDate = \`\${parts[0]}-\${parts[1].padStart(2,'0')}-\${parts[2].padStart(2,'0')}\`;
        }
      }
      if (!parsedDate) parsedDate = new Date().toISOString().split('T')[0];
    }
    
    let amountStr = String(rawAmount).replace(/[^0-9.,-]/g, '');
    let parsedAmount = 0;
    const lastComma = amountStr.lastIndexOf(',');
    const lastDot = amountStr.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      amountStr = amountStr.replace(/\\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      amountStr = amountStr.replace(/,/g, '');
    } else if (lastComma > -1 && lastDot === -1) {
      amountStr = amountStr.replace(',', '.');
    }
    
    parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount) || parsedAmount === 0) continue;
    
    const type = parsedAmount > 0 ? 'income' : 'expense';
    
    txsToCreate.push({
      account_id: importTargetAccountId,
      type: type,
      desc: String(rawDesc).trim() || 'Importación',
      amount: Math.abs(parsedAmount),
      cat: String(rawCat).trim() || 'Varios',
      date: parsedDate
    });
  }
  
  if (txsToCreate.length === 0) {
    showToast("No se encontraron transacciones válidas", true);
    btn.disabled = false;
    btn.textContent = 'Importar Transacciones';
    return;
  }
  
  if (IS_SERVER) {
    try {
      const res = await apiFetch('/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify(txsToCreate)
      });
      if (res && res.ok) {
        showToast(\`Se importaron \${txsToCreate.length} transacciones\`);
        closeImportModal();
        await loadUserData();
        renderAll();
        renderCuentasView();
      }
    } catch (e) {
      showToast("Error en importación: " + e.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Importar Transacciones';
    }
  } else {
    txsToCreate.forEach(tx => {
      const newTx = { ...tx, id: Date.now() + Math.floor(Math.random()*1000) };
      state.transactions.push(newTx);
      
      const acc = state.accounts.find(a => a.id === importTargetAccountId);
      if (acc) {
        if (newTx.type === 'income') acc.balance += newTx.amount;
        else acc.balance -= newTx.amount;
      }
    });
    save();
    showToast(\`Se importaron \${txsToCreate.length} transacciones (Local)\`);
    closeImportModal();
    renderAll();
    renderCuentasView();
    btn.disabled = false;
    btn.textContent = 'Importar Transacciones';
  }
}


// --- WINDOW ATTACHMENTS ---
window.closeImportModal = closeImportModal;
window.executeImport = executeImport;
window.openImportModal = openImportModal;
window.injectImportModal = injectImportModal;
window.buildMappingUI = buildMappingUI;
window.handleImportFileSelect = handleImportFileSelect;
window.processImportData = processImportData;
