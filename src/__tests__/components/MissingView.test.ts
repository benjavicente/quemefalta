/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, readonly, computed } from 'vue';

let MissingView: any;

function createStickersState(ownedNumbers: number[]) {
  const map: Record<number, { owned: boolean; dupes: number; note: string }> = {};
  for (const n of ownedNumbers) {
    map[n] = { owned: true, dupes: 0, note: '' };
  }
  return map;
}

beforeEach(async () => {
  vi.resetModules();

  vi.doMock('@/composables/useStickers', () => {
    const stickersRef = ref<Record<number, any>>({});
    return {
      useStickers: () => ({
        stickers: readonly(stickersRef),
        stats: computed(() => {
          let owned = 0;
          let dupes = 0;
          let withNotes = 0;
          for (const key in stickersRef.value) {
            const s = stickersRef.value[key];
            if (s.owned) owned++;
            if (s.owned && s.dupes > 0) dupes += s.dupes;
            if (s.note) withNotes++;
          }
          return { owned, missing: 980 - owned, dupes, withNotes, pct: 0 };
        }),
        _setStickers: (map: Record<number, any>) => {
          stickersRef.value = map;
        },
      }),
    };
  });

  const mod = await import('@/components/MissingView.vue');
  MissingView = mod.default;
});

describe('MissingView', () => {
  it('shows missing count in header', () => {
    const w = mount(MissingView);
    expect(w.find('.list-head-text h2').text()).toContain('TE FALTAN 980');
  });

  it('shows complete state when nothing missing', async () => {
    // Own all 980 stickers
    const { useStickers } = await import('@/composables/useStickers');
    const s = useStickers() as any;
    const all = createStickersState(Array.from({ length: 980 }, (_, i) => i + 1));
    s._setStickers(all);

    const w = mount(MissingView);
    await w.vm.$nextTick();

    expect(w.find('.empty-title').text()).toContain('ÁLBUM COMPLETO');
  });

  it('shows sections with missing stickers', () => {
    const w = mount(MissingView);
    // With 0 stickers owned, all 49 sections should show
    const groups = w.findAll('.list-group');
    expect(groups.length).toBe(49);
  });

  it('shows copy button when stickers are missing', () => {
    const w = mount(MissingView);
    expect(w.find('.copy-btn').exists()).toBe(true);
  });

  it('toggles section collapse on click', async () => {
    const w = mount(MissingView);

    const firstGroup = w.find('.list-group');
    const firstHead = firstGroup.find('.list-group-head');
    // Initially expanded — chevron should be ▾
    expect(firstHead.find('.list-group-chevron').text()).toBe('▾');
    expect(firstGroup.find('.list-numbers').exists()).toBe(true);

    await firstHead.trigger('click');
    // Now collapsed — chevron should be ▸ and numbers hidden
    expect(firstHead.find('.list-group-chevron').text()).toBe('▸');
    expect(firstGroup.find('.list-numbers').exists()).toBe(false);
  });

  it('emits jumpToSection when clicking a sticker code', async () => {
    const w = mount(MissingView);
    const firstNum = w.find('.list-num');
    await firstNum.trigger('click');
    expect(w.emitted('jumpToSection')).toBeTruthy();
  });

  it('shows almost badge for sections ≥90% owned', async () => {
    // Own 18 of 20 stickers in first section (FWC: stickers 1-20)
    const { useStickers } = await import('@/composables/useStickers');
    const s = useStickers() as any;
    const owned = createStickersState(Array.from({ length: 18 }, (_, i) => i + 1));
    s._setStickers(owned);

    const w = mount(MissingView);
    await w.vm.$nextTick();

    expect(w.find('.almost-badge').exists()).toBe(true);
    expect(w.find('.almost-badge').text()).toContain('¡Casi!');
  });
});
