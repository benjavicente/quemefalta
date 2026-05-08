import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

function mountDialog(props: Partial<{
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
}> = {}) {
  return mount(ConfirmDialog, {
    props: {
      title: 'Confirmar acción',
      message: '¿Estás seguro?',
      ...props,
    },
  });
}

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    const w = mountDialog();
    expect(w.find('.cd-title').text()).toBe('Confirmar acción');
    expect(w.find('.cd-msg').text()).toBe('¿Estás seguro?');
  });

  it('shows default button text', () => {
    const w = mountDialog();
    expect(w.find('.cd-cancel').text()).toBe('Cancelar');
    expect(w.find('.cd-confirm').text()).toBe('Confirmar');
  });

  it('shows custom button text', () => {
    const w = mountDialog({ confirmText: 'Sí, borrar', cancelText: 'No' });
    expect(w.find('.cd-cancel').text()).toBe('No');
    expect(w.findAll('.cd-btn')[1].text()).toBe('Sí, borrar');
  });

  it('uses cd-danger class when danger prop is true', () => {
    const w = mountDialog({ danger: true });
    expect(w.find('.cd-danger').exists()).toBe(true);
    expect(w.find('.cd-confirm').exists()).toBe(false);
  });

  it('uses cd-confirm class when danger is false', () => {
    const w = mountDialog({ danger: false });
    expect(w.find('.cd-confirm').exists()).toBe(true);
    expect(w.find('.cd-danger').exists()).toBe(false);
  });

  it('emits confirm when confirm button clicked', async () => {
    const w = mountDialog();
    await w.find('.cd-confirm').trigger('click');
    expect(w.emitted('confirm')).toHaveLength(1);
  });

  it('emits cancel when cancel button clicked', async () => {
    const w = mountDialog();
    await w.find('.cd-cancel').trigger('click');
    expect(w.emitted('cancel')).toHaveLength(1);
  });

  it('emits cancel when background clicked', async () => {
    const w = mountDialog();
    await w.find('.cd-bg').trigger('click');
    expect(w.emitted('cancel')).toHaveLength(1);
  });

  it('does not emit cancel when dialog body clicked', async () => {
    const w = mountDialog();
    await w.find('.cd').trigger('click');
    expect(w.emitted('cancel')).toBeUndefined();
  });
});
