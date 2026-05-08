import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StickerDetailModal from '@/components/StickerDetailModal.vue';
import type { StickerState } from '@/composables/useStickers';

function mountModal(state: Partial<StickerState> = { owned: true }) {
  return mount(StickerDetailModal, {
    props: {
      stickerNumber: 42,
      code: 'MEX2',
      sectionName: 'México',
      state: { owned: true, dupes: 0, note: '', ...state },
    },
  });
}

describe('StickerDetailModal', () => {
  describe('rendering', () => {
    it('renders sticker code and section name', () => {
      const w = mountModal();
      expect(w.text()).toContain('MEX2');
      expect(w.text()).toContain('México');
    });

    it('shows stepper when owned', () => {
      const w = mountModal({ owned: true });
      expect(w.find('.step-row').exists()).toBe(true);
    });

    it('hides stepper when not owned', () => {
      const w = mountModal({ owned: false });
      expect(w.find('.step-row').exists()).toBe(false);
    });

    it('shows correct total count (dupes + 1)', () => {
      const w = mountModal({ owned: true, dupes: 2 });
      expect(w.find('.step-num').text()).toBe('3');
    });

    it('disables decrement button when dupes is 0', () => {
      const w = mountModal({ owned: true, dupes: 0 });
      const btns = w.findAll('.step-btn');
      const decrementBtn = btns[0];
      expect(decrementBtn.attributes('disabled')).toBeDefined();
    });
  });

  describe('quick chips', () => {
    it('marks active chip based on current dupes', () => {
      const w = mountModal({ owned: true, dupes: 0 });
      const chips = w.findAll('.quick-chip');
      // ×1 chip should be active when dupes=0 (total=1)
      expect(chips[0].classes()).toContain('on');
      expect(chips[1].classes()).not.toContain('on');
    });

    it('clicking chip sets dupes value', async () => {
      const w = mountModal({ owned: true, dupes: 0 });
      const chips = w.findAll('.quick-chip');

      // Click ×2 chip (index 1, sets dupes to 1)
      await chips[1].trigger('click');

      // Now the ×2 chip should be active
      expect(chips[1].classes()).toContain('on');
    });
  });

  describe('stepper', () => {
    it('clicking + increments displayed count', async () => {
      const w = mountModal({ owned: true, dupes: 0 });
      const btns = w.findAll('.step-btn');
      const incrementBtn = btns[1];

      await incrementBtn.trigger('click');
      expect(w.find('.step-num').text()).toBe('2');
    });

    it('clicking - decrements displayed count', async () => {
      const w = mountModal({ owned: true, dupes: 2 });
      const btns = w.findAll('.step-btn');
      const decrementBtn = btns[0];

      await decrementBtn.trigger('click');
      expect(w.find('.step-num').text()).toBe('2'); // was 3, now 2
    });
  });

  describe('note editor', () => {
    it('shows "Agregar nota" button when no note', () => {
      const w = mountModal({ owned: true, note: '' });
      expect(w.text()).toContain('Agregar nota');
    });

    it('shows note text when note exists', () => {
      const w = mountModal({ owned: true, note: 'for pedro' });
      expect(w.text()).toContain('for pedro');
    });

    it('clicking note row reveals editor', async () => {
      const w = mountModal({ owned: true, note: '' });
      await w.find('.note-row').trigger('click');
      expect(w.find('.note-textarea').exists()).toBe(true);
    });

    it('clicking suggestion chip sets note text', async () => {
      const w = mountModal({ owned: true, note: '' });
      await w.find('.note-row').trigger('click');

      const chips = w.findAll('.note-chip');
      await chips[0].trigger('click');

      const textarea = w.find('.note-textarea');
      expect((textarea.element as HTMLTextAreaElement).value).toBe('Para Pedro');
    });
  });

  describe('unowned state', () => {
    it('shows "Marcar como tenida" button when not owned', () => {
      const w = mountModal({ owned: false });
      expect(w.text()).toContain('No tienes esta lámina');
      expect(w.text()).toContain('Marcar como tenida');
    });

    it('emits mark when mark button is clicked', async () => {
      const w = mountModal({ owned: false });
      await w.find('.btn-mark').trigger('click');

      expect(w.emitted('mark')).toHaveLength(1);
    });

    it('hides mark button when owned', () => {
      const w = mountModal({ owned: true });
      expect(w.find('.btn-mark').exists()).toBe(false);
    });
  });

  describe('actions', () => {
    it('save emits update with current dupes and note', async () => {
      const w = mountModal({ owned: true, dupes: 1, note: 'test' });
      await w.find('.btn-save').trigger('click');

      expect(w.emitted('update')).toHaveLength(1);
      expect(w.emitted('update')![0]).toEqual([{ dupes: 1, note: 'test' }]);
    });

    it('remove emits remove', async () => {
      const w = mountModal({ owned: true });
      await w.find('.btn-remove').trigger('click');

      expect(w.emitted('remove')).toHaveLength(1);
    });

    it('close button emits close', async () => {
      const w = mountModal();
      await w.find('.pop-close').trigger('click');

      expect(w.emitted('close')).toHaveLength(1);
    });

    it('clicking background emits close', async () => {
      const w = mountModal();
      await w.find('.pop-bg').trigger('click');

      expect(w.emitted('close')).toHaveLength(1);
    });

    it('hides save/remove buttons when not owned', () => {
      const w = mountModal({ owned: false });
      expect(w.find('.btn-save').exists()).toBe(false);
      expect(w.find('.btn-remove').exists()).toBe(false);
    });
  });

  describe('navigation buttons', () => {
    it('renders prev button when hasPrev is true', () => {
      const w = mount(StickerDetailModal, {
        props: {
          stickerNumber: 42,
          code: 'MEX2',
          sectionName: 'México',
          state: { owned: true, dupes: 0, note: '' },
          hasPrev: true,
        },
      });
      expect(w.find('.pop-prev').exists()).toBe(true);
    });

    it('does not render prev button when hasPrev is false', () => {
      const w = mountModal();
      expect(w.find('.pop-prev').exists()).toBe(false);
    });

    it('renders next button when hasNext is true', () => {
      const w = mount(StickerDetailModal, {
        props: {
          stickerNumber: 42,
          code: 'MEX2',
          sectionName: 'México',
          state: { owned: true, dupes: 0, note: '' },
          hasNext: true,
        },
      });
      expect(w.find('.pop-next').exists()).toBe(true);
    });

    it('does not render next button when hasNext is false', () => {
      const w = mountModal();
      expect(w.find('.pop-next').exists()).toBe(false);
    });

    it('emits prev when prev button is clicked', async () => {
      const w = mount(StickerDetailModal, {
        props: {
          stickerNumber: 42,
          code: 'MEX2',
          sectionName: 'México',
          state: { owned: true, dupes: 0, note: '' },
          hasPrev: true,
        },
      });
      await w.find('.pop-prev').trigger('click');

      expect(w.emitted('prev')).toHaveLength(1);
    });

    it('emits next when next button is clicked', async () => {
      const w = mount(StickerDetailModal, {
        props: {
          stickerNumber: 42,
          code: 'MEX2',
          sectionName: 'México',
          state: { owned: true, dupes: 0, note: '' },
          hasNext: true,
        },
      });
      await w.find('.pop-next').trigger('click');

      expect(w.emitted('next')).toHaveLength(1);
    });
  });
});
