import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, ref, nextTick } from 'vue';
import { useMeta } from '@/composables/useMeta';

beforeEach(() => {
  document.title = '';
  // Clean meta tags
  document
    .querySelectorAll('meta[name="description"], meta[property]')
    .forEach((el) => el.remove());
});

function createWrapper(metaOrRef: Parameters<typeof useMeta>[0]) {
  const Comp = defineComponent({
    setup() {
      useMeta(metaOrRef);
      return {};
    },
    template: '<div />',
  });
  return mount(Comp);
}

describe('useMeta', () => {
  it('sets document title from static object', async () => {
    createWrapper({ title: 'Test Title' });
    await flushPromises();
    expect(document.title).toBe('Test Title');
  });

  it('sets document title from ref', () => {
    const meta = ref({ title: 'Ref Title' });
    createWrapper(meta);
    expect(document.title).toBe('Ref Title');
  });

  it('updates title reactively when ref changes', async () => {
    const meta = ref({ title: 'Initial' });
    createWrapper(meta);
    expect(document.title).toBe('Initial');

    meta.value = { title: 'Updated' };
    await nextTick();
    expect(document.title).toBe('Updated');
  });

  it('sets OG meta tags', () => {
    const meta = ref({ ogTitle: 'OG Title', ogDescription: 'OG Desc' });
    createWrapper(meta);

    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
    expect(ogTitle?.content).toBe('OG Title');
    expect(ogDesc?.content).toBe('OG Desc');
  });

  it('sets twitter meta tags', () => {
    const meta = ref({ ogTitle: 'Twitter Title' });
    createWrapper(meta);

    const tw = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement;
    expect(tw?.content).toBe('Twitter Title');
  });

  it('uses defaults when no values provided', () => {
    const meta = ref({});
    createWrapper(meta);

    expect(document.title).toBe('QueMeFalta — Álbum del Mundial 2026');
  });

  it('restores defaults on unmount', async () => {
    const meta = ref({ title: 'Custom Title' });
    const w = createWrapper(meta);
    expect(document.title).toBe('Custom Title');

    w.unmount();
    expect(document.title).toBe('QueMeFalta — Álbum del Mundial 2026');
  });

  it('creates meta tags that do not exist yet', () => {
    const meta = ref({ description: 'New desc' });
    createWrapper(meta);

    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(desc?.content).toBe('New desc');
  });
});
