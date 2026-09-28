// @ts-nocheck
export class CameraService {
  constructor() {
    this.stream = null;
  }

  async startCamera(videoElement) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      videoElement.srcObject = this.stream;
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      throw err;
    }
  }

  stopCamera(videoElement) {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }

  captureFrame(videoElement, canvasElement) {
    if (!this.stream || videoElement.readyState < 2) {
      throw new Error('Camera not ready');
    }
    canvasElement.width = videoElement.videoWidth || 1280;
    canvasElement.height = videoElement.videoHeight || 720;
    canvasElement.getContext('2d').drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    return canvasElement.toDataURL('image/jpeg', 0.95);
  }

  isStreaming() {
    return !!this.stream;
  }
}

export const cameraService = new CameraService();

