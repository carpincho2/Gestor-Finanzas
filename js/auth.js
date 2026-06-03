/* =====================================================
   AUTH SYSTEM — Dedicated script for index.html
   ===================================================== */

const AUTH_KEY = 'flujo_auth_user';

// Modo servidor vs. archivo local
const IS_SERVER = window.location.protocol !== 'file:';

// Base URL de la API (si está en localhost apunta al puerto 8000 de FastAPI)
const API_BASE = IS_SERVER
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://' + window.location.hostname + ':8000/api'
      : window.location.origin + '/api')
  : null;

// Helper: llamadas a la API
async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  const r   = await fetch(url, {
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

/* ---- Check if already logged in ---- */
async function authCheckSession() {
  if (IS_SERVER) {
    try {
      const data = await apiFetch('/auth/me');
      if (data.user) { authFinishLogin(data.user, true); return; }
    } catch(e) { /* no hay sesión activa */ }
  } else {
    // Fallback localStorage (modo file://)
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored);
        authFinishLogin(user, true);
      } catch(e) { localStorage.removeItem(AUTH_KEY); }
    }
  }
}

/* ---- Tab switch ---- */
function authSwitchTab(tab) {
  const loginForm    = document.getElementById('authLoginForm');
  const registerForm = document.getElementById('authRegisterForm');
  const tabLogin     = document.getElementById('authTabLogin');
  const tabRegister  = document.getElementById('authTabRegister');
  const errorEl      = document.getElementById('authError');

  errorEl.style.display = 'none';

  if (tab === 'login') {
    loginForm.style.display    = '';
    registerForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
  } else {
    loginForm.style.display    = 'none';
    registerForm.style.display = '';
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
  }
}

/* ---- Show/hide password ---- */
function authTogglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type   = 'text';
    btn.innerHTML = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    input.type   = 'password';
    btn.innerHTML = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

/* ---- Auth error / success message ---- */
function authShowError(msg, isOk = false) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = '';
  el.style.background   = isOk ? 'rgba(0,229,160,.1)'  : 'rgba(255,74,107,.1)';
  el.style.borderColor  = isOk ? 'rgba(0,229,160,.25)' : 'rgba(255,74,107,.25)';
  el.style.color        = isOk ? 'var(--accent)'        : 'var(--danger)';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---- Login ---- */
async function authLogin() {
  const email = document.getElementById('authLoginEmail').value.trim();
  const pw    = document.getElementById('authLoginPw').value;

  if (!email) { authShowError('⚠️ Ingresá tu correo electrónico.'); return; }
  if (!pw)    { authShowError('⚠️ Ingresá tu contraseña.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    authShowError('⚠️ El correo no tiene un formato válido.'); return;
  }

  const btn = document.getElementById('authLoginBtn');
  btn.classList.add('loading');
  btn.textContent = ' Iniciando sesión…';

  if (IS_SERVER) {
    // ─── Modo Python Backend ───
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pw })
      });
      authFinishLogin(data.user);
    } catch(e) {
      btn.classList.remove('loading');
      btn.textContent = 'Iniciar sesión';
      authShowError('⚠️ ' + e.message);
    }
  } else {
    // ─── Fallback localStorage ───
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('flujo_users') || '[]');
      const found = users.find(u => u.email === email && u.pw === pw);
      btn.classList.remove('loading');
      btn.textContent = 'Iniciar sesión';
      if (!found) {
        authShowError('⚠️ Email o contraseña incorrectos. ¿Todavía no tenés cuenta? Registrate.');
        return;
      }
      const user = { name: found.name, email: found.email, avatar: found.avatar };
      authFinishLogin(user);
    }, 700);
  }
}

/* ---- Register ---- */
async function authRegister() {
  const name   = document.getElementById('authRegName').value.trim();
  const email  = document.getElementById('authRegEmail').value.trim();
  const pw     = document.getElementById('authRegPw').value;
  const pwConf = document.getElementById('authRegPwConfirm').value;

  if (!name)  { authShowError('⚠️ Ingresá tu nombre completo.'); return; }
  if (!email) { authShowError('⚠️ Ingresá tu correo electrónico.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    authShowError('⚠️ El correo no tiene un formato válido.'); return;
  }
  if (pw.length < 6) { authShowError('⚠️ La contraseña debe tener al menos 6 caracteres.'); return; }
  if (pw !== pwConf) { authShowError('⚠️ Las contraseñas no coinciden.'); return; }

  const btn = document.getElementById('authRegisterBtn');
  btn.classList.add('loading');
  btn.textContent = ' Creando cuenta…';

  if (IS_SERVER) {
    // ─── Modo Python Backend ───
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password: pw })
      });
      authFinishLogin(data.user);
    } catch(e) {
      btn.classList.remove('loading');
      btn.textContent = 'Crear cuenta';
      authShowError('⚠️ ' + e.message);
    }
  } else {
    // ─── Fallback localStorage ───
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('flujo_users') || '[]');
      if (users.find(u => u.email === email)) {
        btn.classList.remove('loading');
        btn.textContent = 'Crear cuenta';
        authShowError('⚠️ Ya existe una cuenta con ese correo. Iniciá sesión.');
        return;
      }
      const parts  = name.split(' ');
      const avatar = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
      users.push({ name, email, pw, avatar });
      localStorage.setItem('flujo_users', JSON.stringify(users));
      const user = { name, email, avatar };
      authFinishLogin(user);
    }, 700);
  }
}

/* ---- Google Sign In ---- */
const GOOGLE_CLIENT_ID = window.FLUJO_GOOGLE_CLIENT_ID || '';

function handleGoogleCredential(response) {
  const googleBtn = document.querySelector('.auth-btn-google');
  if (googleBtn) googleBtn.classList.add('loading');

  if (IS_SERVER) {
    apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: response.credential })
    }).then(data => {
      authFinishLogin(data.user);
    }).catch(e => {
      if (googleBtn) googleBtn.classList.remove('loading');
      authShowError('⚠️ Error Google: ' + e.message);
    });
  } else {
    try {
      const base64  = response.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const payload = JSON.parse(decodeURIComponent(
        atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      ));
      const parts  = (payload.name || payload.email).split(' ');
      const avatar = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
      const user   = { name: payload.name || payload.email, email: payload.email, avatar, picture: payload.picture };
      authFinishLogin(user);
    } catch(e) {
      if (googleBtn) googleBtn.classList.remove('loading');
      authShowError('⚠️ Error procesando respuesta de Google. Intentá de nuevo.');
    }
  }
}

function authGoogle() {
  if (!GOOGLE_CLIENT_ID) {
    authShowError('⚠️ Google Sign-In no está configurado. Ejecutá iniciar_servidor.bat y configurá tu CLIENT_ID.');
    return;
  }

  if (typeof google === 'undefined' || !google.accounts) {
    setTimeout(() => authShowError('⚠️ Cargando Google… intentá de nuevo en un segundo.'), 300);
    return;
  }

  const googleBtn = document.querySelector('.auth-btn-google');
  if (googleBtn) googleBtn.classList.add('loading');

  google.accounts.id.initialize({
    client_id:             GOOGLE_CLIENT_ID,
    callback:              handleGoogleCredential,
    context:               'signin',
    ux_mode:               'popup',
    cancel_on_tap_outside: false
  });

  google.accounts.id.prompt(notification => {
    if (googleBtn) googleBtn.classList.remove('loading');
    if (notification.isNotDisplayed()) {
      authShowError('⚠️ El popup de Google fue bloqueado. Verificá que estés en http://localhost y que el CLIENT_ID sea correcto.');
    }
  });
}

/* ---- Forgot password ---- */
function authForgot() {
  const email = document.getElementById('authLoginEmail').value.trim();
  if (!email) {
    authShowError('ℹ️ Ingresá tu email arriba y presioná el link de nuevo.', false);
    return;
  }
  authShowError('✅ Si existe una cuenta con ese email, recibirás instrucciones en tu casilla.', true);
}

/* ---- Finish login: save session and redirect to main.html ---- */
function authFinishLogin(user, instant) {
  // Guardar sesión en localStorage siempre para que sea leída por main.html
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  
  // Redirigir directamente al Gestor principal (main.html)
  window.location.href = 'main.html';
}

// Ejecutar chequeo de sesión al cargar
authCheckSession();
