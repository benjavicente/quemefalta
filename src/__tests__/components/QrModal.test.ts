import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import QrModal from '@/components/QrModal.vue';
import QRCode from 'qrcode';

vi.mock('qrcode', () => {
  const toString = vi.fn();
  return {
    default: { toString },
    toString,
  };
});

beforeEach(() => {
  vi.mocked(QRCode.toString).mockResolvedValue('<svg data-testid="qr"><rect/></svg>' as never);
});

describe('QrModal', () => {
  it('renderiza username con @', async () => {
    const w = mount(QrModal, {
      props: { url: 'https://x/u/joseac', username: 'joseac' },
    });
    expect(w.find('.qr-username').text()).toBe('@joseac');
  });

  it('renderiza el SVG del QR tras montar', async () => {
    const w = mount(QrModal, {
      props: { url: 'https://x/u/joseac', username: 'joseac' },
    });
    await flushPromises();
    await w.vm.$nextTick();
    expect(w.html()).toContain('<svg');
  });

  it('muestra la url sin protocolo', async () => {
    const w = mount(QrModal, {
      props: { url: 'https://quemefalta.vercel.app/u/joseac', username: 'joseac' },
    });
    expect(w.find('.qr-url').text()).toBe('quemefalta.vercel.app/u/joseac');
  });

  it('emite close al clickear el botón ×', async () => {
    const w = mount(QrModal, {
      props: { url: 'https://x/u/a', username: 'a' },
    });
    await w.find('.qr-close').trigger('click');
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('emite close al clickear el botón Listo', async () => {
    const w = mount(QrModal, {
      props: { url: 'https://x/u/a', username: 'a' },
    });
    await w.find('.qr-cta').trigger('click');
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('emite close al clickear el backdrop', async () => {
    const w = mount(QrModal, {
      props: { url: 'https://x/u/a', username: 'a' },
    });
    await w.find('.qr-bg').trigger('click');
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('no emite close al clickear dentro de la card', async () => {
    const w = mount(QrModal, {
      props: { url: 'https://x/u/a', username: 'a' },
    });
    await w.find('.qr-card').trigger('click');
    expect(w.emitted('close')).toBeUndefined();
  });

  it('regenera el QR si cambia la url', async () => {
    const w = mount(QrModal, {
      props: { url: 'https://x/u/a', username: 'a' },
    });
    await flushPromises();
    expect(QRCode.toString).toHaveBeenCalledWith(
      'https://x/u/a',
      expect.objectContaining({ type: 'svg' }),
    );

    await w.setProps({ url: 'https://x/u/b', username: 'b' });
    await flushPromises();
    expect(QRCode.toString).toHaveBeenCalledWith(
      'https://x/u/b',
      expect.objectContaining({ type: 'svg' }),
    );
  });
});
