import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const cwd = process.cwd();

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Dev keeps the /etherwallet/ base so routes and refreshes resolve there.
  // Production uses a relative base so the built assets work from any gh-pages path.
  base: command === 'build' ? './' : '/etherwallet/',
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

}))
