import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, readonly } from 'vue';
import UndoToast from '@/components/UndoToast.vue';

const mockUndoEntry = ref<{ description: string; undoFn: () => void; timestamp: number } | null>(
  null,
);
const mockExecuteUndo = vi.fn();
const mockDismiss = vi.fn();

vi.mock('@/composables/useUndo', () => ({
  useUndo: () => ({
    currentUndo: readonly(mockUndoEntry),
    pushUndo: vi.fn(),
    executeUndo: mockExecuteUndo,
    dismiss: mockDismiss,
  }),
}));

beforeEach(() => {
  mockUndoEntry.value = null;
  mockExecuteUndo.mockClear();
  mockDismiss.mockClear();
});

describe('UndoToast', () => {
  describe('legacy prop mode', () => {
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

    it('emits dismiss after duration', async () => {
      vi.useFakeTimers();
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
  });

  describe('composable undo mode', () => {
    it('renders undo button when composable has entry', () => {
      mockUndoEntry.value = {
        description: '3 láminas marcadas',
        undoFn: vi.fn(),
        timestamp: Date.now(),
      };
      const w = mount(UndoToast);
      expect(w.find('.toast').exists()).toBe(true);
      expect(w.text()).toContain('3 láminas marcadas');
      expect(w.find('.toast-undo').text()).toBe('DESHACER');
    });

    it('calls executeUndo when undo button clicked', async () => {
      mockUndoEntry.value = {
        description: 'Test',
        undoFn: vi.fn(),
        timestamp: Date.now(),
      };
      const w = mount(UndoToast);
      await w.find('.toast-undo').trigger('click');
      expect(mockExecuteUndo).toHaveBeenCalledOnce();
    });

    it('does not show undo button when no composable entry', () => {
      mockUndoEntry.value = null;
      const w = mount(UndoToast, {
        props: { message: 'Legacy message', visible: true },
      });
      expect(w.find('.toast-undo').exists()).toBe(false);
    });

    it('calls dismiss when toast background clicked', async () => {
      mockUndoEntry.value = {
        description: 'Test',
        undoFn: vi.fn(),
        timestamp: Date.now(),
      };
      const w = mount(UndoToast);
      await w.find('.toast').trigger('click');
      expect(mockDismiss).toHaveBeenCalledOnce();
    });
  });
});
