/* =====================================================
   AUTH SYSTEM — Main Dashboard Session Check
   ===================================================== */

const AUTH_KEY = 'flujo_auth_user';


// Helper: llamadas a la API
async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  const r = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (r.redirected) {
    throw new Error(`La petición fue redirigida por el servidor a: ${r.url}. Esto convierte la petición POST en GET y causa el error 405 en el backend. Asegúrate de acceder a la app usando la URL exacta configurada en el servidor.`);
  }

  let data = null;
  const contentType = r.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await r.json();
    } catch (e) {
      console.warn('Error al decodificar la respuesta JSON del servidor:', e);
    }
  }

  if (!r.ok) {
    const errorMsg = (data && data.error)
      ? data.error + (data.message ? `: ${data.message}` : '')
      : `Error de servidor backend (HTTP ${r.status}).`;
    throw new Error(errorMsg);
  }

  if (data === null) {
    const text = await r.text();
    throw new Error(`Respuesta inválida del servidor (HTTP ${r.status}). Contenido: ${text.slice(0, 150)}...`);
  }

  return data;
}

/* ---- Check session on main.html load ---- */
async function authCheckSession() {
  if (IS_SERVER) {
    try {
      const data = await apiFetch('/auth/me');
      if (data.user) {
        authFinishLogin(data.user);
        return;
      }
    } catch (e) {
      // Si la sesión no es válida en el servidor, borramos la sesión local
      localStorage.removeItem(AUTH_KEY);
    }
  } else {
    // Fallback localStorage (modo file://)
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

  // Si no hay sesión válida, redirigir a index.html
  window.location.href = IS_SERVER ? './' : 'index.html';
}

/* ---- Finish login: update UI and initialize data ---- */
async function authFinishLogin(user) {
  currentUserEmail = user.email;
  await loadUserData();

  // Actualizar sidebar con los datos del usuario
  const initials = user.avatar ||
    (user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'JP');

  const avatarEl = document.querySelector('.user-avatar');
  const nameEl = document.querySelector('.user-name');
  const planEl = document.querySelector('.user-plan');

  if (avatarEl) {
    if (user.picture) {
      avatarEl.innerHTML = `<img src="${user.picture}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" alt="${initials}">`;
    } else {
      avatarEl.textContent = initials;
    }
  }
  if (nameEl) nameEl.textContent = user.name || 'Usuario';
  if (planEl) planEl.textContent = user.email || '';

  // Guardar siempre en localStorage para consistencia
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));

  // Inicializar la aplicación
  init();
}

/* ---- Logout ---- */
async function authLogout() {
  // Revocar sesión de Google si se usó
  if (typeof google !== 'undefined' && google.accounts && currentUserEmail) {
    try { google.accounts.id.revoke(currentUserEmail, () => { }); } catch (e) { }
  }

  if (IS_SERVER) {
    try { await apiFetch('/auth/me', { method: 'POST' }); } catch (e) { }
  }

  currentUserEmail = null;
  localStorage.removeItem(AUTH_KEY);

  // Redirigir a index.html
  window.location.href = IS_SERVER ? './' : 'index.html';
}

/* ---- Delete Account ---- */
function authConfirmDeleteAccount() {
  document.getElementById('userDeleteOverlay').classList.add('open');
}

function closeUserDeleteModal(e) {
  if (!e || e.target.id === 'userDeleteOverlay') {
    document.getElementById('userDeleteOverlay').classList.remove('open');
  }
}

async function doDeleteUserAccount() {
  if (IS_SERVER) {
    try {
      const res = await apiFetch('/auth/me', { method: 'DELETE' });
      if (res.error) throw new Error(res.error);
    } catch (e) {
      console.error("Error al eliminar la cuenta del servidor:", e);
      showToast("⚠️ " + e.message, true);
      closeUserDeleteModal();
      return;
    }
  }

  // Revocar sesión de Google si se usó
  if (typeof google !== 'undefined' && google.accounts && currentUserEmail) {
    try { google.accounts.id.revoke(currentUserEmail, () => { }); } catch (e) { }
  }

  // Limpiar datos locales del usuario
  const keysToDelete = [
    userKey('flujo_tx'),
    userKey('flujo_budgets'),
    userKey('flujo_accounts'),
    userKey('flujo_goals'),
    userKey('flujo_scan_history'),
    userKey('flujo_ocr_dictionary')
  ];
  keysToDelete.forEach(k => localStorage.removeItem(k));

  currentUserEmail = null;
  localStorage.removeItem(AUTH_KEY);

  // Redirigir a la página de login
  window.location.href = IS_SERVER ? './' : 'index.html';
}

/* ---- Perfil View ---- */
function enterPerfilView() {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) return;

  const user = JSON.parse(stored);
  
  // Rellenar cabeceras y campos
  document.getElementById('profileNameHeader').textContent = user.name || 'Usuario';
  document.getElementById('profileEmailHeader').textContent = user.email || '';
  document.getElementById('profileNameInput').value = user.name || '';
  
  const initials = user.avatar ||
    (user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'JP');

  const avatarEl = document.getElementById('profileAvatar');
  if (avatarEl) {
    if (user.picture) {
      avatarEl.innerHTML = `<img src="${user.picture}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" alt="${initials}">`;
    } else {
      avatarEl.textContent = initials;
    }
  }

  // Ocultar campo de contraseña actual si es un usuario que solo se loguea con Google
  const currentPwWrap = document.getElementById('profilePasswordCurrentWrap');
  if (user.picture && currentPwWrap) {
    currentPwWrap.style.display = 'none'; // No tiene contraseña local seteada inicialmente
  } else if (currentPwWrap) {
    currentPwWrap.style.display = '';
  }
}

async function profileUpdateInfo() {
  const name = document.getElementById('profileNameInput').value.trim();
  if (!name) {
    showToast('⚠️ El nombre no puede estar vacío', true);
    return;
  }

  if (IS_SERVER) {
    try {
      const data = await apiFetch('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name })
      });
      if (data.error) throw new Error(data.error);
      
      // Actualizar datos de sesión y UI
      currentUserEmail = data.user.email;
      localStorage.setItem(AUTH_KEY, JSON.stringify(data.user));
      
      // Actualizar barra lateral
      const initials = data.user.avatar || 'JP';
      const avatarSidebar = document.querySelector('.sidebar-footer .user-avatar');
      const nameSidebar = document.querySelector('.sidebar-footer .user-name');
      if (avatarSidebar) {
        if (data.user.picture) {
          avatarSidebar.innerHTML = `<img src="${data.user.picture}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" alt="${initials}">`;
        } else {
          avatarSidebar.textContent = initials;
        }
      }
      if (nameSidebar) nameSidebar.textContent = data.user.name;

      showToast('✅ Información de perfil actualizada');
      enterPerfilView();
    } catch (e) {
      console.error("Error al actualizar perfil:", e);
      showToast("⚠️ " + e.message, true);
    }
  } else {
    // Fallback local
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      user.name = name;
      const parts = name.split(' ');
      user.avatar = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
      
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      
      // Actualizar barra lateral
      const avatarSidebar = document.querySelector('.sidebar-footer .user-avatar');
      const nameSidebar = document.querySelector('.sidebar-footer .user-name');
      if (avatarSidebar) avatarSidebar.textContent = user.avatar;
      if (nameSidebar) nameSidebar.textContent = user.name;

      showToast('✅ Información de perfil actualizada localmente');
      enterPerfilView();
    }
  }
}

async function profileUpdatePassword() {
  const currentPw = document.getElementById('profilePasswordCurrent').value;
  const newPw = document.getElementById('profilePasswordNew').value;
  const newPwConfirm = document.getElementById('profilePasswordNewConfirm').value;

  if (IS_SERVER) {
    if (!newPw || newPw.length < 6) {
      showToast('⚠️ La nueva contraseña debe tener al menos 6 caracteres', true);
      return;
    }
    if (newPw !== newPwConfirm) {
      showToast('⚠️ Las contraseñas nuevas no coinciden', true);
      return;
    }

    try {
      const data = await apiFetch('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPw,
          new_password: newPw
        })
      });
      if (data.error) throw new Error(data.error);

      showToast('✅ Contraseña actualizada correctamente');
      document.getElementById('profilePasswordCurrent').value = '';
      document.getElementById('profilePasswordNew').value = '';
      document.getElementById('profilePasswordNewConfirm').value = '';
    } catch (e) {
      console.error("Error al cambiar contraseña:", e);
      showToast("⚠️ " + e.message, true);
    }
  } else {
    showToast('ℹ️ El cambio de contraseña no está disponible en modo local offline', true);
  }
}

