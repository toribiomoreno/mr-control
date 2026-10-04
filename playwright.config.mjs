import process from 'node:process';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.mjs', reporter: 'list',
  use: { launchOptions: process.env.TEST_CHROMIUM_PATH ? { executablePath:process.env.TEST_CHROMIUM_PATH, args:['--no-sandbox','--disable-gpu'] } : {}, baseURL: 'http://127.0.0.1:5174', viewport: { width:1440, height:1000 } },
  webServer: { command: 'VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key npm run dev -- --host 127.0.0.1 --port 5174', url: 'http://127.0.0.1:5174/tests/seguimiento.html', reuseExistingServer:false },
});
