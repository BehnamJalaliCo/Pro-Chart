"""Fixed, same-origin referral redirects for the two approved providers.

The public routes are deliberately explicit rather than parameterised.  A
request cannot supply or override a destination, and the response is never
cached.  Referral analytics may be added later, but must not record request
headers, query strings, credentials, or other user data.
"""

from types import MappingProxyType

from fastapi import APIRouter
from fastapi.responses import RedirectResponse


router = APIRouter()

REFERRAL_DISCLOSURE = "با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند."
REFERRAL_ELIGIBILITY = "ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد."

REFERRAL_DESTINATIONS = MappingProxyType(
    {
        "lbank": "https://www.lbank.com/ref/PROCHART",
        "oneroyal": "https://vc.cabinet.oneroyal.com/fa/links/go/12412",
    }
)
INTERNAL_REFERRAL_PATHS = MappingProxyType(
    {
        "lbank": "/go/lbank",
        "oneroyal": "/go/oneroyal",
    }
)


def internal_referral_path(provider: str) -> str:
    """Return an approved internal path; unknown providers fail closed."""

    return INTERNAL_REFERRAL_PATHS[provider]


def _fixed_redirect(provider: str) -> RedirectResponse:
    return RedirectResponse(
        url=REFERRAL_DESTINATIONS[provider],
        status_code=302,
        headers={
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
        },
    )


@router.get("/go/lbank", include_in_schema=False)
async def go_lbank() -> RedirectResponse:
    return _fixed_redirect("lbank")


@router.get("/go/oneroyal", include_in_schema=False)
async def go_oneroyal() -> RedirectResponse:
    return _fixed_redirect("oneroyal")
