import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so built asset URLs work when served from a GitHub Pages
  // project subpath (https://<user>.github.io/<repo>/) as well as at a root.
  base: './',
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
})
