import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ShareModal from '@/components/ShareModal.vue';
import { createProfile } from '../mocks/factories';

const mockShare = vi.fn().mockResolvedValue('shared');
const mockCopyOnly = vi.fn().mockResolvedValue(true);

vi.mock('@/composables/useShare', () => ({
  useShare: () => ({
    share: mockShare,
    copyOnly: mockCopyOnly,
    whatsappLink: (text: string, url: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    linkedinLink: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    emailLink: (subject: string, body: string) =>
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    isNativeShareAvailable: false,
    lastResult: { value: null },
    errorMessage: { value: '' },
  }),
}));

const profile = createProfile({ username: 'testuser' });

function mountModal() {
  return mount(ShareModal, {
    props: { profile, pct: 42 },
  });
}

beforeEach(() => {
  mockShare.mockClear();
  mockCopyOnly.mockClear();
});

describe('ShareModal', () => {
  describe('rendering', () => {
    it('renders profile URL without protocol', () => {
      const w = mountModal();
      const urlText = w.find('.url-text');
      expect(urlText.text()).not.toContain('https://');
      expect(urlText.text()).toContain('/u/testuser');
    });

    it('renders WhatsApp, LinkedIn, and Email social links', () => {
      const w = mountModal();
      const socialBtns = w.findAll('.social-btn');
      expect(socialBtns).toHaveLength(3);
      expect(socialBtns[0].text()).toContain('WhatsApp');
      expect(socialBtns[1].text()).toContain('LinkedIn');
      expect(socialBtns[2].text()).toContain('Email');
    });

    it('WhatsApp link has correct href', () => {
      const w = mountModal();
      const whatsappLink = w.findAll('.social-btn')[0];
      expect(whatsappLink.attributes('href')).toContain('wa.me');
    });

    it('LinkedIn link has correct href', () => {
      const w = mountModal();
      const linkedinLink = w.findAll('.social-btn')[1];
      expect(linkedinLink.attributes('href')).toContain('linkedin.com');
    });
  });

  describe('copy button', () => {
    it('calls copyOnly on click', async () => {
      const w = mountModal();
      const copyBtn = w.find('.url-copy');

      expect(copyBtn.text()).toBe('Copiar');
      await copyBtn.trigger('click');
      await flushPromises();

      expect(mockCopyOnly).toHaveBeenCalled();
    });

    it('passes the correct URL to copyOnly', async () => {
      const w = mountModal();

      await w.find('.url-copy').trigger('click');
      await flushPromises();

      expect(mockCopyOnly).toHaveBeenCalledWith(expect.stringContaining('/u/testuser'));
    });
  });

  describe('share button', () => {
    it('calls copyOnly as fallback when native share unavailable', async () => {
      const w = mountModal();
      await w.find('.share-main').trigger('click');

      // isNativeShareAvailable is false, so it should call handleCopy
      expect(mockCopyOnly).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('clicking background emits close', async () => {
      const w = mountModal();
      await w.find('.modal-bg').trigger('click');
      expect(w.emitted('close')).toHaveLength(1);
    });

    it('close button emits close', async () => {
      const w = mountModal();
      await w.find('.close-btn').trigger('click');
      expect(w.emitted('close')).toHaveLength(1);
    });
  });

  describe('preview button', () => {
    it('opens public profile in new tab', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const w = mountModal();

      await w.find('.preview-btn').trigger('click');

      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('/u/testuser'), '_blank');

      openSpy.mockRestore();
    });
  });
});
