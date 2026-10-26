import React, { useState, useEffect, useCallback } from 'react';
import {
  Sidebar,
  NavTab
} from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { MonitoringView } from './components/MonitoringView';
import { RiskEngineView } from './components/RiskEngineView';
import { IncidentModal } from './components/IncidentModal';
import { PhoneCameraBroadcaster } from './components/PhoneCameraBroadcaster';
import { ConnectPhoneModal } from './components/ConnectPhoneModal';
import { api } from './services/api';
import {
  Incident,
  IncidentStatus,
  MonitoredZone,
  VideoSourceItem,
  SystemSettings,
  UserRole,
  AuditLogItem
} from './types';
import { ShieldAlert, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [role, setRole] = useState<UserRole>('operator');
  const [loading, setLoading] = useState<boolean>(true);
  const [phoneCamBroadcasterRoom, setPhoneCamBroadcasterRoom] = useState<string | null>(null);
  const [showConnectPhoneModal, setShowConnectPhoneModal] = useState<boolean>(false);
  const [activePhoneStreamRoom, setActivePhoneStreamRoom] = useState<string | null>(null);

  // Core Data
  const [settings, setSettings] = useState<SystemSettings>({
    demoMode: false,
    yoloConfidence: 0.45,
    selectedModel: 'yolov8n.pt',
    byteTrackMatchThresh: 0.7,
    byteTrackTrackBuffer: 30,
    densityThresholds: { lowMax: 8, mediumMax: 20 },
    riskRules: {
      ruleA_proximity: { enabled: true, thresholdPx: 95, calibratedMeters: 2.2, minPersistenceFrames: 3, severity: 'High' },
      ruleB_sharedZone: { enabled: true, zoneNames: ['Block III Zebra Crossing'], minPersistenceFrames: 2, severity: 'Critical' },
      ruleC_approachConflict: { enabled: true, minSpeedKmh: 12, maxTimeToCollisionSec: 2.5, severity: 'High' },
      ruleD_highCrowdVehicle: { enabled: true, crowdThreshold: 15, severity: 'Warning' },
      alertCooldownSec: 6
    },
    retentionDays: 30,
    emailAlertsEnabled: false,
    alertEmail: 'security@sharda.ac.in',
    audioAlerts: true
  });

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [zones, setZones] = useState<MonitoredZone[]>([]);
  const [sources, setSources] = useState<VideoSourceItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // Active Incident Modal
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Live Toast Notification
  const [toastNotification, setToastNotification] = useState<{
    id: string;
    title: string;
    message: string;
    severity: string;
  } | null>(null);

  // Audio chime generator
  const playAlertChime = useCallback(() => {
    if (!settings.audioAlerts) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(780, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // ignore audio context restrictions
    }
  }, [settings.audioAlerts]);

  // Initial load
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [loadedSettings, loadedZones, loadedSources, loadedIncidents, loadedAnalytics, loadedLogs] =
          await Promise.all([
            api.getSettings().catch(() => settings),
            api.getZones().catch(() => []),
            api.getSources().catch(() => []),
            api.getIncidents().catch(() => []),
            api.getAnalytics().catch(() => null),
            api.getAuditLogs().catch(() => [])
          ]);

        setSettings(loadedSettings);
        setZones(loadedZones);
        setSources(loadedSources);
        setIncidents(loadedIncidents);
        setAnalyticsData(loadedAnalytics);
        setAuditLogs(loadedLogs);
      } catch (err) {
        console.error('Failed to initialize application data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Check if opened on phone with phone_cam query param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const camRoom = params.get('phone_cam');
      if (camRoom) {
        setPhoneCamBroadcasterRoom(camRoom);
      }
    }
  }, []);

  // Handler for Risk Detection Engine alerts (from canvas or test)
  const handleRiskDetected = useCallback(
    async (partialIncident: Partial<Incident>) => {
      try {
        const created = await api.createIncident(partialIncident);
        setIncidents((prev) => [created, ...prev]);

        // Play chime
        playAlertChime();

        // Show toast
        setToastNotification({
          id: created.id,
          title: `${created.severity} Alert: ${created.riskType}`,
          message: `${created.pedestrianTrackId} ↔ ${created.vehicleTrackId} (${created.zoneName})`,
          severity: created.severity
        });

        setTimeout(() => {
          setToastNotification((cur) => (cur?.id === created.id ? null : cur));
        }, 5000);
      } catch (err) {
        console.error('Failed to create incident on server:', err);
      }
    },
    [playAlertChime]
  );

  // Status Updater
  const handleUpdateIncidentStatus = async (id: string, status: IncidentStatus, notes: string) => {
    const reviewerName = role === 'admin' ? 'Admin (Vansh / Vishal)' : 'Campus Security Operator';
    const updated = await api.updateIncidentStatus(id, status, reviewerName, notes);
    setIncidents((prev) => prev.map((item) => (item.id === id ? updated : item)));
    // refresh audit logs
    const logs = await api.getAuditLogs();
    setAuditLogs(logs);
  };

  // Settings Updater
  const handleUpdateSettings = async (newSettings: Partial<SystemSettings>) => {
    const updated = await api.updateSettings(
      newSettings,
      role === 'admin' ? 'Admin Vansh / Vishal' : 'Security Operator'
    );
    setSettings(updated);
    const logs = await api.getAuditLogs();
    setAuditLogs(logs);
  };

  // Add Camera Source
  const handleAddSource = async (source: Partial<VideoSourceItem>) => {
    const created = await api.addSource(source);
    setSources((prev) => [...prev, created]);
    const logs = await api.getAuditLogs();
    setAuditLogs(logs);
  };

  // Upload Video File
  const handleUploadFile = async (file: File, zoneId: string) => {
    const res = await api.uploadVideo(file, zoneId);
    setSources((prev) => [...prev, res.source]);
    const logs = await api.getAuditLogs();
    setAuditLogs(logs);
  };

  // Trigger test synthetic rule scenario
  const handleTriggerTestScenario = (ruleName: 'Rule A' | 'Rule B' | 'Rule C' | 'Rule D') => {
    const sampleTrackIdP = `P-${Math.floor(10 + Math.random() * 89)}`;
    const sampleTrackIdV = `V-${Math.floor(1 + Math.random() * 9)}`;

    if (ruleName === 'Rule A') {
      handleRiskDetected({
        zoneId: 'zone-01',
        zoneName: 'Main Gate 1 Entrance Driveway',
        cameraSource: 'Main Gate 1 — Entrance & Driveway',
        riskType: 'Rule A: Close Proximity',
        severity: 'Critical',
        pedestrianTrackId: sampleTrackIdP,
        vehicleTrackId: sampleTrackIdV,
        vehicleClass: 'Car (Sedan)',
        estimatedProximityMeters: 1.2,
        detectionConfidence: 0.94,
        pedestrianCountInZone: 4,
        vehicleCountInZone: 1,
        ruleTriggered: `Synthetic Test: Proximity between ${sampleTrackIdP} and ${sampleTrackIdV} breached 2.2m threshold for 3+ frames.`
      });
    } else if (ruleName === 'Rule B') {
      handleRiskDetected({
        zoneId: 'zone-02',
        zoneName: 'Block III Zebra Crossing',
        cameraSource: 'Central Boulevard & Block III Crossing',
        riskType: 'Rule B: Shared-Zone Conflict',
        severity: 'Critical',
        pedestrianTrackId: sampleTrackIdP,
        vehicleTrackId: sampleTrackIdV,
        vehicleClass: 'Motorcycle',
        estimatedProximityMeters: 1.6,
        detectionConfidence: 0.91,
        pedestrianCountInZone: 8,
        vehicleCountInZone: 1,
        ruleTriggered: `Synthetic Test: Pedestrian and motor vehicle concurrent occupancy in zebra crosswalk boundary.`
      });
    } else if (ruleName === 'Rule C') {
      handleRiskDetected({
        zoneId: 'zone-03',
        zoneName: 'Engineering Block Parking Lot Access',
        cameraSource: 'Engineering Block Parking Area',
        riskType: 'Rule C: Potential Approach Conflict',
        severity: 'High',
        pedestrianTrackId: sampleTrackIdP,
        vehicleTrackId: sampleTrackIdV,
        vehicleClass: 'Campus Shuttle Bus',
        estimatedProximityMeters: 2.1,
        detectionConfidence: 0.89,
        pedestrianCountInZone: 3,
        vehicleCountInZone: 1,
        ruleTriggered: `Synthetic Test: Motion trajectories converging with projected Time-To-Collision under 2.2 seconds.`
      });
    } else {
      handleRiskDetected({
        zoneId: 'zone-04',
        zoneName: 'Cafeteria Plaza Walkway',
        cameraSource: 'Student Plaza & Cafeteria Avenue',
        riskType: 'Rule D: High Crowd with Vehicle Presence',
        severity: 'Warning',
        pedestrianTrackId: 'Crowd (22 students)',
        vehicleTrackId: sampleTrackIdV,
        vehicleClass: 'Delivery Van',
        estimatedProximityMeters: 3.5,
        detectionConfidence: 0.96,
        pedestrianCountInZone: 22,
        vehicleCountInZone: 1,
        ruleTriggered: `Synthetic Test: Motor vehicle entered pedestrian corridor while crowd density exceeded 15 persons.`
      });
    }
  };

  const getPageTitleAndSubtitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return {
          title: 'Campus Safety Overview',
          subtitle: 'Real-time telemetry, pedestrian counts & risk alerts'
        };
      case 'monitoring':
        return {
          title: 'Live Vision Monitoring Center',
          subtitle: 'YOLOv8 bounding boxes, ByteTrack IDs & collision vectors'
        };
      case 'risk_engine':
        return {
          title: 'Risk Detection Engine & Rules',
          subtitle: 'Configure Rules A, B, C, D, cooldown suppression & metric calibration'
        };
    }
  };

  const { title, subtitle } = getPageTitleAndSubtitle();
  const unresolvedCount = incidents.filter((i) => i.status === 'New' || i.status === 'Under Review').length;

  // Handle camera recording completed
  const handleClipRecorded = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const newSource: VideoSourceItem = {
      id: `rec-${Date.now().toString().slice(-4)}`,
      name: `Recorded: ${filename}`,
      type: 'recorded_clip',
      zoneId: zones[0]?.id || 'zone-01',
      location: 'System / Phone Camera Capture',
      videoUrl: url,
      fileSize: `${(blob.size / (1024 * 1024)).toFixed(2)} MB`,
      duration: 'User Recorded',
      status: 'active',
      fps: 30,
      resolution: '1280x720'
    };
    setSources((prev) => [newSource, ...prev]);
    setToastNotification({
      id: newSource.id,
      title: 'Raw Camera Clip Saved',
      message: `Captured ${filename}. Analyzing in real time!`,
      severity: 'Low'
    });
  };

  const handleQuickUploadRawVideo = (file: File) => {
    const url = URL.createObjectURL(file);
    const newSource: VideoSourceItem = {
      id: `upload-${Date.now().toString().slice(-4)}`,
      name: `Raw Video: ${file.name}`,
      type: 'uploaded_video',
      zoneId: zones[0]?.id || 'zone-01',
      location: 'Uploaded Raw Video Footage',
      videoUrl: url,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      status: 'active',
      fps: 30,
      resolution: '1920x1080'
    };
    setSources((prev) => [newSource, ...prev]);
  };

  if (phoneCamBroadcasterRoom) {
    return (
      <PhoneCameraBroadcaster
        roomId={phoneCamBroadcasterRoom}
        onExitBroadcaster={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setPhoneCamBroadcasterRoom(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        unresolvedIncidentsCount={unresolvedCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          role={role}
          onRoleChange={setRole}
          demoMode={settings.demoMode}
          onToggleDemoMode={(val) => handleUpdateSettings({ demoMode: val })}
          audioAlerts={settings.audioAlerts}
          onToggleAudioAlerts={() => handleUpdateSettings({ audioAlerts: !settings.audioAlerts })}
          newAlertCount={unresolvedCount}
          onAlertsClick={() => {
            const active = incidents.find((i) => i.status === 'New' || i.status === 'Under Review');
            if (active) setSelectedIncident(active);
            else setCurrentTab('monitoring');
          }}
          onConnectPhoneClick={() => setShowConnectPhoneModal(true)}
        />

        {/* Active Page View Body */}
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-500 text-xs font-mono">
              Loading CampusGuard AI engine...
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  incidents={incidents}
                  zones={zones}
                  sources={sources}
                  settings={settings}
                  analyticsData={analyticsData}
                  onSelectIncident={setSelectedIncident}
                  onNavigateToTab={setCurrentTab}
                  onRiskDetected={handleRiskDetected}
                />
              )}

              {currentTab === 'monitoring' && (
                <MonitoringView
                  zones={zones}
                  sources={sources}
                  settings={settings}
                  incidents={incidents}
                  onRiskDetected={handleRiskDetected}
                  onSelectIncident={setSelectedIncident}
                  onAcknowledgeAlert={async (id) => {
                    await handleUpdateIncidentStatus(id, 'Under Review', 'Quick Operator Acknowledged');
                  }}
                  onClipRecorded={handleClipRecorded}
                  onQuickUploadRawVideo={handleQuickUploadRawVideo}
                  onAddSource={handleAddSource}
                  initialPhoneRoomId={activePhoneStreamRoom}
                />
              )}

              {currentTab === 'risk_engine' && (
                <RiskEngineView
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  userRole={role}
                  onTriggerTestScenario={handleTriggerTestScenario}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Incident Review Modal */}
      {selectedIncident && (
        <IncidentModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onUpdateStatus={handleUpdateIncidentStatus}
          userRole={role}
        />
      )}

      {/* Connect Smartphone Camera Modal */}
      <ConnectPhoneModal
        isOpen={showConnectPhoneModal}
        onClose={() => setShowConnectPhoneModal(false)}
        onConnectWirelessPhone={(roomId) => {
          setActivePhoneStreamRoom(roomId);
          setCurrentTab('monitoring');
        }}
        onConnectIpStream={async (url, name) => {
          await handleAddSource({
            name,
            type: 'cctv_ip',
            zoneId: zones[0]?.id || 'zone-01',
            location: 'Smartphone IP Camera Stream',
            rtspUrl: url,
            videoUrl: url,
            status: 'active',
            fps: 25,
            resolution: '1280x720'
          });
          setCurrentTab('monitoring');
        }}
        onSelectLocalCameraDevice={(deviceId) => {
          setCurrentTab('monitoring');
        }}
      />
    </div>
  );
}
