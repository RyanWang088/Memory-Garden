import { defineConfig } from '@playwright/test'
import { fileURLToPath, URL } from 'node:url'

const serverDirectory = fileURLToPath(new URL('../server', import.meta.url))

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
    { command: 'npm run dev', cwd: serverDirectory, url: 'http://localhost:3000/api/health', reuseExistingServer: true },
  ],
})
