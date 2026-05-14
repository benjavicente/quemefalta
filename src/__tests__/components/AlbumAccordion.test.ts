import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';
import AlbumAccordion from '@/components/AlbumAccordion.vue';
import type { StickerState } from '@/composables/useStickers';

vi.mock('@/assets/ball-stadium.png', () => ({ default: 'ball.png' }));
vi.mock('@/assets/ball-crest.jpg', () => ({ default: 'crest.jpg' }));
vi.mock('@/assets/field-squad.jpg', () => ({ default: 'squad.jpg' }));

let mockStickersData: Record<number, StickerState> = {};

vi.mock('@/composables/useStickers', () => ({
  useStickers: () => ({
    stickers: computed(() => mockStickersData),
    loading: ref(false),
    loaded: ref(true),
    syncError: ref(null),
    sessionDead: ref(false),
    pendingOps: ref(new Map()),
    pendingCount: computed(() => 0),
    failedCount: computed(() => 0),
    stats: computed(() => ({ owned: 0, missing: 980, dupes: 0, pct: 0, withNotes: 0 })),
    getSticker: (n: number): StickerState =>
      mockStickersData[n] ?? { owned: false, dupes: 0, note: '' },
    getStickerSyncStatus: () => null,
    retryAllPending: vi.fn(),
    discardAllPending: vi.fn(),
    discardOne: vi.fn(),
    cycleSticker: vi.fn(),
    markSectionComplete: vi.fn(),
    clearSection: vi.fn(),
    adjustDupes: vi.fn(),
    removeSticker: vi.fn(),
    setSticker: vi.fn(),
    setNote: vi.fn(),
    addBatch: vi.fn(),
    decrementSticker: vi.fn(),
  }),
}));

vi.mock('@/composables/useUndo', () => ({
  useUndo: () => ({
    currentUndo: ref(null),
    pushUndo: vi.fn(),
    executeUndo: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

beforeEach(() => {
  mockStickersData = {};
});

function mountAccordion() {
  return mount(AlbumAccordion);
}

describe('AlbumAccordion', () => {
  describe('rendering', () => {
    it('renders intro section', () => {
      const w = mountAccordion();
      expect(w.text()).toContain('Introducción');
    });

    it('renders 12 group headers (A-L)', () => {
      const w = mountAccordion();
      const heads = w.findAll('.acc-group-head');
      expect(heads).toHaveLength(12);
    });

    it('shows group letter', () => {
      const w = mountAccordion();
      expect(w.find('.acc-group-letter').text()).toBe('A');
    });
  });

  describe('expand/collapse', () => {
    it('expands group to show teams on click', async () => {
      const w = mountAccordion();
      await w.findAll('.acc-group-head')[0].trigger('click'); // Group A
      expect(w.find('.acc-teams').exists()).toBe(true);
      const teams = w.findAll('.acc-team');
      // 4 teams in Group A + intro = 5 acc-team elements
      expect(teams.length).toBeGreaterThanOrEqual(4);
    });

    it('expands team to show sticker grid on click', async () => {
      const w = mountAccordion();
      // Expand group A
      await w.findAll('.acc-group-head')[0].trigger('click');
      // Click México (first team in group A)
      const teams = w.findAll('.acc-teams .acc-team');
      await teams[0].trigger('click');
      // SectionView should render
      expect(w.find('.acc-content').exists()).toBe(true);
      expect(w.find('.sect-grid').exists()).toBe(true);
    });

    it('collapses group on second click', async () => {
      const w = mountAccordion();
      await w.findAll('.acc-group-head')[0].trigger('click');
      expect(w.find('.acc-teams').exists()).toBe(true);
      await w.findAll('.acc-group-head')[0].trigger('click');
      expect(w.find('.acc-teams').exists()).toBe(false);
    });
  });

  describe('sectionChange event (URL hash sync)', () => {
    it('emits sectionChange when team is expanded', async () => {
      const w = mountAccordion();
      // Expand group A
      await w.findAll('.acc-group-head')[0].trigger('click');
      // Click México
      const teams = w.findAll('.acc-teams .acc-team');
      await teams[0].trigger('click');

      expect(w.emitted('sectionChange')).toHaveLength(1);
      expect(w.emitted('sectionChange')![0]).toEqual(['team-mex']);
    });

    it('does not emit sectionChange when team is collapsed', async () => {
      const w = mountAccordion();
      await w.findAll('.acc-group-head')[0].trigger('click');
      const teams = w.findAll('.acc-teams .acc-team');
      // Open
      await teams[0].trigger('click');
      // Close
      await teams[0].trigger('click');

      // Only 1 emission (the open), not 2
      expect(w.emitted('sectionChange')).toHaveLength(1);
    });

    it('emits sectionChange with intro when intro is expanded', async () => {
      const w = mountAccordion();
      // Click intro section (first acc-team outside groups)
      const introBtn = w.find('.acc > .acc-item .acc-team');
      await introBtn.trigger('click');

      expect(w.emitted('sectionChange')).toHaveLength(1);
      expect(w.emitted('sectionChange')![0]).toEqual(['intro']);
    });

    it('emits different sectionId for each team', async () => {
      const w = mountAccordion();
      await w.findAll('.acc-group-head')[0].trigger('click');
      const teams = w.findAll('.acc-teams .acc-team');

      // Click second team in group A (RSA)
      await teams[1].trigger('click');
      expect(w.emitted('sectionChange')![0]).toEqual(['team-rsa']);
    });
  });

  describe('openSection (URL hash → accordion)', () => {
    it('opens the correct group and team programmatically', async () => {
      const w = mountAccordion();
      const vm = w.vm as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      vm.openSection('team-mex');
      await w.vm.$nextTick();

      // Group A should be expanded
      expect(w.find('.acc-teams').exists()).toBe(true);
      // México team should be expanded with sticker grid
      expect(w.find('.acc-content').exists()).toBe(true);
      expect(w.find('.sect-name').text()).toContain('México');
    });

    it('opens intro section programmatically', async () => {
      const w = mountAccordion();
      const vm = w.vm as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      vm.openSection('intro');
      await w.vm.$nextTick();

      expect(w.find('.acc-content').exists()).toBe(true);
    });

    it('opens a team from a different group', async () => {
      const w = mountAccordion();
      const vm = w.vm as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      vm.openSection('team-arg');
      await w.vm.$nextTick();

      // Group D should be expanded (ARG is in D)
      expect(w.find('.acc-content').exists()).toBe(true);
      expect(w.find('.sect-name').text()).toContain('Argentina');
    });
  });

  describe('progress bars', () => {
    it('shows team progress bar', async () => {
      const w = mountAccordion();
      await w.findAll('.acc-group-head')[0].trigger('click');
      expect(w.find('.acc-team-bar').exists()).toBe(true);
      expect(w.find('.acc-team-fill').exists()).toBe(true);
    });

    it('shows intro progress bar', () => {
      const w = mountAccordion();
      const introBar = w.find('.acc > .acc-item .acc-team-bar');
      expect(introBar.exists()).toBe(true);
    });
  });
});
