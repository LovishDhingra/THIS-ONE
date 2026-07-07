import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import { useProcessFrame, useCreateDetection, useCreateScreenshot } from "@/hooks/use-detections";
import { AlertTriangle, CheckCircle2, VideoOff, Activity, Camera, UserX, EyeOff, ScanFace, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const VIDEO_CONSTRAINTS = {
  width: 640,
  height: 480,
  facingMode: "user",
};

// Background snapshots are taken every 1 minute for audit purposes.
// The server only retains the last 72 hours of these.
const SCREENSHOT_INTERVAL_MS = 60_000;

// A driver must be continuously distracted for this long before we raise an
// alert. This prevents brief mirror/shoulder checks from being flagged.
const DISTRACTION_THRESHOLD_MS = 3000;

type DetectionLabel =
  | "Safe / Attentive"
  | "No Face Detected"
  | "Eyes Not Visible"
  | "Driver Not Present"
  | null;

type UiState = "idle" | "safe" | "pending" | "distracted";

function getLabelConfig(state: UiState, label: DetectionLabel) {
  if (state === "idle")
    return {
      icon: <Activity className="w-12 h-12" />,
      ring: "text-muted-foreground border-border",
      bg: "bg-card",
      bar: "bg-primary",
      title: "READY",
      desc: "System is in standby mode. Start monitoring to begin analysis.",
      badge: null as { label: string; color: string } | null,
    };

  if (state === "safe")
    return {
      icon: <CheckCircle2 className="w-12 h-12" />,
      ring: "text-emerald-400 border-emerald-500/50 shadow-emerald-500/20",
      bg: "bg-emerald-500/10",
      bar: "bg-emerald-500",
      title: "SAFE",
      desc: "Driver attention is focused. No anomalies detected.",
      badge: { label: "Attentive", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    };

  if (state === "pending")
    return {
      icon: <Loader2 className="w-12 h-12 animate-spin" />,
      ring: "text-blue-400 border-blue-500/50 shadow-blue-500/20",
      bg: "bg-blue-500/10",
      bar: "bg-blue-400",
      title: "CHECKING",
      desc: "Brief look-away detected (e.g. mirror check). Confirming before alerting...",
      badge: { label: label ?? "Verifying", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    };

  // confirmed distracted — style based on specific label
  switch (label) {
    case "Eyes Not Visible":
      return {
        icon: <EyeOff className="w-12 h-12" />,
        ring: "text-orange-400 border-orange-500/50 shadow-orange-500/20 animate-pulse",
        bg: "bg-orange-500/10",
        bar: "bg-orange-500",
        title: "DISTRACTED",
        desc: "Eyes not visible for a sustained period. Driver may be looking away or eyes are closed.",
        badge: { label: "Eyes Not Visible", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      };
    case "No Face Detected":
      return {
        icon: <ScanFace className="w-12 h-12" />,
        ring: "text-yellow-400 border-yellow-500/50 shadow-yellow-500/20 animate-pulse",
        bg: "bg-yellow-500/10",
        bar: "bg-yellow-500",
        title: "DISTRACTED",
        desc: "No face detected for a sustained period. Driver may be looking away.",
        badge: { label: "No Face Detected", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      };
    case "Driver Not Present":
      return {
        icon: <UserX className="w-12 h-12" />,
        ring: "text-red-500 border-red-500/50 shadow-red-500/20 animate-pulse",
        bg: "bg-red-500/10",
        bar: "bg-red-500",
        title: "ALERT",
        desc: "Driver not detected in seat. Camera feed is dark or obstructed.",
        badge: { label: "Driver Not Present", color: "bg-red-500/20 text-red-400 border-red-500/30" },
      };
    default:
      return {
        icon: <AlertTriangle className="w-12 h-12" />,
        ring: "text-red-500 border-red-500/50 shadow-red-500/20 animate-pulse",
        bg: "bg-red-500/10",
        bar: "bg-red-500",
        title: "DISTRACTED",
        desc: "WARNING: Driver attention diverted for a sustained period! Please focus on the road.",
        badge: { label: "Distracted", color: "bg-red-500/20 text-red-400 border-red-500/30" },
      };
  }
}

export function WebcamMonitor() {
  const webcamRef = useRef<Webcam>(null);
  const [isActive, setIsActive] = useState(false);
  const [uiState, setUiState] = useState<UiState>("idle");
  const [label, setLabel] = useState<DetectionLabel>(null);
  const [confidence, setConfidence] = useState(0);
  const [pendingProgress, setPendingProgress] = useState(0);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(Date.now());
  const framesRef = useRef(0);

  // Debounce bookkeeping
  const distractionStartRef = useRef<number | null>(null);
  const lastLoggedStateRef = useRef<boolean | null>(null);

  const processFrame = useProcessFrame();
  const createDetection = useCreateDetection();
  const createScreenshot = useCreateScreenshot();
  const createScreenshotRef = useRef(createScreenshot);
  createScreenshotRef.current = createScreenshot;

  const capture = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot({ width: 320, height: 240 });
    if (!imageSrc) return;

    try {
      const result = await processFrame.mutateAsync(imageSrc);
      setLabel(result.label as DetectionLabel);
      setConfidence(result.confidence);

      const now = Date.now();

      if (result.distracted) {
        if (distractionStartRef.current === null) {
          distractionStartRef.current = now;
        }
        const elapsed = now - distractionStartRef.current;
        const confirmed = elapsed >= DISTRACTION_THRESHOLD_MS;

        setPendingProgress(Math.min(elapsed / DISTRACTION_THRESHOLD_MS, 1));
        setUiState(confirmed ? "distracted" : "pending");

        if (confirmed && lastLoggedStateRef.current !== true) {
          lastLoggedStateRef.current = true;
          const currentImg = webcamRef.current?.getScreenshot({ width: 320, height: 240 }) || null;
          createDetection.mutate({
            label: result.label,
            distracted: true,
            confidence: result.confidence,
            snapshot: currentImg,
          });
        }
      } else {
        distractionStartRef.current = null;
        setPendingProgress(0);
        setUiState("safe");

        if (lastLoggedStateRef.current !== false) {
          lastLoggedStateRef.current = false;
          createDetection.mutate({
            label: result.label,
            distracted: false,
            confidence: result.confidence,
            snapshot: null,
          });
        }
      }
    } catch (err) {
      console.error("Frame processing failed", err);
    }
  }, [processFrame, createDetection]);

  // FPS counter
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTimeRef.current;
      if (delta >= 1000) {
        setFps(Math.round((framesRef.current * 1000) / delta));
        framesRef.current = 0;
        lastTimeRef.current = now;
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // Main capture loop
  useEffect(() => {
    let id: NodeJS.Timeout;
    if (isActive) {
      id = setInterval(() => {
        capture();
        framesRef.current++;
      }, 500);
    } else {
      setUiState("idle");
      setLabel(null);
      setConfidence(0);
      setFps(0);
      setPendingProgress(0);
      distractionStartRef.current = null;
      lastLoggedStateRef.current = null;
    }
    return () => clearInterval(id);
  }, [isActive, capture]);

  // Background screenshot capture for audit purposes (72h retention on server).
  // Uses a ref for the mutation so this effect only restarts when isActive
  // changes, not on every re-render (the capture loop re-renders every 500ms).
  useEffect(() => {
    if (!isActive) return;
    let timeoutId: NodeJS.Timeout;

    const startCapturing = () => {
      // Capture first screenshot after 3 seconds of warm-up
      timeoutId = setTimeout(() => {
        const imageSrc = webcamRef.current?.getScreenshot({ width: 640, height: 480 });
        if (imageSrc) {
          createScreenshotRef.current.mutate({ image: imageSrc });
        }

        const scheduleNext = () => {
          timeoutId = setTimeout(() => {
            const innerImageSrc = webcamRef.current?.getScreenshot({ width: 640, height: 480 });
            if (innerImageSrc) {
              createScreenshotRef.current.mutate({ image: innerImageSrc });
            }
            scheduleNext();
          }, SCREENSHOT_INTERVAL_MS);
        };

        scheduleNext();
      }, 3000);
    };

    startCapturing();
    return () => clearTimeout(timeoutId);
  }, [isActive]);

  const cfg = getLabelConfig(uiState, label);
  const borderGlow = uiState === "distracted"
    ? "border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]"
    : uiState === "pending"
    ? "border-blue-500/60"
    : "border-border";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Video Feed */}
      <Card className={`col-span-1 lg:col-span-2 relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${borderGlow}`}>
        <div className="absolute top-4 left-4 z-20 flex gap-2 flex-wrap">
          <div className="px-2 py-1 rounded bg-black/60 backdrop-blur text-xs font-mono text-white/80 border border-white/10 flex items-center gap-2">
            <Camera className="w-3 h-3" /> CAM_01
          </div>
          {isActive && (
            <div className="px-2 py-1 rounded bg-black/60 backdrop-blur text-xs font-mono text-primary border border-primary/20">
              LIVE • {fps} FPS
            </div>
          )}
          {cfg.badge && isActive && (
            <div className={`px-2 py-1 rounded backdrop-blur text-xs font-semibold border ${cfg.badge.color}`}>
              {cfg.badge.label}
            </div>
          )}
        </div>

        {isActive ? (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={VIDEO_CONSTRAINTS}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 text-muted-foreground gap-4">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <VideoOff className="w-10 h-10 opacity-50" />
            </div>
            <p className="text-lg font-medium">Monitoring Paused</p>
            <Button
              onClick={() => { setIsActive(true); setTimeout(() => capture(), 100); }}
              className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Start Camera Feed
            </Button>
          </div>
        )}

        {/* Overlay HUD */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none border-[1px] border-white/10 m-4 rounded-xl">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/50 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/50 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/50 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/50 rounded-br-xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 opacity-30">
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white" />
              <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white" />
            </div>
          </div>
        )}

        {/* Pending confirmation progress bar (bottom of video) */}
        {uiState === "pending" && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div
              className="h-full bg-blue-400 transition-all duration-150"
              style={{ width: `${pendingProgress * 100}%` }}
            />
          </div>
        )}
      </Card>

      {/* Status Panel */}
      <div className="flex flex-col gap-6">
        <Card className={`flex-1 p-6 flex flex-col items-center justify-center text-center transition-colors duration-300 ${cfg.bg} border border-white/5`}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 mb-6 transition-all duration-300 ${cfg.ring}`}>
            {cfg.icon}
          </div>

          <h2 className="text-3xl font-bold tracking-tight mb-1 uppercase">{cfg.title}</h2>

          {label && isActive && (
            <p className="text-sm font-mono font-semibold text-muted-foreground mb-2 uppercase tracking-widest">
              {label}
            </p>
          )}

          <p className="text-muted-foreground mb-6 text-sm">{cfg.desc}</p>

          {uiState === "pending" && (
            <div className="w-full mb-6 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Confirming...</span>
                <span>{Math.round(pendingProgress * DISTRACTION_THRESHOLD_MS / 100) / 10}s / {DISTRACTION_THRESHOLD_MS / 1000}s</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 transition-all duration-150"
                  style={{ width: `${pendingProgress * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Confidence Level</span>
              <span className="font-mono font-bold">{(confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${cfg.bar}`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Controls */}
        <Card className="p-6 border border-white/5 bg-card/50 backdrop-blur">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4 tracking-wider">System Controls</h3>
          <div className="flex gap-4">
            <Button
              className={`flex-1 ${isActive ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/50" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
              variant={isActive ? "outline" : "default"}
              onClick={() => {
                const next = !isActive;
                setIsActive(next);
                if (next) setTimeout(() => capture(), 100);
              }}
            >
              {isActive ? "Stop Monitor" : "Start Monitor"}
            </Button>
            <Button variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => window.location.reload()}>
              Reset System
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
