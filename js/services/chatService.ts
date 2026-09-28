export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatService {
  private endpoint = '/api/ai/chat';

  async sendMessage(message: string, history: ChatMessage[] = []): Promise<string> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers here if needed
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
