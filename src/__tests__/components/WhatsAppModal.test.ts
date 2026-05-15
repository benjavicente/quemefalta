import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';

const updateProfileMock = vi.fn();
const trackMock = vi.fn();
const profileRef = ref<{ phone: string | null } | null>(null);

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    profile: profileRef,
    updateProfile: updateProfileMock,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

let WhatsAppModal: typeof import('@/components/WhatsAppModal.vue').default;

beforeEach(async () => {
  profileRef.value = null;
  updateProfileMock.mockReset();
  updateProfileMock.mockResolvedValue(undefined);
  trackMock.mockReset();
  vi.resetModules();
  ({ default: WhatsAppModal } = await import('@/components/WhatsAppModal.vue'));
});

function mountModal() {
  return mount(WhatsAppModal);
}

describe('WhatsAppModal', () => {
  describe('rendering', () => {
    it('renders title and description', () => {
      const w = mountModal();
      expect(w.text()).toContain('MI WHATSAPP');
      expect(w.text()).toContain('autenticados');
    });

    it('renders empty input when profile has no phone', () => {
      const w = mountModal();
      expect((w.find('.wa-input').element as HTMLInputElement).value).toBe('');
    });

    it('prefills input with current phone from profile', async () => {
      profileRef.value = { phone: '+56912345678' };
      const w = mountModal();
      await flushPromises();
      expect((w.find('.wa-input').element as HTMLInputElement).value).toBe('+56912345678');
    });

    it('shows Quitar button when profile already has a phone', () => {
      profileRef.value = { phone: '+56912345678' };
      const w = mountModal();
      const buttons = w.findAll('.wa-btn');
      const labels = buttons.map((b) => b.text());
      expect(labels).toContain('Quitar');
    });

    it('hides Quitar button when no phone configured', () => {
      const w = mountModal();
      const labels = w.findAll('.wa-btn').map((b) => b.text());
      expect(labels).not.toContain('Quitar');
    });
  });

  describe('validation', () => {
    it('rejects too-short numbers', async () => {
      const w = mountModal();
      await w.find('.wa-input').setValue('1234');
      await w.findAll('.wa-btn').find((b) => b.text() === 'Guardar')!.trigger('click');
      expect(w.find('.wa-error').exists()).toBe(true);
      expect(updateProfileMock).not.toHaveBeenCalled();
    });

    it('rejects too-long numbers (>15 digits)', async () => {
      const w = mountModal();
      await w.find('.wa-input').setValue('1234567890123456');
      await w.findAll('.wa-btn').find((b) => b.text() === 'Guardar')!.trigger('click');
      expect(w.find('.wa-error').exists()).toBe(true);
      expect(updateProfileMock).not.toHaveBeenCalled();
    });

    it('accepts a valid number with spaces and +', async () => {
      const w = mountModal();
      await w.find('.wa-input').setValue('+56 9 1234 5678');
      await w.findAll('.wa-btn').find((b) => b.text() === 'Guardar')!.trigger('click');
      await flushPromises();
      expect(updateProfileMock).toHaveBeenCalledWith({ phone: '+56912345678' });
    });
  });

  describe('save', () => {
    it('calls updateProfile with normalized phone and emits saved/close', async () => {
      const w = mountModal();
      await w.find('.wa-input').setValue('+56 9 1234 5678');
      await w.findAll('.wa-btn').find((b) => b.text() === 'Guardar')!.trigger('click');
      await flushPromises();
      expect(updateProfileMock).toHaveBeenCalledWith({ phone: '+56912345678' });
      expect(trackMock).toHaveBeenCalledWith('save_phone', { cleared: false });
      expect(w.emitted('saved')).toHaveLength(1);
      expect(w.emitted('close')).toHaveLength(1);
    });

    it('saves null when input is empty (clears the number)', async () => {
      profileRef.value = { phone: '+56912345678' };
      const w = mountModal();
      await flushPromises();
      await w.find('.wa-input').setValue('');
      await w.findAll('.wa-btn').find((b) => b.text() === 'Guardar')!.trigger('click');
      await flushPromises();
      expect(updateProfileMock).toHaveBeenCalledWith({ phone: null });
      expect(trackMock).toHaveBeenCalledWith('save_phone', { cleared: true });
    });

    it('shows error and does not emit when updateProfile fails', async () => {
      updateProfileMock.mockRejectedValue(new Error('network'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const w = mountModal();
      await w.find('.wa-input').setValue('+56912345678');
      await w.findAll('.wa-btn').find((b) => b.text() === 'Guardar')!.trigger('click');
      await flushPromises();
      expect(w.find('.wa-error').exists()).toBe(true);
      expect(w.emitted('close')).toBeUndefined();
      errSpy.mockRestore();
    });
  });

  describe('remove', () => {
    it('calls updateProfile with phone=null when Quitar is pressed', async () => {
      profileRef.value = { phone: '+56912345678' };
      const w = mountModal();
      await flushPromises();
      const quitarBtn = w.findAll('.wa-btn').find((b) => b.text() === 'Quitar');
      await quitarBtn!.trigger('click');
      await flushPromises();
      expect(updateProfileMock).toHaveBeenCalledWith({ phone: null });
      expect(trackMock).toHaveBeenCalledWith('save_phone', { cleared: true });
      expect(w.emitted('saved')).toHaveLength(1);
      expect(w.emitted('close')).toHaveLength(1);
    });
  });

  describe('interactions', () => {
    it('emits close when Cancelar is pressed', async () => {
      const w = mountModal();
      const cancelBtn = w.findAll('.wa-btn').find((b) => b.text() === 'Cancelar');
      await cancelBtn!.trigger('click');
      expect(w.emitted('close')).toHaveLength(1);
    });

    it('emits close when background is clicked', async () => {
      const w = mountModal();
      await w.find('.modal-bg').trigger('click');
      expect(w.emitted('close')).toHaveLength(1);
    });
  });
});
