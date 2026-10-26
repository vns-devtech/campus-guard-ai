import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle, Clock, User, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Incident, IncidentStatus, UserRole } from '../types';

interface IncidentModalProps {
  incident: Incident | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: IncidentStatus, notes: string) => Promise<void>;
  userRole: UserRole;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({
  incident,
  onClose,
  onUpdateStatus,
  userRole
}) => {
  if (!incident) return null;

  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [notes, setNotes] = useState<string>(incident.notes || '');
  const [saving, setSaving] = useState<boolean>(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateStatus(incident.id, status, notes);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'Critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'High':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Warning':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-sm">{incident.id}</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityBadge(incident.severity)}`}>
                  {incident.severity}
                </span>
                <span className="text-xs text-slate-400">· {incident.riskType}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{incident.zoneName} · {new Date(incident.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Rule Triggered Banner */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="font-medium text-slate-200 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Safety Rule Triggered:</span>
            </div>
            <p className="text-slate-300 leading-relaxed font-mono text-[11px] bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
              {incident.ruleTriggered}
            </p>
          </div>

          {/* Involved Entities & Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Pedestrian ID</span>
              <span className="text-sm font-semibold font-mono text-blue-400">{incident.pedestrianTrackId}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Anonymous track</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Vehicle ID & Class</span>
              <span className="text-sm font-semibold font-mono text-rose-400">{incident.vehicleTrackId}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{incident.vehicleClass}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Est. Proximity</span>
              <span className="text-sm font-semibold font-mono text-amber-400">{incident.estimatedProximityMeters}m</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Calibrated distance</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Detection Conf.</span>
              <span className="text-sm font-semibold font-mono text-emerald-400">
                {(incident.detectionConfidence * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">YOLO Ultralytics</span>
            </div>
          </div>

          {/* Privacy & Uncertainty Note */}
          <div className="bg-blue-950/20 border border-blue-900/40 p-3 rounded-lg flex items-start gap-2.5 text-[11px] text-blue-200/90">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong>Privacy Protection:</strong> Identifiers (e.g. {incident.pedestrianTrackId}) are temporary ByteTrack tracking tokens discarded at session end. No facial recognition, biometric models, or personal identities are extracted or stored.
            </div>
          </div>

          {/* Status Update & Operator Notes */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Review Status Workflow
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['New', 'Under Review', 'Resolved', 'False Positive'] as IncidentStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                      status === st
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Security Officer / Operator Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter observations, dispatched security actions, or justification for status update..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-t border-slate-800 text-xs">
          <div className="text-slate-500">
            {incident.reviewedBy ? `Last reviewed by: ${incident.reviewedBy}` : 'Unassigned review'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Save & Update Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
