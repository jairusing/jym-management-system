// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadFile } from './download';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('downloadFile', () => {
  it('creates a UTF-8 BOM blob and clicks a link with the right filename', async () => {
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob?: Blob) => {
      if (blob) {
        created.push(blob);
      }
      return 'blob:mock';
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const filenames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        filenames.push(this.download);
      }
    );

    downloadFile('members-2026-08-28.csv', 'Full name\r\nJuan Dela Cruz');

    expect(filenames).toEqual(['members-2026-08-28.csv']);
    expect(created).toHaveLength(1);
    const bytes = new Uint8Array(await created[0]!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8').decode(bytes.slice(3))).toBe('Full name\r\nJuan Dela Cruz');
  });

  it('defaults to a CSV MIME type and revokes the object URL', () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadFile('x.csv', 'a');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});