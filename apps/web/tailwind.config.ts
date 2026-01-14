import type { Config } from 'tailwindcss'
import preset from '../../packages/config/tailwind/preset'

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
} satisfies Config
