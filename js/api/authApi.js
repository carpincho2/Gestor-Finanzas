import { apiFetch } from './apiClient.js';

export async function login(email, password) {
  return await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function register(name, email, password) {
  return await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  });
}

export async function loginWithGoogle(credential) {
  return await apiFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential })
  });
}

export async function fetchMe() {
  return await apiFetch('/auth/me');
}

export async function logout() {
  return await apiFetch('/auth/me', { method: 'POST' });
}

export async function deleteAccount() {
  return await apiFetch('/auth/me', { method: 'DELETE' });
}

export async function updateProfile(name) {
  return await apiFetch('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ name })
  });
}

export async function updatePassword(current_password, new_password) {
  return await apiFetch('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password, new_password })
  });
}
