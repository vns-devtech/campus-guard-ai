import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  SwitchCamera,
  Circle,
  Wifi,
  WifiOff,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface PhoneCameraBroadcasterProps {
  roomId: string;
  onExitBroadcaster?: () => void;
}

export const PhoneCameraBroadcaster: React.FC<PhoneCameraBroadcasterProps> = ({
  roomId,
  onExitBroadcaster
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [resolution, setResolution] = useState<'480p' | '720p'>('720p');
  const [fps, setFps] = useState<number>(0);
  const [framesSent, setFramesSent] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('Requesting camera access...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const streamIntervalRef = useRef<any>(null);
  const lastFpsCount = useRef<number>(0);
  const fpsTimerRef = useRef<any>(null);

  // Initialize Camera
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    const video = videoRef.current;

    const width = resolution === '720p' ? 1280 : 640;
    const height = resolution === '720p' ? 720 : 480;

    setStatusText(`Starting ${facingMode === 'environment' ? 'rear back' : 'front'} camera...`);
    setErrorMsg(null);

    navigator.mediaDevices
      ?.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: width },
          height: { ideal: height }
        },
        audio: false
      })
      .then((stream) => {
        currentStream = stream;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
        setIsStreaming(true);
        setStatusText('Camera active. Transmitting live frames to CampusGuard AI dashboard...');
      })
      .catch((err) => {
        console.error('Camera access error:', err);
        setErrorMsg(`Camera error: ${err.message}. Please allow camera permissions in your mobile browser.`);
        setIsStreaming(false);
      });

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, resolution]);

  // Frame Transmitter Loop
  useEffect(() => {
    if (!isStreaming) return;

    const canvas = captureCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Send frames every ~60ms (~16 FPS) to balance bandwidth and smoothness
    streamIntervalRef.current = setInterval(() => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = 480;
        canvas.height = Math.round(480 * (video.videoHeight / video.videoWidth)) || 270;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

        fetch(`/api/phone-stream/${roomId}/frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frame: dataUrl,
            timestamp: Date.now()
          })
        })
          .then(() => {
            setFramesSent((prev) => prev + 1);
            lastFpsCount.current += 1;
          })
          .catch((err) => {
            console.warn('Frame transmission glitch:', err);
          });
      }
    }, 65);

    // FPS counter
    fpsTimerRef.current = setInterval(() => {
      setFps(lastFpsCount.current);
      lastFpsCount.current = 0;
    }, 1000);

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
    };
  }, [isStreaming, roomId]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between font-sans select-none overflow-hidden">
      {/* Offscreen frame capture canvas */}
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Top Mobile Status Header */}
      <div className="p-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>CampusGuard Phone Broadcaster</span>
            </div>
            <p className="text-[10px] font-mono text-blue-400">Pairing Code: {roomId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onExitBroadcaster && (
            <button
              onClick={onExitBroadcaster}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Open Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Main Viewfinder */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Live HUD over viewfinder */}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-800 text-[11px] font-mono flex items-center gap-2 text-slate-200">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>TRANSMITTING: {fps} FPS</span>
            <span className="text-slate-500">|</span>
            <span className="text-blue-400">{framesSent} frames</span>
          </div>
        </div>

        {errorMsg && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">Camera Permissions Needed</h3>
            <p className="text-xs text-slate-400 max-w-sm">{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium"
            >
              Retry Camera Permission
            </button>
          </div>
        )}
      </div>

      {/* Bottom Mobile Camera Controls */}
      <div className="p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 space-y-3 z-10">
        <div className="flex items-center justify-around">
          {/* Switch Camera Button */}
          <button
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-white"
          >
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center active:scale-95 transition-transform">
              <SwitchCamera className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">
              {facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
            </span>
          </button>

          {/* Live Indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-14 h-14 rounded-full border-4 border-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <div className="w-6 h-6 rounded-full bg-rose-600 animate-pulse"></div>
            </div>
            <span className="text-[10px] font-mono text-rose-400 font-semibold tracking-wider uppercase">
              LIVE AIR
            </span>
          </div>

          {/* Resolution Selector */}
          <button
            onClick={() => setResolution((prev) => (prev === '720p' ? '480p' : '720p'))}
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-white"
          >
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center active:scale-95 transition-transform font-mono text-xs font-bold text-blue-400">
              {resolution}
            </div>
            <span className="text-[10px] font-medium">Quality</span>
          </button>
        </div>

        <div className="text-center text-[11px] text-slate-400 pt-1">
          Connected to CampusGuard AI Dashboard · Point phone camera at pedestrian crossing or road
        </div>
      </div>
    </div>
  );
};
