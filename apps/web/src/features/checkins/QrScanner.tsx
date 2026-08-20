import { useEffect, useRef } from 'react';
import { outlineButtonClass } from '../../components/ui/buttonClasses';
import { decodeQrFromVideo } from './qrDecoder';

const SCAN_INTERVAL_MS = 150;
const DESC_ID = 'qr-scanner-description';

type QrScannerProps = {
  onCode: (code: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
};

export function QrScanner({ onCode, onError, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCodeRef = useRef(onCode);
  const onErrorRef = useRef(onError);
  const onCloseRef = useRef(onClose);
  onCodeRef.current = onCode;
  onErrorRef.current = onError;
  onCloseRef.current = onClose;

  const savedFocusRef = useRef<HTMLElement | null>(null);
  if (savedFocusRef.current === null) {
    savedFocusRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    const fallback = savedFocusRef.current;
    return () => {
      fallback?.focus();
    };
  }, []);

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR code"
      aria-describedby={DESC_ID}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0A0A0A]/95 p-6"
      onKeyDown={handleKeyDown}
    >
      <div ref={panelRef} className="w-full max-w-md">
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full border border-[#262626] bg-black"
          muted
          playsInline
          aria-label="Camera preview for scanning the member QR code"
        />
        <p id={DESC_ID} className="mt-3 text-center text-sm text-[#A3A3A3]">
          Point the camera at the member's QR code.
        </p>
      </div>
      <button className={outlineButtonClass} type="button" autoFocus onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}