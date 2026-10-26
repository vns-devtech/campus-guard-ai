import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Ensure data directory exists
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'db.json');

// Initial seed data
const initialData = {
  settings: {
    demoMode: true,
    yoloConfidence: 0.45,
    selectedModel: 'yolov8n.pt',
    byteTrackMatchThresh: 0.7,
    byteTrackTrackBuffer: 30,
    densityThresholds: {
      lowMax: 8,
      mediumMax: 20
    },
    riskRules: {
      ruleA_proximity: {
        enabled: true,
        thresholdPx: 95,
        calibratedMeters: 2.2,
        minPersistenceFrames: 3,
        severity: 'High'
      },
      ruleB_sharedZone: {
        enabled: true,
        zoneNames: ['Block III Zebra Crossing', 'Main Gate Driveway Conflict'],
        minPersistenceFrames: 2,
        severity: 'Critical'
      },
      ruleC_approachConflict: {
        enabled: true,
        minSpeedKmh: 12,
        maxTimeToCollisionSec: 2.5,
        severity: 'High'
      },
      ruleD_highCrowdVehicle: {
        enabled: true,
        crowdThreshold: 15,
        severity: 'Warning'
      },
      alertCooldownSec: 6
    },
    retentionDays: 30,
    emailAlertsEnabled: false,
    alertEmail: 'security@sharda.ac.in',
    audioAlerts: true
  },
  sources: [
    {
      id: 'cam-01',
      name: 'Main Gate 1 — Entrance & Driveway',
      type: 'cctv_ip',
      zoneId: 'zone-01',
      location: 'Sharda Main Gate 1',
      rtspUrl: 'rtsp://172.16.20.101:554/stream1',
      status: 'active',
      fps: 25,
      resolution: '1920x1080',
      isDefault: true
    },
    {
      id: 'cam-02',
      name: 'Central Boulevard & Block III Crossing',
      type: 'cctv_ip',
      zoneId: 'zone-02',
      location: 'Academic Block III Walkway',
      rtspUrl: 'rtsp://172.16.20.102:554/stream1',
      status: 'active',
      fps: 30,
      resolution: '1920x1080',
      isDefault: false
    },
    {
      id: 'cam-03',
      name: 'Engineering Block Parking Area',
      type: 'cctv_ip',
      zoneId: 'zone-03',
      location: 'Engineering Block V Parking',
      rtspUrl: 'rtsp://172.16.20.103:554/stream1',
      status: 'active',
      fps: 20,
      resolution: '1280x720',
      isDefault: false
    },
    {
      id: 'cam-04',
      name: 'Student Plaza & Cafeteria Avenue',
      type: 'cctv_ip',
      zoneId: 'zone-04',
      location: 'Cafeteria Pedestrian Way',
      rtspUrl: 'rtsp://172.16.20.104:554/stream1',
      status: 'active',
      fps: 25,
      resolution: '1920x1080',
      isDefault: false
    }
  ],
  zones: [
    {
      id: 'zone-01',
      name: 'Main Gate Driveway Conflict',
      location: 'Gate 1 Plaza',
      type: 'vehicle_pedestrian_mix',
      speedLimitKmh: 15,
      pedestrianCapacity: 50,
      coordinates: [[60, 220], [380, 220], [420, 360], [40, 360]],
      countingLine: { x1: 50, y1: 290, x2: 400, y2: 290 }
    },
    {
      id: 'zone-02',
      name: 'Block III Zebra Crossing',
      location: 'Academic Corridor',
      type: 'pedestrian_priority_crosswalk',
      speedLimitKmh: 10,
      pedestrianCapacity: 40,
      coordinates: [[120, 180], [450, 180], [480, 340], [100, 340]],
      countingLine: { x1: 110, y1: 260, x2: 470, y2: 260 }
    },
    {
      id: 'zone-03',
      name: 'Engineering Parking Lot Access',
      location: 'Block V Lot',
      type: 'parking_access',
      speedLimitKmh: 15,
      pedestrianCapacity: 25,
      coordinates: [[80, 160], [420, 160], [440, 350], [60, 350]],
      countingLine: { x1: 70, y1: 250, x2: 430, y2: 250 }
    },
    {
      id: 'zone-04',
      name: 'Cafeteria Plaza Walkway',
      location: 'Food Court Front',
      type: 'pedestrian_only_with_service_access',
      speedLimitKmh: 5,
      pedestrianCapacity: 80,
      coordinates: [[50, 140], [460, 140], [470, 370], [40, 370]],
      countingLine: { x1: 50, y1: 250, x2: 460, y2: 250 }
    }
  ],
  incidents: [
    {
      id: 'INC-2026-0891',
      timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      zoneId: 'zone-02',
      zoneName: 'Block III Zebra Crossing',
      cameraSource: 'Central Boulevard & Block III Crossing',
      riskType: 'Rule B: Shared-Zone Conflict',
      severity: 'Critical',
      pedestrianTrackId: 'P-042',
      vehicleTrackId: 'V-009',
      vehicleClass: 'Car (Sedan)',
      estimatedProximityMeters: 1.4,
      detectionConfidence: 0.89,
      pedestrianCountInZone: 7,
      vehicleCountInZone: 1,
      ruleTriggered: 'Pedestrian and motor vehicle occupied designated crosswalk simultaneously without yielding.',
      status: 'New',
      reviewedBy: null,
      notes: 'Vehicle observed entering crossing while two students were midway across lane.',
      evidenceSnapshot: null
    },
    {
      id: 'INC-2026-0890',
      timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      zoneId: 'zone-01',
      zoneName: 'Main Gate Driveway Conflict',
      cameraSource: 'Main Gate 1 — Entrance & Driveway',
      riskType: 'Rule A: Close Proximity',
      severity: 'High',
      pedestrianTrackId: 'P-038',
      vehicleTrackId: 'V-006',
      vehicleClass: 'Motorcycle',
      estimatedProximityMeters: 1.8,
      detectionConfidence: 0.84,
      pedestrianCountInZone: 12,
      vehicleCountInZone: 2,
      ruleTriggered: 'Close proximity detected (<2.2m threshold) between moving motorcycle and pedestrian.',
      status: 'Under Review',
      reviewedBy: 'Security Officer R. Sharma',
      notes: 'Motorcycle overtook campus shuttle near gate curb. Guard on duty warned the rider.',
      evidenceSnapshot: null
    },
    {
      id: 'INC-2026-0889',
      timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      zoneId: 'zone-04',
      zoneName: 'Cafeteria Plaza Walkway',
      cameraSource: 'Student Plaza & Cafeteria Avenue',
      riskType: 'Rule D: High Crowd with Vehicle Presence',
      severity: 'Warning',
      pedestrianTrackId: 'Multiple (22 persons)',
      vehicleTrackId: 'V-003',
      vehicleClass: 'Delivery Van',
      estimatedProximityMeters: 3.1,
      detectionConfidence: 0.92,
      pedestrianCountInZone: 24,
      vehicleCountInZone: 1,
      ruleTriggered: 'Commercial service vehicle entered high-density pedestrian corridor during lunch break peak.',
      status: 'Resolved',
      reviewedBy: 'Admin Vansh Bhardwaj',
      notes: 'Scheduled cafeteria supply vehicle escorted through plaza by ground staff.',
      evidenceSnapshot: null
    },
    {
      id: 'INC-2026-0888',
      timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
      zoneId: 'zone-02',
      zoneName: 'Block III Zebra Crossing',
      cameraSource: 'Central Boulevard & Block III Crossing',
      riskType: 'Rule C: Potential Approach Conflict',
      severity: 'High',
      pedestrianTrackId: 'P-019',
      vehicleTrackId: 'V-002',
      vehicleClass: 'Bicycle (E-bike)',
      estimatedProximityMeters: 2.0,
      detectionConfidence: 0.81,
      pedestrianCountInZone: 4,
      vehicleCountInZone: 1,
      ruleTriggered: 'Projected trajectories intersecting within 2.1s time-to-collision window.',
      status: 'False Positive',
      reviewedBy: 'Security Officer M. Khan',
      notes: 'Cyclist braked smoothly 4 meters prior to zebra line. Track trajectory diverged safely.',
      evidenceSnapshot: null
    },
    {
      id: 'INC-2026-0887',
      timestamp: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
      zoneId: 'zone-03',
      zoneName: 'Engineering Parking Lot Access',
      cameraSource: 'Engineering Block Parking Area',
      riskType: 'Rule A: Close Proximity',
      severity: 'High',
      pedestrianTrackId: 'P-011',
      vehicleTrackId: 'V-001',
      vehicleClass: 'Bus (Campus Shuttle)',
      estimatedProximityMeters: 1.7,
      detectionConfidence: 0.95,
      pedestrianCountInZone: 9,
      vehicleCountInZone: 1,
      ruleTriggered: 'Pedestrian walked within blind spot zone of reversing shuttle bus.',
      status: 'Resolved',
      reviewedBy: 'Admin Vishal Dixit',
      notes: 'Conductor spotted student and stopped bus immediately. No injury.',
      evidenceSnapshot: null
    }
  ],
  auditLogs: [
    {
      id: 'LOG-101',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      user: 'Vansh Bhardwaj (Admin)',
      action: 'Updated Risk Rule A threshold',
      details: 'Proximity threshold modified to 2.2 meters / 95px persistence 3 frames.'
    },
    {
      id: 'LOG-102',
      timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      user: 'Vishal Dixit (Admin)',
      action: 'Resolved Incident INC-2026-0889',
      details: 'Marked service delivery van entry as escorted and resolved.'
    },
    {
      id: 'LOG-103',
      timestamp: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
      user: 'System Guardian',
      action: 'Automatic Health Check',
      details: 'All 4 CCTV camera streams and ByteTrack pipeline operational.'
    }
  ]
};

function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json, returning memory initialData:', err);
    return initialData;
  }
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // API Routes
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      app: 'CampusGuard AI',
      institution: 'Sharda University - Semester 5 PBL-3',
      team: ['Vansh Bhardwaj', 'Vishal Dixit'],
      guide: 'Mr. Abhishek Singh Verma',
      timestamp: new Date().toISOString(),
      pythonFastApiBridge: 'http://localhost:8000/docs',
      activeCapabilities: [
        'YOLOv8 Object Detection (Ultralytics)',
        'ByteTrack Identity Preservation',
        'ROI Line Bi-Directional Counting',
        'Zone Crowd Density Analysis (Low/Medium/High)',
        '4-Tier Conflict Risk Engine (Rules A, B, C, D)',
        'Human-in-the-Loop Incident Review'
      ]
    });
  });

  // Settings
  app.get('/api/settings', (req: Request, res: Response) => {
    const db = readDb();
    res.json(db.settings);
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const db = readDb();
    db.settings = { ...db.settings, ...req.body };
    db.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: req.body.operatorName || 'Admin Operator',
      action: 'Settings Updated',
      details: 'Updated detection, tracking and risk threshold configurations.'
    });
    writeDb(db);
    res.json({ success: true, settings: db.settings });
  });

  // Sources
  app.get('/api/sources', (req: Request, res: Response) => {
    const db = readDb();
    res.json(db.sources);
  });

  app.post('/api/sources', (req: Request, res: Response) => {
    const db = readDb();
    const newSource = {
      id: `cam-${Date.now().toString().slice(-4)}`,
      name: req.body.name || 'New Campus Video Source',
      type: req.body.type || 'uploaded_video',
      zoneId: req.body.zoneId || 'zone-01',
      location: req.body.location || 'Campus Monitored Area',
      rtspUrl: req.body.rtspUrl || '',
      status: 'active',
      fps: 25,
      resolution: req.body.resolution || '1920x1080',
      isDefault: false
    };
    db.sources.push(newSource);
    db.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: 'Admin',
      action: 'Added Video Source',
      details: `Added new camera source: ${newSource.name}`
    });
    writeDb(db);
    res.json(newSource);
  });

  // Zones
  app.get('/api/zones', (req: Request, res: Response) => {
    const db = readDb();
    res.json(db.zones);
  });

  app.put('/api/zones/:id', (req: Request, res: Response) => {
    const db = readDb();
    const idx = db.zones.findIndex((z: any) => z.id === req.params.id);
    if (idx !== -1) {
      db.zones[idx] = { ...db.zones[idx], ...req.body };
      writeDb(db);
      res.json(db.zones[idx]);
    } else {
      res.status(404).json({ error: 'Zone not found' });
    }
  });

  // Incidents
  app.get('/api/incidents', (req: Request, res: Response) => {
    const db = readDb();
    const { status, severity, zoneId, limit } = req.query;
    let list = [...db.incidents];

    if (status && status !== 'all') {
      list = list.filter((i: any) => i.status.toLowerCase() === (status as string).toLowerCase());
    }
    if (severity && severity !== 'all') {
      list = list.filter((i: any) => i.severity.toLowerCase() === (severity as string).toLowerCase());
    }
    if (zoneId && zoneId !== 'all') {
      list = list.filter((i: any) => i.zoneId === zoneId);
    }

    if (limit) {
      list = list.slice(0, parseInt(limit as string, 10));
    }

    res.json(list);
  });

  app.post('/api/incidents', (req: Request, res: Response) => {
    const db = readDb();
    const newInc = {
      id: `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      zoneId: req.body.zoneId || 'zone-01',
      zoneName: req.body.zoneName || 'Monitored Conflict Area',
      cameraSource: req.body.cameraSource || 'Live Stream',
      riskType: req.body.riskType || 'Rule A: Close Proximity',
      severity: req.body.severity || 'High',
      pedestrianTrackId: req.body.pedestrianTrackId || 'P-001',
      vehicleTrackId: req.body.vehicleTrackId || 'V-001',
      vehicleClass: req.body.vehicleClass || 'Car',
      estimatedProximityMeters: req.body.estimatedProximityMeters || 1.8,
      detectionConfidence: req.body.detectionConfidence || 0.88,
      pedestrianCountInZone: req.body.pedestrianCountInZone || 1,
      vehicleCountInZone: req.body.vehicleCountInZone || 1,
      ruleTriggered: req.body.ruleTriggered || 'Potentially risky proximity interaction detected.',
      status: 'New',
      reviewedBy: null,
      notes: req.body.notes || 'Flagged automatically by CampusGuard AI risk detection engine.',
      evidenceSnapshot: req.body.evidenceSnapshot || null
    };

    db.incidents.unshift(newInc);
    // keep max 200 incidents
    if (db.incidents.length > 200) {
      db.incidents = db.incidents.slice(0, 200);
    }

    writeDb(db);
    res.json(newInc);
  });

  app.patch('/api/incidents/:id/status', (req: Request, res: Response) => {
    const db = readDb();
    const { status, reviewedBy, notes } = req.body;
    const item = db.incidents.find((i: any) => i.id === req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    item.status = status || item.status;
    if (reviewedBy) item.reviewedBy = reviewedBy;
    if (notes) item.notes = notes;

    db.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: reviewedBy || 'Security Operator',
      action: `Incident ${item.id} status updated to ${item.status}`,
      details: notes || `Marked incident ${item.id} as ${item.status}`
    });

    writeDb(db);
    res.json(item);
  });

  // Analytics
  app.get('/api/analytics', (req: Request, res: Response) => {
    const db = readDb();

    // Hourly pedestrian vs vehicle flow (typical Sharda University schedule)
    const hourlyTraffic = [
      { hour: '07:00', pedestrians: 42, vehicles: 18, riskEvents: 0 },
      { hour: '08:00', pedestrians: 185, vehicles: 64, riskEvents: 2 },
      { hour: '09:00', pedestrians: 340, vehicles: 95, riskEvents: 4 },
      { hour: '10:00', pedestrians: 210, vehicles: 45, riskEvents: 1 },
      { hour: '11:00', pedestrians: 190, vehicles: 38, riskEvents: 0 },
      { hour: '12:00', pedestrians: 280, vehicles: 52, riskEvents: 2 },
      { hour: '13:00', pedestrians: 490, vehicles: 76, riskEvents: 5 }, // Lunch rush
      { hour: '14:00', pedestrians: 310, vehicles: 48, riskEvents: 1 },
      { hour: '15:00', pedestrians: 220, vehicles: 42, riskEvents: 1 },
      { hour: '16:00', pedestrians: 360, vehicles: 88, riskEvents: 3 },
      { hour: '17:00', pedestrians: 510, vehicles: 120, riskEvents: 6 }, // Evening departure
      { hour: '18:00', pedestrians: 230, vehicles: 65, riskEvents: 2 },
      { hour: '19:00', pedestrians: 110, vehicles: 30, riskEvents: 0 }
    ];

    // Incident count by zone
    const zoneIncidentCounts = db.zones.map((z: any) => {
      const count = db.incidents.filter((i: any) => i.zoneId === z.id).length;
      return {
        zoneId: z.id,
        name: z.name,
        incidents: count,
        capacity: z.pedestrianCapacity
      };
    });

    // Risk rule breakdown
    const ruleDistribution = [
      { name: 'Rule A (Proximity)', value: db.incidents.filter((i: any) => i.riskType.includes('Rule A')).length || 18, color: '#f59e0b' },
      { name: 'Rule B (Shared Crosswalk)', value: db.incidents.filter((i: any) => i.riskType.includes('Rule B')).length || 14, color: '#ef4444' },
      { name: 'Rule C (Approach Vector)', value: db.incidents.filter((i: any) => i.riskType.includes('Rule C')).length || 9, color: '#6366f1' },
      { name: 'Rule D (High Crowd+Vehicle)', value: db.incidents.filter((i: any) => i.riskType.includes('Rule D')).length || 7, color: '#ec4899' }
    ];

    // Severity breakdown
    const severityDistribution = [
      { name: 'Critical', count: db.incidents.filter((i: any) => i.severity === 'Critical').length, color: '#dc2626' },
      { name: 'High', count: db.incidents.filter((i: any) => i.severity === 'High').length, color: '#ea580c' },
      { name: 'Warning', count: db.incidents.filter((i: any) => i.severity === 'Warning').length, color: '#f59e0b' },
      { name: 'Low', count: db.incidents.filter((i: any) => i.severity === 'Low').length, color: '#3b82f6' }
    ];

    res.json({
      summary: {
        totalIncidentsRecorded: db.incidents.length,
        unresolvedIncidents: db.incidents.filter((i: any) => i.status === 'New' || i.status === 'Under Review').length,
        resolvedIncidents: db.incidents.filter((i: any) => i.status === 'Resolved').length,
        falsePositiveRate: Math.round((db.incidents.filter((i: any) => i.status === 'False Positive').length / Math.max(1, db.incidents.length)) * 100),
        activeCameras: db.sources.filter((s: any) => s.status === 'active').length,
        todayPedestriansCrossed: 3270,
        todayVehiclesMonitored: 750
      },
      hourlyTraffic,
      zoneIncidentCounts,
      ruleDistribution,
      severityDistribution
    });
  });

  // Audit Logs
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    const db = readDb();
    res.json(db.auditLogs);
  });

  // Export CSV
  app.get('/api/export/incidents.csv', (req: Request, res: Response) => {
    const db = readDb();
    const headers = [
      'Incident ID',
      'Timestamp',
      'Zone Name',
      'Camera Source',
      'Risk Type',
      'Severity',
      'Pedestrian Track ID',
      'Vehicle Track ID',
      'Vehicle Class',
      'Estimated Proximity (m)',
      'Detection Confidence',
      'Status',
      'Reviewed By',
      'Notes'
    ];

    const rows = db.incidents.map((i: any) => [
      `"${i.id}"`,
      `"${i.timestamp}"`,
      `"${i.zoneName}"`,
      `"${i.cameraSource}"`,
      `"${i.riskType}"`,
      `"${i.severity}"`,
      `"${i.pedestrianTrackId}"`,
      `"${i.vehicleTrackId}"`,
      `"${i.vehicleClass}"`,
      i.estimatedProximityMeters,
      i.detectionConfidence,
      `"${i.status}"`,
      `"${i.reviewedBy || 'Unassigned'}"`,
      `"${(i.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="campusguard_incidents_sharda.csv"');
    res.send(csvContent);
  });

  app.get('/api/export/traffic-counts.csv', (req: Request, res: Response) => {
    const headers = ['Time Interval', 'Monitored Zone', 'Pedestrians In', 'Pedestrians Out', 'Vehicles In', 'Vehicles Out', 'Crowd Density Level'];
    const rows = [
      ['08:00 - 09:00', 'Main Gate 1', '140', '25', '52', '12', 'Medium'],
      ['09:00 - 10:00', 'Block III Crossing', '280', '60', '80', '15', 'High'],
      ['10:00 - 11:00', 'Central Boulevard', '160', '50', '35', '8', 'Medium'],
      ['11:00 - 12:00', 'Cafeteria Plaza', '175', '45', '12', '4', 'Medium'],
      ['12:00 - 13:00', 'Cafeteria Plaza', '420', '90', '18', '6', 'High'],
      ['13:00 - 14:00', 'Block III Crossing', '390', '85', '65', '11', 'High'],
      ['14:00 - 15:00', 'Engineering Lot', '120', '30', '40', '10', 'Low'],
      ['15:00 - 16:00', 'Main Gate 1', '180', '40', '55', '14', 'Medium'],
      ['16:00 - 17:00', 'Block III Crossing', '310', '70', '78', '19', 'High'],
      ['17:00 - 18:00', 'Main Gate 1', '410', '190', '110', '45', 'High']
    ];
    const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.map((c: string) => `"${c}"`).join(',')).join('\n')].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="campus_traffic_counts_sharda.csv"');
    res.send(csvContent);
  });

  // Mock upload endpoint
  app.post('/api/upload', (req: Request, res: Response) => {
    const { filename, size, duration, zoneId } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!['mp4', 'avi', 'mov', 'webm', 'mkv'].includes(ext || '')) {
      return res.status(400).json({ error: 'Unsupported format. Allowed formats: MP4, AVI, MOV, WEBM, MKV' });
    }

    const db = readDb();
    const newSource = {
      id: `upload-${Date.now().toString().slice(-4)}`,
      name: `Uploaded: ${filename}`,
      type: 'uploaded_video',
      zoneId: zoneId || 'zone-02',
      location: 'Uploaded Campus Video Test',
      rtspUrl: '',
      status: 'active',
      fps: 30,
      resolution: '1920x1080',
      isDefault: false
    };
    db.sources.push(newSource);
    db.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: 'Operator',
      action: 'Uploaded Video for Analysis',
      details: `Uploaded video ${filename} (${size || 'Unknown size'}) assigned to zone ${zoneId || 'zone-02'}`
    });
    writeDb(db);

    res.json({
      success: true,
      message: 'Video uploaded and indexed for AI pipeline processing.',
      source: newSource
    });
  });

  // In-memory wireless phone camera frame relay
  const phoneStreams: Record<string, { frame: string; timestamp: number; connected: boolean }> = {};

  app.post('/api/phone-stream/:roomId/frame', (req: Request, res: Response) => {
    const { roomId } = req.params;
    const { frame, timestamp } = req.body;
    if (frame) {
      phoneStreams[roomId] = {
        frame,
        timestamp: timestamp || Date.now(),
        connected: true
      };
    }
    res.json({ success: true });
  });

  app.get('/api/phone-stream/:roomId/frame', (req: Request, res: Response) => {
    const { roomId } = req.params;
    const stream = phoneStreams[roomId];
    if (stream && (Date.now() - stream.timestamp < 10000)) {
      res.json({ frame: stream.frame, timestamp: stream.timestamp, active: true });
    } else {
      res.json({ frame: null, timestamp: 0, active: false });
    }
  });

  app.get('/api/phone-stream/:roomId/status', (req: Request, res: Response) => {
    const { roomId } = req.params;
    const stream = phoneStreams[roomId];
    const isLive = Boolean(stream && (Date.now() - stream.timestamp < 8000));
    res.json({ active: isLive, timestamp: stream ? stream.timestamp : null });
  });

  // Vite middleware in dev or static files in production
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusGuard AI Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
