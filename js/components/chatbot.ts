import { chatService, ChatMessage } from '../services/chatService.js';

export class Chatbot {
  private container: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputField: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private isOpen: boolean = false;
  private history: ChatMessage[] = [];

  constructor() {
    this.container = document.getElementById('chatbotWindow') as HTMLElement;
    this.messagesContainer = document.getElementById('chatbotMessages') as HTMLElement;
    this.inputField = document.getElementById('chatbotInput') as HTMLInputElement;
    this.sendButton = document.getElementById('chatbotSendBtn') as HTMLButtonElement;

    this.initListeners();
  }

  private initListeners() {
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

  public toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.container.classList.add('is-open');
      this.inputField.focus();
    } else {
      this.container.classList.remove('is-open');
    }
  }

  public closeChat() {
    this.isOpen = false;
    this.container.classList.remove('is-open');
  }

  private addMessageToUI(content: string, role: 'user' | 'assistant') {
    const msgEl = document.createElement('div');
    msgEl.classList.add('chat-message', role === 'user' ? 'user' : 'ai');
    msgEl.textContent = content;
    this.messagesContainer.appendChild(msgEl);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private showTypingIndicator() {
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

  private removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  public async sendMessage() {
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
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if the chatbot HTML exists
  if (document.getElementById('chatbotWindow')) {
    new Chatbot();
  }
});
