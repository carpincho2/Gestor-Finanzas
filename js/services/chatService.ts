// @ts-nocheck
import { API_BASE } from '../store/store.ts';
import { getAuthToken } from '../api/apiClient.ts';

/**
 * @typedef {Object} ChatMessage
 * @property {'user' | 'assistant'} role
 * @property {string} content
 */

export class ChatService {
  constructor() {
    this.endpoint = (API_BASE || '/api') + '/ai/chat';
  }

  /**
   * @param {string} message
   * @param {ChatMessage[]} [history=[]]
   * @returns {Promise<string>}
   */
  async sendMessage(message, history = []) {
    try {
      const token = getAuthToken();
      const contexto = typeof window.aiBuildContext === 'function'
        ? window.aiBuildContext()
        : 'Usuario consultando desde el asistente rápido de Flujo.';
      const cleanHistory = Array.isArray(history) ? history.slice(0, -1) : [];

      const response = await fetch(this.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          contexto_financiero: contexto,
          pregunta: message,
          historial: cleanHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.reply || data.message || data.content || 'Sin respuesta del servidor.';
    } catch (error) {
      console.error('Error sending message to AI:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService();
