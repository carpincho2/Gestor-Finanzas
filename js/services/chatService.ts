// @ts-nocheck
import { API_BASE } from '../store/store.ts';

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
      const response = await fetch(this.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history
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
