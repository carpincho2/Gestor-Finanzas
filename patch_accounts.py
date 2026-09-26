import re

with open('js/accounts.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(""import { apiFetch } from './api/apiClient.js';"", ""import { apiFetch } from './api/apiClient.js';\nimport { accountService } from './services/accountService.js';"")

content = re.sub(
    r""function saveAccounts\(\) \{[\s\S]*?\}([\n\r\s]*function initAccounts)"",
    ""function saveAccounts() {\n  accountService.saveAccounts();\n}\\1"",
    content
)

content = re.sub(
    r""function initAccounts\(\) \{[\s\S]*?\}([\n\r\s]*/\* ---- Nav entry ---- \*/)"",
    ""function initAccounts() {\n  accountService.initAccounts();\n}\\1"",
    content
)

saveMpToken_new = r""\"async function saveMpToken(accountId) {
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
}\"\"\"

content = re.sub(r""async function saveMpToken\(accountId\) \{[\s\S]*?finally\s*\{[\s\S]*?\}\s*\}"", saveMpToken_new, content)

syncWallet_new = r""\"async function syncWallet(accountId) {
  const btn = document.getElementById(tnSyncWallet_);
  const text = document.getElementById(syncWalletText_);
  const svg = btn ? btn.querySelector('.sync-icon-svg') : null;

  if (btn) btn.disabled = true;
  if (text) text.textContent = 'Sincronizando...';
  if (svg) svg.classList.add('spin-anim');

  try {
    const res = await accountService.syncWallet(accountId);
    if (res && res.ok) {
      const msg = ¡Sincronización exitosa! Importados:  movimientos +
                  (res.skipped_count ?  ( ya existían) : '') +
                  \\nSaldo actual: {res.balance?.toLocaleString('es-AR') || '—'};
      showToast(msg);
      await loadUserData();
      if (typeof renderAll === 'function') renderAll();
      renderCuentasView();
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
}\"\"\"
content = re.sub(r""async function syncWallet\(accountId\) \{[\s\S]*?finally\s*\{[\s\S]*?\}\s*\}"", syncWallet_new, content)

saveMpBalance_new = r""\"function saveMpBalance() {
  const accIdStr = document.getElementById('mpBalanceAccId').value;
  const balanceStr = document.getElementById('mpBalanceInput').value;
  
  if (balanceStr.trim() === '') {
    showToast('Por favor, ingresá un monto válido', true);
    return;
  }
  
  const cleanStr = balanceStr.replace(/\\./g, '').replace(',', '.');
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
  }).catch(e => {
    showToast('Error al guardar el saldo: ' + e.message, true);
  }).finally(() => {
    btn.disabled = false;
    btn.textContent = 'Guardar Saldo Inicial';
  });
}\"\"\"
content = re.sub(r""function saveMpBalance\(\) \{[\s\S]*?btn\.textContent = 'Guardar Saldo Inicial';\s*\}\s*\}"", saveMpBalance_new, content)

loadWalletStatus_new = r""\"async function loadWalletStatus(accountId) {
  try {
    const res = await accountService.getWalletStatus(accountId);
    if (!res || !res.ok) return;

    const badge = document.getElementById(walletStatusBadge_);
    const syncPanel = document.getElementById(walletSyncPanel_);
    const manualPanel = document.getElementById(walletManualPanel_);
    const lastSyncEl = document.getElementById(walletLastSync_);
    const disconnectPanel = document.getElementById(walletDisconnectPanel_);
    const oauthPanel = document.getElementById(walletOAuthPanel_);

    if (res.connected) {
      const panelWrap = document.getElementById(walletPanel_);
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
        badge.textContent = 🟢 ;
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
        lastSyncEl.innerHTML = Última sync:  ;
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
}\"\"\"
content = re.sub(r""async function loadWalletStatus\(accountId\) \{[\s\S]*?catch \(err\) \{\s*console.error\(\"Error al cargar estado de billetera:\", err\);\s*\}\s*\}"", loadWalletStatus_new, content)

disconnectWallet_new = r""\"async function disconnectWallet(accountId) {
  if (!confirm('¿Estás seguro de desconectar la billetera? Tus transacciones importadas se mantienen.')) return;

  try {
    const panelWrap = document.getElementById(walletPanel_);
    const provider = panelWrap ? panelWrap.dataset.provider : 'mercadopago';
    
    const res = await accountService.disconnectWallet(accountId, provider);
    if (res && res.ok) {
      showToast('Billetera desconectada');
      renderCuentasView();
    } else {
      showToast(res.error || 'Error al desconectar', true);
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}\"\"\"
content = re.sub(r""async function disconnectWallet\(accountId\) \{[\s\S]*?catch \(err\) \{\s*showToast\(err.message, \"error\"\);\s*\}\s*\}"", disconnectWallet_new, content)

cleanupDuplicates_new = r""\"async function cleanupDuplicates() {
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
}\"\"\"
content = re.sub(r""async function cleanupDuplicates\(\) \{[\s\S]*?catch \(err\) \{\s*showToast\(\"Error al limpiar duplicados: \" \+ err.message, \"error\"\);\s*\}\s*\}"", cleanupDuplicates_new, content)

fetchSuggestedExchangeRate_new = r""\"async function fetchSuggestedExchangeRate() {
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
        showToast(✅ Cotización sugerida: );
        onTransferRateChanged();
      }
    }
  } catch (err) {
    console.warn('No se pudo obtener cotización externa:', err);
    showToast('⚠️ No se pudo obtener la cotización en vivo. Podés ingresarla manualmente.', true);
  } finally {
    if (btn) btn.innerHTML = origBtnText;
  }
}\"\"\"
content = re.sub(r""async function fetchSuggestedExchangeRate\(\) \{[\s\S]*?finally\s*\{\s*if \(btn\) btn.innerHTML = origBtnText;\s*\}\s*\}"", fetchSuggestedExchangeRate_new, content)

doTransfer_new = r""\"async function doTransfer() {
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
      rateInfo =  (1 USD = {rate ? rate.toLocaleString('es-AR') : (currFrom === 'USD' ? (amountTo/amountFrom).toFixed(2) : (amountFrom/amountTo).toFixed(2))} ARS);
    } else if (type === 'EUR_ARS') {
      rateInfo =  (1 EUR = {rate ? rate.toLocaleString('es-AR') : ''} ARS);
    } else if (rate) {
      rateInfo =  (1  =  );
    }
  }

  const descExpense = ${desc} → ;
  const descIncome = ${desc} ← ;

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
    showToast(✅ Transferencia realizada:  → );
  } catch (err) {
    console.error(err);
    showToast('⚠️ Error al realizar la transferencia', true);
  }
}\"\"\"
content = re.sub(r""async function doTransfer\(\) \{[\s\S]*?showToast\(✅ Transferencia realizada: \$\{formatMoney\(amountFrom, currFrom\)\} → \$\{formatMoney\(amountTo, currTo\)\}\);\s*\}\s*\}"", doTransfer_new, content)

saveAccount_new = r""\"async function saveAccount() {
  const name = document.getElementById('amName').value.trim();
  const type = document.getElementById('amType').value;
  const bank = document.getElementById('amBank').value.trim();
  const balance = parseFloat(document.getElementById('amBalance').value) || 0;
  const currency = document.getElementById('amCurrency').value;
  const limit = parseFloat(document.getElementById('amLimit').value) || 0;
  const notes = document.getElementById('amNotes').value.trim();

  if (!name) { showToast('⚠️ Ingresá un nombre para la cuenta', true); return; }

  const payload = { name, type, bank, balance, currency, limit, notes };

  try {
    const res = await accountService.saveAccount(payload, editingAccountId);
    if (res && res.ok) {
      if (!editingAccountId) {
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
}\"\"\"
content = re.sub(r""async function saveAccount\(\) \{[\s\S]*?closeAccModal\(\);\s*\}"", saveAccount_new, content)

doDeleteAccount_new = r""\"async function doDeleteAccount() {
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
}\"\"\"
content = re.sub(r""async function doDeleteAccount\(\) \{[\s\S]*?closeAccDeleteModal\(\);\s*\}"", doDeleteAccount_new, content)

with open('js/accounts.js', 'w', encoding='utf-8') as f:
    f.write(content)
