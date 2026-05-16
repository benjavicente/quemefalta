import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UpdateBanner from '@/pwa/UpdateBanner.vue';
import { updateAvailable } from '@/pwa/update';

vi.mock('@/pwa/update', async () => {
  const { ref } = await import('vue');

  return {
    updateAvailable: ref(false),
    applyUpdate: vi.fn(),
  };
});

describe('UpdateBanner', () => {
  beforeEach(() => {
    updateAvailable.value = false;
  });

  it('is hidden when no update is available', () => {
    const wrapper = mount(UpdateBanner);

    expect(wrapper.find('.update-banner').exists()).toBe(false);
  });

  it('renders update actions when an update is available', () => {
    updateAvailable.value = true;
    const wrapper = mount(UpdateBanner);

    expect(wrapper.text()).toContain('Update available');
    expect(wrapper.text()).toContain('Not now');
    expect(wrapper.text()).toContain('Update');
  });

  it('dismisses only the banner when Not now is clicked', async () => {
    updateAvailable.value = true;
    const wrapper = mount(UpdateBanner);
    const buttons = wrapper.findAll('button');

    await buttons[0].trigger('click');

    expect(wrapper.find('.update-banner').exists()).toBe(false);
    expect(updateAvailable.value).toBe(true);
  });

  it('wires the primary update action', async () => {
    const update = await import('@/pwa/update');
    updateAvailable.value = true;
    const wrapper = mount(UpdateBanner);
    const buttons = wrapper.findAll('button');

    await buttons[1].trigger('click');

    expect(update.applyUpdate).toHaveBeenCalled();
  });
});
