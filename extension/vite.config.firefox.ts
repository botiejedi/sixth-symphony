import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Firefox build config - no CRXJS plugin
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'firefox-manifest',
      closeBundle() {
        // Copy Firefox manifest
        const distDir = resolve(__dirname, 'dist-firefox')
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true })
        }
        copyFileSync(
          resolve(__dirname, 'manifest.firefox.json'),
          resolve(distDir, 'manifest.json')
        )
        // Copy icons
        const iconsDir = resolve(distDir, 'icons')
        if (!existsSync(iconsDir)) {
          mkdirSync(iconsDir, { recursive: true })
        }
        copyFileSync(resolve(__dirname, 'public/icons/icon16.png'), resolve(iconsDir, 'icon16.png'))
        copyFileSync(resolve(__dirname, 'public/icons/icon48.png'), resolve(iconsDir, 'icon48.png'))
        copyFileSync(resolve(__dirname, 'public/icons/icon128.png'), resolve(iconsDir, 'icon128.png'))
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist-firefox',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: 'src/[name]/index.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  define: {
    'import.meta.env.BROWSER': JSON.stringify('firefox'),
  },
})
