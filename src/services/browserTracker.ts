import { RawDetection } from './aiDetector';
import { TrackedEntity } from '../types';

function computeIoU(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number]
): number {
  const xA = Math.max(boxA[0], boxB[0]);
  const yA = Math.max(boxA[1], boxB[1]);
  const xB = Math.min(boxA[2], boxB[2]);
  const yB = Math.min(boxA[3], boxB[3]);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
  const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);

  return interArea / (boxAArea + boxBArea - interArea + 1e-6);
}

export class BrowserByteTracker {
  private tracks: Map<string, TrackedEntity & { lostFrames: number; crossedLine: boolean }> = new Map();
  private pedCounter = 0;
  private vehCounter = 0;
  private matchThresh = 0.35;
  private maxLostFrames = 20;

  // Cumulative line counts
  public inCount = 0;
  public outCount = 0;

  reset() {
    this.tracks.clear();
    this.pedCounter = 0;
    this.vehCounter = 0;
    this.inCount = 0;
    this.outCount = 0;
  }

  private generateId(className: string): string {
    if (className === 'person') {
      this.pedCounter += 1;
      return `P-${String(this.pedCounter).padStart(3, '0')}`;
    } else {
      this.vehCounter += 1;
      return `V-${String(this.vehCounter).padStart(3, '0')}`;
    }
  }

  update(
    detections: RawDetection[],
    countingLineY: number | null = null
  ): TrackedEntity[] {
    const matchedTrackIds = new Set<string>();
    const matchedDetIndices = new Set<number>();

    // Step 1: Match detections to existing tracks via IoU
    for (let dIdx = 0; dIdx < detections.length; dIdx++) {
      const det = detections[dIdx];
      let bestIoU = this.matchThresh;
      let bestTrackId: string | null = null;

      for (const [tId, track] of this.tracks.entries()) {
        if (matchedTrackIds.has(tId)) continue;
        const isPedDet = det.className === 'person';
        const isPedTrk = track.class === 'person';
        if (isPedDet !== isPedTrk) continue;

        const iou = computeIoU(det.bbox, track.bbox);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestTrackId = tId;
        }
      }

      if (bestTrackId) {
        const existing = this.tracks.get(bestTrackId)!;
        existing.bbox = det.bbox;
        existing.center = det.center;
        existing.confidence = det.confidence;
        existing.lostFrames = 0;

        existing.history.push(det.center);
        if (existing.history.length > 20) {
          existing.history.shift();
        }

        // Calculate speed in km/h based on movement
        if (existing.history.length >= 2) {
          const prev = existing.history[existing.history.length - 2];
          const curr = existing.history[existing.history.length - 1];
          const distPx = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
          // Approximate calibration: 1px/frame @ 30fps ~ 2.5 km/h
          existing.speedKmh = Math.round(distPx * 2.4 * 10) / 10;
        }

        // Virtual Tripwire check
        if (countingLineY && !existing.crossedLine && existing.history.length >= 2) {
          const prevY = existing.history[existing.history.length - 2][1];
          const currY = existing.history[existing.history.length - 1][1];
          if (prevY < countingLineY && currY >= countingLineY) {
            existing.crossedLine = true;
            this.inCount += 1;
          } else if (prevY > countingLineY && currY <= countingLineY) {
            existing.crossedLine = true;
            this.outCount += 1;
          }
        }

        matchedTrackIds.add(bestTrackId);
        matchedDetIndices.add(dIdx);
      }
    }

    // Step 2: Initialize new tracks for unmatched detections
    for (let dIdx = 0; dIdx < detections.length; dIdx++) {
      if (!matchedDetIndices.has(dIdx)) {
        const det = detections[dIdx];
        const newId = this.generateId(det.className);
        this.tracks.set(newId, {
          id: newId,
          class: det.className,
          confidence: det.confidence,
          bbox: det.bbox,
          center: det.center,
          history: [det.center],
          speedKmh: det.className === 'person' ? 4.5 : 15.0,
          lostFrames: 0,
          crossedLine: false
        });
      }
    }

    // Step 3: Handle lost tracks and remove stale tracks
    const toDelete: string[] = [];
    for (const [tId, track] of this.tracks.entries()) {
      if (!matchedTrackIds.has(tId)) {
        track.lostFrames += 1;
        if (track.lostFrames > this.maxLostFrames) {
          toDelete.push(tId);
        }
      }
    }

    for (const tId of toDelete) {
      this.tracks.delete(tId);
    }

    // Return active tracks (present in this frame)
    return Array.from(this.tracks.values()).filter((t) => t.lostFrames === 0);
  }
}
