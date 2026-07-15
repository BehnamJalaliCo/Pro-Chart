export const REFERRAL_DISCLOSURE = 'با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.';
export const REFERRAL_ELIGIBILITY = 'ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.';

export const INTERNAL_REFERRAL_PATHS = Object.freeze({
  LBank: '/go/lbank',
  OneRoyal: '/go/oneroyal',
});

export function normalizeAccountType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'crypto') return 'crypto';
  if (normalized === 'broker' || normalized === 'forex') return 'broker';
  return null;
}

export function providerForAccountType(value) {
  const normalized = normalizeAccountType(value);
  if (normalized === 'crypto') return 'LBank';
  if (normalized === 'broker') return 'OneRoyal';
  return null;
}

export function referralPathFor(provider, candidate) {
  const approved = INTERNAL_REFERRAL_PATHS[provider];
  if (!approved) return null;
  return candidate === approved ? candidate : approved;
}
