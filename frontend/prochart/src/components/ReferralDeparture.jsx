import React from 'react';

import {
  REFERRAL_DISCLOSURE,
  REFERRAL_ELIGIBILITY,
  referralPathFor,
} from '../referrals';

export default function ReferralDeparture({
  provider,
  href,
  buttonLabel,
  buttonClassName = '',
  buttonStyle,
  compact = false,
}) {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const uid = React.useId().replaceAll(':', '');
  const disclosureId = `referral-disclosure-${uid}`;
  const eligibilityId = `referral-eligibility-${uid}`;
  const checkboxId = `referral-ack-${uid}`;
  const approvedPath = referralPathFor(provider, href);
  const describedBy = `${disclosureId} ${eligibilityId}`;

  return (
    <section aria-label={`لینک معرفی ${provider}`} className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-2.5 mb-3'}>
      <p id={disclosureId} className="text-[12px] leading-6 opacity-80">
        <strong>لینک معرفی:</strong> {REFERRAL_DISCLOSURE}
      </p>
      <p id={eligibilityId} className="text-[12px] leading-6 opacity-80">{REFERRAL_ELIGIBILITY}</p>
      <label htmlFor={checkboxId} className="flex items-start gap-2 text-[12px] leading-6 cursor-pointer">
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
          className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-50`}
          style={buttonStyle}
        >
          {buttonLabel || `لینک معرفی — ورود به وب‌سایت ${provider}`}
        </button>
      </form>
    </section>
  );
}
