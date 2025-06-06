// @ts-check
import antfu from '@antfu/eslint-config'
import nuxt from './.nuxt/eslint.config.mjs'

export default antfu(
  {
    unocss: true,
    formatters: true,
    pnpm: true,
    vue: {
      overrides: {
        'vue/component-name-in-template-casing': ['error', 'PascalCase', {
          registeredComponentsOnly: false,
        }],
        'vue/custom-event-name-casing': ['error', 'kebab-case'],
      },
    },
  },
)
  .append(nuxt())
