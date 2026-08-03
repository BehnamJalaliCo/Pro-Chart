#!/usr/bin/env python3
"""Validate the baked API route contract without starting application lifespan."""

from __future__ import annotations

from collections import Counter
from contextlib import redirect_stdout
import json
import sys

# The application's structured logger writes its import-time CORS event to
# stdout. Keep the machine-readable contract on stdout and preserve application
# diagnostics on stderr.
with redirect_stdout(sys.stderr):
    from src.api.deps import get_current_admin
    from src.api.main import app


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


method_paths = sorted(
    (method, route.path)
    for route in app.routes
    for method in (getattr(route, "methods", None) or ())
)
pair_counts = Counter(method_paths)
duplicates = [
    {"method": method, "path": path, "count": count}
    for (method, path), count in sorted(pair_counts.items())
    if count > 1
]
websocket_paths = sorted(
    route.path
    for route in app.routes
    if route.__class__.__name__ == "APIWebSocketRoute"
)
live_http = {(method, path) for method, path in method_paths if path.startswith("/live/")}
auth_http = {(method, path) for method, path in method_paths if path.startswith("/auth/")}
live_admin_routes = [
    route for route in app.routes if route.path.startswith("/live/admin/")
]
route_lookup = {
    (method, route.path): route
    for route in app.routes
    for method in (getattr(route, "methods", None) or ())
}
middleware = [item.cls.__name__ for item in app.user_middleware]

checks = {
    "routeObjectCount": len(app.routes) == 487,
    "httpMethodPathCount": len(method_paths) == 486,
    "duplicateMethodPathsAbsent": not duplicates,
    "websocketContract": set(websocket_paths) == EXPECTED_WEBSOCKETS,
    "liveHttpContract": live_http == EXPECTED_LIVE_HTTP,
    "liveAdminRouteCount": len(live_admin_routes) == 15,
    "liveAdminProtection": all(
        get_current_admin in direct_dependencies(route)
        for route in live_admin_routes
    ),
    "coreAuthContract": EXPECTED_CORE_AUTH <= auth_http,
    "protectedCoreAuth": all(
        get_current_admin in direct_dependencies(route_lookup.get(pair))
        for pair in {("POST", "/auth/logout"), ("GET", "/auth/me")}
    ),
    "securityHeadersMiddlewareConfigured": "SecurityHeadersMiddleware" in middleware,
    "topLevelEaRoutesAbsent": not any(path.startswith("/ea") for _, path in method_paths),
}

result = {
    "status": "pass" if all(checks.values()) else "fail",
    "checks": checks,
    "routeObjectCount": len(app.routes),
    "httpMethodPathCount": len(method_paths),
    "uniqueHttpMethodPathCount": len(pair_counts),
    "duplicateMethodPaths": duplicates,
    "websocketPaths": websocket_paths,
    "liveHttpMethodPaths": [
        {"method": method, "path": path} for method, path in sorted(live_http)
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
