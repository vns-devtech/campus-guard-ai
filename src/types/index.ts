export type UserRole = 'admin' | 'operator';

export interface MonitoredZone {
  id: string;
  name: string;
  location: string;
  type: string;
  speedLimitKmh: number;
  pedestrianCapacity: number;
  coordinates: [number, number][];
  countingLine?: { x1: number; y1: number; x2: number; y2: number };
}

export interface VideoSourceItem {
  id: string;
  name: string;
  type: 'cctv_ip' | 'webcam' | 'uploaded_video' | 'recorded_clip';
  zoneId: string;
  location: string;
  rtspUrl?: string;
  status: 'active' | 'offline' | 'paused';
  fps: number;
  resolution: string;
  isDefault?: boolean;
  videoUrl?: string;
  fileSize?: string;
  duration?: string;
}

export type RiskSeverity = 'Critical' | 'High' | 'Warning' | 'Low';
export type IncidentStatus = 'New' | 'Under Review' | 'Resolved' | 'False Positive';

export interface Incident {
  id: string;
  timestamp: string;
  zoneId: string;
  zoneName: string;
  cameraSource: string;
  riskType: string;
  severity: RiskSeverity;
  pedestrianTrackId: string;
  vehicleTrackId: string;
  vehicleClass: string;
  estimatedProximityMeters: number;
  detectionConfidence: number;
  pedestrianCountInZone: number;
  vehicleCountInZone: number;
  ruleTriggered: string;
  status: IncidentStatus;
  reviewedBy: string | null;
  notes: string | null;
  evidenceSnapshot?: string | null;
}

export interface TrackedEntity {
  id: string;
  class: 'person' | 'car' | 'motorcycle' | 'bicycle' | 'bus' | 'truck';
  confidence: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  center: [number, number];
  history: [number, number][];
  speedKmh?: number;
  inZone?: boolean;
}

export interface SystemSettings {
  demoMode: boolean;
  yoloConfidence: number;
  selectedModel: string;
  byteTrackMatchThresh: number;
  byteTrackTrackBuffer: number;
  densityThresholds: {
    lowMax: number;
    mediumMax: number;
  };
  riskRules: {
    ruleA_proximity: {
      enabled: boolean;
      thresholdPx: number;
      calibratedMeters: number;
      minPersistenceFrames: number;
      severity: RiskSeverity;
    };
    ruleB_sharedZone: {
      enabled: boolean;
      zoneNames: string[];
      minPersistenceFrames: number;
      severity: RiskSeverity;
    };
    ruleC_approachConflict: {
      enabled: boolean;
      minSpeedKmh: number;
      maxTimeToCollisionSec: number;
      severity: RiskSeverity;
    };
    ruleD_highCrowdVehicle: {
      enabled: boolean;
      crowdThreshold: number;
      severity: RiskSeverity;
    };
    alertCooldownSec: number;
  };
  retentionDays: number;
  emailAlertsEnabled: boolean;
  alertEmail: string;
  audioAlerts: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}
