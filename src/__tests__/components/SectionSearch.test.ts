import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SectionSearch from '@/components/SectionSearch.vue';

describe('SectionSearch', () => {
  it('renders an empty input by default', () => {
    const w = mount(SectionSearch);
    expect((w.find('.sec-search').element as HTMLInputElement).value).toBe('');
  });

  it('uses default placeholder when none is provided', () => {
    const w = mount(SectionSearch);
    expect(w.find('.sec-search').attributes('placeholder')).toContain('Buscar sección');
  });

  it('allows overriding the placeholder via prop', () => {
    const w = mount(SectionSearch, { props: { placeholder: 'Custom placeholder' } });
    expect(w.find('.sec-search').attributes('placeholder')).toBe('Custom placeholder');
  });

  it('uses default aria-label when none is provided', () => {
    const w = mount(SectionSearch);
    expect(w.find('.sec-search').attributes('aria-label')).toBe('Buscar sección');
  });

  it('overrides aria-label via prop', () => {
    const w = mount(SectionSearch, { props: { ariaLabel: 'Buscar pa otro lado' } });
    expect(w.find('.sec-search').attributes('aria-label')).toBe('Buscar pa otro lado');
  });

  it('updates v-model when user types', async () => {
    const w = mount(SectionSearch, { props: { modelValue: '' } });
    await w.find('.sec-search').setValue('mex');
    const updates = w.emitted('update:modelValue');
    expect(updates).toBeTruthy();
    expect(updates![updates!.length - 1]).toEqual(['mex']);
  });

  it('shows clear button only when there is a value', async () => {
    const w = mount(SectionSearch, { props: { modelValue: '' } });
    expect(w.find('.sec-search-clear').exists()).toBe(false);

    await w.setProps({ modelValue: 'mex' });
    expect(w.find('.sec-search-clear').exists()).toBe(true);
  });

  it('clears the value when × is pressed', async () => {
    const w = mount(SectionSearch, { props: { modelValue: 'mex' } });
    await w.find('.sec-search-clear').trigger('click');
    const updates = w.emitted('update:modelValue');
    expect(updates![updates!.length - 1]).toEqual(['']);
  });

  it('emits enter event when user presses Enter in the input', async () => {
    const w = mount(SectionSearch, { props: { modelValue: 'mex' } });
    await w.find('.sec-search').trigger('keydown.enter');
    expect(w.emitted('enter')).toHaveLength(1);
  });
});
