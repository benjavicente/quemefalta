import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShare } from '@/composables/useShare';

describe('useShare', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('share()', () => {
    const shareData = {
      title: 'Mi album',
      text: 'Mira mi album',
      url: 'https://quemefalta.app/u/testuser',
    };

    it('uses navigator.share when available and returns "shared"', async () => {
      Object.defineProperty(navigator, 'share', {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true,
      });

      const { share } = useShare();
      const result = await share(shareData);

      expect(navigator.share).toHaveBeenCalledWith(shareData);
      expect(result).toBe('shared');
    });

    it('falls back to clipboard when navigator.share is not available', async () => {
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);

      const { share } = useShare();
      const result = await share(shareData);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(shareData.url);
      expect(result).toBe('copied');
    });

    it('handles AbortError gracefully', async () => {
      const abortError = new DOMException('User cancelled', 'AbortError');
      Object.defineProperty(navigator, 'share', {
        value: vi.fn().mockRejectedValue(abortError),
        writable: true,
        configurable: true,
      });

      const { share, lastResult } = useShare();
      const result = await share(shareData);

      expect(result).toBe('error');
      expect(lastResult.value).toBeNull();
    });

    it('returns "error" when both share and clipboard fail', async () => {
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('Clipboard blocked'));

      const { share, errorMessage } = useShare();
      const result = await share(shareData);

      expect(result).toBe('error');
      expect(errorMessage.value).toBe('Clipboard blocked');
    });
  });

  describe('copyOnly()', () => {
    it('returns true on success', async () => {
      navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);

      const { copyOnly } = useShare();
      const result = await copyOnly('some text');

      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('some text');
    });

    it('returns false on failure', async () => {
      navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('fail'));

      const { copyOnly } = useShare();
      const result = await copyOnly('some text');

      expect(result).toBe(false);
    });
  });

  describe('URL builders', () => {
    it('whatsappLink builds correct wa.me URL', () => {
      const { whatsappLink } = useShare();
      const url = whatsappLink('Check this', 'https://example.com');

      expect(url).toContain('https://wa.me/?text=');
      expect(url).toContain(encodeURIComponent('Check this\nhttps://example.com'));
    });

    it('linkedinLink builds correct LinkedIn sharing URL', () => {
      const { linkedinLink } = useShare();
      const url = linkedinLink('https://example.com');

      expect(url).toBe(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://example.com')}`,
      );
    });

    it('emailLink builds correct mailto URI', () => {
      const { emailLink } = useShare();
      const url = emailLink('Subject here', 'Body here');

      expect(url).toBe(
        `mailto:?subject=${encodeURIComponent('Subject here')}&body=${encodeURIComponent('Body here')}`,
      );
    });
  });

  describe('lastResult', () => {
    it('updates after successful share', async () => {
      Object.defineProperty(navigator, 'share', {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true,
      });

      const { share, lastResult } = useShare();
      expect(lastResult.value).toBeNull();

      await share({ title: 't', text: 'x', url: 'https://x.com' });
      expect(lastResult.value).toBe('shared');
    });
  });
});
