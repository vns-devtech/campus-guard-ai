import React, { useState, useRef } from 'react';
import {
  Camera,
  Activity,
  Users,
  Car,
  Layers,
  Maximize2,
  CheckCircle,
  Eye,
  Sliders,
  ShieldCheck,
  Upload,
  Film,
  QrCode
} from 'lucide-react';
import { MonitoredZone, VideoSourceItem, SystemSettings, Incident, TrackedEntity } from '../types';
import { VisionCanvas } from './VisionCanvas';
import { ConnectPhoneModal } from './ConnectPhoneModal';

interface MonitoringViewProps {
  zones: MonitoredZone[];
  sources: VideoSourceItem[];
  settings: SystemSettings;
  incidents: Incident[];
  onRiskDetected: (incident: Partial<Incident>) => void;
  onSelectIncident: (incident: Incident) => void;
  onAcknowledgeAlert: (id: string) => Promise<void>;
  onClipRecorded?: (videoBlob: Blob, filename: string) => void;
  onQuickUploadRawVideo?: (file: File) => void;
  onAddSource?: (source: Partial<VideoSourceItem>) => Promise<void>;
  initialPhoneRoomId?: string | null;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  zones,
  sources,
  settings,
  incidents,
  onRiskDetected,
  onSelectIncident,
  onAcknowledgeAlert,
  onClipRecorded,
  onQuickUploadRawVideo,
  onAddSource,
  initialPhoneRoomId
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || 'cam-01');
  const [sourceType, setSourceType] = useState<'cctv_demo' | 'webcam' | 'uploaded' | 'recorded_clip' | 'phone_stream'>(
    initialPhoneRoomId ? 'phone_stream' : 'cctv_demo'
  );
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState<boolean>(false);
  const [phoneRoomId, setPhoneRoomId] = useState<string | null>(initialPhoneRoomId || null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialPhoneRoomId) {
      setPhoneRoomId(initialPhoneRoomId);
      setSourceType('phone_stream');
      setCustomVideoUrl(null);
    }
  }, [initialPhoneRoomId]);

  const quickFileRef = useRef<HTMLInputElement | null>(null);

  const activeSource = sources.find((s) => s.id === selectedSourceId) || sources[0];
  const activeZone = zones.find((z) => z.id === activeSource?.zoneId) || zones[0];

  const [liveTelemetry, setLiveTelemetry] = useState({
    fps: 30,
    latencyMs: 24,
    pedestrians: 0,
    vehicles: 0,
    density: 'Low' as 'Low' | 'Medium' | 'High',
    inCount: 0,
    outCount: 0
  });

  const handleQuickFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setSourceType('uploaded');
      if (onQuickUploadRawVideo) {
        onQuickUploadRawVideo(file);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden input for quick raw video loading */}
      <input
        ref={quickFileRef}
        type="file"
        accept=".mp4,.avi,.mov,.webm,.mkv"
        className="hidden"
        onChange={handleQuickFileChange}
      />

      {/* Top Source Switcher & Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                {sourceType === 'webcam'
                  ? 'Raw System/Phone Camera Stream'
                  : sourceType === 'uploaded' || sourceType === 'recorded_clip'
                  ? 'Raw Video Ingestion Feed'
                  : activeSource?.name}
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-emerald-400 font-mono">
                {sourceType === 'webcam' ? 'LIVE RAW CAMERA' : 'ACTIVE FEED'}
              </span>
            </div>
          </div>
        </div>

        {/* Source Mode Switchers */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Use Laptop / Phone Webcam */}
          <button
            onClick={() => {
              setSourceType('webcam');
              setCustomVideoUrl(null);
              setPhoneRoomId(null);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              sourceType === 'webcam'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {sourceType === 'webcam' ? '● Live Camera Active' : 'Use Raw Camera'}
          </button>

          {/* Quick Upload Raw Video Button */}
          <button
            onClick={() => quickFileRef.current?.click()}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              sourceType === 'uploaded'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Load Raw Video File</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Full Vision Viewport + Live Track Table */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: Canvas Video Viewport */}
        <div className="xl:col-span-2 space-y-4">
          <VisionCanvas
            sourceType={sourceType}
            videoFileUrl={customVideoUrl || activeSource?.videoUrl}
            phoneRoomId={phoneRoomId}
            selectedDeviceId={selectedDeviceId}
            zone={activeZone}
            settings={settings}
            onRiskDetected={onRiskDetected}
            onMetricsUpdate={setLiveTelemetry}
            onClipRecorded={onClipRecorded}
          />

          {/* Telemetry Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Crowd Status</div>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-sm font-bold font-mono ${
                  liveTelemetry.density === 'High' ? 'text-rose-400' :
                  liveTelemetry.density === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {liveTelemetry.density}
                </span>
                <span className="text-[10px] text-slate-500">{liveTelemetry.pedestrians} peds</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Vehicles Monitored</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold font-mono text-slate-200">
                  {liveTelemetry.vehicles}
                </span>
                <span className="text-[10px] text-slate-500">&lt;15 km/h zone</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Tripwire (In / Out)</div>
              <div className="flex items-center justify-between mt-1 font-mono text-sm font-bold">
                <span className="text-emerald-400">+{liveTelemetry.inCount}</span>
                <span className="text-slate-600">/</span>
                <span className="text-sky-400">-{liveTelemetry.outCount}</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Processing Health</div>
              <div className="flex items-center justify-between mt-1 font-mono text-sm font-bold text-slate-200">
                <span>{liveTelemetry.fps} FPS</span>
                <span className="text-[10px] text-emerald-400 font-normal">{liveTelemetry.latencyMs}ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live Risk Alerts Drawer */}
        <div className="space-y-4">
          {/* Active Camera Guidance Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Computer Vision Active</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {sourceType === 'webcam'
                ? 'Streaming from your raw camera. Detection and tracking run in real time directly on your video frames.'
                : sourceType === 'uploaded' || sourceType === 'recorded_clip'
                ? 'Processing user uploaded raw video. Frame-by-frame neural network identifies pedestrians and vehicles.'
                : 'Displaying simulated campus monitoring feed. Use the buttons above to load your own raw video or camera!'}
            </p>
          </div>
        </div>
      </div>

      {/* Connect Smartphone Camera Modal */}
      <ConnectPhoneModal
        isOpen={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onConnectWirelessPhone={(roomId) => {
          setPhoneRoomId(roomId);
          setSourceType('phone_stream');
          setCustomVideoUrl(null);
        }}
        onConnectIpStream={(url, name) => {
          setCustomVideoUrl(url);
          setSourceType('uploaded');
          if (onAddSource) {
            onAddSource({
              id: `ip-${Date.now().toString().slice(-4)}`,
              name,
              type: 'cctv_ip',
              zoneId: activeZone?.id || 'zone-01',
              location: 'Smartphone IP Camera Stream',
              rtspUrl: url,
              videoUrl: url,
              status: 'active',
              fps: 25,
              resolution: '1280x720'
            });
          }
        }}
        onSelectLocalCameraDevice={(deviceId) => {
          setSelectedDeviceId(deviceId);
          setSourceType('webcam');
          setCustomVideoUrl(null);
          setPhoneRoomId(null);
        }}
      />
    </div>
  );
};
