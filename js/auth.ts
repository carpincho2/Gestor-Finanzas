// @ts-nocheck
import { checkSession, loginUser, registerUser, googleLoginUser, saveSession } from './services/authService.ts';

/* ---- Check if already logged in ---- */
export async function authCheckSession() {
  const user = await checkSession();
  if (user) {
    authFinishLogin(user, true);
  }
}

/* ---- Tab switch ---- */
export function authSwitchTab(tab) {
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
export function authTogglePw(inputId, btn) {
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
export function authShowError(msg, isOk = false) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = '';
  el.style.background   = isOk ? 'rgba(0,229,160,.1)'  : 'rgba(255,74,107,.1)';
  el.style.borderColor  = isOk ? 'rgba(0,229,160,.25)' : 'rgba(255,74,107,.25)';
  el.style.color        = isOk ? 'var(--accent)'        : 'var(--danger)';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---- Login ---- */
export async function authLogin() {
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

  try {
    const user = await loginUser(email, pw);
    authFinishLogin(user);
  } catch(e) {
    btn.classList.remove('loading');
    btn.textContent = 'Iniciar sesión';
    authShowError('⚠️ ' + e.message);
  }
}

/* ---- Register ---- */
export async function authRegister() {
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

  try {
    const user = await registerUser(name, email, pw);
    authFinishLogin(user);
  } catch(e) {
    btn.classList.remove('loading');
    btn.textContent = 'Crear cuenta';
    authShowError('⚠️ ' + e.message);
  }
}

/* ---- Google Sign In ---- */
const GOOGLE_CLIENT_ID = window.FLUJO_GOOGLE_CLIENT_ID || '';

export async function handleGoogleCredential(response) {
  try {
    let payload = null;
    try {
      const base64  = response.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      payload = JSON.parse(decodeURIComponent(
        atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      ));
    } catch(e) {
      // Ignored if server will validate anyway, but needed for local file:// mode
    }
    
    const user = await googleLoginUser(response.credential, payload);
    authFinishLogin(user);
  } catch(e) {
    authShowError('⚠️ Error Google: ' + e.message);
  }
}

export function initGoogleAuth() {
  if (!GOOGLE_CLIENT_ID) {
    console.warn('Google Sign-In no configurado. Falta CLIENT_ID.');
    return;
  }

  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.initialize({
      client_id:             GOOGLE_CLIENT_ID,
      callback:              handleGoogleCredential,
      context:               'signin',
      ux_mode:               'popup',
      cancel_on_tap_outside: false
    });

    const container = document.getElementById('googleBtnContainer');
    if (container) {
      google.accounts.id.renderButton(container, {
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        locale: 'es',
        width: 400
      });

      const customBtn = document.getElementById('authBtnGoogleCustom');
      if (customBtn) {
        container.addEventListener('mouseenter', () => customBtn.classList.add('hover'));
        container.addEventListener('mouseleave', () => customBtn.classList.remove('hover'));
      }
    }
  } else {
    setTimeout(initGoogleAuth, 300);
  }
}

/* ---- Forgot password ---- */
export function authForgot() {
  const email = document.getElementById('authLoginEmail').value.trim();
  if (!email) {
    authShowError('ℹ️ Ingresá tu email arriba y presioná el link de nuevo.', false);
    return;
  }
  authShowError('✅ Si existe una cuenta con ese email, recibirás instrucciones en tu casilla.', true);
}

/* ---- Finish login: save session and redirect to main.html ---- */
export function authFinishLogin(user, instant) {
  saveSession(user);
  window.location.href = 'main.html';
}

// Attach globals for HTML onclicks
window.authSwitchTab = authSwitchTab;
window.authTogglePw = authTogglePw;
window.authForgot = authForgot;
window.authLogin = authLogin;
window.authRegister = authRegister;

// Ejecutar chequeo de sesión al cargar e inicializar Google Sign-In
authCheckSession();
initGoogleAuth();

