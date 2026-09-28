import { IS_SERVER } from '../store/store.ts';
import { login, register, loginWithGoogle, fetchMe } from '../api/authApi.ts';

const AUTH_KEY = 'flujo_auth_user';

export async function checkSession() {
  if (IS_SERVER) {
    try {
      const data = await fetchMe();
      if (data.user) return data.user;
    } catch (e) {
      // no hay sesión activa
    }
  } else {
    // Fallback localStorage (modo file://)
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored);
        return user;
      } catch (e) {
        localStorage.removeItem(AUTH_KEY);
      }
    }
  }
  return null;
}

export async function loginUser(email, pw) {
  if (IS_SERVER) {
    const data = await login(email, pw);
    return data.user;
  } else {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = JSON.parse(localStorage.getItem('flujo_users') || '[]');
        const found = users.find(u => u.email === email && u.pw === pw);
        if (!found) {
          reject(new Error('Email o contraseña incorrectos. ¿Todavía no tenés cuenta? Registrate.'));
          return;
        }
        const user = { name: found.name, email: found.email, avatar: found.avatar };
        resolve(user);
      }, 700);
    });
  }
}

export async function registerUser(name, email, pw) {
  if (IS_SERVER) {
    const data = await register(name, email, pw);
    return data.user;
  } else {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = JSON.parse(localStorage.getItem('flujo_users') || '[]');
        if (users.find(u => u.email === email)) {
          reject(new Error('Ya existe una cuenta con ese correo. Iniciá sesión.'));
          return;
        }
        const parts = name.split(' ');
        const avatar = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
        users.push({ name, email, pw, avatar });
        localStorage.setItem('flujo_users', JSON.stringify(users));
        const user = { name, email, avatar };
        resolve(user);
      }, 700);
    });
  }
}

export async function googleLoginUser(credential, payload) {
  if (IS_SERVER) {
    const data = await loginWithGoogle(credential);
    return data.user;
  } else {
    return new Promise((resolve, reject) => {
      try {
        const parts = (payload.name || payload.email).split(' ');
        const avatar = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
        const user = { name: payload.name || payload.email, email: payload.email, avatar, picture: payload.picture };
        resolve(user);
      } catch (e) {
        reject(new Error('Error procesando respuesta de Google. Intentá de nuevo.'));
      }
    });
  }
}

export function saveSession(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}
