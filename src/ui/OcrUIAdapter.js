/**
 * OcrUIAdapter — Adaptador de Entrada (UI)
 * 
 * ¿Qué es un Adaptador de Entrada?
 * En Arquitectura Hexagonal, los adaptadores de entrada capturan
 * las acciones del usuario (clicks, uploads) y las convierten en
 * llamadas a los Casos de Uso de la aplicación.
 * 
 * Este adaptador maneja toda la lógica de la interfaz del escáner OCR:
 * - Apertura/cierre del modal
 * - Captura de imagen (cámara o archivo)
 * - Drag & Drop
 * - Barra de progreso
 * - Visualización de resultados editables
 * - Confirmación para crear la transacción
 */
import { ErrorHandler } from '../shared/ErrorHandler.js';
import { UIManager } from '../shared/UIManager.js';

export class OcrUIAdapter {
  /**
   * @param {App} app — Referencia a la aplicación principal
   * @param {object} useCases — Objeto con los casos de uso inyectados
   *   - useCases.scanReceipt: ScanReceiptUseCase
   *   - useCases.addTransaction: AddTransactionUseCase
   */
  constructor(app, useCases) {
    this.app = app;
    this.useCases = useCases;
    this.currentImageFile = null;
    this.setupEventListeners();
  }

  /**
   * Registra todos los event listeners del modal OCR.
   * 
   * ¿Por qué usamos addEventListener en vez de onclick?
   * Porque es el patrón que sigue el proyecto (eliminamos deuda técnica
   * de atributos inline). Además, addEventListener permite múltiples
   * listeners y es más fácil de limpiar.
   */
  setupEventListeners() {
    // --- Botón para abrir el modal ---
    const scanBtn = document.getElementById('openOcrModalBtn');
    if (scanBtn) {
      scanBtn.addEventListener('click', () => this.openModal());
    }

    // --- Botón para cerrar el modal ---
    const closeBtn = document.getElementById('closeOcrModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    // --- Click en overlay para cerrar ---
    const overlay = document.getElementById('ocrModalOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });
    }

    // --- Input de archivo ---
    const fileInput = document.getElementById('ocrFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // --- Drag & Drop ---
    const dropZone = document.getElementById('ocrDropZone');
    if (dropZone) {
      // preventDefault es NECESARIO para que funcione el drop.
      // Sin esto, el navegador abre la imagen en una pestaña nueva.
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        this.handleDrop(e);
      });
      // Click en la zona de drop también abre el selector de archivos
      dropZone.addEventListener('click', () => {
        fileInput?.click();
      });
    }

    // --- Botón de cámara (dispositivos móviles) ---
    const cameraBtn = document.getElementById('ocrCameraBtn');
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        const cameraInput = document.getElementById('ocrCameraInput');
        if (cameraInput) cameraInput.click();
      });
    }
    const cameraInput = document.getElementById('ocrCameraInput');
    if (cameraInput) {
      cameraInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // --- Botón de confirmar transacción ---
    const confirmBtn = document.getElementById('ocrConfirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.confirmTransaction());
    }

    // --- Botón de reintentar ---
    const retryBtn = document.getElementById('ocrRetryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.resetToUpload());
    }
  }

  /**
   * Abre el modal de OCR y muestra la vista de carga.
   */
  openModal() {
    const modal = document.getElementById('ocrModalOverlay');
    if (modal) {
      modal.classList.add('open');
      this.resetToUpload();
    }
  }

  /**
   * Cierra el modal de OCR.
   */
  closeModal() {
    const modal = document.getElementById('ocrModalOverlay');
    if (modal) {
      modal.classList.remove('open');
      this.currentImageFile = null;
    }
  }

  /**
   * Maneja la selección de archivo desde el input.
   * 
   * @param {Event} e — Evento change del input[type=file]
   */
  handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      this.processImage(file);
    }
    // Reseteamos el input para poder seleccionar el mismo archivo de nuevo
    e.target.value = '';
  }

  /**
   * Maneja el evento de Drop (arrastrar y soltar imagen).
   * 
   * @param {DragEvent} e
   */
  handleDrop(e) {
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.processImage(file);
    } else {
      UIManager.showToast('Solo se aceptan archivos de imagen', true);
    }
  }

  /**
   * Procesa una imagen: muestra preview, ejecuta OCR, muestra resultados.
   * 
   * Este es el flujo principal del escáner:
   * 1. Guarda referencia al archivo
   * 2. Muestra la preview de la imagen
   * 3. Muestra la barra de progreso
   * 4. Ejecuta el caso de uso ScanReceipt
   * 5. Muestra los resultados o el error
   * 
   * @param {File} imageFile — Archivo de imagen seleccionado
   */
  async processImage(imageFile) {
    this.currentImageFile = imageFile;

    // Mostrar preview de la imagen
    this.showImagePreview(imageFile);

    // Cambiar a vista de progreso
    this.showPhase('processing');

    // Ejecutar el caso de uso de OCR
    await ErrorHandler.runSafeAsync(async () => {
      const result = await this.useCases.scanReceipt.execute(
        imageFile,
        (progress) => this.updateProgress(progress)
      );

      if (result.success) {
        this.showResults(result.data, result.confidence);
      } else {
        this.showError(result.error);
      }
    }, 'OCR');
  }

  /**
   * Muestra la preview de la imagen subida.
   * 
   * @param {File} file — Archivo de imagen
   */
  showImagePreview(file) {
    const preview = document.getElementById('ocrImagePreview');
    if (preview) {
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.onload = () => URL.revokeObjectURL(url);
      preview.style.display = 'block';
    }
  }

  /**
   * Controla qué "fase" del modal se muestra.
   * 
   * El modal tiene 3 fases:
   * 1. upload — Zona de drag & drop (estado inicial)
   * 2. processing — Barra de progreso + preview
   * 3. results — Formulario con datos extraídos
   * 
   * @param {'upload'|'processing'|'results'} phase
   */
  showPhase(phase) {
    const phases = ['ocrUploadPhase', 'ocrProcessingPhase', 'ocrResultsPhase'];
    phases.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const active = document.getElementById(`ocr${phase.charAt(0).toUpperCase() + phase.slice(1)}Phase`);
    if (active) active.style.display = '';
  }

  /**
   * Actualiza la barra de progreso del OCR.
   * 
   * @param {{ status: string, progress: number }} progress
   *   - status: Mensaje de estado (ej: "Leyendo texto del ticket...")
   *   - progress: Porcentaje 0-1
   */
  updateProgress(progress) {
    const bar = document.getElementById('ocrProgressBar');
    const text = document.getElementById('ocrProgressText');
    
    if (bar) {
      const pct = Math.round(progress.progress * 100);
      bar.style.width = `${pct}%`;
    }
    if (text) {
      text.textContent = progress.status;
    }
  }

  /**
   * Muestra los resultados del OCR en campos editables.
   * 
   * @param {{ desc: string, amount: number|null, date: string|null, cat: string, rawText: string }} data
   * @param {number} confidence — Nivel de confianza 0-100
   */
  showResults(data, confidence) {
    // Llenar los campos editables
    const descEl = document.getElementById('ocrDesc');
    const amountEl = document.getElementById('ocrAmount');
    const dateEl = document.getElementById('ocrDate');
    const catEl = document.getElementById('ocrCat');
    const confidenceEl = document.getElementById('ocrConfidence');
    const rawTextEl = document.getElementById('ocrRawText');

    if (descEl) descEl.value = data.desc || '';
    if (amountEl) amountEl.value = data.amount || '';
    if (dateEl) dateEl.value = data.date || new Date().toISOString().split('T')[0];
    if (catEl) catEl.value = data.cat || 'Otros';
    
    if (confidenceEl) {
      confidenceEl.textContent = `${confidence}%`;
      // Color según confianza: verde > 70%, amarillo > 40%, rojo <= 40%
      confidenceEl.className = 'ocr-confidence ' + 
        (confidence >= 70 ? 'high' : confidence >= 40 ? 'medium' : 'low');
    }

    if (rawTextEl) {
      rawTextEl.textContent = data.rawText || 'Sin texto detectado';
    }

    // Mostrar la fase de resultados
    this.showPhase('results');
  }

  /**
   * Muestra un error cuando el OCR falla.
   * 
   * @param {string} errorMessage
   */
  showError(errorMessage) {
    const errorEl = document.getElementById('ocrErrorMsg');
    if (errorEl) {
      errorEl.textContent = errorMessage;
    }
    this.showPhase('results');
    
    // Ocultar los campos de resultado y mostrar solo el error
    const form = document.getElementById('ocrResultForm');
    if (form) form.style.display = 'none';
    
    const errorSection = document.getElementById('ocrErrorSection');
    if (errorSection) errorSection.style.display = '';
  }

  /**
   * Vuelve a la vista de carga (para reintentar).
   */
  resetToUpload() {
    this.currentImageFile = null;
    this.showPhase('upload');
    
    // Resetear preview
    const preview = document.getElementById('ocrImagePreview');
    if (preview) {
      preview.src = '';
      preview.style.display = 'none';
    }
    
    // Resetear progreso
    const bar = document.getElementById('ocrProgressBar');
    if (bar) bar.style.width = '0%';
    const text = document.getElementById('ocrProgressText');
    if (text) text.textContent = 'Preparando...';
    
    // Mostrar formulario y ocultar error
    const form = document.getElementById('ocrResultForm');
    if (form) form.style.display = '';
    const errorSection = document.getElementById('ocrErrorSection');
    if (errorSection) errorSection.style.display = 'none';
  }

  /**
   * Confirma la transacción con los datos del OCR (editados o no por el usuario).
   * Usa el AddTransactionUseCase existente para crear la transacción.
   */
  confirmTransaction() {
    ErrorHandler.runSafe(() => {
      const txData = {
        type: 'expense', // Los tickets siempre son gastos
        desc: document.getElementById('ocrDesc')?.value.trim(),
        amount: parseFloat(document.getElementById('ocrAmount')?.value),
        cat: document.getElementById('ocrCat')?.value,
        date: document.getElementById('ocrDate')?.value || new Date().toISOString().split('T')[0]
      };

      // Usamos el mismo caso de uso que ya existe para agregar transacciones
      this.useCases.addTransaction.execute(txData);

      // Feedback y limpieza
      UIManager.showToast('✅ Transacción creada desde ticket escaneado');
      this.closeModal();
      this.app.renderAll();
    }, 'Confirmar OCR');
  }
}
