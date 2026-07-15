import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  findForbiddenProviders,
  scanTree,
  selectFrontendContexts,
  stripNonShippingComments,
} from '../scripts/provider-exclusivity-scan.mjs';

async function withTree(files, fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'provider-exclusivity-'));
  try {
    for (const [relative, contents] of Object.entries(files)) {
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('comments do not create provider false positives while product strings remain visible', () => {
  const source = [
    '// Binance is mentioned only in an engineering comment.',
    '/* Kraken must also be ignored here. */',
    'const approved = "LBank و OneRoyal";',
    'const forbidden = "اتصال به Bybit";',
  ].join('\n');
  const stripped = stripNonShippingComments(source, '.jsx');
  assert.doesNotMatch(stripped, /Binance|Kraken/);
  assert.match(stripped, /LBank و OneRoyal/);
  assert.match(stripped, /Bybit/);
  assert.deepEqual(
    findForbiddenProviders(stripped, { relativePath: 'src/App.jsx', surface: 'source' })
      .map(({ provider }) => provider),
    ['Bybit'],
  );
});

test('OneRoyal operational routes and MT5 activation state are blocking findings', () => {
  const source = [
    'client.post("/user/account/link", credentials);',
    'client.post("/user/copy-config", settings);',
    'client.get("/admin/ea-config");',
    'const active = account.kind === "mt5";',
    'const allowed = "OneRoyal فقط مسیر معرفی است";',
  ].join('\n');
  const findings = findForbiddenProviders(source, {
    relativePath: 'src/legacy-controls.jsx',
    surface: 'source',
  });
  assert.equal(findings.length, 4);
  assert.ok(findings.every(({ category }) => category === 'oneroyal-operational'));
  assert.ok(findings.every(({ provider }) => provider.startsWith('OneRoyal operational')));
});

test('source, fixtures, bundles, URLs, and binary asset names are scanned', async () => {
  await withTree({
    'src/App.jsx': 'export const providers = ["LBank", "OneRoyal"]; // Binance is non-shipping\n',
    'fixtures/provider.json': '{"broker":"Exness"}\n',
    'public/coinbase-logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    'dist/assets/index.js': 'const x="https://www.binance.com/register";const y="OneRoyal";',
  }, async (root) => {
    const source = await scanTree(root, { kind: 'source', excludeDirectories: new Set(['dist']) });
    assert.deepEqual(
      source.findings.map(({ provider, matchKind, relativePath }) => [provider, matchKind, relativePath]),
      [
        ['Exness', 'content', 'fixtures/provider.json'],
        ['Coinbase', 'path', 'public/coinbase-logo.png'],
      ],
    );
    assert.equal(source.surfaces.fixture.findings, 1);

    const bundle = await scanTree(path.join(root, 'dist'), { kind: 'bundle' });
    assert.deepEqual(bundle.findings.map(({ provider }) => provider), ['Binance']);
    assert.equal(bundle.result, 'FAIL');
  });
});

test('clean trees are deterministic and approve only LBank and OneRoyal', async () => {
  await withTree({
    'src/referrals.js': 'export const providers = Object.freeze(["LBank", "OneRoyal"]);\n',
    'public/partners/oneroyal.svg': '<svg aria-label="OneRoyal"/>\n',
    'fixtures/referral.json': '{"exchange":"LBank","broker":"OneRoyal"}\n',
  }, async (root) => {
    const first = await scanTree(root, { kind: 'source' });
    const second = await scanTree(root, { kind: 'source' });
    assert.equal(first.result, 'PASS');
    assert.deepEqual(first, second);
    assert.match(first.treeSha256, /^[a-f0-9]{64}$/);
    assert.equal(first.filesScanned, 3);
  });
});

test('compose selection includes the ignored-but-deployed user frontend', () => {
  const repoRoot = '/workspace/app';
  const compose = {
    services: {
      'frontend-prochart': { build: { context: '/workspace/app/frontend/prochart', dockerfile: 'Dockerfile' } },
      'admin-frontend': { build: { context: '/workspace/app/frontend/panel', dockerfile: 'Dockerfile' } },
      'user-frontend': { build: { context: '/workspace/app/frontend/user', dockerfile: 'Dockerfile' } },
      api: { build: { context: '/workspace/app', dockerfile: 'Dockerfile' } },
    },
  };
  assert.deepEqual(selectFrontendContexts(compose, repoRoot), [
    { service: 'admin-frontend', context: 'frontend/panel', dockerfile: 'Dockerfile' },
    { service: 'frontend-prochart', context: 'frontend/prochart', dockerfile: 'Dockerfile' },
    { service: 'user-frontend', context: 'frontend/user', dockerfile: 'Dockerfile' },
  ]);
});

test('missing or escaping frontend build contexts fail closed', () => {
  const base = {
    services: {
      'frontend-prochart': { build: { context: '/workspace/app/frontend/prochart' } },
      'admin-frontend': { build: { context: '/workspace/app/frontend/panel' } },
    },
  };
  assert.throws(() => selectFrontendContexts(base, '/workspace/app'), /missing required compose service: user-frontend/);

  const escaping = structuredClone(base);
  escaping.services['user-frontend'] = { build: { context: '/workspace/other/user' } };
  assert.throws(() => selectFrontendContexts(escaping, '/workspace/app'), /escapes repository root/);
});
