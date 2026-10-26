import React, { useState } from 'react';
import {
  Users,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { Incident, MonitoredZone, VideoSourceItem, SystemSettings } from '../types';
import { VisionCanvas } from './VisionCanvas';

interface DashboardViewProps {
  incidents: Incident[];
  zones: MonitoredZone[];
  sources: VideoSourceItem[];
  settings: SystemSettings;
  analyticsData: any;
  onSelectIncident?: (incident: Incident) => void;
  onNavigateToTab: (tab: any) => void;
  onRiskDetected: (incident: Partial<Incident>) => void;
  onAcknowledgeAlert?: (id: string) => Promise<void>;
  onClipRecorded?: (videoBlob: Blob, filename: string) => void;
  onQuickUploadRawVideo?: (file: File) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  incidents,
  zones,
  settings,
  analyticsData,
  onSelectIncident,
  onNavigateToTab,
  onRiskDetected
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[1]?.id || zones[0]?.id || 'zone-02');
  const activeZone = zones.find((z) => z.id === selectedZoneId) || zones[0];

  const [liveMetrics, setLiveMetrics] = useState({
    fps: 29,
    latencyMs: 31,
    pedestrians: 5,
    vehicles: 2,
    density: 'Low' as 'Low' | 'Medium' | 'High',
    inCount: 142,
    outCount: 88
  });

  const activeAlerts = incidents.filter((i) => i.status === 'New' || i.status === 'Under Review');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 3 Clear Essential Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Pedestrians */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Live Pedestrians</span>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{liveMetrics.pedestrians}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">In camera frame</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Crowd Density */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Crowd Density</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-2xl font-bold font-mono ${
                liveMetrics.density === 'High' ? 'text-rose-400' :
                liveMetrics.density === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {liveMetrics.density}
              </span>
              <span className={`w-2 h-2 rounded-full ${
                liveMetrics.density === 'High' ? 'bg-rose-400 animate-pulse' :
                liveMetrics.density === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}></span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Real-time capacity monitor</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Active Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Active Alerts</span>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{activeAlerts.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Pending operator review</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Live Campus Video Monitoring */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Live Campus Camera View</h3>
            <span className="text-xs text-slate-500">· Real-Time Pedestrian Safety</span>
          </div>

          {/* Zone Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="zone-select" className="text-xs text-slate-400">Zone:</label>
            <select
              id="zone-select"
              aria-label="Zone"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <VisionCanvas
          sourceType="cctv_demo"
          zone={activeZone}
          settings={settings}
          onRiskDetected={onRiskDetected}
          onMetricsUpdate={setLiveMetrics}
        />
      </div>
    </div>
  );
};
