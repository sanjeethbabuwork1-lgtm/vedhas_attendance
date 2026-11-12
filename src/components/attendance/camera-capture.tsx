"use client";

/* eslint-disable @next/next/no-img-element -- base64 captured photos */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type CamState = "starting" | "live" | "captured" | "error";

type FaceDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<unknown[]>;
};

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }
}

export function CameraCapture({
  title,
  onCapture,
  onCancel,
}: {
  title: string;
  onCapture: (faceDetected: boolean) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetectorLike | null>(null);
  const [state, setState] = useState<CamState>("starting");
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);
  const autoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setState("starting");
      setErrorMsg(null);

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setState("error");
        setErrorMsg(
          "Camera access is not available here. This feature needs a secure context (HTTPS) or localhost."
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setState("live");

        if (window.FaceDetector) {
          try {
            detectorRef.current = new window.FaceDetector({
              fastMode: true,
              maxDetectedFaces: 1,
            });
            setAutoDetect(true);
          } catch {
            setAutoDetect(false);
          }
        } else {
          setAutoDetect(false);
        }
      } catch (err) {
        if (cancelled) return;
        setState("error");
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setErrorMsg(
            "Camera permission is required to mark attendance. Please allow camera access in your browser settings and try again."
          );
        } else if (
          name === "NotFoundError" ||
          name === "OverconstrainedError"
        ) {
          setErrorMsg("No camera was found on this device.");
        } else {
          setErrorMsg("Unable to access the camera. Please try again.");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (state !== "live" || !autoDetect || !detectorRef.current) {
      setFaceDetected(false);
      return;
    }

    let stopped = false;
    let rafId = 0;
    const video = videoRef.current;

    async function tick() {
      if (stopped || !video || video.readyState < 2 || !detectorRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      try {
        const faces = await detectorRef.current.detect(video);
        if (stopped) return;
        if (faces.length > 0) {
          setFaceDetected(true);
          if (autoTimerRef.current === null) {
            autoTimerRef.current = window.setTimeout(() => {
              autoTimerRef.current = null;
              capture();
            }, 600);
          }
        } else {
          setFaceDetected(false);
          if (autoTimerRef.current !== null) {
            window.clearTimeout(autoTimerRef.current);
            autoTimerRef.current = null;
          }
        }
      } catch {
        // ignore transient detection errors
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [state, autoDetect]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // The <video> element unmounts when a photo is captured. On retake a fresh
  // <video> mounts, so re-attach the (still running) stream to it.
  useEffect(() => {
    if (state !== "live" || !streamRef.current) return;
    const video = videoRef.current;
    if (video && !video.srcObject) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
  }, [state]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL("image/jpeg", 0.72));
    setState("captured");

    if (detectorRef.current) {
      detectorRef.current
        .detect(canvas)
        .then((faces) => setFaceDetected(faces.length > 0))
        .catch(() => setFaceDetected(false));
    }
  }

  function retake() {
    setPreview(null);
    setFaceDetected(false);
    setState("live");
  }

  function close() {
    stopStream();
    onCancel();
  }

  return (
    <Modal onClose={close} panelClassName="p-5">
      <h3 className="mb-4 text-base font-bold text-slate-900">{title}</h3>

      <div
          className={cn(
            "mb-4 overflow-hidden rounded-2xl border-2 bg-black transition-colors duration-300",
            state === "live" && autoDetect
              ? faceDetected
                ? "border-success shadow-lg shadow-success/30"
                : "border-slate-200"
              : "border-slate-200"
          )}
        >
          {state === "captured" && preview ? (
            <img
              src={preview}
              alt="Captured photo"
              className="aspect-[3/4] w-full -scale-x-100 object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[3/4] w-full -scale-x-100 object-cover"
            />
          )}
        </div>

        {state === "live" && autoDetect && (
          <div
            className={cn(
              "mb-3 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
              faceDetected
                ? "bg-success-soft text-success"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {faceDetected ? (
              <>
                <Camera className="size-4 animate-pulse" />
                Face detected — capturing…
              </>
            ) : (
              <>
                <Camera className="size-4" />
                Position your face in the frame
              </>
            )}
          </div>
        )}

        {state === "starting" && (
          <p className="mb-3 flex items-center justify-center gap-2 text-center text-sm text-slate-500">
            <Camera className="size-4 animate-pulse" />
            Starting camera…
          </p>
        )}

        {state === "error" && (
          <div className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            <p className="flex items-center gap-2">
              <CameraOff className="size-4 shrink-0" />
              Camera unavailable
            </p>
            <p className="mt-1 text-xs font-normal">{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {state === "captured" ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => {
                  stopStream();
                  onCapture(faceDetected);
                }}
              >
                Use this photo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={retake}
              >
                <RefreshCcw className="size-4" />
                Retake
              </Button>
            </>
          ) : state === "error" ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => setAttempt((a) => a + 1)}
              >
                <RefreshCcw className="size-4" />
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={close}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={state !== "live"}
                onClick={capture}
              >
                <Camera className="size-4" />
                Capture
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={state !== "live"}
                onClick={close}
              >
                Cancel
              </Button>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          A live photo is required — attendance cannot be marked from a saved
          file. Only face detection is recorded with your attendance.
        </p>
    </Modal>
  );
}