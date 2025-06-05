import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
    ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600'],
  ],
  presets: [
    presetWind4(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
      processors: createLocalFontProcessor(),
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  safelist: [
    'i-twemoji-grinning-face-with-big-eyes',
    'i-twemoji-beaming-face-with-smiling-eyes',
    'i-twemoji-face-with-tears-of-joy',
    'i-twemoji-rolling-on-the-floor-laughing',
    'i-twemoji-smiling-face-with-halo',
    'i-twemoji-winking-face',
    'i-twemoji-star-struck',
    'i-twemoji-face-blowing-a-kiss',
    'i-twemoji-upside-down-face',
    'i-twemoji-zany-face',
    'i-twemoji-shushing-face',
    'i-twemoji-thinking-face',
    'i-twemoji-face-with-monocle',
    'i-twemoji-nerd-face',
    'i-twemoji-smiling-face-with-sunglasses',
    'i-twemoji-cowboy-hat-face',
    'i-twemoji-clown-face',
    'i-twemoji-ghost',
    'i-twemoji-alien',
    'i-twemoji-robot',
  ],
})
