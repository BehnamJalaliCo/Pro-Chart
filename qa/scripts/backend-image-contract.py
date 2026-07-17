#!/usr/bin/env python3
"""Validate the baked FastAPI route/auth/header contract without lifespan I/O."""

from __future__ import annotations

from collections import Counter
from contextlib import redirect_stdout
import json
import sys

with redirect_stdout(sys.stderr):
    from src.api.deps import get_current_admin
    from src.api.main import app


# Re-baselined against the exact production image
# sha256:c388f3aaa5b23ced63ccf2af5a59c3ed16e685df518971475f399329be7a8dd6.
# Its complete normalized method/path inventory is byte-identical to the
# referral candidate (494 unique pairs); this count reflects FastAPI 0.139's
# lazy included-router expansion rather than a product route addition.
EXPECTED_ROUTE_OBJECTS = 492
EXPECTED_HTTP_METHOD_PATHS = 494
EXPECTED_REFERRALS = {
    ("GET", "/go/lbank"),
    ("GET", "/go/oneroyal"),
}
EXPECTED_LIVE_HTTP = {
    ("GET", "/live/config"),
    ("POST", "/live/auth/telegram"),
    ("GET", "/live/admin/state"),
    ("POST", "/live/admin/start"),
    ("POST", "/live/admin/stop"),
    ("POST", "/live/admin/mode"),
    ("POST", "/live/admin/chat-toggle"),
    ("POST", "/live/admin/slowmode"),
    ("POST", "/live/admin/pin"),
    ("POST", "/live/admin/title"),
    ("POST", "/live/admin/ban"),
    ("POST", "/live/admin/unban"),
    ("POST", "/live/admin/mute"),
    ("POST", "/live/admin/unmute"),
    ("DELETE", "/live/admin/message/{msg_id}"),
    ("POST", "/live/admin/clear"),
    ("GET", "/live/admin/publish-info"),
}
EXPECTED_CORE_AUTH = {
    ("POST", "/auth/login"),
    ("POST", "/auth/refresh"),
    ("POST", "/auth/logout"),
    ("GET", "/auth/me"),
}
EXPECTED_WEBSOCKETS = {"/live/ws/chat", "/ws/prices"}


def direct_dependencies(route: object) -> set[object]:
    dependant = getattr(route, "dependant", None)
    return {
        dependency.call
        for dependency in getattr(dependant, "dependencies", ())
    }


def effective_routes(app: object) -> list[object]:
    """Normalize legacy flat routes and FastAPI 0.139 lazy included routers."""
    result = []
    for route in app.routes:
        candidates = getattr(route, "effective_candidates", None)
        if callable(candidates):
            result.extend(candidates())
        else:
            result.append(route)
    return result


def route_path(route: object) -> str:
    starlette_route = getattr(route, "starlette_route", None)
    return getattr(starlette_route, "path", None) or getattr(route, "path", "")


def is_websocket_route(route: object) -> bool:
    original = getattr(route, "original_route", route)
    return original.__class__.__name__ == "APIWebSocketRoute"


routes = effective_routes(app)


method_paths = sorted(
    (method, route_path(route))
    for route in routes
    for method in (getattr(route, "methods", None) or ())
)
pair_counts = Counter(method_paths)
duplicates = [
    {"method": method, "path": path, "count": count}
    for (method, path), count in sorted(pair_counts.items())
    if count > 1
]
websocket_paths = sorted(
    route_path(route)
    for route in routes
    if is_websocket_route(route)
)
live_http = {(method, path) for method, path in method_paths if path.startswith("/live/")}
auth_http = {(method, path) for method, path in method_paths if path.startswith("/auth/")}
referral_http = {(method, path) for method, path in method_paths if path.startswith("/go/")}
live_admin_routes = [route for route in routes if route_path(route).startswith("/live/admin/")]
referral_routes = [route for route in routes if route_path(route).startswith("/go/")]
route_lookup = {
    (method, route_path(route)): route
    for route in routes
    for method in (getattr(route, "methods", None) or ())
}
middleware = [item.cls.__name__ for item in app.user_middleware]

checks = {
    "routeObjectCount": len(routes) == EXPECTED_ROUTE_OBJECTS,
    "httpMethodPathCount": len(method_paths) == EXPECTED_HTTP_METHOD_PATHS,
    "duplicateMethodPathsAbsent": not duplicates,
    "websocketContract": set(websocket_paths) == EXPECTED_WEBSOCKETS,
    "liveHttpContract": live_http == EXPECTED_LIVE_HTTP,
    "liveAdminRouteCount": len(live_admin_routes) == 15,
    "liveAdminProtection": all(
        get_current_admin in direct_dependencies(route) for route in live_admin_routes
    ),
    "coreAuthContract": EXPECTED_CORE_AUTH <= auth_http,
    "protectedCoreAuth": all(
        get_current_admin in direct_dependencies(route_lookup[pair])
        for pair in {("POST", "/auth/logout"), ("GET", "/auth/me")}
    ),
    "referralHttpContract": referral_http == EXPECTED_REFERRALS,
    "referralRoutesPublic": all(
        get_current_admin not in direct_dependencies(route) for route in referral_routes
    ),
    "securityHeadersMiddlewareConfigured": "SecurityHeadersMiddleware" in middleware,
    "topLevelEaRoutesAbsent": not any(path.startswith("/ea") for _, path in method_paths),
}

result = {
    "status": "pass" if all(checks.values()) else "fail",
    "checks": checks,
    "routeObjectCount": len(routes),
    "httpMethodPathCount": len(method_paths),
    "uniqueHttpMethodPathCount": len(pair_counts),
    "duplicateMethodPaths": duplicates,
    "websocketPaths": websocket_paths,
    "liveHttpMethodPaths": [
        {"method": method, "path": path} for method, path in sorted(live_http)
    ],
    "referralHttpMethodPaths": [
        {"method": method, "path": path} for method, path in sorted(referral_http)
    ],
    "liveAdminRouteCount": len(live_admin_routes),
    "authHttpMethodPaths": [
        {"method": method, "path": path} for method, path in sorted(auth_http)
    ],
    "middleware": middleware,
    "applicationLifespanStarted": False,
    "liveServicesOrDataUsed": False,
}
print(json.dumps(result, indent=2, sort_keys=True))
raise SystemExit(0 if result["status"] == "pass" else 1)
