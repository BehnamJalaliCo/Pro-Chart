# Referral-only and frontend-runtime deployment

- Result: `PASS`
- Rollout: `2026-07-15T04:22:41Z` to `2026-07-15T04:22:53Z`
- Final browser validation: `2026-07-15T04:25:59Z`
- Stable observation: `2026-07-15T04:26:37Z`
- Rollback triggered: `NO`

## Exact deployed images

- API, data-feed, crypto-ws, finnhub-ws, news-worker: `sha256:23f49262ce660e6ad405ae72cd96037aa4d70e75a085163143dc07d98646223e`
- Main edge: `sha256:20e2ad31c1280f44850530a7ac12456f4817da8f163fdd230defe0436f7fa3ec`
- User Portal: `sha256:6a5c2512392cdb8257c804a0ca116c4fed9ce4186fd9a6e2685c313d1dcf6216`
- Panel: `sha256:8b6231de18db8810b8d83e02b3db83960cb9b5f1b33de0549961360073535ea2`

## Final gates

- All 11 compose services are running; API, main edge, User Portal, Panel and infrastructure healthchecks are healthy.
- All eight replaced containers have restart count zero and zero fatal/traceback/panic/uncaught patterns in the observation window.
- API health reports database and Redis connected; live OpenAPI contains 421 paths and the MT5 compatibility endpoint has no credential request body.
- `/go/lbank` and `/go/oneroyal` return only the fixed approved 302 destinations on origin and Cloudflare public paths, including with hostile query parameters.
- User and Panel public roots return 200 and the seven-header security boundary.
- Production assets for main, user and panel match their tested candidate manifests byte-for-byte.
- Candidate browser tests: user referral 4/4, main referral 4/4 and panel navigation 1/1.
- Production browser tests after rollout: user referral 4/4, main referral 4/4 and panel navigation 1/1.
- Final performance gate: six measured samples passed (three desktop and three mobile); six cross-project cases were intentionally skipped.
- Frontend Grype scans: each exact image has 3 Medium, 0 High and 0 Critical findings; each final SBOM has 22 packages.

## Harness transparency

- A local performance attempt used an IP origin and hit the application's IP-canonicalization guard; the corrected `prochart.local` mapped-origin run passed 6/6.
- The first main production-browser command derived an unmapped `user.pro-chart.ir` hostname; the corrected mapped-origin run passed 4/4.
- The first Panel production-browser evidence mount was root-owned and failed only while writing `actual.png`; ownership was corrected and the same test passed 1/1.

## Rollback

The previous eight image identities are preserved under `rollback-referral-20260715T042151Z` tags and `rollback.override.yml`. No rollback was required.
