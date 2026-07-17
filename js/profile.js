import { IS_SERVER, state, userKey } from './store/store.js';
import { fetchMe, logout, deleteAccount, updateProfile, updatePassword } from './api/authApi.js';
import { apiFetch } from './api/apiClient.js';
import { showToast } from './utils/utils.js';
import { loadUserData, init } from './app.js';

const AUTH_KEY = 'flujo_auth_user';

export async function authCheckSession() {
  if (IS_SERVER) {
    try {
      const data = await fetchMe();
      if (data.user) {
        authFinishLogin(data.user);
        return;
      }
    } catch (e) {
      localStorage.removeItem(AUTH_KEY);
    }
  } else {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored);
        authFinishLogin(user);
        return;
      } catch (e) {
        localStorage.removeItem(AUTH_KEY);
      }
    }
  }
  window.location.href = IS_SERVER ? './' : 'index.html';
}

export async function authFinishLogin(user) {
  state.currentUserEmail = user.email;
  await loadUserData();

  const initials = user.avatar || (user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'JP');
  const avatarEl = document.querySelector('.user-avatar');
  const nameEl = document.querySelector('.user-name');
  const planEl = document.querySelector('.user-plan');

  if (avatarEl) {
    if (user.picture) avatarEl.innerHTML = `<img src="${user.picture}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" alt="${initials}">`;
    else avatarEl.textContent = initials;
  }
  if (nameEl) nameEl.textContent = user.name || 'Usuario';
  if (planEl) planEl.textContent = user.email || '';

  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  init();
}

export async function authLogout() {
  if (typeof google !== 'undefined' && google.accounts && state.currentUserEmail) {
    try { google.accounts.id.revoke(state.currentUserEmail, () => { }); } catch (e) { }
  }
  if (IS_SERVER) {
    try { await logout(); } catch (e) { }
  }
  state.currentUserEmail = null;
  localStorage.removeItem(AUTH_KEY);
  window.location.href = IS_SERVER ? './' : 'index.html';
}

export function authConfirmDeleteAccount() { document.getElementById('userDeleteOverlay').classList.add('open'); }
export function closeUserDeleteModal(e) {
  if (!e || e.target.id === 'userDeleteOverlay') document.getElementById('userDeleteOverlay').classList.remove('open');
}

export async function doDeleteUserAccount() {
  if (IS_SERVER) {
    try {
      await deleteAccount();
    } catch (e) {
      showToast("⚠️ " + e.message, true);
      closeUserDeleteModal();
      return;
    }
  }
  if (typeof google !== 'undefined' && google.accounts && state.currentUserEmail) {
    try { google.accounts.id.revoke(state.currentUserEmail, () => { }); } catch (e) { }
  }
  [userKey('flujo_tx'), userKey('flujo_budgets'), userKey('flujo_accounts'), userKey('flujo_goals'), userKey('flujo_scan_history')].forEach(k => localStorage.removeItem(k));
  state.currentUserEmail = null;
  localStorage.removeItem(AUTH_KEY);
  window.location.href = IS_SERVER ? './' : 'index.html';
}

export function enterPerfilView() {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) return;
  const user = JSON.parse(stored);
  document.getElementById('profileNameHeader').textContent = user.name || 'Usuario';
  document.getElementById('profileEmailHeader').textContent = user.email || '';
  document.getElementById('profileNameInput').value = user.name || '';
  
  const initials = user.avatar || (user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'JP');
  const avatarEl = document.getElementById('profileAvatar');
  if (avatarEl) {
    if (user.picture) avatarEl.innerHTML = `<img src="${user.picture}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" alt="${initials}">`;
    else avatarEl.textContent = initials;
  }
  const currentPwWrap = document.getElementById('profilePasswordCurrentWrap');
  if (user.picture && currentPwWrap) currentPwWrap.style.display = 'none';
  else if (currentPwWrap) currentPwWrap.style.display = '';
}

export async function profileUpdateInfo() {
  const name = document.getElementById('profileNameInput').value.trim();
  if (!name) { showToast('⚠️ El nombre no puede estar vacío', true); return; }
  if (IS_SERVER) {
    try {
      const data = await updateProfile(name);
      state.currentUserEmail = data.user.email;
      localStorage.setItem(AUTH_KEY, JSON.stringify(data.user));
      const initials = data.user.avatar || 'JP';
      const avatarSidebar = document.querySelector('.sidebar-footer .user-avatar');
      const nameSidebar = document.querySelector('.sidebar-footer .user-name');
      if (avatarSidebar) {
        if (data.user.picture) avatarSidebar.innerHTML = `<img src="${data.user.picture}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" alt="${initials}">`;
        else avatarSidebar.textContent = initials;
      }
      if (nameSidebar) nameSidebar.textContent = data.user.name;
      showToast('✅ Información de perfil actualizada');
      enterPerfilView();
    } catch (e) {
      showToast("⚠️ " + e.message, true);
    }
  } else {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      user.name = name;
      const parts = name.split(' ');
      user.avatar = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      const avatarSidebar = document.querySelector('.sidebar-footer .user-avatar');
      const nameSidebar = document.querySelector('.sidebar-footer .user-name');
      if (avatarSidebar) avatarSidebar.textContent = user.avatar;
      if (nameSidebar) nameSidebar.textContent = user.name;
      showToast('✅ Información de perfil actualizada localmente');
      enterPerfilView();
    }
  }
}

export async function profileUpdatePassword() {
  const currentPw = document.getElementById('profilePasswordCurrent').value;
  const newPw = document.getElementById('profilePasswordNew').value;
  const newPwConfirm = document.getElementById('profilePasswordNewConfirm').value;

  if (IS_SERVER) {
    if (!newPw || newPw.length < 6) { showToast('⚠️ La nueva contraseña debe tener al menos 6 caracteres', true); return; }
    if (newPw !== newPwConfirm) { showToast('⚠️ Las contraseñas nuevas no coinciden', true); return; }
    try {
      await updatePassword(currentPw, newPw);
      showToast('✅ Contraseña actualizada correctamente');
      document.getElementById('profilePasswordCurrent').value = '';
      document.getElementById('profilePasswordNew').value = '';
      document.getElementById('profilePasswordNewConfirm').value = '';
    } catch (e) {
      showToast("⚠️ " + e.message, true);
    }
  } else {
    showToast('ℹ️ El cambio de contraseña no está disponible en modo local offline', true);
  }
}

export function confirmResetData() {
  if (confirm("¿Estás seguro de que querés vaciar TODAS tus transacciones y volver los saldos a cero? Esta acción NO se puede deshacer.")) {
    doResetData();
  }
}

export async function doResetData() {
  if (IS_SERVER) {
    try {
      await apiFetch('/transactions/all', { method: 'DELETE' });
    } catch (e) {
      showToast("⚠️ " + e.message, true);
      return;
    }
  } else {
    const txKey = userKey('flujo_tx');
    const accKey = userKey('flujo_accounts');
    localStorage.setItem(txKey, JSON.stringify([]));
    if (localStorage.getItem(accKey)) {
      const accs = JSON.parse(localStorage.getItem(accKey));
      accs.forEach(a => a.balance = 0);
      localStorage.setItem(accKey, JSON.stringify(accs));
    }
  }
  await loadUserData();
  if (window.renderAll) window.renderAll();
  showToast("✅ Transacciones eliminadas y saldos en 0");
}
