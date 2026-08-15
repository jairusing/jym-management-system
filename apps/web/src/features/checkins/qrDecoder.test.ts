// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import jsQR from 'jsqr';
import { decodeQrFromVideo } from './qrDecoder';

vi.mock('jsqr', () => ({
  default: vi.fn()
}));

const mockedJsQR = vi.mocked(jsQR);

function stubCanvasContext() {
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1
    }))
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => context as unknown as CanvasRenderingContext2D
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return context;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('decodeQrFromVideo', () => {
  it('returns the decoded QR payload from a video frame', () => {
    stubCanvasContext();
    mockedJsQR.mockReturnValue({ data: 'member-123' } as never);

    const video = document.createElement('video');
    expect(decodeQrFromVideo(video)).toBe('member-123');
    expect(mockedJsQR).toHaveBeenCalledOnce();
  });

  it('returns null when no QR code is present', () => {
    stubCanvasContext();
    mockedJsQR.mockReturnValue(null);

    const video = document.createElement('video');
    expect(decodeQrFromVideo(video)).toBeNull();
  });

  it('returns null when canvas access fails', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const video = document.createElement('video');
    expect(decodeQrFromVideo(video)).toBeNull();
  });
});