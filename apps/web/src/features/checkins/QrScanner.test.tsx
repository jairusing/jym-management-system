// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QrScanner } from './QrScanner';

vi.mock('./qrDecoder', () => ({
  decodeQrFromVideo: vi.fn()
}));

const { decodeQrFromVideo } = await import('./qrDecoder');
const mockedDecode = vi.mocked(decodeQrFromVideo);

function stubCamera() {
  const stop = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop }]
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia }
  });
  return { getUserMedia, stop };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

describe('QrScanner', () => {
  it('requests the back camera and reports a decoded member ID', async () => {
    const camera = stubCamera();
    mockedDecode.mockReturnValue('member-123');

    const onCode = vi.fn();
    const onError = vi.fn();
    render(<QrScanner onCode={onCode} onError={onError} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(camera.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } });
    });
    await waitFor(() => {
      expect(onCode).toHaveBeenCalledWith('member-123');
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an error when camera access is denied', async () => {
    const camera = stubCamera();
    camera.getUserMedia.mockRejectedValue(new Error('denied'));

    const onError = vi.fn();
    render(<QrScanner onCode={vi.fn()} onError={onError} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/camera access was denied/i));
    });
  });

  it('stops the camera tracks on unmount', async () => {
    const camera = stubCamera();
    mockedDecode.mockReturnValue(null);

    const { unmount } = render(
      <QrScanner onCode={vi.fn()} onError={vi.fn()} onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(camera.getUserMedia).toHaveBeenCalled();
    });
    unmount();
    expect(camera.stop).toHaveBeenCalled();
  });

  it('closes when the cancel button is pressed', async () => {
    stubCamera();
    mockedDecode.mockReturnValue(null);

    const onClose = vi.fn();
    render(<QrScanner onCode={vi.fn()} onError={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});