import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BatchInput from '@/components/BatchInput.vue';

function mountBatch() {
  return mount(BatchInput);
}

describe('BatchInput', () => {
  describe('rendering', () => {
    it('renders title and hint', () => {
      const w = mountBatch();
      expect(w.text()).toContain('Ingreso rápido');
      expect(w.text()).toContain('AGREGAR LÁMINAS');
    });

    it('renders quick team chips', () => {
      const w = mountBatch();
      const chips = w.findAll('.bi-team-chip');
      expect(chips.length).toBeGreaterThanOrEqual(8);
      expect(chips[0].text()).toBe('FWC');
      expect(chips[1].text()).toBe('MEX');
    });

    it('renders textarea for input', () => {
      const w = mountBatch();
      expect(w.find('.bi-input').exists()).toBe(true);
    });

    it('shows 0 láminas preview when empty', () => {
      const w = mountBatch();
      expect(w.find('.bi-preview').text()).toContain('0 láminas');
    });

    it('disables add button when input is empty', () => {
      const w = mountBatch();
      expect(w.find('.bi-btn').attributes('disabled')).toBeDefined();
    });
  });

  describe('parsing', () => {
    it('parses single sticker code', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX5');
      expect(w.find('.bi-preview').text()).toContain('1 láminas');
    });

    it('parses multiple codes comma-separated', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX5, ARG1, BRA3');
      expect(w.find('.bi-preview').text()).toContain('3 láminas');
    });

    it('parses team code to expand all stickers', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX');
      expect(w.find('.bi-preview').text()).toContain('20 láminas');
    });

    it('parses prefix + numbers format', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX 1 5 8');
      expect(w.find('.bi-preview').text()).toContain('3 láminas');
    });

    it('parses code range', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX1-MEX5');
      expect(w.find('.bi-preview').text()).toContain('5 láminas');
    });

    it('shows dupes when codes are repeated', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX5, MEX5');
      expect(w.find('.bi-preview').text()).toContain('1 láminas');
      expect(w.find('.bi-preview').text()).toContain('1 rep.');
    });

    it('enables add button when valid input present', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX5');
      expect(w.find('.bi-btn').attributes('disabled')).toBeUndefined();
    });
  });

  describe('interactions', () => {
    it('clicking team chip appends code to input', async () => {
      const w = mountBatch();
      await w.findAll('.bi-team-chip')[1].trigger('click'); // MEX
      expect((w.find('.bi-input').element as HTMLTextAreaElement).value).toBe('MEX');
    });

    it('clicking team chip appends with comma to existing input', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('ARG1');
      await w.findAll('.bi-team-chip')[1].trigger('click'); // MEX
      expect((w.find('.bi-input').element as HTMLTextAreaElement).value).toBe('ARG1, MEX');
    });

    it('emits add with parsed numbers on click', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX5');
      await w.find('.bi-btn').trigger('click');
      expect(w.emitted('add')).toHaveLength(1);
      const nums = w.emitted('add')![0][0] as number[];
      expect(nums).toHaveLength(1);
      expect(nums[0]).toBe(25); // MEX5 = startsAt(21) + 5 - 1 = 25
    });

    it('does not emit add when input has no valid stickers', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('ZZZZZ');
      // Button should be disabled since parseSummary returns 0
      expect(w.find('.bi-btn').attributes('disabled')).toBeDefined();
      expect(w.emitted('add')).toBeUndefined();
    });

    it('emits close when background clicked', async () => {
      const w = mountBatch();
      await w.find('.bi-bg').trigger('click');
      expect(w.emitted('close')).toHaveLength(1);
    });

    it('emits close when X clicked', async () => {
      const w = mountBatch();
      await w.find('.bi-close').trigger('click');
      expect(w.emitted('close')).toHaveLength(1);
    });

    it('clears input after successful add', async () => {
      const w = mountBatch();
      await w.find('.bi-input').setValue('MEX5');
      await w.find('.bi-btn').trigger('click');
      expect((w.find('.bi-input').element as HTMLTextAreaElement).value).toBe('');
    });
  });
});
