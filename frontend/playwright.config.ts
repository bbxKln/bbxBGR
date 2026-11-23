import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: [
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npx wrangler dev --port 8788',
      cwd: '../backend',
      url: 'http://localhost:8788/api/v1/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
