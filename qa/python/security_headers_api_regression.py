#!/usr/bin/env python3
"""Dependency-compatible ASGI regression for the API security middleware."""

from __future__ import annotations

import asyncio
import json

from src.api.middleware.security_headers import SecurityHeadersMiddleware


class BareResponseApp:
    async def __call__(self, scope, receive, send):
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})


async def invoke(*, enable_hsts: bool, csp_policy: str | None = None) -> dict[str, str]:
    middleware = SecurityHeadersMiddleware(
        BareResponseApp(),
        enable_hsts=enable_hsts,
        csp_policy=csp_policy,
    )
    messages = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    await middleware(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "scheme": "https",
            "method": "GET",
            "path": "/health",
            "raw_path": b"/health",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("api", 8000),
        },
        receive,
        send,
    )
    start = next(message for message in messages if message["type"] == "http.response.start")
    return {name.decode("latin-1").lower(): value.decode("latin-1") for name, value in start["headers"]}


async def main() -> int:
    headers = await invoke(enable_hsts=True)
    assert headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"
    assert headers["x-frame-options"] == "DENY"
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-xss-protection"] == "0"
    assert headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "camera=()" in headers["permissions-policy"]
    assert headers["content-security-policy"] == (
        "default-src 'none'; object-src 'none'; frame-ancestors 'none'; "
        "base-uri 'none'; form-action 'none'"
    )

    no_hsts = await invoke(enable_hsts=False)
    assert "strict-transport-security" not in no_hsts
    assert no_hsts["x-xss-protection"] == "0"

    custom = "default-src 'none'; sandbox"
    custom_headers = await invoke(enable_hsts=True, csp_policy=custom)
    assert custom_headers["content-security-policy"] == custom

    print(json.dumps({
        "result": "PASS",
        "assertions": 11,
        "hstsEnabled": True,
        "hstsDisabledBranch": True,
        "customCspBranch": True,
        "headers": headers,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
