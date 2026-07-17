#!/usr/bin/env python3
"""Runtime verification for the canonical ProChart nginx security boundary.

This uses only the Python standard library so it can inspect a freshly built
container without installing a scanner into the production image.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import ssl
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser


REQUIRED_HEADERS = {
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "x-xss-protection": "0",
    "referrer-policy": "strict-origin-when-cross-origin",
}

REQUIRED_CSP = {
    "default-src": {"'self'"},
    "base-uri": {"'none'"},
    "object-src": {"'none'"},
    "frame-ancestors": {"'none'"},
    "form-action": {"'self'"},
    "script-src": {"'self'", "'unsafe-eval'", "https://telegram.org"},
    "script-src-attr": {"'none'"},
    "worker-src": {"'self'", "blob:"},
    "style-src": {"'self'", "'unsafe-inline'"},
    "font-src": {"'self'", "data:"},
    "img-src": {"'self'", "data:", "blob:", "https:"},
    "media-src": {"'self'", "blob:"},
    "connect-src": {"'self'", "wss://pro-chart.ir", "wss://pro-chart.com"},
    "frame-src": {"https://oauth.telegram.org"},
    "manifest-src": {"'self'"},
    "upgrade-insecure-requests": set(),
}


class InlineScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self._inline = False
        self._chunks: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "script":
            self._inline = not any(name.lower() == "src" for name, _ in attrs)
            self._chunks = []

    def handle_data(self, data: str) -> None:
        if self._inline:
            self._chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._inline:
            script = "".join(self._chunks)
            if script.strip():
                self.scripts.append(script)
            self._inline = False
            self._chunks = []


@dataclass
class Response:
    status: int
    headers: dict[str, list[str]]
    body: bytes


def fetch(url: str, host: str) -> Response:
    request = urllib.request.Request(url, headers={"Host": host, "User-Agent": "ProChart-PC130-QA/1"})
    context = ssl._create_unverified_context()  # container certificate is checked by deployment, not this local IP probe
    try:
        response = urllib.request.urlopen(request, context=context, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    headers: dict[str, list[str]] = {}
    for name in response.headers.keys():
        headers[name.lower()] = response.headers.get_all(name) or []
    return Response(response.status, headers, response.read())


def one_header(response: Response, name: str) -> str:
    values = response.headers.get(name, [])
    if len(values) != 1:
        raise AssertionError(f"expected exactly one {name} header, got {values!r}")
    return values[0]


def parse_csp(value: str) -> dict[str, set[str]]:
    directives: dict[str, set[str]] = {}
    for raw in value.split(";"):
        parts = raw.strip().split()
        if parts:
            directives[parts[0]] = set(parts[1:])
    return directives


def check_security_headers(path: str, response: Response) -> dict[str, object]:
    if response.status != 200:
        raise AssertionError(f"{path}: expected 200, got {response.status}")

    for name, expected in REQUIRED_HEADERS.items():
        actual = one_header(response, name)
        if actual != expected:
            raise AssertionError(f"{path}: {name}={actual!r}, expected {expected!r}")

    permissions = one_header(response, "permissions-policy")
    for disabled in ("camera=()", "geolocation=()", "microphone=()", "payment=()", "usb=()"):
        if disabled not in permissions:
            raise AssertionError(f"{path}: Permissions-Policy is missing {disabled}")

    csp = one_header(response, "content-security-policy")
    directives = parse_csp(csp)
    for directive, expected_tokens in REQUIRED_CSP.items():
        if directive not in directives:
            raise AssertionError(f"{path}: CSP is missing {directive}")
        missing = expected_tokens - directives[directive]
        if missing:
            raise AssertionError(f"{path}: CSP {directive} is missing {sorted(missing)}")
    if "'unsafe-inline'" in directives["script-src"]:
        raise AssertionError(f"{path}: script-src must not allow unsafe-inline")
    if "*" in csp:
        raise AssertionError(f"{path}: CSP must not contain a wildcard")

    return {"path": path, "status": response.status, "headers": response.headers}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True, help="HTTPS container URL, for example https://172.20.0.5")
    parser.add_argument("--host", default="pro-chart.ir", help="Host header sent to nginx")
    parser.add_argument("--output", help="Optional JSON result path")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    index = fetch(base + "/index.html", args.host)
    results = [check_security_headers("/index.html", index)]
    html = index.body.decode("utf-8")

    scripts = InlineScriptParser()
    scripts.feed(html)
    csp = parse_csp(one_header(index, "content-security-policy"))
    hashes = []
    for script in scripts.scripts:
        digest = base64.b64encode(hashlib.sha256(script.encode("utf-8")).digest()).decode("ascii")
        token = f"'sha256-{digest}'"
        hashes.append(token)
        if token not in csp["script-src"]:
            raise AssertionError(f"inline script hash is absent from CSP: {token}")

    asset_match = re.search(r'<script[^>]+src="([^"]+\.js)"', html)
    if not asset_match:
        raise AssertionError("built index.html has no JavaScript asset")

    paths = [
        "/",
        "/does-not-exist-pc130",
        asset_match.group(1),
        "/manifest.webmanifest",
        "/sw.js",
        "/health",
        "/api/health",
    ]
    for path in paths:
        results.append(check_security_headers(path, fetch(base + path, args.host)))

    summary = {
        "result": "PASS",
        "baseUrl": base,
        "host": args.host,
        "inlineScriptHashes": hashes,
        "routes": results,
        "compatibilityException": "script-src unsafe-eval is required by the sandboxed NamaScript worker",
    }
    rendered = json.dumps(summary, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(rendered)
    sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
