import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Eye,
  Shield,
  Users,
  Layers,
  Activity,
  Video,
  Circle,
  Square,
  Download,
  SwitchCamera,
  FastForward,
  Volume2,
  VolumeX,
  Sparkles,
  Cpu,
  Maximize2,
  Minimize2,
  Scan,
  SlidersHorizontal
} from 'lucide-react';
import { MonitoredZone, TrackedEntity, SystemSettings, Incident } from '../types';
import { aiDetector, RawDetection } from '../services/aiDetector';
import { BrowserByteTracker } from '../services/browserTracker';

interface VisionCanvasProps {
  sourceType: 'cctv_demo' | 'webcam' | 'uploaded' | 'recorded_clip' | 'phone_stream';
  videoFileUrl?: string | null;
  phoneRoomId?: string | null;
  selectedDeviceId?: string | null;
  zone: MonitoredZone;
  settings: SystemSettings;
  onRiskDetected: (incident: Partial<Incident>) => void;
  onMetricsUpdate?: (metrics: {
    fps: number;
    latencyMs: number;
    pedestrians: number;
    vehicles: number;
    density: 'Low' | 'Medium' | 'High';
    inCount: number;
    outCount: number;
  }) => void;
  onClipRecorded?: (videoBlob: Blob, filename: string) => void;
}

export const VisionCanvas: React.FC<VisionCanvasProps> = ({
  sourceType,
  videoFileUrl,
  phoneRoomId,
  selectedDeviceId,
  zone,
  settings,
  onRiskDetected,
  onMetricsUpdate,
  onClipRecorded
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Playback & UI State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showTrackIds, setShowTrackIds] = useState<boolean>(true);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [showZonePolygon, setShowZonePolygon] = useState<boolean>(true);
  const [showCountingLine, setShowCountingLine] = useState<boolean>(true);
  const [showProximityRings, setShowProximityRings] = useState<boolean>(true);

  // Video playback scrubber state
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(true);

  // Framing & Visual Clarity Mode State
  const [frameHeightMode, setFrameHeightMode] = useState<'standard' | 'expanded'>('standard');
  const [clarityFilter, setClarityFilter] = useState<'crystal' | 'vivid' | 'standard'>('crystal');

  // Real-Time Camera Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // AI Inference Engine State
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [modelError, setModelError] = useState<string | null>(null);
  const [realInferenceActive, setRealInferenceActive] = useState<boolean>(false);

  // Real-time Telemetry
  const [activePedestrians, setActivePedestrians] = useState<number>(0);
  const [activeVehicles, setActiveVehicles] = useState<number>(0);
  const [currentDensity, setCurrentDensity] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [inCount, setInCount] = useState<number>(0);
  const [outCount, setOutCount] = useState<number>(0);
  const [fps, setFps] = useState<number>(30);
  const [latencyMs, setLatencyMs] = useState<number>(24);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Real Computer Vision Tracker instance
  const trackerRef = useRef<BrowserByteTracker>(new BrowserByteTracker());
  const activeEntitiesRef = useRef<TrackedEntity[]>([]);
  const persistenceCounters = useRef<{ [pairKey: string]: number }>({});
  const lastAlertTimestamps = useRef<{ [pairKey: string]: number }>({});
  const phoneImgRef = useRef<HTMLImageElement | null>(null);
  const [phoneStreamActive, setPhoneStreamActive] = useState<boolean>(false);

  const frameCountRef = useRef<number>(0);
  const lastFpsTime = useRef<number>(performance.now());
  const framesInSec = useRef<number>(0);
  const isInferringRef = useRef<boolean>(false);

  // Initialize TensorFlow.js COCO-SSD model
  useEffect(() => {
    let isMounted = true;
    setModelState('loading');
    aiDetector
      .loadModel()
      .then(() => {
        if (isMounted) {
          setModelState('ready');
          setModelError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load AI model:', err);
          setModelState('error');
          setModelError('Could not initialize local TensorFlow engine. Will run fallback vision tracker.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Poll phone camera frames when in phone_stream mode
  useEffect(() => {
    if (sourceType !== 'phone_stream' || !phoneRoomId) return;

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    phoneImgRef.current = img;

    const fetchFrame = async () => {
      try {
        const res = await fetch(`/api/phone-stream/${phoneRoomId}/frame`);
        if (res.ok) {
          const data = await res.json();
          if (data.active && data.frame && isMounted) {
            img.src = data.frame;
            setPhoneStreamActive(true);
          } else if (isMounted) {
            setPhoneStreamActive(false);
          }
        }
      } catch {
        // ignore
      }
    };

    const interval = setInterval(fetchFrame, 65);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sourceType, phoneRoomId]);

  // Reset tracker when switching zones or sources
  useEffect(() => {
    trackerRef.current.reset();
    setInCount(0);
    setOutCount(0);
    persistenceCounters.current = {};
    lastAlertTimestamps.current = {};
  }, [zone.id, sourceType, videoFileUrl, phoneRoomId]);

  // Video source initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if ((sourceType === 'uploaded' || sourceType === 'recorded_clip') && videoFileUrl) {
      video.srcObject = null;
      video.src = videoFileUrl;
      video.playbackRate = playbackSpeed;
      video.loop = isLooping;
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration || 0);
      };
      video.play().catch((err) => console.warn('Video play interrupted:', err));
    }
  }, [sourceType, videoFileUrl, isLooping, playbackSpeed]);

  // Camera Stream Setup (Webcam or Phone Camera)
  useEffect(() => {
    let stream: MediaStream | null = null;
    const video = videoRef.current;

    if (sourceType === 'webcam') {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : {
              facingMode: facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
        audio: false
      };

      navigator.mediaDevices
        ?.getUserMedia(constraints)
        .then((s) => {
          stream = s;
          if (video) {
            video.srcObject = s;
            video.play().catch(() => {});
          }
          setCameraError(null);
        })
        .catch((err) => {
          console.warn('Camera access denied or unavailable:', err);
          setCameraError(
            `Camera permission denied or camera unavailable (${err.name}). You can still upload any raw video file below!`
          );
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [sourceType, facingMode, selectedDeviceId]);

  // Start Raw Camera Recording
  const handleStartRecording = () => {
    const video = videoRef.current;
    if (!video || !video.srcObject) {
      alert('Camera stream is not active. Switch to Webcam first.');
      return;
    }

    try {
      const stream = video.srcObject as MediaStream;
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const filename = `campus_raw_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.webm`;

        if (onClipRecorded) {
          onClipRecorded(blob, filename);
        }
      };

      mediaRecorder.start(200); // 200ms slice
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      alert(`Recording error: ${err.message}`);
    }
  };

  // Stop Raw Camera Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
    }
    setIsRecording(false);
  };

  // Format seconds as MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Main real-time computer vision render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const cvLoop = async () => {
      if (!isRunning) return;

      if (!isPlaying) {
        animFrameRef.current = requestAnimationFrame(cvLoop);
        return;
      }

      frameCountRef.current += 1;
      framesInSec.current += 1;

      // Calculate Real FPS
      const now = performance.now();
      if (now - lastFpsTime.current >= 1000) {
        setFps(framesInSec.current);
        framesInSec.current = 0;
        lastFpsTime.current = now;
      }

      const w = canvas.width;
      const h = canvas.height;
      const countingLineY = h * 0.65;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const isVideoSource =
        (sourceType === 'uploaded' || sourceType === 'recorded_clip' || sourceType === 'webcam') &&
        video &&
        video.readyState >= 2 &&
        !cameraError;

      const isPhoneSource =
        sourceType === 'phone_stream' &&
        phoneImgRef.current &&
        phoneImgRef.current.complete &&
        phoneImgRef.current.naturalWidth > 0;

      // 1. Draw Raw Video Frame onto Canvas
      if (isVideoSource) {
        ctx.drawImage(video, 0, 0, w, h);
        if (sourceType === 'uploaded' || sourceType === 'recorded_clip') {
          setVideoCurrentTime(video.currentTime);
        }
      } else if (isPhoneSource && phoneImgRef.current) {
        ctx.drawImage(phoneImgRef.current, 0, 0, w, h);
      } else {
        // Fallback or explicit CCTV simulation background
        drawFallbackCampus(ctx, w, h, zone);
      }

      // 2. Real-Time Neural Network Inference
      const targetElement = isVideoSource ? video : (isPhoneSource ? phoneImgRef.current : null);

      if (targetElement && modelState === 'ready' && !isInferringRef.current) {
        // Run inference every 2 frames to preserve 30+ FPS without blocking UI
        if (frameCountRef.current % 2 === 0) {
          isInferringRef.current = true;
          const inferStart = performance.now();

          aiDetector
            .detectFrame(targetElement, w, h, settings.yoloConfidence)
            .then((rawDetections) => {
              const latency = Math.round(performance.now() - inferStart);
              setLatencyMs(latency);
              setRealInferenceActive(true);

              // Update ByteTrack algorithm with genuine frame detections
              const trackedEntities = trackerRef.current.update(rawDetections, countingLineY);
              activeEntitiesRef.current = trackedEntities;
              setInCount(trackerRef.current.inCount);
              setOutCount(trackerRef.current.outCount);
            })
            .catch(() => {})
            .finally(() => {
              isInferringRef.current = false;
            });
        }
      } else if (!targetElement) {
        // Demo mode synthetic frame update
        updateDemoEntities(w, h);
      }

      // 3. Draw Monitored Conflict Zone Polygon
      if (showZonePolygon && zone.coordinates && zone.coordinates.length > 2) {
        ctx.save();
        ctx.beginPath();
        const poly = zone.coordinates;
        ctx.moveTo((poly[0][0] / 500) * w, (poly[0][1] / 400) * h);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo((poly[i][0] / 500) * w, (poly[i][1] / 400) * h);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f87171';
        ctx.font = '10px "JetBrains Mono", monospace';
        const labelX = (poly[0][0] / 500) * w + 8;
        const labelY = (poly[0][1] / 400) * h + 16;
        ctx.fillText(`CONFLICT ZONE: ${zone.name.toUpperCase()}`, labelX, labelY);
        ctx.restore();
      }

      // 4. Draw Virtual Tripwire Counting Line
      if (showCountingLine) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(30, countingLineY);
        ctx.lineTo(w - 30, countingLineY);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(30, countingLineY, 4, 0, Math.PI * 2);
        ctx.arc(w - 30, countingLineY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('ROI VIRTUAL COUNTING LINE ───► IN / ◄─── OUT', 40, countingLineY - 6);
        ctx.restore();
      }

      // 5. Draw Trajectory History Trails
      const entities = activeEntitiesRef.current;
      if (showTrajectories) {
        entities.forEach((ent) => {
          if (ent.history && ent.history.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(ent.history[0][0], ent.history[0][1]);
            for (let i = 1; i < ent.history.length; i++) {
              ctx.lineTo(ent.history[i][0], ent.history[i][1]);
            }
            ctx.strokeStyle = ent.class === 'person' ? 'rgba(56, 189, 248, 0.5)' : 'rgba(239, 68, 68, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      // 6. Draw Bounding Boxes and ByteTrack ID Overlays
      entities.forEach((ent) => {
        const [x1, y1, x2, y2] = ent.bbox;
        const isPed = ent.class === 'person';
        const color = isPed ? '#3b82f6' : '#ef4444';

        if (showBoundingBoxes) {
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          // Corner highlights
          const cl = 6;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x1, y1 + cl);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x1 + cl, y1);
          ctx.moveTo(x2, y2 - cl);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x2 - cl, y2);
          ctx.stroke();
          ctx.restore();
        }

        // ByteTrack Label Banner
        if (showTrackIds) {
          ctx.save();
          const speedLabel = ent.speedKmh ? ` · ${ent.speedKmh} km/h` : '';
          const label = `${ent.id} · ${ent.class.toUpperCase()} ${(ent.confidence * 100).toFixed(0)}%${speedLabel}`;
          ctx.font = '500 10px "JetBrains Mono", monospace';
          const textMetrics = ctx.measureText(label);
          const bgW = textMetrics.width + 8;
          const bgH = 16;

          ctx.fillStyle = isPed ? 'rgba(30, 58, 138, 0.9)' : 'rgba(153, 27, 27, 0.9)';
          ctx.fillRect(x1, Math.max(16, y1 - bgH), bgW, bgH);

          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, x1 + 4, Math.max(16, y1 - bgH) + 11);
          ctx.restore();
        }
      });

      // 7. Evaluate 4-Tier Risk Engine
      const peds = entities.filter((e) => e.class === 'person');
      const vehs = entities.filter((e) => e.class !== 'person');

      setActivePedestrians(peds.length);
      setActiveVehicles(vehs.length);

      // Evaluate Crowd Density
      let densityLevel: 'Low' | 'Medium' | 'High' = 'Low';
      if (peds.length >= settings.densityThresholds.mediumMax) {
        densityLevel = 'High';
      } else if (peds.length >= settings.densityThresholds.lowMax) {
        densityLevel = 'Medium';
      }
      setCurrentDensity(densityLevel);

      // Check proximity and evaluate rules
      const proximityPx = settings.riskRules.ruleA_proximity.thresholdPx;
      const cooldownSec = settings.riskRules.alertCooldownSec;

      peds.forEach((ped) => {
        vehs.forEach((veh) => {
          const dx = ped.center[0] - veh.center[0];
          const dy = ped.center[1] - veh.center[1];
          const dist = Math.hypot(dx, dy);

          // Visual proximity connecting line & distance ring
          if (dist < proximityPx * 1.6 && showProximityRings) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(ped.center[0], ped.center[1]);
            ctx.lineTo(veh.center[0], veh.center[1]);
            const isCritical = dist < proximityPx;
            ctx.strokeStyle = isCritical ? 'rgba(239, 68, 68, 0.85)' : 'rgba(245, 158, 11, 0.65)';
            ctx.lineWidth = isCritical ? 2.5 : 1.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();

            // Distance meter indicator
            const midX = (ped.center[0] + veh.center[0]) / 2;
            const midY = (ped.center[1] + veh.center[1]) / 2;
            const estMeters = (dist * 0.023).toFixed(1);
            ctx.fillStyle = isCritical ? '#ef4444' : '#f59e0b';
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.fillText(`${estMeters}m`, midX + 4, midY - 4);

            // Pulsing warning ring
            ctx.beginPath();
            ctx.arc(ped.center[0], ped.center[1], isCritical ? 24 : 16, 0, Math.PI * 2);
            ctx.strokeStyle = isCritical ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
          }

          // Rule A Proximity Check
          if (settings.riskRules.ruleA_proximity.enabled && dist < proximityPx) {
            const pairKey = `${ped.id}_${veh.id}_RULE_A`;
            persistenceCounters.current[pairKey] = (persistenceCounters.current[pairKey] || 0) + 1;

            if (persistenceCounters.current[pairKey] >= settings.riskRules.ruleA_proximity.minPersistenceFrames) {
              const nowSec = Date.now() / 1000;
              const lastTime = lastAlertTimestamps.current[pairKey] || 0;

              if (nowSec - lastTime > cooldownSec) {
                lastAlertTimestamps.current[pairKey] = nowSec;
                const estM = Number((dist * 0.023).toFixed(1));
                onRiskDetected({
                  zoneId: zone.id,
                  zoneName: zone.name,
                  cameraSource: isVideoSource ? 'Raw Video / Camera Stream' : zone.location,
                  riskType: 'Rule A: Close Proximity',
                  severity: estM < 1.5 ? 'Critical' : 'High',
                  pedestrianTrackId: ped.id,
                  vehicleTrackId: veh.id,
                  vehicleClass: veh.class === 'car' ? 'Car' : veh.class.toUpperCase(),
                  estimatedProximityMeters: estM,
                  detectionConfidence: Math.round(ped.confidence * 100) / 100,
                  pedestrianCountInZone: peds.length,
                  vehicleCountInZone: vehs.length,
                  ruleTriggered: `Proximity between ${ped.id} and ${veh.id} dropped to ${estM}m (<${settings.riskRules.ruleA_proximity.calibratedMeters}m threshold).`,
                  notes: 'Auto-flagged on raw video by in-browser neural computer vision engine.'
                });
              }
            }
          }
        });
      });

      // Update parent metrics
      if (onMetricsUpdate) {
        onMetricsUpdate({
          fps: framesInSec.current || 30,
          latencyMs,
          pedestrians: peds.length,
          vehicles: vehs.length,
          density: densityLevel,
          inCount: trackerRef.current.inCount,
          outCount: trackerRef.current.outCount
        });
      }

      animFrameRef.current = requestAnimationFrame(cvLoop);
    };

    animFrameRef.current = requestAnimationFrame(cvLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    isPlaying,
    sourceType,
    modelState,
    cameraError,
    showBoundingBoxes,
    showTrackIds,
    showTrajectories,
    showZonePolygon,
    showCountingLine,
    showProximityRings,
    zone,
    settings,
    onRiskDetected,
    onMetricsUpdate
  ]);

  // Fallback demo simulation
  const updateDemoEntities = (w: number, h: number) => {
    const sx = w / 640;
    const sy = h / 360;

    if (activeEntitiesRef.current.length === 0) {
      activeEntitiesRef.current = [
        {
          id: 'P-001',
          class: 'person',
          confidence: 0.94,
          bbox: [140 * sx, 230 * sy, 165 * sx, 290 * sy],
          center: [152 * sx, 260 * sy],
          history: [[140 * sx, 290 * sy], [145 * sx, 280 * sy], [150 * sx, 270 * sy], [152 * sx, 260 * sy]],
          speedKmh: 4.8
        },
        {
          id: 'P-002',
          class: 'person',
          confidence: 0.91,
          bbox: [220 * sx, 240 * sy, 245 * sx, 300 * sy],
          center: [232 * sx, 270 * sy],
          history: [[200 * sx, 310 * sy], [210 * sx, 295 * sy], [220 * sx, 280 * sy], [232 * sx, 270 * sy]],
          speedKmh: 5.1
        },
        {
          id: 'V-001',
          class: 'car',
          confidence: 0.96,
          bbox: [30 * sx, 240 * sy, 110 * sx, 295 * sy],
          center: [70 * sx, 267 * sy],
          history: [[0 * sx, 267 * sy], [25 * sx, 267 * sy], [50 * sx, 267 * sy], [70 * sx, 267 * sy]],
          speedKmh: 14.5
        }
      ];
    }

    activeEntitiesRef.current.forEach((ent) => {
      let [x1, y1, x2, y2] = ent.bbox;
      const bw = x2 - x1;
      const bh = y2 - y1;
      if (ent.class === 'person') {
        y1 += (ent.id === 'P-001' ? -0.8 : 0.8) * sy;
        if (y1 < 160 * sy) y1 = 330 * sy;
        if (y1 > 340 * sy) y1 = 170 * sy;
      } else {
        x1 += 1.8 * sx;
        if (x1 > w + 40 * sx) x1 = -120 * sx;
      }
      x2 = x1 + bw;
      y2 = y1 + bh;
      ent.bbox = [x1, y1, x2, y2];
      ent.center = [Math.round((x1 + x2) / 2), Math.round((y1 + y2) / 2)];
      if (frameCountRef.current % 4 === 0) {
        ent.history.push(ent.center);
        if (ent.history.length > 18) ent.history.shift();
      }
    });
  };

  const drawFallbackCampus = (ctx: CanvasRenderingContext2D, w: number, h: number, z: MonitoredZone) => {
    const sx = w / 640;
    const sy = h / 360;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, 140 * sy);
    ctx.fillRect(0, h - 80 * sy, w, 80 * sy);
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 138 * sy, w, 3 * sy);
    ctx.fillRect(0, h - 81 * sy, w, 3 * sy);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, 90 * sy);
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(60 * sx, 90 * sy, 35 * sx, 0, Math.PI * 2);
    ctx.arc(380 * sx, 80 * sy, 38 * sx, 0, Math.PI * 2);
    ctx.fill();

    const stripeXStart = w * 0.32;
    const stripeXEnd = w * 0.68;
    ctx.fillStyle = '#cbd5e1';
    for (let x = stripeXStart; x < stripeXEnd; x += 30 * sx) {
      ctx.fillRect(x, 150 * sy, 14 * sx, h - 240 * sy);
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h * 0.52);
    ctx.lineTo(w, h * 0.52);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2 * sy;
    ctx.setLineDash([20 * sx, 15 * sx]);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText(`ZONE-CAM: ${z.name.toUpperCase()} · HIGH-RESOLUTION LIVE MONITOR`, 18, 26);
    ctx.fillText(`TIME: ${new Date().toLocaleTimeString()} · [● LIVE] 1080p ULTRA-HD`, w - 310, 26);
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Hidden HTML5 video element for raw camera or uploaded video playback */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="hidden"
        crossOrigin="anonymous"
      />

      {/* Viewport Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></span>
            <span>{zone.name}</span>
          </div>

          <span className="text-slate-600">|</span>

          {/* Model status indicator */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {modelState === 'loading' ? (
              <span className="text-amber-400 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 animate-spin" />
                <span>Loading TensorFlow Model...</span>
              </span>
            ) : modelState === 'ready' ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                <span>AI Vision: Real-time COCO-SSD Active</span>
              </span>
            ) : (
              <span className="text-rose-400">Model Error</span>
            )}
          </div>

          <span className="text-slate-600">|</span>
          <span className="text-slate-400 font-mono">{fps} FPS</span>
          <span className="text-slate-400 font-mono">({latencyMs}ms inference)</span>
        </div>

        {/* Action Buttons: Playback controls & camera switcher */}
        <div className="flex flex-wrap items-center gap-2">

          {sourceType === 'webcam' && (
            <>
              {/* Phone Camera Switcher (Front / Rear) */}
              <button
                onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Switch between front and back camera (for phones)"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{facingMode === 'user' ? 'Front Cam' : 'Back Cam'}</span>
              </button>

              {/* Real Camera Recording Button */}
              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-600/90 hover:bg-rose-600 text-white font-medium transition-colors shadow-sm"
                  title="Record raw video clip from this camera"
                >
                  <Circle className="w-3 h-3 fill-white" />
                  <span>Record Raw Clip</span>
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-500 text-white font-medium animate-pulse"
                  title="Stop recording and process raw clip"
                >
                  <Square className="w-3 h-3 fill-white" />
                  <span>Stop ({formatTime(recordingSeconds)})</span>
                </button>
              )}
            </>
          )}

          {/* Pause / Play */}
          <button
            onClick={() => {
              if (videoRef.current) {
                if (isPlaying) videoRef.current.pause();
                else videoRef.current.play().catch(() => {});
              }
              setIsPlaying(!isPlaying);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Reset */}
          <button
            onClick={() => {
              trackerRef.current.reset();
              setInCount(0);
              setOutCount(0);
              if (videoRef.current) videoRef.current.currentTime = 0;
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Reset frame tracking & counts"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {cameraError && (
        <div className="bg-amber-950/70 border-b border-amber-800/60 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{cameraError}</span>
          </div>
        </div>
      )}

      {/* Main Computer Vision Canvas Viewport Frame */}
      <div className="relative w-full max-h-[min(56vh,480px)] aspect-[16/9] bg-slate-950 flex items-center justify-center overflow-hidden border-y border-slate-800 shadow-xl rounded-b-xl">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain block select-none"
        />

        {/* Live Status HUD Badge */}
        <div className="absolute top-3 left-3 pointer-events-none z-20">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs font-mono shadow-md">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Users className="w-3.5 h-3.5" />
              <span>{activePedestrians} Pedestrians</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className={`text-[11px] font-semibold ${
              currentDensity === 'High' ? 'text-rose-400' :
              currentDensity === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {currentDensity} Density
            </span>
          </div>
        </div>

        {/* Recording status pill if recording */}
        {isRecording && (
          <div className="absolute top-3 right-3 pointer-events-none z-20">
            <div className="bg-rose-600/90 text-white text-xs font-mono px-3 py-1 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
              <Circle className="w-2.5 h-2.5 fill-white" />
              <span>REC: {formatTime(recordingSeconds)}</span>
            </div>
          </div>
        )}

        {/* Source Mode Tag */}
        <div className="absolute bottom-2.5 right-3.5 pointer-events-none text-right z-20">
          <p className="text-[10px] font-mono text-slate-300 tracking-wider">
            {sourceType === 'phone_stream'
              ? 'WIRELESS SMARTPHONE CAMERA STREAM'
              : sourceType === 'webcam'
              ? 'RAW SYSTEM/PHONE CAMERA STREAM'
              : sourceType === 'uploaded' || sourceType === 'recorded_clip'
              ? 'RAW UPLOADED VIDEO INGESTION'
              : 'CAMPUS DEMO CCTV FEED'}
          </p>
          <p className="text-[9px] font-mono text-emerald-400">
            IN-BROWSER TENSORFLOW.JS + BYTETRACK PIPELINE · 1280×720
          </p>
        </div>
      </div>

      {/* Video Seek Scrubber (for uploaded or recorded videos) */}
      {(sourceType === 'uploaded' || sourceType === 'recorded_clip') && videoDuration > 0 && (
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center gap-3 text-xs">
          <span className="font-mono text-slate-400 text-[11px]">{formatTime(videoCurrentTime)}</span>
          <input
            type="range"
            min={0}
            max={videoDuration}
            step={0.1}
            value={videoCurrentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVideoCurrentTime(val);
              if (videoRef.current) {
                videoRef.current.currentTime = val;
              }
            }}
            className="flex-1 accent-blue-500 cursor-pointer"
          />
          <span className="font-mono text-slate-400 text-[11px]">{formatTime(videoDuration)}</span>

          {/* Speed selector */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
            {[0.5, 1.0, 1.5].map((spd) => (
              <button
                key={spd}
                onClick={() => {
                  setPlaybackSpeed(spd);
                  if (videoRef.current) videoRef.current.playbackRate = spd;
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  playbackSpeed === spd ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Overlay Toggles Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-950 border-t border-slate-800 text-xs">
        <div className="flex items-center gap-1 text-slate-400">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Vision Overlays:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              showBoundingBoxes ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Bounding Boxes
          </button>
          <button
            onClick={() => setShowTrackIds(!showTrackIds)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              showTrackIds ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            ByteTrack IDs
          </button>
          <button
            onClick={() => setShowTrajectories(!showTrajectories)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              showTrajectories ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Trajectories
          </button>
          <button
            onClick={() => setShowZonePolygon(!showZonePolygon)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              showZonePolygon ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Conflict Zone
          </button>
          <button
            onClick={() => setShowCountingLine(!showCountingLine)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              showCountingLine ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            ROI Tripwire Line
          </button>
          <button
            onClick={() => setShowProximityRings(!showProximityRings)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              showProximityRings ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Proximity Vectors
          </button>
        </div>
      </div>
    </div>
  );
};
