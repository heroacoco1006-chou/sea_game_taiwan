import { defineConfig } from 'vite';

// base: './' 讓打包後可離線開啟，也方便日後 Electron 載入
export default defineConfig({
  base: './',
  // 預設 5173；預覽工具會透過 PORT 環境變數指定其他埠，方便與既有 dev server 並存
  server: { port: Number(process.env.PORT) || 5173 },
  // vite preview（serve dist）也讓出 PORT，方便用內建預覽工具驗證 build 版（不佔用 dev 的 5173）
  preview: { port: Number(process.env.PORT) || 4173 },
});
