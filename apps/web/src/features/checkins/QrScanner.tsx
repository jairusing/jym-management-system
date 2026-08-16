import { useEffect, useRef } from 'react';
import { decodeQrFromVideo } from './qrDecoder';

const SCAN_INTERVAL_MS = 150;

type QrScannerProps = {
  onCode: (code: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
};

export function QrScanner({ onCode, onError, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const onErrorRef = useRef(onError);
  onCodeRef.current = onCode;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let stream: MediaStream | null = null;

    const stopTracks = () => {
      stream?.getTracks().forEach((track) => track.stop());
    };

    const loop = () => {
      if (cancelled) {
        return;
      }
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const code = decodeQrFromVideo(video);
      if (code) {
        onCodeRef.current(code);
        return;
      }
      timer = window.setTimeout(loop, SCAN_INTERVAL_MS);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        onErrorRef.current('Camera is not available in this browser.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stopTracks();
          return;
        }
        const video = videoRef.current;
        if (!video) {
          stopTracks();
          return;
        }
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          void 0;
        }
        loop();
      } catch {
        onErrorRef.current('Camera access was denied. Enter the member ID manually instead.');
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      stopTracks();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0A0A0A]/95 p-6">
      <div className="w-full max-w-md">
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full border border-[#262626] bg-black"
          muted
          playsInline
        />
        <p className="mt-3 text-center text-sm text-[#A3A3A3]">
          Point the camera at the member's QR code.
        </p>
      </div>
      <button
        className="inline-flex items-center border border-[#262626] px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FAFAFA] transition-colors hover:border-[#FF3D00] hover:text-[#FF3D00]"
        type="button"
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  );
}