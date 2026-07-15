import { test, expect } from '@playwright/test';

test.describe('PC-130 runtime CSP behavior', () => {
  test('the production policy permits required workers and blocks an unlisted script origin', async ({ page }) => {
    const violations = [];
    await page.addInitScript(() => {
      window.__pc130Violations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__pc130Violations.push({
          blockedURI: event.blockedURI,
          directive: event.effectiveDirective,
        });
      });
    });

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('#root')).not.toBeEmpty();

    const workerResult = await page.evaluate(async () => {
      // Keep the worker probe compatible with the production CSP: validating
      // blob workers must not require the forbidden `unsafe-eval` capability.
      const source = `postMessage(6 * 7)`;
      const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
      try {
        return await new Promise((resolve, reject) => {
          const worker = new Worker(url);
          const timeout = setTimeout(() => reject(new Error('worker timeout')), 5000);
          worker.onmessage = (event) => {
            clearTimeout(timeout);
            worker.terminate();
            resolve(event.data);
          };
          worker.onerror = (event) => {
            clearTimeout(timeout);
            worker.terminate();
            reject(new Error(event.message));
          };
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    });
    expect(workerResult).toBe(42);

    const blockedProbe = await page.evaluate(() => new Promise((resolve) => {
      const onViolation = (event) => {
        if (event.blockedURI.includes('example.invalid')) {
          resolve({ blockedURI: event.blockedURI, directive: event.effectiveDirective });
        }
      };
      document.addEventListener('securitypolicyviolation', onViolation, { once: true });
      const script = document.createElement('script');
      script.src = 'https://example.invalid/prochart-pc130-probe.js';
      document.head.appendChild(script);
      setTimeout(() => resolve(null), 3000);
    }));
    violations.push(...await page.evaluate(() => window.__pc130Violations));

    expect(blockedProbe).toEqual(expect.objectContaining({
      directive: 'script-src-elem',
      blockedURI: 'https://example.invalid/prochart-pc130-probe.js',
    }));
    expect(violations).toContainEqual(expect.objectContaining({
      directive: 'script-src-elem',
      blockedURI: 'https://example.invalid/prochart-pc130-probe.js',
    }));
  });
});
