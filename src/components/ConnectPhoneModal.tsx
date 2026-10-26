import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Smartphone,
  QrCode,
  Wifi,
  ExternalLink,
  Copy,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Camera,
  Play,
  RotateCw,
  Video,
  Cable
} from 'lucide-react';

interface ConnectPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectWirelessPhone: (roomId: string) => void;
  onConnectIpStream: (url: string, name: string) => void;
  onSelectLocalCameraDevice: (deviceId: string) => void;
}

export const ConnectPhoneModal: React.FC<ConnectPhoneModalProps> = ({
  isOpen,
  onClose,
  onConnectWirelessPhone,
  onConnectIpStream,
  onSelectLocalCameraDevice
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'qr' | 'ip_app' | 'usb_device'>('qr');
  const [roomId, setRoomId] = useState<string>(() => {
    return 'CAM-' + Math.floor(100 + Math.random() * 900);
  });
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [ipUrl, setIpUrl] = useState<string>('http://192.168.1.50:8080/video');
  const [ipAppType, setIpAppType] = useState<'ip_webcam' | 'droidcam' | 'custom'>('ip_webcam');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  // Generate QR Code URL
  const phoneBroadcasterUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?phone_cam=${roomId}`
    : `https://campusguard.local/?phone_cam=${roomId}`;

  useEffect(() => {
    QRCode.toDataURL(phoneBroadcasterUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [phoneBroadcasterUrl]);

  // Poll server for phone pairing status
  useEffect(() => {
    if (activeTab !== 'qr') return;

    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/phone-stream/${roomId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.active) {
            setIsPhoneConnected(true);
          }
        }
      } catch {
        // ignore
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomId, activeTab]);

  // Enumerate USB and connected camera devices
  useEffect(() => {
    if (activeTab === 'usb_device') {
      navigator.mediaDevices?.enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setAvailableDevices(videoInputs);
        })
        .catch((err) => console.warn('Device enumeration error:', err));
    }
  }, [activeTab]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(phoneBroadcasterUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApplyPreset = (preset: 'ip_webcam' | 'droidcam') => {
    setIpAppType(preset);
    if (preset === 'ip_webcam') {
      setIpUrl('http://192.168.1.X:8080/video');
    } else {
      setIpUrl('http://192.168.1.X:4747/video');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Connect Smartphone Camera</h3>
              <p className="text-xs text-slate-400">Use your phone as a wireless CCTV camera for real-time AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-6 pt-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'qr'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Code (No App Required)</span>
          </button>

          <button
            onClick={() => setActiveTab('ip_app')}
            className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'ip_app'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span>IP Webcam / DroidCam Apps</span>
          </button>

          <button
            onClick={() => setActiveTab('usb_device')}
            className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'usb_device'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cable className="w-4 h-4" />
            <span>USB / Continuity Camera</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 text-xs text-slate-300 space-y-4">
          {/* TAB 1: Instant QR Code Scan */}
          {activeTab === 'qr' && (
            <div className="space-y-4">
              <div className="bg-blue-950/30 border border-blue-900/50 p-3 rounded-xl flex items-start gap-2.5 text-blue-200">
                <QrCode className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Instant Wireless Pairing:</strong> Scan the QR code below with your iPhone (Camera app) or Android phone. It immediately launches the Phone Broadcaster and transmits your camera stream directly to this dashboard without installing any app!
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                {/* QR Code Container */}
                <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col items-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Phone Camera QR Code" className="w-48 h-48 block" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-500 font-mono text-[10px]">
                      Generating QR...
                    </div>
                  )}
                  <span className="text-[10px] text-slate-600 font-mono mt-1 font-semibold">PAIRING CODE: {roomId}</span>
                </div>

                {/* Pairing Steps & Status */}
                <div className="space-y-3 flex-1">
                  <div className="space-y-2">
                    <div className="font-semibold text-slate-200">3-Step Quick Connect:</div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px]">
                      <li>Open your phone camera and scan the QR code.</li>
                      <li>Allow browser camera permission when prompted.</li>
                      <li>Point phone at pedestrians/campus path and click below!</li>
                    </ol>
                  </div>

                  {/* Phone Status Indicator */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    isPhoneConnected
                      ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        isPhoneConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500 animate-ping'
                      }`}></span>
                      <span className="font-medium">
                        {isPhoneConnected ? 'Phone Camera Connected & Live!' : 'Waiting for phone to scan...'}
                      </span>
                    </div>
                    {isPhoneConnected && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  </div>

                  {/* Copy Link button */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={phoneBroadcasterUrl}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-400"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 shrink-0 font-medium"
                    >
                      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Room ID: <span className="font-mono text-slate-400">{roomId}</span>
                </span>
                <button
                  onClick={() => {
                    onConnectWirelessPhone(roomId);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start AI Monitoring with Phone Stream</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IP Camera Apps (DroidCam / IP Webcam) */}
          {activeTab === 'ip_app' && (
            <div className="space-y-4">
              <div className="text-slate-400 leading-relaxed text-[11px]">
                If you already have a popular mobile camera app installed on your phone, you can stream directly over your local WiFi network:
              </div>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('ip_webcam')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    ipAppType === 'ip_webcam'
                      ? 'bg-blue-950/40 border-blue-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-semibold text-slate-200">IP Webcam (Android)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Port 8080 · MJPEG stream</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('droidcam')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    ipAppType === 'droidcam'
                      ? 'bg-blue-950/40 border-blue-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-semibold text-slate-200">DroidCam (iOS / Android)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Port 4747 · Video feed</div>
                </button>
              </div>

              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-medium">
                  Enter Phone Stream IP URL:
                </label>
                <input
                  type="text"
                  value={ipUrl}
                  onChange={(e) => setIpUrl(e.target.value)}
                  placeholder="e.g. http://192.168.1.45:8080/video"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-500">
                  Tip: Look at the bottom of the IP Webcam app screen on your phone to find the exact IP address.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onConnectIpStream(ipUrl, `Phone IP Cam (${ipAppType})`);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  Connect Stream
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: USB / Continuity Camera (Select from Device Manager) */}
          {activeTab === 'usb_device' && (
            <div className="space-y-4">
              <div className="text-slate-400 leading-relaxed text-[11px]">
                If your phone is plugged in via USB (Android 14 Webcam mode) or wirelessly paired via iPhone Continuity Camera, select it from your system devices below:
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableDevices.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    No camera devices detected. Ensure permissions are granted.
                  </div>
                ) : (
                  availableDevices.map((dev, idx) => (
                    <button
                      key={dev.deviceId || idx}
                      onClick={() => {
                        onSelectLocalCameraDevice(dev.deviceId);
                        onClose();
                      }}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 flex items-center justify-between text-left transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Camera className="w-4 h-4 text-blue-400" />
                        <div>
                          <div className="font-medium text-slate-200">{dev.label || `Camera Device ${idx + 1}`}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{dev.deviceId.slice(0, 16)}...</div>
                        </div>
                      </div>
                      <span className="text-blue-400 text-xs font-semibold">Select →</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
