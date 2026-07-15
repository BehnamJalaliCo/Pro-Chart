import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  INTERNAL_REFERRAL_PATHS,
  REFERRAL_DISCLOSURE,
  REFERRAL_ELIGIBILITY,
  referralPathFor,
} from '../src/referrals.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [departure, userPanel, profile, partners, orderTicket, apiClient, nginx, apiRoutes, main] = await Promise.all([
  read('../src/components/ReferralDeparture.jsx'),
  read('../src/UserPanel.jsx'),
  read('../src/app/screens/ProfileScreen.jsx'),
  read('../src/bazaarnama/Partners.jsx'),
  read('../src/bazaarnama/OrderTicket.jsx'),
  read('../src/api/client.js'),
  read('../nginx.conf'),
  read('../../../src/api/routes/referrals.py'),
  read('../../../src/api/main.py'),
]);

test('referral paths are a fixed same-origin allowlist and fail closed', () => {
  assert.deepEqual(INTERNAL_REFERRAL_PATHS, {
    LBank: '/go/lbank',
    OneRoyal: '/go/oneroyal',
  });
  assert.equal(Object.isFrozen(INTERNAL_REFERRAL_PATHS), true);
  assert.equal(referralPathFor('LBank', 'https://attacker.invalid'), '/go/lbank');
  assert.equal(referralPathFor('OneRoyal', '/go/lbank'), '/go/oneroyal');
  assert.equal(referralPathFor('unapproved', '/go/lbank'), null);
});

test('departure gate has exact disclosures, accessible checkbox, and native disabled submit', () => {
  assert.equal(REFERRAL_DISCLOSURE, 'با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.');
  assert.equal(REFERRAL_ELIGIBILITY, 'ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.');
  assert.match(departure, /<label htmlFor=\{checkboxId\}/);
  assert.match(departure, /id=\{checkboxId\}[\s\S]*?type="checkbox"[\s\S]*?aria-describedby=\{describedBy\}/);
  assert.match(departure, /<form action=\{approvedPath \|\| undefined\} method="get" target="_blank" rel="noopener noreferrer sponsored">/);
  assert.match(departure, /<button[\s\S]*?type="submit"[\s\S]*?disabled=\{!acknowledged \|\| !approvedPath\}/);
  assert.doesNotMatch(departure, /window\.open|location\.(?:assign|replace)|href=\{/);
});

test('reachable desktop and mobile referral surfaces use the shared gate', () => {
  assert.equal((userPanel.match(/<ReferralDeparture\b/g) || []).length, 3);
  assert.match(userPanel, /provider="LBank"/);
  assert.match(userPanel, /provider="OneRoyal"/);
  assert.doesNotMatch(userPanel, /<a href=\{refUrl/);
  assert.doesNotMatch(userPanel, /bnConnectMt5/);

  assert.equal((profile.match(/<ReferralDeparture\b/g) || []).length, 2);
  assert.match(profile, /provider="LBank"/);
  assert.match(profile, /provider="OneRoyal"/);
  assert.doesNotMatch(profile, /bnConnectMt5|api_secret.*OneRoyal|mt\.password/);
  assert.match(profile, /OneRoyal[\s\S]*?فقط به‌عنوان مسیر معرفی/);

  assert.doesNotMatch(apiClient, /bnConnectMt5|bnConnectRemove:\s*\(kind\)/);
  assert.match(apiClient, /bnDisconnectLbank:\s*\(\)\s*=>\s*client\.delete\('\/academy\/bn\/connect\/lbank'\)/);
  assert.match(orderTicket, /const connected = !!\([\s\S]*?isCrypto[\s\S]*?accounts\?\.lbank/);
  assert.doesNotMatch(orderTicket, /conn\.mt5|mt5_connected/);
  assert.match(orderTicket, /OneRoyal فقط مسیر معرفی است و معاملهٔ مستقیم فارکس/);
});

test('dormant Partners source uses local assets, neutral copy, and the same gate', () => {
  assert.match(partners, /logo: '\/partners\/lbank\.svg'/);
  assert.match(partners, /logo: '\/partners\/oneroyal\.svg'/);
  assert.match(partners, /<ReferralDeparture/);
  assert.doesNotMatch(partners, /https?:\/\/|clearbit|TRADEYAR|رگوله‌شده|پاداش|کارمزدِ ویژه/);
  assert.match(partners, /اتصال حساب یا معامله مستقیم OneRoyal در Pro Chart فعال نیست/);
});

test('edge and API expose two exact redirect contracts only', () => {
  for (const provider of ['lbank', 'oneroyal']) {
    assert.match(nginx, new RegExp(`location = /go/${provider} \\{`));
    assert.match(nginx, new RegExp(`proxy_pass \\$up_referral/go/${provider};`));
  }
  assert.doesNotMatch(nginx, /location\s+[~^* ]+\^?\/go\/\(?/);
  assert.match(main, /app\.include_router\(referrals\.router/);
  assert.match(apiRoutes, /"lbank": "https:\/\/www\.lbank\.com\/ref\/PROCHART"/);
  assert.match(apiRoutes, /"oneroyal": "https:\/\/vc\.cabinet\.oneroyal\.com\/fa\/links\/go\/12412"/);
  assert.doesNotMatch(apiRoutes, /@router\.get\("\/go\/\{/);
});
