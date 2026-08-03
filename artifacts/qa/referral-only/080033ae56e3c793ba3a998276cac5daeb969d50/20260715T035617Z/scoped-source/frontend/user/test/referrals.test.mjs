import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  INTERNAL_REFERRAL_PATHS,
  REFERRAL_DISCLOSURE,
  REFERRAL_ELIGIBILITY,
  normalizeAccountType,
  providerForAccountType,
  referralPathFor,
} from '../src/referrals.js';

const appRoot = fileURLToPath(new URL('../../../', import.meta.url));

async function source(relativePath) {
  return readFile(new URL(relativePath, new URL('../../../', import.meta.url)), 'utf8');
}

test('account types map legacy forex to the broker referral boundary', () => {
  assert.equal(normalizeAccountType('crypto'), 'crypto');
  assert.equal(normalizeAccountType('broker'), 'broker');
  assert.equal(normalizeAccountType('forex'), 'broker');
  assert.equal(normalizeAccountType('unknown'), null);
  assert.equal(providerForAccountType('crypto'), 'LBank');
  assert.equal(providerForAccountType('broker'), 'OneRoyal');
});

test('referral paths are fixed and unapproved candidates fail to the allowlist path', () => {
  assert.deepEqual(INTERNAL_REFERRAL_PATHS, {
    LBank: '/go/lbank',
    OneRoyal: '/go/oneroyal',
  });
  assert.equal(referralPathFor('LBank', 'https://attacker.invalid'), '/go/lbank');
  assert.equal(referralPathFor('OneRoyal', '//attacker.invalid'), '/go/oneroyal');
  assert.equal(referralPathFor('unknown', '/go/lbank'), null);
});

test('departure component requires disclosure acknowledgement and a native GET form', async () => {
  const component = await source('frontend/user/src/components/ReferralDeparture.jsx');
  assert.equal(REFERRAL_DISCLOSURE, 'با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.');
  assert.equal(REFERRAL_ELIGIBILITY, 'ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.');
  assert.match(component, /<form action=\{approvedPath \|\| undefined\} method="get" target="_blank" rel="noopener noreferrer sponsored">/);
  assert.match(component, /disabled=\{!acknowledged \|\| !approvedPath\}/);
  assert.doesNotMatch(component, /window\.open|location\.href/);
});

test('real user portal has no MT5 client or raw referral anchors', async () => {
  const [client, connect, subscription, trading] = await Promise.all([
    source('frontend/user/src/api/client.js'),
    source('frontend/user/src/pages/ConnectPage.jsx'),
    source('frontend/user/src/pages/SubscriptionPage.jsx'),
    source('frontend/user/src/pages/TradingPage.jsx'),
  ]);
  assert.doesNotMatch(client, /connectMt5|disconnect:\s*\(kind\)/);
  assert.doesNotMatch(connect, /bnUserAPI\.connectMt5|<a\s+href=\{data\?*\.url\}/);
  assert.doesNotMatch(subscription, /<a\s+href=\{data\?*\.url\}/);
  assert.match(trading, /connQ\.data\?\.accounts\?\.lbank/);
  assert.doesNotMatch(trading, /Object\.keys\(accounts\)/);
  assert.ok(appRoot.endsWith('/app/'));
});

test('edge and standalone user nginx expose only the two exact referral routes', async () => {
  const [edge, standalone] = await Promise.all([
    source('nginx/user-panel.conf'),
    source('frontend/user/nginx.conf'),
  ]);
  assert.equal((edge.match(/location = \/go\/lbank/g) || []).length, 2);
  assert.equal((edge.match(/location = \/go\/oneroyal/g) || []).length, 2);
  assert.equal((standalone.match(/location = \/go\/lbank/g) || []).length, 1);
  assert.equal((standalone.match(/location = \/go\/oneroyal/g) || []).length, 1);
  assert.doesNotMatch(`${edge}\n${standalone}`, /proxy_pass\s+\$?(?:request_uri|arg_|http_)/);
});
