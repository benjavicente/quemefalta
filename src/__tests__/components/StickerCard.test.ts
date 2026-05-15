import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import StickerCard from '@/components/StickerCard.vue';
import type { StickerState } from '@/composables/useStickers';

// Mock the image import
vi.mock('@/assets/ball-stadium.png', () => ({ default: 'ball.png' }));

function mountCard(state: Partial<StickerState> = {}) {
  return mount(StickerCard, {
    props: {
      number: 42,
      code: 'MEX2',
      state: { owned: false, dupes: 0, note: '', ...state },
    },
  });
}

describe('StickerCard', () => {
  describe('rendering', () => {
    it('renders sticker code', () => {
      const w = mountCard();
      expect(w.text()).toContain('MEX2');
    });

    it('has stk-owned class when owned', () => {
      const w = mountCard({ owned: true });
      expect(w.find('.stk-owned').exists()).toBe(true);
    });

    it('does not have stk-owned class when not owned', () => {
      const w = mountCard({ owned: false });
      expect(w.find('.stk-owned').exists()).toBe(false);
    });

    it('has stk-dupe class when dupes > 0', () => {
      const w = mountCard({ owned: true, dupes: 1 });
      expect(w.find('.stk-dupe').exists()).toBe(true);
    });

    it('shows badge with dupes count (+N)', () => {
      const w = mountCard({ owned: true, dupes: 2 });
      const badge = w.find('.stk-badge');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toBe('+2');
    });

    it('does not show badge when dupes is 0', () => {
      const w = mountCard({ owned: true, dupes: 0 });
      expect(w.find('.stk-badge').exists()).toBe(false);
    });

    it('shows note dot when note is truthy', () => {
      const w = mountCard({ owned: true, note: 'for pedro' });
      expect(w.find('.stk-note-dot').exists()).toBe(true);
    });

    it('hides note dot when note is empty', () => {
      const w = mountCard({ owned: true, note: '' });
      expect(w.find('.stk-note-dot').exists()).toBe(false);
    });
  });

  describe('interactions', () => {
    it('emits cycle on short click (pointerdown + quick pointerup)', async () => {
      const w = mountCard();
      const stk = w.find('.stk');

      await stk.trigger('pointerdown');
      await stk.trigger('pointerup');

      expect(w.emitted('cycle')).toHaveLength(1);
      expect(w.emitted('openDetail')).toBeUndefined();
    });

    it('emits openDetail on long press (400ms)', async () => {
      vi.useFakeTimers();
      const w = mountCard();
      const stk = w.find('.stk');

      await stk.trigger('pointerdown');
      vi.advanceTimersByTime(400);
      await stk.trigger('pointerup');

      expect(w.emitted('openDetail')).toHaveLength(1);
      expect(w.emitted('cycle')).toBeUndefined();

      vi.useRealTimers();
    });

    it('cancels long press on pointercancel', async () => {
      vi.useFakeTimers();
      const w = mountCard();
      const stk = w.find('.stk');

      await stk.trigger('pointerdown');
      vi.advanceTimersByTime(200);
      await stk.trigger('pointercancel');
      vi.advanceTimersByTime(300);
      await stk.trigger('pointerup');

      // Neither event should fire since pointer was cancelled
      expect(w.emitted('openDetail')).toBeUndefined();

      vi.useRealTimers();
    });

    it('cancels long press on pointerleave', async () => {
      vi.useFakeTimers();
      const w = mountCard();
      const stk = w.find('.stk');

      await stk.trigger('pointerdown');
      vi.advanceTimersByTime(200);
      await stk.trigger('pointerleave');
      vi.advanceTimersByTime(300);

      expect(w.emitted('openDetail')).toBeUndefined();

      vi.useRealTimers();
    });
  });
});
