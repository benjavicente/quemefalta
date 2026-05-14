/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, readonly, computed } from 'vue';

let DupesView: any;

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
          for (const key in stickersRef.value) {
            const s = stickersRef.value[key];
            if (s.owned) owned++;
            if (s.owned && s.dupes > 0) dupes += s.dupes;
          }
          return { owned, missing: 980 - owned, dupes, withNotes: 0, pct: 0 };
        }),
        _setStickers: (map: Record<number, any>) => {
          stickersRef.value = map;
        },
      }),
    };
  });

  const mod = await import('@/components/DupesView.vue');
  DupesView = mod.default;
});

describe('DupesView', () => {
  it('shows empty state when no dupes', () => {
    const w = mount(DupesView);
    expect(w.find('.empty-title').text()).toContain('NO TIENES REPETIDAS');
  });

  it('shows dupes list when stickers have dupes', async () => {
    const { useStickers } = await import('@/composables/useStickers');
    const s = useStickers() as any;
    s._setStickers({
      5: { owned: true, dupes: 2, note: '' },
      10: { owned: true, dupes: 1, note: 'para pedro' },
    });

    const w = mount(DupesView);
    await w.vm.$nextTick();

    expect(w.find('.dupes-list').exists()).toBe(true);
    const items = w.findAll('.dupe-item');
    expect(items.length).toBe(2);
  });

  it('shows correct count (dupes + 1)', async () => {
    const { useStickers } = await import('@/composables/useStickers');
    const s = useStickers() as any;
    s._setStickers({
      5: { owned: true, dupes: 2, note: '' },
    });

    const w = mount(DupesView);
    await w.vm.$nextTick();

    // dupes=2 means ×3 total (1 base + 2 extra)
    expect(w.find('.dupe-count').text()).toBe('×3');
  });

  it('shows note with pencil icon when present', async () => {
    const { useStickers } = await import('@/composables/useStickers');
    const s = useStickers() as any;
    s._setStickers({
      5: { owned: true, dupes: 1, note: 'cambiar con juan' },
    });

    const w = mount(DupesView);
    await w.vm.$nextTick();

    expect(w.find('.dupe-note').text()).toContain('cambiar con juan');
  });

  it('emits openDetail when clicking a dupe item', async () => {
    const { useStickers } = await import('@/composables/useStickers');
    const s = useStickers() as any;
    s._setStickers({
      5: { owned: true, dupes: 1, note: '' },
    });

    const w = mount(DupesView);
    await w.vm.$nextTick();

    await w.find('.dupe-item').trigger('click');
    expect(w.emitted('openDetail')).toBeTruthy();
    expect(w.emitted('openDetail')![0]).toEqual([5]);
  });

  it('shows copy button when dupes exist', async () => {
    const { useStickers } = await import('@/composables/useStickers');
    const s = useStickers() as any;
    s._setStickers({
      5: { owned: true, dupes: 1, note: '' },
    });

    const w = mount(DupesView);
    await w.vm.$nextTick();

    expect(w.find('.copy-btn').exists()).toBe(true);
  });

  it('does not show copy button when no dupes', () => {
    const w = mount(DupesView);
    expect(w.find('.copy-btn').exists()).toBe(false);
  });

  it('shows header with dupes count', async () => {
    const { useStickers } = await import('@/composables/useStickers');
    const s = useStickers() as any;
    s._setStickers({
      5: { owned: true, dupes: 2, note: '' },
      10: { owned: true, dupes: 3, note: '' },
    });

    const w = mount(DupesView);
    await w.vm.$nextTick();

    expect(w.find('.list-head-text h2').text()).toContain('TIENES 5 REPETIDAS');
  });
});
