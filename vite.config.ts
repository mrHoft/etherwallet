import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const cwd = process.cwd();

// https://vite.dev/config/
export default defineConfig({
  base: '/etherwallet/',
  build: {
    assetsDir: './',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: '~',
        replacement: `${cwd}/src/`,
      }
    ],
  },

})
