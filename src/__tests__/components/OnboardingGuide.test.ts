import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import OnboardingGuide from '@/components/OnboardingGuide.vue';

// Mock elements that the onboarding targets
function createMockElements() {
  const selectors: Record<string, HTMLElement> = {};

  function makeEl(selector: string, tag = 'div') {
    const el = document.createElement(tag);
    el.className = selector.replace(/^\./, '').replace(/[:\[\]='"()]/g, '-');
    // Give it dimensions so getBoundingClientRect works
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ top: 100, left: 50, bottom: 140, right: 350, width: 300, height: 40 }),
    });
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
    selectors[selector] = el;
    return el;
  }

  // Create all elements the onboarding needs
  makeEl('.acc-group-head', 'button');
  makeEl('.acc-teams');
  const team = makeEl('.acc-team', 'button');
  // Put team inside acc-teams
  const teamsContainer = document.querySelector('.acc-teams')!;
  teamsContainer.appendChild(team.cloneNode());

  makeEl('.acc-content');
  const stkWrap = document.createElement('div');
  stkWrap.setAttribute('data-stk', '1');
  const stk = document.createElement('div');
  stk.className = 'stk';
  stkWrap.appendChild(stk);
  document.body.appendChild(stkWrap);

  makeEl('.sect-grid');
  makeEl('.complete-btn', 'button');
  makeEl('.tab-add', 'button');

  // Tabs
  const tab1 = document.createElement('button');
  tab1.className = 'tab';
  tab1.click = vi.fn();
  const tab2 = document.createElement('button');
  tab2.className = 'tab';
  tab2.click = vi.fn();
  const tab3 = document.createElement('button');
  tab3.className = 'tab';
  tab3.click = vi.fn();
  const tabsNav = document.createElement('nav');
  tabsNav.appendChild(tab1);
  tabsNav.appendChild(tab2);
  tabsNav.appendChild(tab3);
  document.body.appendChild(tabsNav);

  const copyBtn = makeEl('.copy-btn', 'button');
  const shareBtn = document.createElement('button');
  shareBtn.className = 'hdr-icon-btn';
  shareBtn.title = 'Compartir mi perfil';
  Object.defineProperty(shareBtn, 'getBoundingClientRect', {
    value: () => ({ top: 10, left: 300, bottom: 50, right: 340, width: 40, height: 40 }),
  });
  shareBtn.scrollIntoView = vi.fn();
  document.body.appendChild(shareBtn);

  return { tab1, tab2, tab3, copyBtn, shareBtn };
}

let mockEls: ReturnType<typeof createMockElements>;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  localStorage.clear();
  mockEls = createMockElements();
});

afterEach(() => {
  vi.useRealTimers();
});

function mountGuide() {
  return mount(OnboardingGuide, {
    global: {
      stubs: { Teleport: true },
    },
  });
}

async function waitForVisible(w: ReturnType<typeof mount>) {
  // Initial 500ms delay + 300ms scroll settle
  vi.advanceTimersByTime(500);
  await flushPromises();
  vi.advanceTimersByTime(300);
  await flushPromises();
}

async function advance(w: ReturnType<typeof mount>) {
  await w.find('.onb-next').trigger('click');
  await flushPromises();
  vi.advanceTimersByTime(300);
  await flushPromises();
}

describe('OnboardingGuide', () => {
  describe('rendering', () => {
    it('shows after initial delay', async () => {
      const w = mountGuide();
      expect(w.find('.onb-overlay').exists()).toBe(false);
      await waitForVisible(w);
      expect(w.find('.onb-overlay').exists()).toBe(true);
    });

    it('shows step 1/11 indicator', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      expect(w.find('.onb-step-indicator').text()).toContain('1/');
    });

    it('shows first step text about groups', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      expect(w.find('.onb-text').text()).toContain('grupo');
    });

    it('shows skip and next buttons', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      expect(w.find('.onb-skip').text()).toBe('Omitir');
      expect(w.find('.onb-next').text()).toBe('Siguiente');
    });

    it('shows tap hint', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      expect(w.find('.onb-tap-hint').text()).toContain('Toca fuera');
    });
  });

  describe('navigation', () => {
    it('advances to next step on click', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      expect(w.find('.onb-step-indicator').text()).toContain('1/');
      await advance(w);
      expect(w.find('.onb-step-indicator').text()).toContain('2/');
    });

    it('advances when clicking overlay background', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      await w.find('.onb-overlay').trigger('click');
      await flushPromises();
      vi.advanceTimersByTime(300);
      await flushPromises();
      expect(w.find('.onb-step-indicator').text()).toContain('2/');
    });

    it('emits done on skip', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      await w.find('.onb-skip').trigger('click');
      expect(w.emitted('done')).toHaveLength(1);
    });

    it('saves to localStorage on skip', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      await w.find('.onb-skip').trigger('click');
      expect(localStorage.getItem('quemefalta_onboarding_done')).toBe('1');
    });

    it('shows "Listo" on last step', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      // Advance through all steps
      const totalSteps = parseInt(w.find('.onb-step-indicator').text().split('/')[1]);
      for (let i = 0; i < totalSteps - 1; i++) {
        await advance(w);
      }
      expect(w.find('.onb-next').text()).toBe('Listo');
    });

    it('emits done after last step', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      const totalSteps = parseInt(w.find('.onb-step-indicator').text().split('/')[1]);
      for (let i = 0; i < totalSteps; i++) {
        await advance(w);
      }
      expect(w.emitted('done')).toHaveLength(1);
    });
  });

  describe('tab switching', () => {
    it('clicks "Faltan" tab on step 7', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      // Steps 1-6
      for (let i = 0; i < 6; i++) {
        await advance(w);
      }
      // Step 7 should have clicked tab 2 (Faltan)
      expect(mockEls.tab2.click).toHaveBeenCalled();
    });

    it('clicks "Repetidas" tab on step 9', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      // Steps 1-8
      for (let i = 0; i < 8; i++) {
        await advance(w);
      }
      // Step 9 should have clicked tab 3 (Repetidas)
      expect(mockEls.tab3.click).toHaveBeenCalled();
    });

    it('clicks "Album" tab on last step (share)', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      // Steps 1-9
      for (let i = 0; i < 9; i++) {
        await advance(w);
      }
      // Step 10 should have clicked tab 1 (Album)
      expect(mockEls.tab1.click).toHaveBeenCalled();
    });
  });

  describe('spotlight', () => {
    it('renders spotlight element', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      expect(w.find('.onb-spotlight').exists()).toBe(true);
    });

    it('calls scrollIntoView on target element', async () => {
      const w = mountGuide();
      await waitForVisible(w);
      const el = document.querySelector('.acc-group-head') as HTMLElement;
      expect(el.scrollIntoView).toHaveBeenCalled();
    });
  });
});
