import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface RawDetection {
  className: 'person' | 'car' | 'motorcycle' | 'bicycle' | 'bus' | 'truck';
  confidence: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  center: [number, number];
}

const TARGET_CLASSES: Record<string, 'person' | 'car' | 'motorcycle' | 'bicycle' | 'bus' | 'truck'> = {
  person: 'person',
  car: 'car',
  motorcycle: 'motorcycle',
  bicycle: 'bicycle',
  bus: 'bus',
  truck: 'truck'
};

class AIDetectorService {
  private model: cocoSsd.ObjectDetection | null = null;
  private loadingPromise: Promise<cocoSsd.ObjectDetection> | null = null;
  private isModelReady: boolean = false;
  private loadError: string | null = null;

  async loadModel(): Promise<cocoSsd.ObjectDetection> {
    if (this.model) {
      return this.model;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      try {
        console.log('[CampusGuard AI] Initializing TensorFlow.js backend and loading COCO-SSD model...');
        await tf.ready();
        // Load mobilenet_v2 for fast real-time frame detection
        const loaded = await cocoSsd.load({ base: 'mobilenet_v2' });
        this.model = loaded;
        this.isModelReady = true;
        this.loadError = null;
        console.log('[CampusGuard AI] COCO-SSD object detection model loaded successfully.');
        return loaded;
      } catch (err: any) {
        console.error('[CampusGuard AI] Failed to load COCO-SSD model:', err);
        this.loadError = err.message || 'Failed to initialize TensorFlow model';
        throw err;
      }
    })();

    return this.loadingPromise;
  }

  isReady(): boolean {
    return this.isModelReady;
  }

  getError(): string | null {
    return this.loadError;
  }

  /**
   * Runs real-time inference on an HTMLVideoElement, HTMLCanvasElement, or HTMLImageElement
   */
  async detectFrame(
    element: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    canvasWidth: number,
    canvasHeight: number,
    minConfidence: number = 0.4
  ): Promise<RawDetection[]> {
    if (!this.model) {
      return [];
    }

    try {
      const predictions = await this.model.detect(element, 20, minConfidence);
      const results: RawDetection[] = [];

      // Determine element resolution vs canvas resolution for coordinate mapping
      let elemW = canvasWidth;
      let elemH = canvasHeight;

      if (element instanceof HTMLVideoElement) {
        elemW = element.videoWidth || canvasWidth;
        elemH = element.videoHeight || canvasHeight;
      } else if (element instanceof HTMLImageElement) {
        elemW = element.naturalWidth || canvasWidth;
        elemH = element.naturalHeight || canvasHeight;
      }

      const scaleX = canvasWidth / elemW;
      const scaleY = canvasHeight / elemH;

      for (const pred of predictions) {
        const clsLower = pred.class.toLowerCase();
        const mappedClass = TARGET_CLASSES[clsLower];

        if (mappedClass && pred.score >= minConfidence) {
          const [bx, by, bw, bh] = pred.bbox;

          // Scale bbox coordinates to match canvas
          const x1 = Math.round(bx * scaleX);
          const y1 = Math.round(by * scaleY);
          const x2 = Math.round((bx + bw) * scaleX);
          const y2 = Math.round((by + bh) * scaleY);
          const cx = Math.round((x1 + x2) / 2);
          const cy = Math.round((y1 + y2) / 2);

          results.push({
            className: mappedClass,
            confidence: Math.round(pred.score * 100) / 100,
            bbox: [x1, y1, x2, y2],
            center: [cx, cy]
          });
        }
      }

      return results;
    } catch (err) {
      console.warn('[CampusGuard AI] Inference error during frame analysis:', err);
      return [];
    }
  }
}

export const aiDetector = new AIDetectorService();
