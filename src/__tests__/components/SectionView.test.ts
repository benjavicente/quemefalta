import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';
import SectionView from '@/components/SectionView.vue';
import type { AlbumSection } from '@/lib/albumData';
import type { StickerState } from '@/composables/useStickers';

// Mock the ball image
vi.mock('@/assets/ball-stadium.png', () => ({ default: 'ball.png' }));

const mockCycleSticker = vi.fn();
const mockMarkSectionComplete = vi.fn();
const mockClearSection = vi.fn();

let mockStickersData: Record<number, StickerState> = {};

vi.mock('@/composables/useStickers', () => ({
  useStickers: () => ({
    stickers: computed(() => mockStickersData),
    loading: ref(false),
    loaded: ref(true),
    syncError: ref(null),
    stats: computed(() => ({ owned: 0, missing: 980, dupes: 0, pct: 0, withNotes: 0 })),
    getSticker: (n: number): StickerState =>
      mockStickersData[n] ?? { owned: false, dupes: 0, note: '' },
    cycleSticker: mockCycleSticker,
    markSectionComplete: mockMarkSectionComplete,
    clearSection: mockClearSection,
    adjustDupes: vi.fn(),
    removeSticker: vi.fn(),
    setNote: vi.fn(),
  }),
}));

const section: AlbumSection = {
  id: 'team-mex',
  name: 'México',
  code: 'MEX',
  count: 20,
  startsAt: 21,
  group: 'A',
  isTeam: true,
};

function mountSection(stickerOverrides: Record<number, StickerState> = {}) {
  mockStickersData = stickerOverrides;
  return mount(SectionView, {
    props: { section },
  });
}

beforeEach(() => {
  mockCycleSticker.mockClear();
  mockMarkSectionComplete.mockClear();
  mockClearSection.mockClear();
  mockStickersData = {};
});

describe('SectionView', () => {
  describe('rendering', () => {
    it('renders section name', () => {
      const w = mountSection();
      expect(w.find('.sect-name').text()).toBe('México');
    });

    it('renders sticker range', () => {
      const w = mountSection();
      expect(w.find('.sect-meta').text()).toContain('MEX1—MEX20');
    });

    it('renders correct number of StickerCards', () => {
      const w = mountSection();
      const cards = w.findAll('.stk-wrap');
      expect(cards).toHaveLength(20);
    });

    it('shows owned count badge', () => {
      const w = mountSection({
        21: { owned: true, dupes: 0, note: '' },
        22: { owned: true, dupes: 0, note: '' },
      });
      expect(w.find('.sect-badge').text()).toBe('2/20');
    });
  });

  describe('complete button', () => {
    it('shows "Completar" button when section not complete', () => {
      const w = mountSection();
      expect(w.find('.complete-btn').exists()).toBe(true);
      expect(w.text()).toContain('Completar México');
    });

    it('shows "Sección completa" when all owned', () => {
      const allOwned: Record<number, StickerState> = {};
      for (let i = 21; i <= 40; i++) {
        allOwned[i] = { owned: true, dupes: 0, note: '' };
      }
      const w = mountSection(allOwned);
      expect(w.find('.complete-done').exists()).toBe(true);
      expect(w.find('.complete-btn').exists()).toBe(false);
    });

    it('calls markSectionComplete on click', async () => {
      const w = mountSection();
      await w.find('.complete-btn').trigger('click');

      expect(mockMarkSectionComplete).toHaveBeenCalledWith(21, 20);
    });
  });

  describe('clear button', () => {
    it('shows clear button when some stickers owned', () => {
      const w = mountSection({
        21: { owned: true, dupes: 0, note: '' },
      });
      expect(w.find('.clear-btn').exists()).toBe(true);
    });

    it('hides clear button when no stickers owned', () => {
      const w = mountSection();
      expect(w.find('.clear-btn').exists()).toBe(false);
    });

    it('calls clearSection on click after confirm', async () => {
      const w = mountSection({
        21: { owned: true, dupes: 0, note: '' },
      });
      await w.find('.clear-btn').trigger('click');

      // ConfirmDialog should appear
      const confirmBtn = w.find('.cd-danger');
      expect(confirmBtn.exists()).toBe(true);
      await confirmBtn.trigger('click');

      expect(mockClearSection).toHaveBeenCalledWith(21, 20);
    });
  });

  describe('events', () => {
    it('emits openDetail when a StickerCard emits openDetail', async () => {
      const w = mountSection();
      // Find first StickerCard's .stk element and simulate long press
      const firstCard = w.findAllComponents({ name: 'StickerCard' })[0];
      firstCard.vm.$emit('openDetail');

      expect(w.emitted('openDetail')).toHaveLength(1);
      expect(w.emitted('openDetail')![0]).toEqual([21]);
    });
  });
});
