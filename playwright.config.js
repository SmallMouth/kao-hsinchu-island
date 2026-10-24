import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.js',
  use: { baseURL: 'http://127.0.0.1:5173', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined) }, reducedMotion: 'reduce' },
  webServer: { command: 'npm run dev -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
