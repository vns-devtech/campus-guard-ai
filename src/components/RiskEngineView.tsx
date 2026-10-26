import React, { useState } from 'react';
import {
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Info,
  Clock,
  Layers,
  Activity,
  SlidersHorizontal
} from 'lucide-react';
import { SystemSettings, RiskSeverity, UserRole } from '../types';

interface RiskEngineViewProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  userRole: UserRole;
  onTriggerTestScenario: (scenarioRule: 'Rule A' | 'Rule B' | 'Rule C' | 'Rule D') => void;
}

export const RiskEngineView: React.FC<RiskEngineViewProps> = ({
  settings,
  onUpdateSettings,
  userRole,
  onTriggerTestScenario
}) => {
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const isAdmin = userRole === 'admin';

  const handleToggleRule = (ruleKey: 'ruleA_proximity' | 'ruleB_sharedZone' | 'ruleC_approachConflict' | 'ruleD_highCrowdVehicle') => {
    const updated = {
      ...localSettings,
      riskRules: {
        ...localSettings.riskRules,
        [ruleKey]: {
          ...localSettings.riskRules[ruleKey],
          enabled: !localSettings.riskRules[ruleKey].enabled
        }
      }
    };
    setLocalSettings(updated);
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      await onUpdateSettings(localSettings);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error(e);
      setSaveStatus('idle');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-100">Conflict Detection & Risk Engine</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure spatio-temporal collision boundary thresholds, persistence frames, and safety rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{saveStatus === 'saving' ? 'Saving Rules...' : saveStatus === 'saved' ? 'Settings Saved!' : 'Save Rule Engine'}</span>
          </button>
        </div>
      </div>

      {/* Synthetic Scenario Trigger Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold text-slate-200">Synthetic Scenario Testing Sandbox</h4>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Dispatches instant test alert</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => onTriggerTestScenario('Rule A')}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 text-xs text-slate-300 font-medium transition-colors"
          >
            <Play className="w-3 h-3 text-amber-400" />
            <span>Test Rule A (Proximity)</span>
          </button>
          <button
            onClick={() => onTriggerTestScenario('Rule B')}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800 text-xs text-slate-300 font-medium transition-colors"
          >
            <Play className="w-3 h-3 text-rose-400" />
            <span>Test Rule B (Crosswalk)</span>
          </button>
          <button
            onClick={() => onTriggerTestScenario('Rule C')}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800 text-xs text-slate-300 font-medium transition-colors"
          >
            <Play className="w-3 h-3 text-sky-400" />
            <span>Test Rule C (Trajectory)</span>
          </button>
          <button
            onClick={() => onTriggerTestScenario('Rule D')}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800 text-xs text-slate-300 font-medium transition-colors"
          >
            <Play className="w-3 h-3 text-purple-400" />
            <span>Test Rule D (Crowd Conflict)</span>
          </button>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rule A: Close Proximity */}
        <div className={`p-4 rounded-xl border transition-colors ${localSettings.riskRules.ruleA_proximity.enabled ? 'bg-slate-900 border-slate-800' : 'bg-slate-950/60 border-slate-900 opacity-60'}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <h4 className="text-sm font-semibold text-slate-200">Rule A: Proximity Breach</h4>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {localSettings.riskRules.ruleA_proximity.severity}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Flags whenever physical distance between a monitored pedestrian and vehicle breaches threshold.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable Rule A"
                checked={localSettings.riskRules.ruleA_proximity.enabled}
                onChange={() => handleToggleRule('ruleA_proximity')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Calibrated Threshold (Meters)</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                value={localSettings.riskRules.ruleA_proximity.calibratedMeters}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 2.2;
                  setLocalSettings({
                    ...localSettings,
                    riskRules: {
                      ...localSettings.riskRules,
                      ruleA_proximity: {
                        ...localSettings.riskRules.ruleA_proximity,
                        calibratedMeters: val
                      }
                    }
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Min Persistence (Frames)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={localSettings.riskRules.ruleA_proximity.minPersistenceFrames}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 3;
                  setLocalSettings({
                    ...localSettings,
                    riskRules: {
                      ...localSettings.riskRules,
                      ruleA_proximity: {
                        ...localSettings.riskRules.ruleA_proximity,
                        minPersistenceFrames: val
                      }
                    }
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Rule B: Shared Zone / Crosswalk */}
        <div className={`p-4 rounded-xl border transition-colors ${localSettings.riskRules.ruleB_sharedZone.enabled ? 'bg-slate-900 border-slate-800' : 'bg-slate-950/60 border-slate-900 opacity-60'}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <h4 className="text-sm font-semibold text-slate-200">Rule B: Shared Zone Conflict</h4>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {localSettings.riskRules.ruleB_sharedZone.severity}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Triggered when pedestrian and motorized vehicle simultaneously occupy a designated zebra crossing.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable Rule B"
                checked={localSettings.riskRules.ruleB_sharedZone.enabled}
                onChange={() => handleToggleRule('ruleB_sharedZone')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Target Zone Designation</label>
              <div className="text-slate-300 bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 font-mono text-[11px] truncate">
                {localSettings.riskRules.ruleB_sharedZone.zoneNames?.[0] || 'Block III Crossing'}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Min Persistence (Frames)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={localSettings.riskRules.ruleB_sharedZone.minPersistenceFrames}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 2;
                  setLocalSettings({
                    ...localSettings,
                    riskRules: {
                      ...localSettings.riskRules,
                      ruleB_sharedZone: {
                        ...localSettings.riskRules.ruleB_sharedZone,
                        minPersistenceFrames: val
                      }
                    }
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Rule C: Approach Trajectory Conflict */}
        <div className={`p-4 rounded-xl border transition-colors ${localSettings.riskRules.ruleC_approachConflict.enabled ? 'bg-slate-900 border-slate-800' : 'bg-slate-950/60 border-slate-900 opacity-60'}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <h4 className="text-sm font-semibold text-slate-200">Rule C: Trajectory Collision Vector</h4>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {localSettings.riskRules.ruleC_approachConflict.severity}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Calculates Time-To-Collision (TTC) using projected motion vectors and relative vehicle speed.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable Rule C"
                checked={localSettings.riskRules.ruleC_approachConflict.enabled}
                onChange={() => handleToggleRule('ruleC_approachConflict')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Min Velocity (km/h)</label>
              <input
                type="number"
                min="5"
                max="60"
                value={localSettings.riskRules.ruleC_approachConflict.minSpeedKmh}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 12;
                  setLocalSettings({
                    ...localSettings,
                    riskRules: {
                      ...localSettings.riskRules,
                      ruleC_approachConflict: {
                        ...localSettings.riskRules.ruleC_approachConflict,
                        minSpeedKmh: val
                      }
                    }
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Max TTC (Seconds)</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="8"
                value={localSettings.riskRules.ruleC_approachConflict.maxTimeToCollisionSec}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 2.5;
                  setLocalSettings({
                    ...localSettings,
                    riskRules: {
                      ...localSettings.riskRules,
                      ruleC_approachConflict: {
                        ...localSettings.riskRules.ruleC_approachConflict,
                        maxTimeToCollisionSec: val
                      }
                    }
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Rule D: Crowd Density Conflict */}
        <div className={`p-4 rounded-xl border transition-colors ${localSettings.riskRules.ruleD_highCrowdVehicle.enabled ? 'bg-slate-900 border-slate-800' : 'bg-slate-950/60 border-slate-900 opacity-60'}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <h4 className="text-sm font-semibold text-slate-200">Rule D: High Crowd + Vehicle Corridor</h4>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {localSettings.riskRules.ruleD_highCrowdVehicle.severity}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Alerts security if any motor vehicle enters high-density student congregation points.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable Rule D"
                checked={localSettings.riskRules.ruleD_highCrowdVehicle.enabled}
                onChange={() => handleToggleRule('ruleD_highCrowdVehicle')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Crowd Threshold (Persons)</label>
              <input
                type="number"
                min="5"
                max="100"
                value={localSettings.riskRules.ruleD_highCrowdVehicle.crowdThreshold}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 15;
                  setLocalSettings({
                    ...localSettings,
                    riskRules: {
                      ...localSettings.riskRules,
                      ruleD_highCrowdVehicle: {
                        ...localSettings.riskRules.ruleD_highCrowdVehicle,
                        crowdThreshold: val
                      }
                    }
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Alert Cooldown Window</label>
              <div className="text-slate-300 bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 font-mono text-[11px]">
                {localSettings.riskRules.alertCooldownSec} seconds
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
