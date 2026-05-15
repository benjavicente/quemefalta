import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

// Mock useStickers para controlar el state local visible al componente.
const stickersRef = ref<Record<number, { owned: boolean; dupes: number; note: string }>>({});

vi.mock('@/composables/useStickers', () => ({
  useStickers: () => ({
    stickers: stickersRef,
  }),
}));

let BatchRemoveInput: typeof import('@/components/BatchRemoveInput.vue').default;

beforeEach(async () => {
  stickersRef.value = {};
  vi.resetModules();
  ({ default: BatchRemoveInput } = await import('@/components/BatchRemoveInput.vue'));
});

function mountRemove() {
  return mount(BatchRemoveInput);
}

describe('BatchRemoveInput', () => {
  describe('rendering', () => {
    it('renders title and hint', () => {
      const w = mountRemove();
      expect(w.text()).toContain('Egreso rápido');
      expect(w.text()).toContain('QUITAR LÁMINAS');
    });

    it('hides preview card when empty', () => {
      const w = mountRemove();
      expect(w.find('.bi-preview-card').exists()).toBe(false);
    });

    it('disables Quitar button when input is empty', () => {
      const w = mountRemove();
      expect(w.find('.bi-btn').attributes('disabled')).toBeDefined();
    });

    it('renders quick team chips', () => {
      const w = mountRemove();
      const chips = w.findAll('.bi-team-chip');
      expect(chips.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('preview breakdown', () => {
    it('shows "ignoradas" when input contains stickers the user does not own', async () => {
      // No marca nada → todas las apariciones van a skipped
      const w = mountRemove();
      await w.find('.bi-input').setValue('MEX5');
      expect(w.find('.bi-preview-card').text()).toContain('1');
      expect(w.find('.bi-preview-card').text()).toContain('ignorada');
    });

    it('shows "desmarcada" when removing the only copy of an owned sticker', async () => {
      // MEX5 = sticker 25 (startsAt 21 + 5 - 1)
      stickersRef.value = { 25: { owned: true, dupes: 0, note: '' } };
      const w = mountRemove();
      await w.find('.bi-input').setValue('MEX5');
      const text = w.find('.bi-preview-card').text();
      expect(text).toContain('−1');
      expect(text).toContain('desmarcada');
      expect(text).toContain('MEX5');
    });

    it('shows "repetida menos" when removing a dupe from a sticker with copies left', async () => {
      stickersRef.value = { 25: { owned: true, dupes: 2, note: '' } };
      const w = mountRemove();
      await w.find('.bi-input').setValue('MEX5');
      const text = w.find('.bi-preview-card').text();
      expect(text).toContain('−1');
      expect(text).toContain('repetida');
      expect(text).not.toContain('desmarcada');
    });

    it('partial-removes when input exceeds owned copies and lists the rest as ignoradas', async () => {
      // Tenés 1 copia (owned, 0 dupes). Input pide quitar 3.
      stickersRef.value = { 25: { owned: true, dupes: 0, note: '' } };
      const w = mountRemove();
      await w.find('.bi-input').setValue('MEX5, MEX5, MEX5');
      const text = w.find('.bi-preview-card').text();
      expect(text).toContain('desmarcada');
      expect(text).toContain('ignorada');
    });
  });

  describe('interactions', () => {
    it('emits remove with parsed numbers when Quitar is pressed', async () => {
      stickersRef.value = { 25: { owned: true, dupes: 0, note: '' } };
      const w = mountRemove();
      await w.find('.bi-input').setValue('MEX5');
      await w.find('.bi-btn').trigger('click');
      expect(w.emitted('remove')).toHaveLength(1);
      expect(w.emitted('remove')![0][0]).toEqual([25]);
    });

    it('clears the textarea after emitting remove', async () => {
      stickersRef.value = { 25: { owned: true, dupes: 1, note: '' } };
      const w = mountRemove();
      await w.find('.bi-input').setValue('MEX5');
      await w.find('.bi-btn').trigger('click');
      expect((w.find('.bi-input').element as HTMLTextAreaElement).value).toBe('');
    });

    it('clicking team chip appends code to input', async () => {
      const w = mountRemove();
      const chips = w.findAll('.bi-team-chip');
      await chips[1].trigger('click'); // MEX
      expect((w.find('.bi-input').element as HTMLTextAreaElement).value).toBe('MEX');
    });

    it('does NOT close on background click (prevents accidental dismissal)', async () => {
      const w = mountRemove();
      await w.find('.bi-bg').trigger('click');
      expect(w.emitted('close')).toBeUndefined();
    });

    it('emits close when X is pressed', async () => {
      const w = mountRemove();
      await w.find('.bi-close').trigger('click');
      expect(w.emitted('close')).toHaveLength(1);
    });
  });
});
