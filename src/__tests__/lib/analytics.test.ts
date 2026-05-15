import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockear @vercel/analytics ANTES de importar analytics.ts.
const trackMock = vi.fn();

vi.mock('@vercel/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

describe('analytics.track', () => {
  beforeEach(() => {
    trackMock.mockReset();
    vi.resetModules();
  });

  it('forwards event name and props to vercel/analytics when not in mock mode', async () => {
    vi.stubEnv('VITE_MOCK', 'false');
    const { track } = await import('@/lib/analytics');
    track('test_event', { foo: 'bar' });
    expect(trackMock).toHaveBeenCalledWith('test_event', { foo: 'bar' });
  });

  it('forwards undefined when called without props', async () => {
    vi.stubEnv('VITE_MOCK', 'false');
    const { track } = await import('@/lib/analytics');
    track('test_event_no_props');
    expect(trackMock).toHaveBeenCalledWith('test_event_no_props', undefined);
  });

  it('no-ops in mock mode (VITE_MOCK=true)', async () => {
    vi.stubEnv('VITE_MOCK', 'true');
    const { track } = await import('@/lib/analytics');
    track('test_event', { foo: 'bar' });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('swallows errors from the underlying tracker so UI never breaks', async () => {
    vi.stubEnv('VITE_MOCK', 'false');
    trackMock.mockImplementation(() => {
      throw new Error('boom');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { track } = await import('@/lib/analytics');
    expect(() => track('test_event')).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
