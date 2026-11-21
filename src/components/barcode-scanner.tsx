"use client";

import { useEffect, useRef, useState } from "react";
import { inputCls } from "./ui";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Camera barcode scanner. Uses the browser's built-in BarcodeDetector where it
 * exists (Chrome on Android) and falls back to ZXing (iPhone Safari, desktop).
 * The camera needs HTTPS (or localhost). A typed barcode always works.
 */
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "nocamera">("starting");
  const [typed, setTyped] = useState("");
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopZxing: (() => void) | null = null;
    let cancelled = false;

    const found = (code: string) => {
      if (done.current) return;
      done.current = true;
      navigator.vibrate?.(60);
      onCode(code);
    };

    async function start() {
      const video = videoRef.current;
      if (!video || !navigator.mediaDevices?.getUserMedia) return setStatus("nocamera");
      const Native = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      try {
        if (Native) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (cancelled) return;
          video.srcObject = stream;
          await video.play();
          setStatus("scanning");
          const detector = new Native({ formats: FORMATS });
          const tick = async () => {
            if (cancelled || done.current) return;
            try {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) return found(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
            raf = requestAnimationFrame(tick);
          };
          tick();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: "environment" }, audio: false },
            video,
            (result) => result && found(result.getText()),
          );
          stopZxing = () => controls.stop();
          if (cancelled) return stopZxing();
          setStatus("scanning");
        }
      } catch {
        if (!cancelled) setStatus("nocamera");
      }
    }
    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      stopZxing?.();
    };
  }, [onCode]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Scan a barcode</span>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-text">
          Cancel
        </button>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        {status === "scanning" && (
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80" />
        )}
        {status !== "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white/80">
            {status === "starting" ? "Starting camera…" : "Camera unavailable. Type the barcode below instead."}
          </div>
        )}
      </div>
      {status === "scanning" && <p className="text-xs text-muted">Hold the barcode inside the box.</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const code = typed.replace(/\D/g, "");
          if (code.length >= 6) {
            done.current = true;
            onCode(code);
          }
        }}
      >
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          inputMode="numeric"
          placeholder="Or type the barcode number"
          aria-label="Barcode number"
          className={inputCls}
        />
        <button className="shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-accent-text">Look up</button>
      </form>
    </div>
  );
}
