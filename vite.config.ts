import { defineConfig } from 'vite';

// base: './' 讓打包後可離線開啟，也方便日後 Electron 載入
export default defineConfig({
  base: './',
  // 預設 5173；預覽工具會透過 PORT 環境變數指定其他埠，方便與既有 dev server 並存
  server: { port: Number(process.env.PORT) || 5173 },
});
