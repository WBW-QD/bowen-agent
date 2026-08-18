import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: './', // 相对路径：适配 GitHub Pages 子路径部署
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: {
      // Windows 上监听大体积/被占用图片易触发 EBUSY 崩溃，忽略图片文件
      ignored: ['**/src/assets/*.png', '**/public/*.png'],
    },
    proxy: {
      // 前端同源请求 /api → 后端 :3000，避免跨域
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
