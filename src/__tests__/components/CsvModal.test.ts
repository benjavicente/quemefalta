import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, readonly } from 'vue';

let CsvModal: any;
const mockImportBulk = vi.fn().mockResolvedValue(10);

beforeEach(async () => {
  vi.resetModules();

  vi.doMock('@/composables/useStickers', () => {
    const stickersRef = ref<Record<number, any>>({
      1: { owned: true, dupes: 0, note: '' },
      5: { owned: true, dupes: 2, note: 'test' },
    });
    return {
      useStickers: () => ({
        stickers: readonly(stickersRef),
        importBulk: mockImportBulk,
      }),
    };
  });

  const mod = await import('@/components/CsvModal.vue');
  CsvModal = mod.default;
  mockImportBulk.mockClear();
});

describe('CsvModal', () => {
  it('renders menu view with export and import options', () => {
    const w = mount(CsvModal);
    expect(w.find('.modal').exists()).toBe(true);
    // Text is uppercase in the UI
    expect(w.text().toLowerCase()).toContain('exportar');
    expect(w.text().toLowerCase()).toContain('importar');
  });

  it('emits close when clicking backdrop', async () => {
    const w = mount(CsvModal);
    await w.find('.modal-bg').trigger('click');
    expect(w.emitted('close')).toBeTruthy();
  });

  it('has a file input for CSV import', () => {
    const w = mount(CsvModal);
    const fileInput = w.find('input[type="file"]');
    expect(fileInput.exists()).toBe(true);
    expect(fileInput.attributes('accept')).toContain('.csv');
  });
});
