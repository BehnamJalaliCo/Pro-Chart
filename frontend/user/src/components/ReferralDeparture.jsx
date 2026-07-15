import { useEffect, useId, useState } from 'react';

import {
  REFERRAL_DISCLOSURE,
  REFERRAL_ELIGIBILITY,
  referralPathFor,
} from '../referrals';

export default function ReferralDeparture({
  provider,
  href,
  buttonLabel,
  buttonClassName = 'btn-primary',
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const uid = useId().replaceAll(':', '');
  const disclosureId = `referral-disclosure-${uid}`;
  const eligibilityId = `referral-eligibility-${uid}`;
  const checkboxId = `referral-ack-${uid}`;
  const approvedPath = referralPathFor(provider, href);
  const describedBy = `${disclosureId} ${eligibilityId}`;

  useEffect(() => setAcknowledged(false), [provider, approvedPath]);

  return (
    <section aria-label={`لینک معرفی ${provider}`} className="space-y-3">
      <p id={disclosureId} className="text-xs text-text-secondary leading-6">
        <strong>لینک معرفی:</strong> {REFERRAL_DISCLOSURE}
      </p>
      <p id={eligibilityId} className="text-xs text-text-secondary leading-6">
        {REFERRAL_ELIGIBILITY}
      </p>
      <label htmlFor={checkboxId} className="flex items-start gap-2 text-xs text-text-secondary leading-6 cursor-pointer">
        <input
          id={checkboxId}
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          aria-describedby={describedBy}
          className="mt-1 shrink-0"
        />
        <span>شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.</span>
      </label>
      <form action={approvedPath || undefined} method="get" target="_blank" rel="noopener noreferrer sponsored">
        <button
          type="submit"
          disabled={!acknowledged || !approvedPath}
          aria-describedby={describedBy}
          className={`${buttonClassName} referral-departure-submit w-full inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {buttonLabel || `لینک معرفی — ورود به وب‌سایت ${provider}`}
        </button>
      </form>
    </section>
  );
}
