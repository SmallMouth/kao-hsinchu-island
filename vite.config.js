import { resolve } from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({
  build: { rollupOptions: {
    // 兩個進入點：根目錄＝新竹風城島，game/＝午安新竹（單檔遊戲，內嵌一般 <script>，Vite 原樣輸出）
    input: { main: resolve(import.meta.dirname, 'index.html'), game: resolve(import.meta.dirname, 'game/index.html') },
    output: { manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js', 'three/addons/renderers/CSS2DRenderer.js'] } },
  } },
});
