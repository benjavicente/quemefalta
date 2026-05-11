import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUndo } from '@/composables/useUndo';

beforeEach(() => {
  // Reset undo state between tests
  const { dismiss } = useUndo();
  dismiss();
});

describe('useUndo', () => {
  it('starts with no undo entry', () => {
    const { currentUndo } = useUndo();
    expect(currentUndo.value).toBeNull();
  });

  it('pushUndo sets current entry', () => {
    const { pushUndo, currentUndo } = useUndo();
    const fn = vi.fn();
    pushUndo('Test action', fn);

    expect(currentUndo.value).not.toBeNull();
    expect(currentUndo.value!.description).toBe('Test action');
  });

  it('executeUndo calls the undo function', () => {
    const { pushUndo, executeUndo } = useUndo();
    const fn = vi.fn();
    pushUndo('Test', fn);

    executeUndo();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('executeUndo clears current entry', () => {
    const { pushUndo, executeUndo, currentUndo } = useUndo();
    pushUndo('Test', vi.fn());

    executeUndo();
    expect(currentUndo.value).toBeNull();
  });

  it('dismiss clears without calling undo', () => {
    const { pushUndo, dismiss, currentUndo } = useUndo();
    const fn = vi.fn();
    pushUndo('Test', fn);

    dismiss();
    expect(currentUndo.value).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('auto-expires after 4 seconds', () => {
    vi.useFakeTimers();
    const { pushUndo, currentUndo } = useUndo();
    pushUndo('Test', vi.fn());

    expect(currentUndo.value).not.toBeNull();
    vi.advanceTimersByTime(4000);
    expect(currentUndo.value).toBeNull();

    vi.useRealTimers();
  });

  it('new push replaces previous entry', () => {
    const { pushUndo, currentUndo } = useUndo();
    pushUndo('First', vi.fn());
    pushUndo('Second', vi.fn());

    expect(currentUndo.value!.description).toBe('Second');
  });

  it('executeUndo does nothing when no entry', () => {
    const { executeUndo } = useUndo();
    expect(() => executeUndo()).not.toThrow();
  });
});
