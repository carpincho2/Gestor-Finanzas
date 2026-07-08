/* =====================================================
   CUENTAS
   ===================================================== */
let accounts = [];
let selectedAccountId = null;
let editingAccountId = null;

const ACC_TYPE_LABELS = {
  banco: 'Banco', ahorro: 'Ahorro', efectivo: 'Efectivo',
  tarjeta: 'Tarjeta', inversion: 'Inversión', digital: 'Digital', custom: 'Otro'
};

const ACC_TYPE_ICONS = {
  banco: '🏦', ahorro: '🐷', efectivo: '💵',
  tarjeta: '💳', inversion: '📈', digital: '📱', custom: '💼'
};

const ACC_TYPE_COLORS = {
  banco: '#5b8cff', ahorro: '#00e5a0', efectivo: '#ffb84a',
  tarjeta: '#ff6b4a', inversion: '#a78bfa', digital: '#38bdf8', custom: '#64748b'
};

function saveAccounts() {
  if (!IS_SERVER) {
    localStorage.setItem(userKey('flujo_accounts'), JSON.stringify(accounts));
  }
}

function initAccounts() {
  if (accounts.length === 0) {
    saveAccounts();
  }
}

/* ---- Nav entry ---- */
function enterCuentasView() {
  selectedAccountId = accounts.length > 0 ? accounts[0].id : null;
  renderCuentasView();
}

/* ---- Main render ---- */
function renderCuentasView() {
  renderCvWorth();
  renderCvCards();
  renderCvTransferSelects();
  renderCvDetail();
  renderCvTxList();
}

/* Net worth */
function renderCvWorth() {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  document.getElementById('cvNetWorth').textContent = '$' + total.toLocaleString('es-AR');

  document.getElementById('cvWorthBreakdown').innerHTML = accounts.map(a => `
    <div class="cv-worth-chip">
      <div class="cv-worth-chip-dot" style="background:${ACC_TYPE_COLORS[a.type]};"></div>
      <span style="color:var(--muted);">${escHtml(a.name)}</span>
      <span style="color:${a.balance < 0 ? 'var(--danger)' : 'var(--text)'}; font-weight:600;">
        $${a.balance.toLocaleString('es-AR')}
      </span>
    </div>
  `).join('');
}

/* Account cards */
function renderCvCards() {
  const el = document.getElementById('cvCards');

  const cards = accounts.map(a => {
    const color = ACC_TYPE_COLORS[a.type];
    const cls = 'acc-' + a.type;
    const sel = a.id === selectedAccountId ? 'selected' : '';

    // month change
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      const tAccId = t.account_id || t.accountId;
      return (tAccId === a.id) && d.getMonth() === m && d.getFullYear() === y;
    });
    const mInc = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const mExp = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    return `
      <div class="acc-card ${cls} ${sel}" onclick="selectAccount(${a.id})">
        <div class="acc-card-shine"></div>
        <div class="acc-card-actions">
          <button class="acc-action-btn" onclick="event.stopPropagation();openAccModal(${a.id})" title="Editar">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="acc-action-btn" onclick="event.stopPropagation();confirmDeleteAccount(${a.id})" title="Eliminar">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <div class="acc-card-type">${ACC_TYPE_ICONS[a.type]} ${ACC_TYPE_LABELS[a.type]}${a.currency !== 'ARS' ? ' · ' + a.currency : ''}</div>
        <div class="acc-card-name">${escHtml(a.name)}</div>
        <div class="acc-card-bank">${escHtml(a.bank || '—')}</div>
        <div class="acc-card-balance">$${a.balance.toLocaleString('es-AR')}</div>
        <div class="acc-card-change">
          ${a.type === 'tarjeta' && a.limit ? `Disponible: $${(a.limit + a.balance).toLocaleString('es-AR')}` : `Este mes: +$${mInc.toLocaleString('es-AR')} / -$${mExp.toLocaleString('es-AR')}`}
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = cards + `
    <div class="acc-add-card" onclick="openAccModal()">
      <div class="acc-add-icon">+</div>
      <div style="font-size:13px;font-weight:600;">Agregar cuenta</div>
      <div style="font-size:11px;font-family:var(--font-mono);">banco, efectivo, digital…</div>
    </div>
  `;
}

/* Account detail panel */
function renderCvDetail() {
  const el = document.getElementById('cvDetailBody');
  if (!selectedAccountId) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;padding:20px 0;">Seleccioná una cuenta.</div>`;
    return;
  }

  const a = accounts.find(x => x.id === selectedAccountId);
  if (!a) return;

  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  const accTx = transactions.filter(t => (t.account_id || t.accountId) === a.id);
  const monthTx = accTx.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === m && d.getFullYear() === y;
  });

  const totalIn = accTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = accTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthIn = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthOut = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const color = ACC_TYPE_COLORS[a.type];
  const fmt = n => '$' + n.toLocaleString('es-AR');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:44px;height:44px;border-radius:12px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:22px;">
        ${ACC_TYPE_ICONS[a.type]}
      </div>
      <div>
        <div style="font-size:15px;font-weight:800;">${escHtml(a.name)}</div>
        <div style="font-size:11px;font-family:var(--font-mono);color:var(--muted);">${escHtml(a.bank || ACC_TYPE_LABELS[a.type])}</div>
      </div>
    </div>

    <div style="background:${color}12;border:1px solid ${color}30;border-radius:10px;padding:14px 16px;margin-bottom:16px;text-align:center;">
      <div style="font-size:11px;font-family:var(--font-mono);color:${color};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Saldo actual</div>
      <div style="font-size:28px;font-weight:800;letter-spacing:-1.5px;color:${a.balance < 0 ? 'var(--danger)' : color};">
        ${fmt(a.balance)}
      </div>
      ${a.currency !== 'ARS' ? `<div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);margin-top:2px;">${a.currency}</div>` : ''}
    </div>

    ${a.type === 'tarjeta' && a.limit ? `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font-mono);color:var(--muted);margin-bottom:6px;">
          <span>Límite usado</span>
          <span>${fmt(Math.abs(a.balance))} / ${fmt(a.limit)}</span>
        </div>
        <div class="bv-bar-bg">
          <div class="bv-bar-fill" style="width:${Math.min((Math.abs(a.balance) / a.limit) * 100, 100)}%;background:${(Math.abs(a.balance) / a.limit) > 0.8 ? 'var(--danger)' : color};"></div>
        </div>
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);margin-top:4px;text-align:right;">Disponible: ${fmt(a.limit + a.balance)}</div>
      </div>
    ` : ''}

    <div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Ingresos este mes</span>
        <span class="cv-detail-stat-val" style="color:var(--accent);">+${fmt(monthIn)}</span>
      </div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Gastos este mes</span>
        <span class="cv-detail-stat-val" style="color:var(--danger);">${fmt(-monthOut)}</span>
      </div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Total ingresos</span>
        <span class="cv-detail-stat-val" style="color:var(--accent);">+${fmt(totalIn)}</span>
      </div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Total gastos</span>
        <span class="cv-detail-stat-val" style="color:var(--danger);">${fmt(-totalOut)}</span>
      </div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Transacciones</span>
        <span class="cv-detail-stat-val">${accTx.length}</span>
      </div>
      ${a.notes ? `
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Notas</span>
        <span class="cv-detail-stat-val" style="font-weight:400;color:var(--muted);text-align:right;max-width:180px;">${escHtml(a.notes)}</span>
      </div>` : ''}
    </div>

    ${a.type === 'digital' ? `
      <div class="mp-sync-container" id="walletPanel_${a.id}" style="margin-top:16px;padding:14px;border-radius:10px;background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:10px;font-family:var(--font-mono);color:var(--muted);letter-spacing:1px;text-transform:uppercase;">Billetera Virtual</span>
          <span id="walletStatusBadge_${a.id}" style="font-size:9px;padding:2px 8px;border-radius:20px;font-weight:700;letter-spacing:0.5px;"></span>
        </div>

        <!-- Panel OAuth (Recomendado) -->
        <div id="walletOAuthPanel_${a.id}" style="margin-bottom: 4px; padding-bottom: 12px; border-bottom: 1px solid rgba(56,189,248,0.15);">
          <button class="btn" style="width:100%;justify-content:center;background:#009ee3;color:white;font-size:12px;font-weight:600;border:none;padding:10px;" onclick="window.location.href='/api/wallets/mercadopago/connect?account_id=${a.id}'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
            Conectar con Mercado Pago
          </button>
          <div style="font-size:9px;color:var(--muted);text-align:center;margin-top:6px;">Conexión segura y oficial (OAuth 2.0)</div>
        </div>

        <!-- Panel de conexión manual (token) -->
        <div id="walletManualPanel_${a.id}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:10px;font-family:var(--font-mono);color:var(--muted);letter-spacing:1px;text-transform:uppercase;">Enlace Mercado Pago</span>
            <span style="font-size:10px;color:#38bdf8;cursor:pointer;font-weight:600;" onclick="toggleMpTokenVisibility(event)">Mostrar</span>
          </div>
          <div style="display:flex;gap:8px;">
            <input type="password" id="cvMpToken" class="field-input" style="font-family:var(--font-mono);font-size:11px;flex:1;background:var(--surface);" placeholder="Token de acceso (o 'mock-token')" value="">
            <button class="btn btn-ghost" style="padding:9px 12px;font-size:12px;border-color:rgba(56,189,248,0.25);color:var(--text);" onclick="saveMpToken(${a.id})" id="btnSaveMpToken">
              Guardar
            </button>
          </div>
        </div>

        <!-- Botones de sincronización y saldo -->
        <div id="walletSyncPanel_${a.id}" style="display:none;flex-direction:column;gap:6px;">
          <button class="btn" style="justify-content:center;font-size:12px;width:100%;background:#38bdf8;color:#0b0e13;" onclick="syncMercadoPago(${a.id})" id="btnSyncMp_${a.id}">
            <svg class="sync-icon-svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right:4px;transition:transform 0.5s ease;">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span id="syncMpText_${a.id}">Sincronizar Billetera</span>
          </button>
        </div>

        <!-- Última sincronización -->
        <div id="walletLastSync_${a.id}" style="display:none;font-size:10px;font-family:var(--font-mono);color:var(--muted);text-align:center;padding-top:4px;border-top:1px solid rgba(56,189,248,0.1);"></div>

        <!-- Botón desconectar -->
        <div id="walletDisconnectPanel_${a.id}" style="display:none;text-align:center;">
          <button class="btn btn-ghost" style="font-size:10px;color:var(--danger);border-color:rgba(239,68,68,0.2);padding:4px 12px;" onclick="disconnectWallet(${a.id})">
            Desconectar Billetera
          </button>
        </div>
      </div>
    ` : ''}

    <div style="margin-top:16px;display:flex;gap:8px;">
      <button class="btn btn-ghost" style="flex:1;justify-content:center;font-size:12px;" onclick="openAccModal(${a.id})">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar
      </button>
      <button class="btn" style="flex:1;justify-content:center;font-size:12px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);" onclick="openModal()">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Registrar
      </button>
    </div>
  `;

  if (a.type === 'digital') {
    setTimeout(() => loadWalletStatus(a.id), 0);
  }
}

function toggleMpTokenVisibility(e) {
  const input = document.getElementById('cvMpToken');
  const span = e ? e.target : (typeof event !== 'undefined' ? event.target : null);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (span) span.textContent = 'Ocultar';
  } else {
    input.type = 'password';
    if (span) span.textContent = 'Mostrar';
  }
}

async function saveMpToken(accountId) {
  const tokenInput = document.getElementById('cvMpToken');
  if (!tokenInput) return;
  const tokenVal = tokenInput.value.trim();

  const btn = document.getElementById('btnSaveMpToken');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const res = await apiFetchLocal(`/accounts/${accountId}/token`, {
      method: 'PUT',
      body: JSON.stringify({ mp_token: tokenVal })
    });

    if (res && res.ok) {
      showToast('Token de Mercado Pago actualizado');
      // Actualizar localmente el token de la cuenta
      const acc = accounts.find(x => x.id === accountId);
      if (acc) {
        acc.mp_token = tokenVal;
      }
      renderCuentasView();
    } else {
      showToast(res.error || 'Error al guardar el token', true);
    }
  } catch (err) {
    console.error("Error al guardar token:", err);
    showToast('Error al conectar con el servidor', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }
}

async function syncMercadoPago(accountId) {
  const btn = document.getElementById(`btnSyncMp_${accountId}`);
  const text = document.getElementById(`syncMpText_${accountId}`);
  const svg = btn ? btn.querySelector('.sync-icon-svg') : null;

  if (btn) btn.disabled = true;
  if (text) text.textContent = 'Sincronizando...';
  if (svg) svg.classList.add('spin-anim');

  try {
    const res = await apiFetchLocal(`/accounts/${accountId}/sync`, {
      method: 'POST'
    });

    if (res && res.ok) {
      // Actualizar el balance local con el saldo real devuelto por el servidor
      const acc = accounts.find(x => x.id === accountId);
      if (acc && res.balance !== undefined) {
        acc.balance = res.balance;
      }

      const msg = `¡Sincronización exitosa! Importados: ${res.imported_count} movimientos` +
                  (res.skipped_count ? ` (${res.skipped_count} ya existían)` : '') +
                  `\nSaldo actual: $${res.balance?.toLocaleString('es-AR') || '—'}`;
      showToast(msg);
      await loadUserData();
      renderAll();
      renderCuentasView();
    } else {
      showToast(res.error || 'Error en la sincronización', true);
    }
  } catch (err) {
    console.error("Error al sincronizar Mercado Pago:", err);
    showToast('Error de red al sincronizar con Mercado Pago', true);
  } finally {
    if (btn) btn.disabled = false;
    if (text) text.textContent = 'Sincronizar Billetera';
    if (svg) svg.classList.remove('spin-anim');
  }
}



// Modal para saldo inicial de MP
function promptInitialBalance(accountId) {
  const acc = accounts.find(a => a.id === parseInt(accountId));
  if (!acc) return;
  
  // Inject modal into DOM if it doesn't exist (due to cached main.html)
  if (!document.getElementById('mpBalanceModalOverlay')) {
    const modalHtml = `
      <div class="modal-overlay" id="mpBalanceModalOverlay">
        <div class="modal" style="max-width:420px; text-align:center; padding:32px 24px;">
          <div style="width:56px;height:56px;background:rgba(56,189,248,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
            <svg width="28" height="28" fill="none" stroke="#38bdf8" stroke-width="2" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div class="modal-title" style="color:var(--text);font-size:20px;margin-bottom:8px;">¡Conexión Exitosa!</div>
          <div style="font-size:14px;color:var(--muted);margin-bottom:24px;line-height:1.5;">
            Por seguridad, Mercado Pago no nos permite leer tu saldo. Por favor ingresá tu <strong>saldo inicial</strong> para la cuenta <span id="mpBalanceAccName" style="color:var(--text);font-weight:600;"></span>.
          </div>
          <input type="hidden" id="mpBalanceAccId">
          <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:24px;">
            <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:8px;">Saldo actual</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
              <span style="font-size:24px;color:var(--text);font-weight:600;">$</span>
              <input type="number" step="0.01" id="mpBalanceInput" placeholder="0.00" style="background:transparent;border:none;color:var(--text);font-size:32px;font-weight:700;width:150px;text-align:center;outline:none;" onfocus="this.select()">
            </div>
          </div>
          <button class="btn btn-primary" onclick="saveMpBalance()" id="mpBalanceSaveBtn" style="width:100%;justify-content:center;padding:14px;font-size:15px;font-weight:600;">
            Guardar Saldo Inicial
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  setTimeout(() => {
    document.getElementById('mpBalanceAccName').textContent = acc.name;
    document.getElementById('mpBalanceAccId').value = acc.id;
    const input = document.getElementById('mpBalanceInput');
    input.value = acc.balance || '';
    
    document.getElementById('mpBalanceModalOverlay').classList.add('open');
    setTimeout(() => input.focus(), 100);
  }, 100);
}

function closeMpBalanceModal() {
  document.getElementById('mpBalanceModalOverlay').classList.remove('open');
}

function saveMpBalance() {
  const accIdStr = document.getElementById('mpBalanceAccId').value;
  const balanceStr = document.getElementById('mpBalanceInput').value;
  
  const acc = accounts.find(a => a.id === parseInt(accIdStr));
  if (!acc) return;
  
  if (balanceStr.trim() === '') {
    showToast('Por favor, ingresá un monto válido', true);
    return;
  }
  
  const newBalance = parseFloat(balanceStr.replace(',', '.'));
  if (isNaN(newBalance)) {
    showToast('El monto ingresado no es válido', true);
    return;
  }
  
  const btn = document.getElementById('mpBalanceSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  
  acc.balance = newBalance;
  if (IS_SERVER) {
    apiFetch(`/accounts/${acc.id}`, {
      method: 'PUT',
      body: JSON.stringify(acc)
    }).then(() => {
      renderAll();
      closeMpBalanceModal();
      showToast('Saldo inicial guardado correctamente');
      btn.disabled = false;
      btn.textContent = 'Guardar Saldo Inicial';
    }).catch(e => {
      showToast('Error al guardar el saldo: ' + e.message, true);
      btn.disabled = false;
      btn.textContent = 'Guardar Saldo Inicial';
    });
  } else {
    save();
    renderAll();
    closeMpBalanceModal();
    showToast('Saldo inicial guardado correctamente');
    btn.disabled = false;
    btn.textContent = 'Guardar Saldo Inicial';
  }
}

/* ---- Wallet Connection Status ---- */

async function loadWalletStatus(accountId) {
  try {
    const res = await apiFetchLocal(`/wallets/status/${accountId}`);
    if (!res || !res.ok) return;

    const badge = document.getElementById(`walletStatusBadge_${accountId}`);
    const syncPanel = document.getElementById(`walletSyncPanel_${accountId}`);
    const manualPanel = document.getElementById(`walletManualPanel_${accountId}`);
    const lastSyncEl = document.getElementById(`walletLastSync_${accountId}`);
    const disconnectPanel = document.getElementById(`walletDisconnectPanel_${accountId}`);
    const oauthPanel = document.getElementById(`walletOAuthPanel_${accountId}`);

    if (res.connected) {
      // Billetera conectada: ocultar opciones de conexión, mostrar sync/desconectar
      if (badge) {
        badge.textContent = '🟢 CONECTADA';
        badge.style.background = 'rgba(34,197,94,0.12)';
        badge.style.color = '#22c55e';
      }
      if (oauthPanel) oauthPanel.style.display = 'none';
      if (manualPanel) manualPanel.style.display = 'none';
      if (syncPanel) syncPanel.style.display = 'flex';
      if (disconnectPanel) disconnectPanel.style.display = 'block';

      // Mostrar última sincronización
      if (lastSyncEl && res.last_sync_at) {
        const timeAgo = formatTimeAgo(new Date(res.last_sync_at));
        const statusIcon = res.last_sync_status === 'success' ? '✓' : res.last_sync_status === 'error' ? '✗' : '○';
        lastSyncEl.innerHTML = `Última sync: ${timeAgo} ${statusIcon}`;
        lastSyncEl.style.display = 'block';
      }
    } else if (res.status === 'expired') {
      if (badge) {
        badge.textContent = '🟡 EXPIRADA';
        badge.style.background = 'rgba(234,179,8,0.12)';
        badge.style.color = '#eab308';
      }
      if (oauthPanel) oauthPanel.style.display = 'block';
      if (manualPanel) manualPanel.style.display = 'none';
      if (syncPanel) syncPanel.style.display = 'flex';
    } else {
      // No conectada: mostrar opciones de conexión
      if (badge) {
        badge.textContent = '🔴 DESCONECTADA';
        badge.style.background = 'rgba(239,68,68,0.12)';
        badge.style.color = '#ef4444';
      }
      if (oauthPanel) oauthPanel.style.display = 'block';
      if (manualPanel) manualPanel.style.display = 'block';
      if (syncPanel) syncPanel.style.display = 'none';
      if (disconnectPanel) disconnectPanel.style.display = 'none';
    }
  } catch (err) {
    console.error("Error al cargar estado de billetera:", err);
  }
}


async function disconnectWallet(accountId) {
  if (!confirm('¿Estás seguro de desconectar la billetera? Tus transacciones importadas se mantienen.')) return;

  try {
    const res = await apiFetchLocal(`/wallets/mercadopago/disconnect/${accountId}`, {
      method: 'POST'
    });

    if (res && res.ok) {
      showToast('Billetera desconectada');
      const acc = accounts.find(x => x.id === accountId);
      if (acc) acc.mp_token = null;
      renderCuentasView();
    } else {
      showToast(res.error || 'Error al desconectar', true);
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==========================================
//  LIMPIEZA DE DUPLICADOS
// ==========================================
async function cleanupDuplicates() {
  if (!confirm("¿Seguro que querés limpiar los duplicados exactos? Esto dejará solo la transacción original y borrará las copias repetidas.")) {
    return;
  }
  
  try {
    const res = await apiFetch("/transactions/cleanup-duplicates", { method: "POST" });
    showToast(res.message || "Duplicados eliminados.", "success");
    await loadUserData(); // Recargar la lista y cuentas
    if (typeof applyTxFilter === "function") applyTxFilter(); // Refrescar la tabla actual
  } catch (err) {
    showToast("Error al limpiar duplicados: " + err.message, "error");
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'hace unos segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
  return date.toLocaleDateString('es-AR');
}

/* Tx list for selected account */

function renderCvTxList() {
  const el = document.getElementById('cvTxList');

  if (!selectedAccountId) {
    el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Seleccioná una cuenta.</div>`;
    document.getElementById('cvTxPanelTitle').textContent = 'Movimientos';
    document.getElementById('cvTxCount').textContent = '—';
    return;
  }

  const a = accounts.find(x => x.id === selectedAccountId);
  const list = transactions.filter(t => (t.account_id || t.accountId) === selectedAccountId)
    .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

  document.getElementById('cvTxPanelTitle').textContent = a ? `Movimientos — ${a.name}` : 'Movimientos';
  document.getElementById('cvTxCount').textContent = list.length + ' recientes';

  if (list.length === 0) {
    el.innerHTML = `<div style="padding:28px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Sin movimientos en esta cuenta.<br>Registrá una transacción y asignala a esta cuenta.</div>`;
    return;
  }

  el.innerHTML = list.map(t => `
    <div class="cv-tx-item">
      <div class="tx-icon" style="background:${CAT_COLORS[t.cat] || '#ffffff'}22;width:34px;height:34px;font-size:14px;border-radius:8px;flex-shrink:0;">
        ${CAT_ICONS[t.cat] || '📦'}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${escHtml(t.desc)}</div>
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);">${t.cat} · ${formatDate(t.date)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:var(--font-mono);font-weight:700;font-size:13px;" class="${t.type}">
          ${t.type === 'income' ? '+' : '-'}$${t.amount.toLocaleString('es-AR')}
        </div>
      </div>
    </div>
  `).join('');
}

/* Transfer selects */
function renderCvTransferSelects() {
  const fromEl = document.getElementById('cvTransferFrom');
  const toEl = document.getElementById('cvTransferTo');
  const opts = accounts.map(a => `<option value="${a.id}">${ACC_TYPE_ICONS[a.type]} ${escHtml(a.name)} ($${a.balance.toLocaleString('es-AR')})</option>`).join('');
  fromEl.innerHTML = opts;
  toEl.innerHTML = opts;
  if (accounts.length > 1) toEl.selectedIndex = 1;
  initCustomSelects(document.getElementById('cvTransferFrom').parentNode);
  initCustomSelects(document.getElementById('cvTransferTo').parentNode);
}

function swapTransfer() {
  const f = document.getElementById('cvTransferFrom');
  const t = document.getElementById('cvTransferTo');
  [f.value, t.value] = [t.value, f.value];
  updateCustomSelectDisplay(f);
  updateCustomSelectDisplay(t);
}

async function doTransfer() {
  const fromId = parseInt(document.getElementById('cvTransferFrom').value);
  const toId = parseInt(document.getElementById('cvTransferTo').value);
  const amount = parseFloat(document.getElementById('cvTransferAmount').value);
  const desc = document.getElementById('cvTransferDesc').value.trim() || 'Transferencia';

  if (fromId === toId) { showToast('⚠️ Seleccioná cuentas distintas', true); return; }
  if (!amount || amount <= 0) { showToast('⚠️ Ingresá un monto válido', true); return; }

  const fromAcc = accounts.find(x => x.id === fromId);
  const toAcc = accounts.find(x => x.id === toId);
  if (!fromAcc || !toAcc) return;

  if (IS_SERVER) {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const linkId = Date.now();
      
      await apiFetchLocal('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: fromId,
          type: 'expense',
          desc: `${desc} → ${toAcc.name}`,
          amount,
          cat: 'Otros',
          date: dateStr,
          transfer_id: linkId
        })
      });
      
      await apiFetchLocal('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: toId,
          type: 'income',
          desc: `${desc} ← ${fromAcc.name}`,
          amount,
          cat: 'Otros',
          date: dateStr,
          transfer_id: linkId
        })
      });
      
      await loadUserData();
      
      document.getElementById('cvTransferAmount').value = '';
      document.getElementById('cvTransferDesc').value = '';
      renderCuentasView();
      showToast(`✅ Transferidos $${amount.toLocaleString('es-AR')} de ${fromAcc.name} a ${toAcc.name}`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error al realizar la transferencia en el servidor', true);
    }
  } else {
    fromAcc.balance -= amount;
    toAcc.balance += amount;
    saveAccounts();

    const dateStr = new Date().toISOString().split('T')[0];
    const linkId = Date.now();
    transactions.unshift({ id: linkId, type: 'expense', desc: `${desc} → ${toAcc.name}`, amount, cat: 'Otros', date: dateStr, accountId: fromId, transferId: linkId });
    transactions.unshift({ id: linkId + 1, type: 'income', desc: `${desc} ← ${fromAcc.name}`, amount, cat: 'Otros', date: dateStr, accountId: toId, transferId: linkId });
    save();

    document.getElementById('cvTransferAmount').value = '';
    document.getElementById('cvTransferDesc').value = '';

    renderCuentasView();
    showToast(`✅ Transferidos $${amount.toLocaleString('es-AR')} de ${fromAcc.name} a ${toAcc.name}`);
  }
}

function selectAccount(id) {
  selectedAccountId = id;
  renderCvCards();
  renderCvDetail();
  renderCvTxList();
}

/* ---- Account Modal ---- */
function openAccModal(id) {
  editingAccountId = id || null;
  document.getElementById('amLimitWrap').style.display = 'none';

  if (id) {
    const a = accounts.find(x => x.id === id);
    if (!a) return;
    document.getElementById('accModalTitle').textContent = 'Editar Cuenta';
    document.getElementById('amSaveBtn').textContent = 'Guardar cambios';
    document.getElementById('amName').value = a.name;
    document.getElementById('amType').value = a.type;
    updateCustomSelectDisplay(document.getElementById('amType'));
    document.getElementById('amBank').value = a.bank || '';
    document.getElementById('amBalance').value = a.balance;
    document.getElementById('amCurrency').value = a.currency || 'ARS';
    document.getElementById('amNotes').value = a.notes || '';
    if (a.type === 'tarjeta') {
      document.getElementById('amLimitWrap').style.display = '';
      document.getElementById('amLimit').value = a.limit || 0;
    }
  } else {
    document.getElementById('accModalTitle').textContent = 'Nueva Cuenta';
    document.getElementById('amSaveBtn').textContent = 'Crear Cuenta';
    document.getElementById('amName').value = '';
    document.getElementById('amType').value = 'banco';
    updateCustomSelectDisplay(document.getElementById('amType'));
    document.getElementById('amBank').value = '';
    document.getElementById('amBalance').value = '';
    document.getElementById('amCurrency').value = 'ARS';
    document.getElementById('amNotes').value = '';
    document.getElementById('amLimit').value = '';
  }
  document.getElementById('accModalOverlay').classList.add('open');
}

function onAmTypeChange() {
  const t = document.getElementById('amType').value;
  document.getElementById('amLimitWrap').style.display = t === 'tarjeta' ? '' : 'none';
}

function closeAccModal(e) {
  if (!e || e.target.id === 'accModalOverlay') {
    document.getElementById('accModalOverlay').classList.remove('open');
    editingAccountId = null;
  }
}

async function saveAccount() {
  const name = document.getElementById('amName').value.trim();
  const type = document.getElementById('amType').value;
  const bank = document.getElementById('amBank').value.trim();
  const balance = parseFloat(document.getElementById('amBalance').value) || 0;
  const currency = document.getElementById('amCurrency').value;
  const limit = parseFloat(document.getElementById('amLimit').value) || 0;
  const notes = document.getElementById('amNotes').value.trim();

  if (!name) { showToast('⚠️ Ingresá un nombre para la cuenta', true); return; }

  const payload = { name, type, bank, balance, currency, limit, notes };

  if (IS_SERVER) {
    try {
      if (editingAccountId) {
        const res = await apiFetchLocal(`/accounts/${editingAccountId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          const idx = accounts.findIndex(x => x.id === editingAccountId);
          if (idx > -1) {
            accounts[idx] = res.account;
            renderCuentasView();
            showToast('✏️ Cuenta actualizada');
          }
        }
      } else {
        const res = await apiFetchLocal('/accounts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          accounts.push(res.account);
          selectedAccountId = res.account.id;
          renderCuentasView();
          showToast('✅ Cuenta creada');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error al guardar en el servidor', true);
    }
  } else {
    if (editingAccountId) {
      const idx = accounts.findIndex(x => x.id === editingAccountId);
      if (idx > -1) {
        accounts[idx] = { ...accounts[idx], name, type, bank, balance, currency, limit, notes };
        saveAccounts();
        renderCuentasView();
        showToast('✏️ Cuenta actualizada');
      }
    } else {
      const newA = { id: Date.now(), name, type, bank, balance, currency, limit, notes };
      accounts.push(newA);
      selectedAccountId = newA.id;
      saveAccounts();
      renderCuentasView();
      showToast('✅ Cuenta creada');
    }
  }
  closeAccModal();
}

/* ---- Delete ---- */
function confirmDeleteAccount(id) {
  editingAccountId = id;
  const a = accounts.find(x => x.id === id);
  document.getElementById('adName').textContent = a ? a.name : '';
  document.getElementById('accDeleteOverlay').classList.add('open');
}

function closeAccDeleteModal(e) {
  if (!e || e.target.id === 'accDeleteOverlay') {
    document.getElementById('accDeleteOverlay').classList.remove('open');
    editingAccountId = null;
  }
}

async function doDeleteAccount() {
  if (IS_SERVER) {
    try {
      const res = await apiFetchLocal(`/accounts/${editingAccountId}`, {
        method: 'DELETE'
      });
      if (res && res.ok) {
        // En lugar de mutar localmente, recargamos la data real del servidor
        // para que desaparezcan las transacciones que el backend eliminó en cascada
        await loadUserData();
        
        if (selectedAccountId === editingAccountId) selectedAccountId = accounts[0]?.id || null;
        renderCuentasView();
        renderAll();
        showToast('🗑️ Cuenta eliminada');
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error al eliminar en el servidor', true);
    }
  } else {
    accounts = accounts.filter(x => x.id !== editingAccountId);
    if (selectedAccountId === editingAccountId) selectedAccountId = accounts[0]?.id || null;
    saveAccounts();
    renderCuentasView();
    showToast('🗑️ Cuenta eliminada');
  }
  closeAccDeleteModal();
}

