import pluginVue from 'eslint-plugin-vue';
import vueTsConfig from '@vue/eslint-config-typescript';
import vuePrettierConfig from '@vue/eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...pluginVue.configs['flat/recommended'],
  ...vueTsConfig(),
  vuePrettierConfig,
];
