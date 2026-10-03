// @ts-nocheck
import { state, IS_SERVER, API_BASE, userKey } from './store/store.ts';
import { showToast, formatCurrency, escHtml, getCurrencySymbol, formatMoney } from './utils/utils.ts';
import { apiFetch } from './api/apiClient.ts';
import { accountService } from './services/accountService.ts';
// (Imports cruzados inyectados por refactor)

/* =====================================================
   CUENTAS
   ===================================================== */

let selectedAccountId = null;
let editingAccountId = null;
let reconcilingAccountId = null;
let accountsFilterTab = 'active'; // 'active', 'archived', 'all'
let accountSearchQuery = '';
let accountTxSearchQuery = '';
let showConsolidatedNetWorth = false;
let cachedRates = { blue: 1350, eur: 1450 };

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
  accountService.saveAccounts();
}

function initAccounts() {
  accountService.initAccounts();
}

/* ---- Nav entry ---- */
function enterCuentasView() {
  const activeAccs = state.accounts.filter(a => !a.is_archived);
  selectedAccountId = activeAccs.length > 0 ? activeAccs[0].id : (state.accounts.length > 0 ? state.accounts[0].id : null);
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
async function renderCvWorth() {
  const elTotal = document.getElementById('cvNetWorth');
  const btnToggle = document.getElementById('cvToggleConsolidatedBtn');
  if (!elTotal) return;

  const arsTotal = state.accounts.filter(a => !a.is_archived && (a.currency || 'ARS') === 'ARS').reduce((s, a) => s + a.balance, 0);
  const usdTotal = state.accounts.filter(a => !a.is_archived && a.currency === 'USD').reduce((s, a) => s + a.balance, 0);
  const eurTotal = state.accounts.filter(a => !a.is_archived && a.currency === 'EUR').reduce((s, a) => s + a.balance, 0);

  if (showConsolidatedNetWorth) {
    if (cachedRates.blue === 1350) {
      try {
        const rateUSD = await accountService.getSuggestedExchangeRate('USD', 'ARS');
        if (rateUSD && rateUSD.rate) cachedRates.blue = rateUSD.rate;
        const rateEUR = await accountService.getSuggestedExchangeRate('EUR', 'ARS');
        if (rateEUR && rateEUR.rate) cachedRates.eur = rateEUR.rate;
      } catch (e) {
        console.warn('Usando cotizaciones de referencia:', e);
      }
    }
    const consolidatedARS = arsTotal + (usdTotal * cachedRates.blue) + (eurTotal * cachedRates.eur);
    elTotal.innerHTML = `≈ $${Math.round(consolidatedARS).toLocaleString('es-AR')} <span style="font-size:14px;color:var(--muted);font-weight:400;">ARS (Estimado)</span>`;
    if (btnToggle) btnToggle.textContent = '💵 Mostrar Desglose por Moneda';
  } else {
    let netWorthText = '$' + arsTotal.toLocaleString('es-AR');
    const extras = [];
    if (usdTotal !== 0) extras.push(`US$ ${usdTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    if (eurTotal !== 0) extras.push(`€ ${eurTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    if (extras.length > 0) {
      netWorthText += ` + ${extras.join(' + ')}`;
    }
    elTotal.textContent = netWorthText;
    if (btnToggle) btnToggle.textContent = '💱 Mostrar Estimado Consolidado ARS';
  }

  const breakdownEl = document.getElementById('cvWorthBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = state.accounts.filter(a => !a.is_archived).map(a => `
      <div class="cv-worth-chip">
        <div class="cv-worth-chip-dot" style="background:${a.color || ACC_TYPE_COLORS[a.type] || '#5b8cff'};"></div>
        <span style="color:var(--muted);">${escHtml(a.name)}${a.is_favorite ? ' ⭐' : ''}</span>
        <span style="color:${a.balance < 0 ? 'var(--danger)' : 'var(--text)'}; font-weight:600;">
          ${formatMoney(a.balance, a.currency || 'ARS')}
        </span>
      </div>
    `).join('');
  }
}

function toggleConsolidatedNetWorth() {
  showConsolidatedNetWorth = !showConsolidatedNetWorth;
  renderCvWorth();
}

function setAccountsFilterTab(tab) {
  accountsFilterTab = tab;
  ['tabAccountsActive', 'tabAccountsArchived', 'tabAccountsAll'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const activeBtn = document.getElementById('tabAccounts' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (activeBtn) activeBtn.classList.add('active');
  renderCvCards();
}

function onAccountSearchChanged() {
  const input = document.getElementById('cvAccountSearch');
  accountSearchQuery = input ? input.value : '';
  renderCvCards();
}

function onAccountTxSearchChanged() {
  const input = document.getElementById('cvTxSearch');
  accountTxSearchQuery = input ? input.value : '';
  renderCvTxList();
}

/* Account cards */
function renderCvCards() {
  const el = document.getElementById('cvCards');
  if (!el) return;

  let filtered = state.accounts.slice();

  // Filter tab
  if (accountsFilterTab === 'active') {
    filtered = filtered.filter(a => !a.is_archived);
  } else if (accountsFilterTab === 'archived') {
    filtered = filtered.filter(a => !!a.is_archived);
  }

  // Search query
  if (accountSearchQuery.trim()) {
    const q = accountSearchQuery.toLowerCase();
    filtered = filtered.filter(a => 
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.bank && a.bank.toLowerCase().includes(q)) ||
      (a.alias && a.alias.toLowerCase().includes(q)) ||
      (a.cbu && a.cbu.toLowerCase().includes(q))
    );
  }

  // Sort favorites first
  filtered.sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return 0;
  });

  const cards = filtered.map(a => {
    const color = a.color || ACC_TYPE_COLORS[a.type] || '#5b8cff';
    const icon = a.icon || ACC_TYPE_ICONS[a.type] || '🏦';
    const cls = 'acc-' + a.type;
    const sel = a.id === selectedAccountId ? 'selected' : '';

    // month change
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const monthTx = state.transactions.filter(t => {
      const d = new Date(t.date);
      const tAccId = t.account_id || t.accountId;
      return (tAccId === a.id) && d.getMonth() === m && d.getFullYear() === y;
    });
    const mInc = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const mExp = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const customCardStyle = a.color ? `background: linear-gradient(135deg, ${a.color}25 0%, ${a.color}50 100%); border-color: ${a.color}50;` : '';

    let cardFooter = `Este mes: +${formatMoney(mInc, a.currency || 'ARS')} / -${formatMoney(mExp, a.currency || 'ARS')}`;
    if (a.type === 'tarjeta') {
      const disp = a.limit ? `Disponible: ${formatMoney(a.limit + a.balance, a.currency || 'ARS')}` : '';
      const dates = (a.closing_day || a.due_day) ? ` · Cierre: día ${a.closing_day || '—'} / Vence: día ${a.due_day || '—'}` : '';
      cardFooter = disp ? (disp + dates) : (dates || cardFooter);
    }

    return `
      <div class="acc-card ${cls} ${sel}" style="${customCardStyle}" onclick="selectAccount(${a.id})">
        <div class="acc-card-shine"></div>
        ${a.is_favorite ? '<div class="acc-card-star-badge" title="Cuenta Favorita">⭐</div>' : ''}
        ${a.is_archived ? '<div class="acc-card-archived-badge" title="Cuenta Archivada">Archivada</div>' : ''}
        <div class="acc-card-actions">
          <button class="acc-action-btn" onclick="event.stopPropagation();toggleAccountFavorite(${a.id})" title="${a.is_favorite ? 'Quitar favorita' : 'Fijar favorita'}">
            ${a.is_favorite ? '★' : '☆'}
          </button>
          <button class="acc-action-btn" onclick="event.stopPropagation();openAccModal(${a.id})" title="Editar">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="acc-action-btn" onclick="event.stopPropagation();toggleAccountArchive(${a.id})" title="${a.is_archived ? 'Desarchivar' : 'Archivar'}">
            ${a.is_archived ? '📂' : '📦'}
          </button>
          <button class="acc-action-btn" onclick="event.stopPropagation();confirmDeleteAccount(${a.id})" title="Eliminar">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <div class="acc-card-type">${icon} ${ACC_TYPE_LABELS[a.type] || 'Cuenta'}${a.currency !== 'ARS' ? ' · ' + a.currency : ''}</div>
        <div class="acc-card-name">${escHtml(a.name)}</div>
        <div class="acc-card-bank">${escHtml(a.bank || (a.alias ? '@' + a.alias : '—'))}</div>
        <div class="acc-card-balance" style="${a.color ? `color: ${a.color};` : ''}">${formatMoney(a.balance, a.currency || 'ARS')}</div>
        <div class="acc-card-change">
          ${cardFooter}
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = cards + `
    <div class="acc-add-card" onclick="openAccModal()">
      <div class="acc-add-icon">+</div>
      <div style="font-size:13px;font-weight:600;">Agregar cuenta</div>
      <div style="font-size:11px;font-family:var(--font-mono);">banco, efectivo, digital, tarjeta…</div>
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

  const a = state.accounts.find(x => x.id === selectedAccountId);
  if (!a) return;

  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  const accTx = state.transactions.filter(t => (t.account_id || t.accountId) === a.id);
  const monthTx = accTx.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === m && d.getFullYear() === y;
  });

  const totalIn = accTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = accTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthIn = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthOut = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const color = ACC_TYPE_COLORS[a.type];
  const fmt = n => formatMoney(n, a.currency || 'ARS');

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
        ${formatMoney(a.balance, a.currency || 'ARS')}
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

    ${(a.alias || a.cbu) ? `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px;">
        ${a.alias ? `
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:11px;font-family:var(--font-mono);color:var(--muted);">Alias: <strong style="color:var(--text);">${escHtml(a.alias)}</strong></span>
            <button type="button" class="cv-copy-btn" onclick="copyAccountData('${escHtml(a.alias)}', 'Alias')">📋 Copiar</button>
          </div>
        ` : ''}
        ${a.cbu ? `
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:11px;font-family:var(--font-mono);color:var(--muted);">CBU/CVU: <strong style="color:var(--text);">${escHtml(a.cbu)}</strong></span>
            <button type="button" class="cv-copy-btn" onclick="copyAccountData('${escHtml(a.cbu)}', 'CBU/CVU')">📋 Copiar</button>
          </div>
        ` : ''}
      </div>
    ` : ''}

    ${a.type === 'tarjeta' ? `
      ${(a.closing_day || a.due_day) ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;font-size:11px;font-family:var(--font-mono);">
          <span>📅 Cierre: <strong>Día ${a.closing_day || '—'}</strong></span>
          <span>⏰ Vence: <strong>Día ${a.due_day || '—'}</strong></span>
        </div>
      ` : ''}
      ${a.balance < 0 ? `
        <button class="btn" style="width:100%;justify-content:center;background:rgba(255,74,107,0.15);border:1px solid rgba(255,74,107,0.3);color:#ff4a6b;font-size:12px;font-weight:600;margin-bottom:12px;padding:10px;" onclick="quickPayCreditCard(${a.id})">
          💳 Pagar Resumen (${fmt(Math.abs(a.balance))})
        </button>
      ` : ''}
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

    <div style="margin-top:14px;display:flex;gap:6px;flex-wrap:wrap;">
      <button class="btn btn-ghost" style="flex:1;justify-content:center;font-size:11px;padding:7px;" onclick="openAccReconcileModal(${a.id})" title="Conciliar y ajustar saldo">
        ⚡ Conciliar
      </button>
      <button class="btn btn-ghost" style="flex:1;justify-content:center;font-size:11px;padding:7px;" onclick="toggleAccountFavorite(${a.id})" title="${a.is_favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}">
        ${a.is_favorite ? '⭐ Favorita' : '☆ Favorita'}
      </button>
      <button class="btn btn-ghost" style="flex:1;justify-content:center;font-size:11px;padding:7px;" onclick="toggleAccountArchive(${a.id})" title="${a.is_archived ? 'Desarchivar cuenta' : 'Archivar cuenta'}">
        ${a.is_archived ? '📂 Desarchivar' : '📦 Archivar'}
      </button>
    </div>

    ${a.type === 'digital' ? `
      <div class="mp-sync-container" id="walletPanel_${a.id}" style="margin-top:16px;padding:14px;border-radius:10px;background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15);display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:10px;font-family:var(--font-mono);color:var(--muted);letter-spacing:1px;text-transform:uppercase;">Billetera Virtual</span>
          <span id="walletStatusBadge_${a.id}" style="font-size:9px;padding:2px 8px;border-radius:20px;font-weight:700;letter-spacing:0.5px;"></span>
        </div>

        <!-- Panel OAuth (Recomendado) -->
        <div id="walletOAuthPanel_${a.id}" style="margin-bottom: 4px; padding-bottom: 12px; border-bottom: 1px solid rgba(56,189,248,0.15); display:flex; flex-direction:column; gap:8px;">
          <button class="btn" style="width:100%;justify-content:center;background:#009ee3;color:white;font-size:12px;font-weight:600;border:none;padding:10px;" onclick="window.location.href='/api/wallets/mercadopago/connect?account_id=${a.id}'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
            Conectar Mercado Pago
          </button>
          <button class="btn" style="width:100%;justify-content:center;background:#111111;color:white;font-size:12px;font-weight:600;border:none;padding:10px;" onclick="window.location.href='/api/wallets/plaid/connect?account_id=${a.id}'">
            Conectar Plaid (Bancos EE.UU./Europa)
          </button>
          <button class="btn" style="width:100%;justify-content:center;background:#440099;color:white;font-size:12px;font-weight:600;border:none;padding:10px;" onclick="window.location.href='/api/wallets/belvo/connect?account_id=${a.id}'">
            Conectar Belvo (Bancos LatAm)
          </button>
          <div style="font-size:9px;color:var(--muted);text-align:center;margin-top:2px;">Conexión segura mediante Router Multiproveedor</div>
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
          <button class="btn" style="justify-content:center;font-size:12px;width:100%;background:#38bdf8;color:#0b0e13;" onclick="syncWallet(${a.id})" id="btnSyncWallet_${a.id}">
            <svg class="sync-icon-svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right:4px;transition:transform 0.5s ease;">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span id="syncWalletText_${a.id}">Sincronizar Billetera</span>
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
    <div style="margin-top:8px;">
      <button class="btn" style="width:100%;justify-content:center;font-size:12px;background:var(--surface2);border:1px solid var(--border);color:var(--text);" onclick="if(typeof openImportModal === 'function') openImportModal(${a.id})">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        Importar Excel / CSV
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
    const res = await accountService.saveMpToken(accountId, tokenVal);
    if (res && res.ok) {
      showToast('Token de Mercado Pago actualizado');
      renderCuentasView();
      if (window.currentPage === 'transacciones' && typeof renderTxView === 'function') renderTxView();
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

async function syncWallet(accountId) {
  const btn = document.getElementById(`btnSyncWallet_${accountId}`);
  const text = document.getElementById(`syncWalletText_${accountId}`);
  const svg = btn ? btn.querySelector('.sync-icon-svg') : null;

  if (btn) btn.disabled = true;
  if (text) text.textContent = 'Sincronizando...';
  if (svg) svg.classList.add('spin-anim');

  try {
    const res = await accountService.syncWallet(accountId);
    if (res && res.ok) {
      const msg = `¡Sincronización exitosa! Importados: ${res.imported_count} movimientos` +
                  (res.skipped_count ? ` (${res.skipped_count} ya existían)` : '') +
                  `\nSaldo actual: ${res.balance?.toLocaleString('es-AR') || '—'}`;
      showToast(msg);
      await loadUserData();
      if (typeof renderAll === 'function') renderAll();
      renderCuentasView();
      if (window.currentPage === 'transacciones' && typeof renderTxView === 'function') renderTxView();
    } else {
      showToast(res.error || 'Error en la sincronización', true);
    }
  } catch (err) {
    console.error("Error al sincronizar billetera:", err);
    showToast('Error de red al sincronizar con la billetera', true);
  } finally {
    if (btn) btn.disabled = false;
    if (text) text.textContent = 'Sincronizar Billetera';
    if (svg) svg.classList.remove('spin-anim');
  }
}



// Modal para saldo inicial de MP
function promptInitialBalance(accountId) {
  const acc = state.accounts.find(a => a.id === parseInt(accountId));
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
              <input type="text" inputmode="decimal" id="mpBalanceInput" placeholder="0,00" style="background:transparent;border:none;color:var(--text);font-size:32px;font-weight:700;width:150px;text-align:center;outline:none;" onfocus="this.select()" oninput="formatMpBalanceInput(this)" onkeydown="if(event.key === 'Enter') saveMpBalance()">
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
    // Si ya tiene balance, formatearlo para mostrar
    if (acc.balance) {
      let valStr = String(acc.balance).replace('.', ',');
      input.value = valStr;
      formatMpBalanceInput(input);
    } else {
      input.value = '';
    }
    
    document.getElementById('mpBalanceModalOverlay').classList.add('open');
    setTimeout(() => input.focus(), 100);
  }, 100);
}

function formatMpBalanceInput(el) {
  let val = el.value;
  // Permitir solo números y coma
  val = val.replace(/[^0-9,]/g, '');
  // Evitar más de una coma
  const parts = val.split(',');
  if (parts.length > 2) {
    val = parts[0] + ',' + parts.slice(1).join('');
  }
  
  // Formatear la parte entera con puntos
  let p = val.split(',');
  if (p[0].length > 0) {
    p[0] = parseInt(p[0], 10).toLocaleString('es-AR').replace(/,/g, '.');
  }
  el.value = p.length > 1 ? p[0] + ',' + p[1] : p[0];
}

function closeMpBalanceModal() {
  document.getElementById('mpBalanceModalOverlay').classList.remove('open');
}

function saveMpBalance() {
  const accIdStr = document.getElementById('mpBalanceAccId').value;
  const balanceStr = document.getElementById('mpBalanceInput').value;
  
  if (balanceStr.trim() === '') {
    showToast('Por favor, ingresá un monto válido', true);
    return;
  }
  
  const cleanStr = balanceStr.replace(/\./g, '').replace(',', '.');
  const newBalance = parseFloat(cleanStr);
  if (isNaN(newBalance)) {
    showToast('El monto ingresado no es válido', true);
    return;
  }
  
  const btn = document.getElementById('mpBalanceSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  
  accountService.updateAccountBalance(accIdStr, newBalance).then(() => {
    if (typeof IS_SERVER !== 'undefined' && !IS_SERVER && typeof save === 'function') save();
    if (typeof renderAll === 'function') renderAll();
    renderCuentasView();
    closeMpBalanceModal();
    showToast('Saldo inicial guardado correctamente');
    if (typeof syncWallet === 'function') syncWallet(parseInt(accIdStr));
  }).catch(e => {
    showToast('Error al guardar el saldo: ' + e.message, true);
  }).finally(() => {
    btn.disabled = false;
    btn.textContent = 'Guardar Saldo Inicial';
  });
}

/* ---- Wallet Connection Status ---- */

async function loadWalletStatus(accountId) {
  try {
    const res = await accountService.getWalletStatus(accountId);
    if (!res || !res.ok) return;

    const badge = document.getElementById(`walletStatusBadge_${accountId}`);
    const syncPanel = document.getElementById(`walletSyncPanel_${accountId}`);
    const manualPanel = document.getElementById(`walletManualPanel_${accountId}`);
    const lastSyncEl = document.getElementById(`walletLastSync_${accountId}`);
    const disconnectPanel = document.getElementById(`walletDisconnectPanel_${accountId}`);
    const oauthPanel = document.getElementById(`walletOAuthPanel_${accountId}`);

    if (res.connected) {
      const panelWrap = document.getElementById(`walletPanel_${accountId}`);
      if (panelWrap) {
        panelWrap.dataset.provider = res.provider;
      }
      
      const providerNames = {
        'mercadopago': 'Mercado Pago',
        'plaid': 'Plaid',
        'belvo': 'Belvo'
      };
      const providerLabel = providerNames[res.provider] || 'CONECTADA';

      if (badge) {
        badge.textContent = `🟢 ${providerLabel.toUpperCase()}`;
        badge.style.background = 'rgba(34,197,94,0.12)';
        badge.style.color = '#22c55e';
      }
      if (oauthPanel) oauthPanel.style.display = 'none';
      if (manualPanel) manualPanel.style.display = 'none';
      if (syncPanel) syncPanel.style.display = 'flex';
      if (disconnectPanel) disconnectPanel.style.display = 'block';

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
    const panelWrap = document.getElementById(`walletPanel_${accountId}`);
    const provider = panelWrap ? panelWrap.dataset.provider : 'mercadopago';
    
    const res = await accountService.disconnectWallet(accountId, provider);
    if (res && res.ok) {
      showToast('Billetera desconectada');
      renderCuentasView();
      if (window.currentPage === 'transacciones' && typeof renderTxView === 'function') renderTxView();
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
    const res = await accountService.cleanupDuplicates();
    showToast(res.message || "Duplicados eliminados.", "success");
    await loadUserData();
    if (typeof applyTxFilter === "function") applyTxFilter();
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
  if (!el) return;

  if (!selectedAccountId) {
    el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Seleccioná una cuenta.</div>`;
    if (document.getElementById('cvTxPanelTitle')) document.getElementById('cvTxPanelTitle').textContent = 'Movimientos';
    if (document.getElementById('cvTxCount')) document.getElementById('cvTxCount').textContent = '—';
    return;
  }

  const a = state.accounts.find(x => x.id === selectedAccountId);
  let list = state.transactions.filter(t => (t.account_id || t.accountId) === selectedAccountId);

  if (accountTxSearchQuery.trim()) {
    const q = accountTxSearchQuery.toLowerCase();
    list = list.filter(t => (t.desc && t.desc.toLowerCase().includes(q)) || (t.cat && t.cat.toLowerCase().includes(q)));
  }

  list.sort((x, y) => new Date(y.date) - new Date(x.date));
  const totalCount = list.length;
  const displayList = list.slice(0, 25);

  if (document.getElementById('cvTxPanelTitle')) {
    document.getElementById('cvTxPanelTitle').textContent = a ? `Movimientos — ${a.name}` : 'Movimientos';
  }
  if (document.getElementById('cvTxCount')) {
    document.getElementById('cvTxCount').textContent = `${totalCount} ${totalCount === 1 ? 'movimiento' : 'movimientos'}`;
  }

  if (displayList.length === 0) {
    el.innerHTML = `<div style="padding:28px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">
      ${accountTxSearchQuery ? 'No se encontraron movimientos con ese filtro.' : 'Sin movimientos en esta cuenta.<br>Registrá una transacción y asignala a esta cuenta.'}
    </div>`;
    return;
  }

  el.innerHTML = displayList.map(t => `
    <div class="cv-tx-item">
      <div class="tx-icon" style="background:${state.CAT_COLORS[t.cat] || '#ffffff'}22;width:34px;height:34px;font-size:14px;border-radius:8px;flex-shrink:0;">
        ${state.CAT_ICONS[t.cat] || '📦'}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${escHtml(t.desc)}</div>
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);">${t.cat} · ${formatDate(t.date)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:var(--font-mono);font-weight:700;font-size:13px;" class="${t.type}">
          ${t.type === 'income' ? '+' : '-'}${formatMoney(t.amount, a ? a.currency || 'ARS' : 'ARS')}
        </div>
      </div>
    </div>
  `).join('') + (totalCount > 25 ? `
    <div style="padding:10px 0;text-align:center;">
      <button class="btn btn-ghost" style="font-size:11px;padding:5px 12px;" onclick="goToTransactionsWithAccountFilter()">
        Ver los ${totalCount} movimientos en Transacciones ↗
      </button>
    </div>
  ` : '');
}

/* Transfer selects & Multi-currency engine */
function getConversionRateType(currFrom, currTo) {
  if ((currFrom === 'USD' && currTo === 'ARS') || (currFrom === 'ARS' && currTo === 'USD')) return 'USD_ARS';
  if ((currFrom === 'EUR' && currTo === 'ARS') || (currFrom === 'ARS' && currTo === 'EUR')) return 'EUR_ARS';
  return 'DIRECT';
}

function renderCvTransferSelects() {
  const fromEl = document.getElementById('cvTransferFrom');
  const toEl = document.getElementById('cvTransferTo');
  if (!fromEl || !toEl) return;

  const validAccounts = state.accounts.filter(a => !a.is_archived);
  const opts = validAccounts.map(a => {
    const sym = getCurrencySymbol(a.currency);
    const curr = a.currency || 'ARS';
    const icon = a.icon || ACC_TYPE_ICONS[a.type] || '🏦';
    return `<option value="${a.id}">${icon} ${escHtml(a.name)} (${sym} ${a.balance.toLocaleString('es-AR')} ${curr})</option>`;
  }).join('');

  fromEl.innerHTML = opts;
  toEl.innerHTML = opts;
  if (state.accounts.length > 1) toEl.selectedIndex = 1;

  initCustomSelects(fromEl.parentNode);
  initCustomSelects(toEl.parentNode);

  onTransferAccountsChanged();
}

function onTransferAccountsChanged() {
  const fromEl = document.getElementById('cvTransferFrom');
  const toEl = document.getElementById('cvTransferTo');
  const crossBox = document.getElementById('cvCrossCurrencyBox');
  const amountLabel = document.getElementById('cvTransferAmountLabel');
  const rateLabel = document.getElementById('cvTransferRateLabel');
  const amountToLabel = document.getElementById('cvTransferAmountToLabel');
  const pairText = document.getElementById('cvCrossPairText');

  if (!fromEl || !toEl || !state.accounts.length) return;

  const fromId = parseInt(fromEl.value);
  const toId = parseInt(toEl.value);
  const fromAcc = state.accounts.find(a => a.id === fromId);
  const toAcc = state.accounts.find(a => a.id === toId);

  if (!fromAcc || !toAcc) return;

  const currFrom = fromAcc.currency || 'ARS';
  const currTo = toAcc.currency || 'ARS';
  const symFrom = getCurrencySymbol(currFrom);
  const symTo = getCurrencySymbol(currTo);

  if (currFrom === currTo) {
    if (crossBox) crossBox.style.display = 'none';
    if (amountLabel) amountLabel.textContent = `Monto a transferir (${symFrom})`;
  } else {
    if (crossBox) crossBox.style.display = 'block';
    if (amountLabel) amountLabel.textContent = `Monto a debitar (${symFrom} ${currFrom})`;
    if (amountToLabel) amountToLabel.textContent = `Monto a recibir (${symTo} ${currTo})`;
    if (pairText) pairText.textContent = `Conversión ${currFrom} → ${currTo}`;

    if (rateLabel) {
      if ((currFrom === 'USD' && currTo === 'ARS') || (currFrom === 'ARS' && currTo === 'USD')) {
        rateLabel.textContent = 'Cotización (1 USD = ARS)';
      } else if ((currFrom === 'EUR' && currTo === 'ARS') || (currFrom === 'ARS' && currTo === 'EUR')) {
        rateLabel.textContent = 'Cotización (1 EUR = ARS)';
      } else {
        rateLabel.textContent = `Cotización (1 ${currFrom} = ${currTo})`;
      }
    }

    onTransferAmountChanged();
  }
}

function updateTransferSummary(amountFrom, amountTo, rate, currFrom, currTo, fromAcc, toAcc) {
  const summaryEl = document.getElementById('cvCrossSummary');
  if (!summaryEl) return;

  if (!amountFrom || !amountTo || !rate) {
    summaryEl.innerHTML = `💡 Ingresá el monto y la cotización para calcular el destino en ${currTo}.`;
    return;
  }

  const symFrom = getCurrencySymbol(currFrom);
  const symTo = getCurrencySymbol(currTo);
  const fmtFrom = amountFrom.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const fmtTo = amountTo.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const fmtRate = rate.toLocaleString('es-AR', { maximumFractionDigits: 4 });

  let rateStr = '';
  const type = getConversionRateType(currFrom, currTo);
  if (type === 'USD_ARS') rateStr = `1 USD = $${fmtRate} ARS`;
  else if (type === 'EUR_ARS') rateStr = `1 EUR = $${fmtRate} ARS`;
  else rateStr = `1 ${currFrom} = ${fmtRate} ${currTo}`;

  summaryEl.innerHTML = `💡 Débito: <strong>${symFrom} ${fmtFrom}</strong> (${escHtml(fromAcc.name)}) → Crédito: <strong>${symTo} ${fmtTo}</strong> (${escHtml(toAcc.name)})<br><span style="color:#60a5fa;">Tasa aplicada: ${rateStr}</span>`;
}

function onTransferAmountChanged() {
  const fromEl = document.getElementById('cvTransferFrom');
  const toEl = document.getElementById('cvTransferTo');
  if (!fromEl || !toEl) return;
  const fromAcc = state.accounts.find(a => a.id === parseInt(fromEl.value));
  const toAcc = state.accounts.find(a => a.id === parseInt(toEl.value));
  if (!fromAcc || !toAcc) return;

  const currFrom = fromAcc.currency || 'ARS';
  const currTo = toAcc.currency || 'ARS';
  if (currFrom === currTo) return;

  const amountFrom = parseFloat(document.getElementById('cvTransferAmount').value) || 0;
  const rateInput = document.getElementById('cvTransferRate');
  const amountToInput = document.getElementById('cvTransferAmountTo');
  const rate = parseFloat(rateInput ? rateInput.value : 0) || 0;

  if (amountFrom > 0 && rate > 0) {
    const type = getConversionRateType(currFrom, currTo);
    let amountTo = 0;
    if (type === 'USD_ARS') {
      amountTo = currFrom === 'USD' ? (amountFrom * rate) : (amountFrom / rate);
    } else if (type === 'EUR_ARS') {
      amountTo = currFrom === 'EUR' ? (amountFrom * rate) : (amountFrom / rate);
    } else {
      amountTo = amountFrom * rate;
    }
    if (amountToInput) amountToInput.value = (Math.round(amountTo * 100) / 100).toFixed(2);
    updateTransferSummary(amountFrom, amountTo, rate, currFrom, currTo, fromAcc, toAcc);
  } else {
    updateTransferSummary(amountFrom, 0, rate, currFrom, currTo, fromAcc, toAcc);
  }
}

function onTransferRateChanged() {
  onTransferAmountChanged();
}

function onTransferAmountToChanged() {
  const fromEl = document.getElementById('cvTransferFrom');
  const toEl = document.getElementById('cvTransferTo');
  if (!fromEl || !toEl) return;
  const fromAcc = state.accounts.find(a => a.id === parseInt(fromEl.value));
  const toAcc = state.accounts.find(a => a.id === parseInt(toEl.value));
  if (!fromAcc || !toAcc) return;

  const currFrom = fromAcc.currency || 'ARS';
  const currTo = toAcc.currency || 'ARS';
  if (currFrom === currTo) return;

  const amountFrom = parseFloat(document.getElementById('cvTransferAmount').value) || 0;
  const amountTo = parseFloat(document.getElementById('cvTransferAmountTo').value) || 0;
  const rateInput = document.getElementById('cvTransferRate');

  if (amountFrom > 0 && amountTo > 0) {
    const type = getConversionRateType(currFrom, currTo);
    let rate = 0;
    if (type === 'USD_ARS') {
      rate = currFrom === 'USD' ? (amountTo / amountFrom) : (amountFrom / amountTo);
    } else if (type === 'EUR_ARS') {
      rate = currFrom === 'EUR' ? (amountTo / amountFrom) : (amountFrom / amountTo);
    } else {
      rate = amountTo / amountFrom;
    }
    if (rateInput) rateInput.value = (Math.round(rate * 10000) / 10000).toFixed(2);
    updateTransferSummary(amountFrom, amountTo, rate, currFrom, currTo, fromAcc, toAcc);
  }
}

async function fetchSuggestedExchangeRate() {
  const fromEl = document.getElementById('cvTransferFrom');
  const toEl = document.getElementById('cvTransferTo');
  const btn = document.getElementById('cvFetchRateBtn');
  if (!fromEl || !toEl) return;

  const fromAcc = state.accounts.find(a => a.id === parseInt(fromEl.value));
  const toAcc = state.accounts.find(a => a.id === parseInt(toEl.value));
  if (!fromAcc || !toAcc) return;

  const currFrom = fromAcc.currency || 'ARS';
  const currTo = toAcc.currency || 'ARS';
  if (currFrom === currTo) return;

  const origBtnText = btn ? btn.innerHTML : '';
  if (btn) btn.innerHTML = '⏳ Consultando...';

  try {
    const suggested = await accountService.getSuggestedExchangeRate(currFrom, currTo);
    if (suggested && suggested.rate > 0) {
      const rateInput = document.getElementById('cvTransferRate');
      if (rateInput) {
        rateInput.value = suggested.rate;
        showToast(`✅ Cotización sugerida: ${suggested.label}`);
        onTransferRateChanged();
      }
    }
  } catch (err) {
    console.warn('No se pudo obtener cotización externa:', err);
    showToast('⚠️ No se pudo obtener la cotización en vivo. Podés ingresarla manualmente.', true);
  } finally {
    if (btn) btn.innerHTML = origBtnText;
  }
}

function swapTransfer() {
  const f = document.getElementById('cvTransferFrom');
  const t = document.getElementById('cvTransferTo');
  if (!f || !t) return;
  [f.value, t.value] = [t.value, f.value];
  updateCustomSelectDisplay(f);
  updateCustomSelectDisplay(t);
  onTransferAccountsChanged();
}

async function doTransfer() {
  const fromId = parseInt(document.getElementById('cvTransferFrom').value);
  const toId = parseInt(document.getElementById('cvTransferTo').value);
  const amountFrom = parseFloat(document.getElementById('cvTransferAmount').value);
  const desc = document.getElementById('cvTransferDesc').value.trim() || 'Transferencia';

  if (fromId === toId) { showToast('⚠️ Seleccioná cuentas distintas', true); return; }
  if (!amountFrom || amountFrom <= 0) { showToast('⚠️ Ingresá un monto a transferir válido', true); return; }

  const fromAcc = state.accounts.find(x => x.id === fromId);
  const toAcc = state.accounts.find(x => x.id === toId);
  if (!fromAcc || !toAcc) return;

  const currFrom = fromAcc.currency || 'ARS';
  const currTo = toAcc.currency || 'ARS';
  const isCross = (currFrom !== currTo);

  let amountTo = amountFrom;
  let rateInfo = '';

  if (isCross) {
    amountTo = parseFloat(document.getElementById('cvTransferAmountTo').value);
    const rate = parseFloat(document.getElementById('cvTransferRate').value);

    if (!amountTo || amountTo <= 0) {
      showToast('⚠️ Ingresá el monto a recibir o la cotización', true);
      return;
    }

    const type = getConversionRateType(currFrom, currTo);
    if (type === 'USD_ARS') {
      rateInfo = ` (1 USD = ${rate ? rate.toLocaleString('es-AR') : (currFrom === 'USD' ? (amountTo/amountFrom).toFixed(2) : (amountFrom/amountTo).toFixed(2))} ARS)`;
    } else if (type === 'EUR_ARS') {
      rateInfo = ` (1 EUR = ${rate ? rate.toLocaleString('es-AR') : ''} ARS)`;
    } else if (rate) {
      rateInfo = ` (1 ${currFrom} = ${rate} ${currTo})`;
    }
  }

  const descExpense = `${desc} → ${toAcc.name}${rateInfo}`;
  const descIncome = `${desc} ← ${fromAcc.name}${rateInfo}`;

  try {
    const res = await accountService.doTransfer(fromId, toId, amountFrom, amountTo, descExpense, descIncome);
    if (res && res.local && typeof save === 'function') {
      save();
    } else if (res && res.ok && window.loadUserData) {
      await window.loadUserData();
    }
    document.getElementById('cvTransferAmount').value = '';
    if (document.getElementById('cvTransferAmountTo')) document.getElementById('cvTransferAmountTo').value = '';
    document.getElementById('cvTransferDesc').value = '';
    renderCuentasView();
    showToast(`✅ Transferencia realizada: ${formatMoney(amountFrom, currFrom)} → ${formatMoney(amountTo, currTo)}`);
  } catch (err) {
    console.error(err);
    showToast('⚠️ Error al realizar la transferencia', true);
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
  const cardDaysWrap = document.getElementById('amCardDaysWrap');
  if (cardDaysWrap) cardDaysWrap.style.display = 'none';

  if (id) {
    const a = state.accounts.find(x => x.id === id);
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
    if (document.getElementById('amAlias')) document.getElementById('amAlias').value = a.alias || '';
    if (document.getElementById('amCbu')) document.getElementById('amCbu').value = a.cbu || '';
    if (document.getElementById('amColor')) document.getElementById('amColor').value = a.color || ACC_TYPE_COLORS[a.type] || '#5b8cff';
    if (document.getElementById('amIcon')) document.getElementById('amIcon').value = a.icon || '';
    if (document.getElementById('amFavorite')) document.getElementById('amFavorite').checked = !!a.is_favorite;

    if (a.type === 'tarjeta') {
      document.getElementById('amLimitWrap').style.display = '';
      document.getElementById('amLimit').value = a.limit || 0;
      if (cardDaysWrap) {
        cardDaysWrap.style.display = '';
        document.getElementById('amClosingDay').value = a.closing_day || '';
        document.getElementById('amDueDay').value = a.due_day || '';
      }
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
    if (document.getElementById('amAlias')) document.getElementById('amAlias').value = '';
    if (document.getElementById('amCbu')) document.getElementById('amCbu').value = '';
    if (document.getElementById('amColor')) document.getElementById('amColor').value = '#5b8cff';
    if (document.getElementById('amIcon')) document.getElementById('amIcon').value = '';
    if (document.getElementById('amFavorite')) document.getElementById('amFavorite').checked = false;
    if (document.getElementById('amClosingDay')) document.getElementById('amClosingDay').value = '';
    if (document.getElementById('amDueDay')) document.getElementById('amDueDay').value = '';
  }
  document.getElementById('accModalOverlay').classList.add('open');
}

function onAmTypeChange() {
  const t = document.getElementById('amType').value;
  const isCard = t === 'tarjeta';
  document.getElementById('amLimitWrap').style.display = isCard ? '' : 'none';
  const cardDaysWrap = document.getElementById('amCardDaysWrap');
  if (cardDaysWrap) cardDaysWrap.style.display = isCard ? '' : 'none';
  if (document.getElementById('amColor') && ACC_TYPE_COLORS[t]) {
    document.getElementById('amColor').value = ACC_TYPE_COLORS[t];
  }
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
  const alias = document.getElementById('amAlias') ? document.getElementById('amAlias').value.trim() : null;
  const cbu = document.getElementById('amCbu') ? document.getElementById('amCbu').value.trim() : null;
  const color = document.getElementById('amColor') ? document.getElementById('amColor').value.trim() : null;
  const icon = document.getElementById('amIcon') ? document.getElementById('amIcon').value.trim() : null;
  const is_favorite = document.getElementById('amFavorite') ? document.getElementById('amFavorite').checked : false;
  const closing_day = document.getElementById('amClosingDay') && document.getElementById('amClosingDay').value ? parseInt(document.getElementById('amClosingDay').value) : null;
  const due_day = document.getElementById('amDueDay') && document.getElementById('amDueDay').value ? parseInt(document.getElementById('amDueDay').value) : null;

  if (!name) { showToast('⚠️ Ingresá un nombre para la cuenta', true); return; }

  const payload = {
    name, type, bank, balance, currency, limit, notes,
    alias: alias || null,
    cbu: cbu || null,
    color: color || null,
    icon: icon || null,
    is_favorite,
    closing_day,
    due_day
  };

  try {
    const res = await accountService.saveAccount(payload, editingAccountId);
    if (res && res.ok) {
      if (!editingAccountId && res.account) {
        selectedAccountId = res.account.id;
      }
      renderCuentasView();
      showToast(editingAccountId ? '✏️ Cuenta actualizada' : '✅ Cuenta creada');
    }
  } catch (err) {
    console.error(err);
    showToast('⚠️ Error al guardar', true);
  }
  closeAccModal();
}

/* ---- Delete ---- */
function confirmDeleteAccount(id) {
  editingAccountId = id;
  const a = state.accounts.find(x => x.id === id);
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
  try {
    const res = await accountService.deleteAccount(editingAccountId);
    if (res && res.ok) {
      if (typeof IS_SERVER !== 'undefined' && IS_SERVER && typeof loadUserData === 'function') {
        await loadUserData();
      }
      if (selectedAccountId === editingAccountId) selectedAccountId = state.accounts[0]?.id || null;
      renderCuentasView();
      if (typeof IS_SERVER !== 'undefined' && IS_SERVER && typeof renderAll === 'function') renderAll();
      showToast('🗑️ Cuenta eliminada');
    }
  } catch (err) {
    console.error(err);
    showToast('⚠️ Error al eliminar', true);
  }
  closeAccDeleteModal();
}

/* ---- Conciliación de Saldo ---- */
function openAccReconcileModal(accountId) {
  reconcilingAccountId = accountId;
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return;
  document.getElementById('arAccountName').textContent = acc.name;
  document.getElementById('arCurrentBalance').textContent = formatMoney(acc.balance, acc.currency || 'ARS');
  document.getElementById('arCurrencyLabel').textContent = acc.currency || 'ARS';
  document.getElementById('arRealBalance').value = acc.balance;
  document.getElementById('arNote').value = '';
  document.getElementById('arDiffBox').style.display = 'none';
  document.getElementById('accReconcileOverlay').classList.add('open');
  setTimeout(() => document.getElementById('arRealBalance').focus(), 100);
}

function closeAccReconcileModal(e) {
  if (!e || e.target.id === 'accReconcileOverlay') {
    document.getElementById('accReconcileOverlay').classList.remove('open');
    reconcilingAccountId = null;
  }
}

function onReconcileInputChanged() {
  const acc = state.accounts.find(a => a.id === reconcilingAccountId);
  if (!acc) return;
  const realVal = parseFloat(document.getElementById('arRealBalance').value);
  const diffBox = document.getElementById('arDiffBox');
  if (isNaN(realVal)) {
    diffBox.style.display = 'none';
    return;
  }
  const diff = Math.round((realVal - acc.balance) * 100) / 100;
  diffBox.style.display = 'block';
  if (Math.abs(diff) < 0.01) {
    diffBox.style.background = 'rgba(255,255,255,0.05)';
    diffBox.style.color = 'var(--muted)';
    diffBox.textContent = 'Sin diferencia de saldo.';
  } else if (diff > 0) {
    diffBox.style.background = 'rgba(0,229,160,0.12)';
    diffBox.style.color = 'var(--accent)';
    diffBox.textContent = `Ajuste necesario: +${formatMoney(diff, acc.currency || 'ARS')} (se registrará como Ingreso)`;
  } else {
    diffBox.style.background = 'rgba(239,68,68,0.12)';
    diffBox.style.color = 'var(--danger)';
    diffBox.textContent = `Ajuste necesario: -${formatMoney(Math.abs(diff), acc.currency || 'ARS')} (se registrará como Gasto)`;
  }
}

async function doReconcileAccount() {
  if (!reconcilingAccountId) return;
  const realVal = parseFloat(document.getElementById('arRealBalance').value);
  const note = document.getElementById('arNote').value.trim() || 'Ajuste de saldo';
  if (isNaN(realVal)) {
    showToast('⚠️ Ingresá un saldo válido', true);
    return;
  }

  const btn = document.getElementById('arSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const res = await accountService.reconcileAccount(reconcilingAccountId, realVal, note);
    if (res && res.ok) {
      showToast('✅ Saldo conciliado correctamente');
      if (typeof loadUserData === 'function') await loadUserData();
      renderCuentasView();
      closeAccReconcileModal();
    } else {
      showToast(res.error || 'Error al conciliar saldo', true);
    }
  } catch (err) {
    console.error(err);
    showToast('⚠️ Error al conectar con el servidor', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar Ajuste';
  }
}

/* ---- Acciones Rápidas (Copiar, Pagar Tarjeta, Favoritas, Archivar) ---- */
function copyAccountData(text, label) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`✅ ${label} copiado al portapapeles`);
  }).catch(() => {
    showToast(`⚠️ No se pudo copiar al portapapeles`, true);
  });
}

function quickPayCreditCard(accountId) {
  const card = state.accounts.find(a => a.id === accountId);
  if (!card) return;
  const fromAcc = state.accounts.find(a => a.id !== accountId && !a.is_archived && a.type !== 'tarjeta' && a.balance > 0);
  if (!fromAcc) {
    showToast('⚠️ No se encontró una cuenta bancaria con saldo disponible para pagar la tarjeta', true);
    return;
  }

  const amountToPay = Math.abs(card.balance);
  const fromEl = document.getElementById('cvTransferFrom');
  const toEl = document.getElementById('cvTransferTo');
  const amountEl = document.getElementById('cvTransferAmount');
  const descEl = document.getElementById('cvTransferDesc');

  if (fromEl) fromEl.value = fromAcc.id;
  if (toEl) toEl.value = card.id;
  if (amountEl) amountEl.value = amountToPay;
  if (descEl) descEl.value = `Pago de resumen ${card.name}`;

  if (typeof updateCustomSelectDisplay === 'function') {
    if (fromEl) updateCustomSelectDisplay(fromEl);
    if (toEl) updateCustomSelectDisplay(toEl);
  }
  onTransferAccountsChanged();

  const transferForm = document.querySelector('.cv-transfer');
  if (transferForm) transferForm.scrollIntoView({ behavior: 'smooth' });
  showToast(`💳 Formulario de transferencia preparado para ${card.name}`);
}

async function toggleAccountArchive(accountId) {
  try {
    const res = await accountService.toggleArchive(accountId);
    if (res && res.ok) {
      const isArch = res.account ? res.account.is_archived : false;
      showToast(isArch ? '📦 Cuenta archivada' : '📂 Cuenta desarchivada');
      renderCuentasView();
    } else {
      showToast(res.error || 'Error al archivar cuenta', true);
    }
  } catch (err) {
    console.error(err);
    showToast('⚠️ Error al actualizar estado de la cuenta', true);
  }
}

async function toggleAccountFavorite(accountId) {
  try {
    const res = await accountService.toggleFavorite(accountId);
    if (res && res.ok) {
      const isFav = res.account ? res.account.is_favorite : false;
      showToast(isFav ? '⭐ Cuenta fijada como favorita' : 'Cuenta desmarcada de favoritas');
      renderCuentasView();
    } else {
      showToast(res.error || 'Error al fijar favorita', true);
    }
  } catch (err) {
    console.error(err);
    showToast('⚠️ Error al actualizar favorita', true);
  }
}

function goToTransactionsWithAccountFilter() {
  if (!selectedAccountId) return;
  if (typeof window.setPage === 'function') {
    const navTx = document.querySelector('[onclick*="transacciones"]') || document.querySelector('[onclick*="transactions"]');
    window.setPage(navTx, 'transacciones');
  }
  const sel = document.getElementById('txFilterAccount');
  if (sel) {
    sel.value = selectedAccountId;
    if (typeof window.applyTxFilter === 'function') window.applyTxFilter();
  }
}

// --- WINDOW ATTACHMENTS ---
window.toggleMpTokenVisibility = toggleMpTokenVisibility;
window.renderCvTxList = renderCvTxList;
window.swapTransfer = swapTransfer;
window.renderCvWorth = renderCvWorth;
window.openAccModal = openAccModal;
window.saveMpToken = saveMpToken;
window.closeAccModal = closeAccModal;
window.saveAccount = saveAccount;
window.saveMpBalance = saveMpBalance;
window.saveAccounts = saveAccounts;
window.renderCvDetail = renderCvDetail;
window.onAmTypeChange = onAmTypeChange;
window.cleanupDuplicates = cleanupDuplicates;
window.formatMpBalanceInput = formatMpBalanceInput;
window.confirmDeleteAccount = confirmDeleteAccount;
window.renderCvCards = renderCvCards;
window.doDeleteAccount = doDeleteAccount;
window.disconnectWallet = disconnectWallet;
window.initAccounts = initAccounts;
window.promptInitialBalance = promptInitialBalance;
window.selectAccount = selectAccount;
window.closeMpBalanceModal = closeMpBalanceModal;
window.syncWallet = syncWallet;
window.loadWalletStatus = loadWalletStatus;
window.formatTimeAgo = formatTimeAgo;
window.renderCuentasView = renderCuentasView;
window.closeAccDeleteModal = closeAccDeleteModal;
window.enterCuentasView = enterCuentasView;
window.doTransfer = doTransfer;
window.renderCvTransferSelects = renderCvTransferSelects;
window.onTransferAccountsChanged = onTransferAccountsChanged;
window.onTransferAmountChanged = onTransferAmountChanged;
window.onTransferRateChanged = onTransferRateChanged;
window.onTransferAmountToChanged = onTransferAmountToChanged;
window.fetchSuggestedExchangeRate = fetchSuggestedExchangeRate;
window.setAccountsFilterTab = setAccountsFilterTab;
window.onAccountSearchChanged = onAccountSearchChanged;
window.onAccountTxSearchChanged = onAccountTxSearchChanged;
window.toggleConsolidatedNetWorth = toggleConsolidatedNetWorth;
window.toggleAccountArchive = toggleAccountArchive;
window.toggleAccountFavorite = toggleAccountFavorite;
window.openAccReconcileModal = openAccReconcileModal;
window.closeAccReconcileModal = closeAccReconcileModal;
window.onReconcileInputChanged = onReconcileInputChanged;
window.doReconcileAccount = doReconcileAccount;
window.copyAccountData = copyAccountData;
window.quickPayCreditCard = quickPayCreditCard;
window.goToTransactionsWithAccountFilter = goToTransactionsWithAccountFilter;



