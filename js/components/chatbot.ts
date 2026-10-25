// @ts-nocheck
import { chatService } from '../services/chatService.ts';

export class Chatbot {
  constructor() {
    this.container = document.getElementById('chatbotWindow');
    this.messagesContainer = document.getElementById('chatbotMessages');
    this.inputField = document.getElementById('chatbotInput');
    this.sendButton = document.getElementById('chatbotSendBtn');
    this.isOpen = false;
    this.history = [];

    this.initListeners();
  }

  initListeners() {
    const toggleBtn = document.getElementById('chatbotToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleChat());
    }

    const closeBtn = document.getElementById('chatbotCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeChat());
    }

    if (this.sendButton) {
      this.sendButton.addEventListener('click', () => this.sendMessage());
    }

    if (this.inputField) {
      this.inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.sendMessage();
        }
      });
    }
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.container.classList.add('is-open');
      this.inputField.focus();
    } else {
      this.container.classList.remove('is-open');
    }
  }

  closeChat() {
    this.isOpen = false;
    this.container.classList.remove('is-open');
  }

  addMessageToUI(content, role) {
    const msgEl = document.createElement('div');
    msgEl.classList.add('chat-message', role === 'user' ? 'user' : 'ai');
    msgEl.textContent = content;
    this.messagesContainer.appendChild(msgEl);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.classList.add('chat-message', 'ai');
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    this.messagesContainer.appendChild(indicator);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  async sendMessage() {
    const text = this.inputField.value.trim();
    if (!text) return;

    this.inputField.value = '';
    this.sendButton.disabled = true;

    // Add user message to UI and history
    this.addMessageToUI(text, 'user');
    this.history.push({ role: 'user', content: text });

    this.showTypingIndicator();

    try {
      // Send to backend
      const response = await chatService.sendMessage(text, this.history);

      this.removeTypingIndicator();

      // Add AI response to UI and history
      this.addMessageToUI(response, 'assistant');
      this.history.push({ role: 'assistant', content: response });
    } catch (error) {
      this.removeTypingIndicator();
      this.addMessageToUI('Error de conexión. Intenta de nuevo.', 'assistant');
    } finally {
      this.sendButton.disabled = false;
      this.inputField.focus();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('chatbotWindow')) {
      new Chatbot();
    }
  });
} else if (document.getElementById('chatbotWindow')) {
  new Chatbot();
}
