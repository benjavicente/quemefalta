import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import UndoToast from '@/components/UndoToast.vue';

describe('UndoToast', () => {
  it('renders message when visible', () => {
    const w = mount(UndoToast, {
      props: { message: 'Lámina agregada', visible: true },
    });
    expect(w.text()).toContain('Lámina agregada');
  });

  it('does not render when not visible', () => {
    const w = mount(UndoToast, {
      props: { message: 'Lámina agregada', visible: false },
    });
    expect(w.find('.toast').exists()).toBe(false);
  });

  it('renders undo button', () => {
    const w = mount(UndoToast, {
      props: { message: 'Test', visible: true },
    });
    expect(w.find('.toast-undo').text()).toBe('DESHACER');
  });

  it('emits undo when undo button clicked', async () => {
    const w = mount(UndoToast, {
      props: { message: 'Test', visible: true },
    });
    await w.find('.toast-undo').trigger('click');
    expect(w.emitted('undo')).toHaveLength(1);
  });

  it('emits dismiss after duration', async () => {
    vi.useFakeTimers();
    // Mount with visible=false first, then toggle to trigger watcher
    const w = mount(UndoToast, {
      props: { message: 'Test', visible: false, duration: 1000 },
    });
    await w.setProps({ visible: true });
    await flushPromises();
    vi.advanceTimersByTime(1000);
    await flushPromises();
    expect(w.emitted('dismiss')).toHaveLength(1);
    vi.useRealTimers();
  });

  it('uses default 3000ms duration', async () => {
    vi.useFakeTimers();
    const w = mount(UndoToast, {
      props: { message: 'Test', visible: false },
    });
    await w.setProps({ visible: true });
    await flushPromises();
    vi.advanceTimersByTime(2999);
    await flushPromises();
    expect(w.emitted('dismiss')).toBeUndefined();
    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(w.emitted('dismiss')).toHaveLength(1);
    vi.useRealTimers();
  });

  it('resets timer when visibility changes', async () => {
    vi.useFakeTimers();
    const w = mount(UndoToast, {
      props: { message: 'Test', visible: true, duration: 1000 },
    });
    vi.advanceTimersByTime(500);
    await w.setProps({ visible: false });
    await w.setProps({ visible: true });
    vi.advanceTimersByTime(500);
    await flushPromises();
    // Should NOT have fired yet (timer restarted)
    expect(w.emitted('dismiss')).toBeUndefined();
    vi.advanceTimersByTime(500);
    await flushPromises();
    expect(w.emitted('dismiss')).toHaveLength(1);
    vi.useRealTimers();
  });
});
