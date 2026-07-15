import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = process.env.PLAYWRIGHT_ARTIFACT_ROOT
  ? path.resolve(process.env.PLAYWRIGHT_ARTIFACT_ROOT)
  : path.resolve(here, '..', 'artifacts', 'qa', 'playwright');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: path.join(artifactRoot, 'test-results'),
  reporter: [
    ['line'],
    ['json', { outputFile: path.join(artifactRoot, 'report.json') }],
    ['html', { outputFolder: path.join(artifactRoot, 'html'), open: 'never' }],
  ],
  use: {
    // The default host is intentionally non-public. Map it to 127.0.0.1 in the runner
    // (`--add-host prochart.local:127.0.0.1`) so an IP-canonicalization guard cannot
    // redirect characterization traffic to the public deployment.
    baseURL: process.env.PROCHART_BASE_URL || 'https://prochart.local',
    locale: 'fa-IR',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'on',
    ...(process.env.PLAYWRIGHT_HOST_RESOLVER_RULES
      ? { launchOptions: { args: [`--host-resolver-rules=${process.env.PLAYWRIGHT_HOST_RESOLVER_RULES}`] } }
      : {}),
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      },
    },
  ],
});
