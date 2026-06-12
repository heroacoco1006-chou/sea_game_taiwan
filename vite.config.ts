import { defineConfig } from 'vite';

// base: './' 讓打包後可離線開啟，也方便日後 Electron 載入
export default defineConfig({
  base: './',
  server: { port: 5173 },
});
