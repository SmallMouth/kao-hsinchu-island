import { resolve } from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({
  build: { rollupOptions: {
    // Build both entry points; the standalone game retains its inline script and pinned CDN import.
    input: { main: resolve(import.meta.dirname, 'index.html'), game: resolve(import.meta.dirname, 'game/index.html') },
    output: { manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js', 'three/addons/renderers/CSS2DRenderer.js'] } },
  } },
});
