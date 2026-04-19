import { UIManager } from './UIManager.js';

export class ErrorHandler {
  static handle(error, context = '') {
    console.error(`[Error ${context}]:`, error);
    
    let userMessage = 'Ocurrió un error inesperado.';
    
    if (error.message.includes('QuotaExceededError')) {
      userMessage = 'No hay espacio suficiente en el almacenamiento local.';
    } else if (error.message.includes('Descripción requerida') || error.message.includes('Monto')) {
      userMessage = `Error de validación: ${error.message}`;
    } else {
      userMessage = `Error: ${error.message}`;
    }

    UIManager.showToast(userMessage, true);
  }

  static runSafe(fn, context = '') {
    try {
      return fn();
    } catch (error) {
      this.handle(error, context);
    }
  }

  static async runSafeAsync(fn, context = '') {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
    }
  }
}
