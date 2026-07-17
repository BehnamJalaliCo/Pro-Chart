#!/usr/bin/env python3
"""Deterministic, static inventory of the six declared frontend applications.

The inventory is deliberately conservative:

* only Git-tracked, present files contribute to the canonical/current inventory;
* the canonical inventory remains tracked-path-only, while a separate current
  candidate view may follow eligible, nonignored untracked source with explicit
  provenance;
* reachability means "found in a static relative-import graph from main.jsx",
  not that a browser path was exercised;
* a source match is evidence for manual review, never proof of runtime behavior,
  authorization, accessibility, licensing, or compatibility.

The script uses only Python's standard library and emits stable JSON.  It does
not include a wall-clock timestamp.  Run metadata belongs beside the generated
JSON in the run-scoped artifact directory.
"""

from __future__ import annotations

import argparse
import ast
import collections
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Iterable
from urllib.parse import urlparse


SCHEMA_VERSION = "1.0.0"
APPLICATIONS = (
    "academy",
    "ig",
    "panel",
    "prochart",
    "user",
    "website",
)
SOURCE_EXTENSIONS = (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")
RESOLVE_EXTENSIONS = SOURCE_EXTENSIONS + (".json", ".css", ".svg", ".png")
ASSET_EXTENSIONS = {
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".gif": "image",
    ".svg": "vector",
    ".woff": "font",
    ".woff2": "font",
    ".ttf": "font",
    ".otf": "font",
}
EXCLUDED_TREE_PARTS = {"node_modules", ".vite", "dist", "www", "src.bak"}
CANDIDATE_SCHEMA_VERSION = "1.0.0"
CANDIDATE_EXCLUDED_TREE_PARTS = EXCLUDED_TREE_PARTS | {
    "android",
    "build",
    "coverage",
    "fixtures",
    "generated",
    "test",
    "tests",
    "__fixtures__",
    "__generated__",
    "__tests__",
}
HOST_CONFIGS = {
    "academy": ("nginx/conf.d/academy.conf",),
    "ig": ("nginx/conf.d/ig.conf",),
    "panel": ("nginx/panel.conf",),
    "prochart": ("frontend/prochart/nginx.conf",),
    "user": ("nginx/user-panel.conf",),
    "website": ("nginx/conf.d/website.conf",),
}
EXPECTED_BUILD_CONTEXTS = {
    "academy": "./frontend/academy",
    "ig": "./frontend/ig",
    "panel": "./frontend/panel",
    "prochart": "./frontend/prochart",
    "user": "./frontend/user",
    "website": "./frontend/website",
}
BRAND_TERMS = (
    "anthropic",
    "bsc",
    "capacitor",
    "claude",
    "clearbit",
    "cloudflare",
    "facebook",
    "finnhub",
    "google",
    "instagram",
    "lbank",
    "lucide",
    "metamask",
    "mt5",
    "oanda",
    "oneroyal",
    "openai",
    "telegram",
    "tradingview",
    "twelvedata",
    "twitter",
    "usdt",
    "walletconnect",
    "youtube",
)


def run_git(repo: Path, *args: str, check: bool = True) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and proc.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed ({proc.returncode}): {proc.stderr.strip()}"
        )
    return proc.stdout


def git_paths(repo: Path, *args: str) -> list[str]:
    if not args:
        raise ValueError("git_paths requires a git subcommand")
    raw = subprocess.run(
        ["git", args[0], "-z", *args[1:]],
        cwd=repo,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ).stdout
    return sorted(item.decode("utf-8", "replace") for item in raw.split(b"\0") if item)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def digest_file_set(repo: Path, paths: Iterable[str]) -> str:
    digest = hashlib.sha256()
    for relative in sorted(paths):
        path = repo / relative
        if not path.is_file():
            continue
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def digest_provenance_file_set(
    repo: Path, provenance_by_path: dict[str, str]
) -> str:
    """Hash candidate bytes together with their tracked/untracked provenance."""
    digest = hashlib.sha256()
    for relative, provenance in sorted(provenance_by_path.items()):
        path = repo / relative
        if not path.is_file():
            continue
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(provenance.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def strip_js_comments(source: str) -> str:
    """Remove JS comments while preserving strings, character positions and lines."""
    out = list(source)
    index = 0
    state = "code"
    quote = ""
    while index < len(source):
        char = source[index]
        nxt = source[index + 1] if index + 1 < len(source) else ""
        if state == "code":
            if char in ("'", '"', "`"):
                state = "string"
                quote = char
            elif char == "/" and nxt == "/":
                out[index] = out[index + 1] = " "
                index += 1
                state = "line_comment"
            elif char == "/" and nxt == "*":
                out[index] = out[index + 1] = " "
                index += 1
                state = "block_comment"
        elif state == "string":
            if char == "\\":
                index += 1
            elif char == quote:
                state = "code"
        elif state == "line_comment":
            if char == "\n":
                state = "code"
            else:
                out[index] = " "
        elif state == "block_comment":
            if char == "*" and nxt == "/":
                out[index] = out[index + 1] = " "
                index += 1
                state = "code"
            elif char != "\n":
                out[index] = " "
        index += 1
    return "".join(out)


def line_number(source: str, offset: int) -> int:
    return source.count("\n", 0, offset) + 1


def line_excerpt(source: str, line: int, limit: int = 180) -> str:
    lines = source.splitlines()
    if line < 1 or line > len(lines):
        return ""
    excerpt = re.sub(r"\s+", " ", lines[line - 1]).strip()
    return excerpt[:limit]


def evidence(path: str, source: str, offset: int, **values: object) -> dict[str, object]:
    line = line_number(source, offset)
    item: dict[str, object] = {
        "path": path,
        "line": line,
        "excerpt": line_excerpt(source, line),
    }
    item.update(values)
    return item


def tracked_status(repo: Path, root: str) -> dict[str, object]:
    tracked = git_paths(repo, "ls-files", "--", root)
    present = [path for path in tracked if (repo / path).is_file()]
    deleted = [path for path in tracked if not (repo / path).exists()]
    untracked = git_paths(repo, "ls-files", "--others", "--exclude-standard", "--", root)
    ignored_all = git_paths(
        repo, "ls-files", "--others", "--ignored", "--exclude-standard", "--", root
    )
    # Dependency/build caches can contain tens of thousands of files and are not
    # application-source evidence.  Keep ignored source backups (for example
    # src.bak) visible, but omit reproducible caches and generated outputs.
    ignored = [
        path
        for path in ignored_all
        if not any(part in {"node_modules", ".vite", "dist", "www"} for part in Path(path).parts)
    ]
    return {
        "tracked_present": present,
        "tracked_present_noncanonical_tree": [
            path
            for path in present
            if any(part in {"dist", "www", "src.bak"} for part in Path(path).parts)
        ],
        "tracked_deleted": deleted,
        "untracked_present": [path for path in untracked if (repo / path).is_file()],
        "ignored_present": [path for path in ignored if (repo / path).is_file()],
    }


def filesystem_source_files(repo: Path, app: str) -> list[str]:
    root = repo / "frontend" / app / "src"
    if not root.is_dir():
        return []
    result = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        relative = path.relative_to(repo)
        if any(part in EXCLUDED_TREE_PARTS for part in relative.parts):
            continue
        result.append(relative.as_posix())
    return sorted(result)


def source_files(paths: Iterable[str]) -> list[str]:
    return sorted(
        path
        for path in paths
        if Path(path).suffix.lower() in SOURCE_EXTENSIONS
        and "src" in Path(path).parts
        and not any(part in EXCLUDED_TREE_PARTS for part in Path(path).parts)
    )


def candidate_source_exclusion_reason(path: str) -> str | None:
    """Return the deterministic candidate-policy exclusion for a source path."""
    relative = Path(path)
    lowered_parts = tuple(part.lower() for part in relative.parts)
    if relative.suffix.lower() not in SOURCE_EXTENSIONS or "src" not in relative.parts:
        return "outside_canonical_source_extensions_or_src_tree"
    if any(part in CANDIDATE_EXCLUDED_TREE_PARTS for part in lowered_parts):
        return "excluded_legacy_generated_native_or_test_tree"
    name = relative.name.lower()
    if re.search(r"\.(?:test|spec)\.(?:[cm]?[jt]sx?)$", name):
        return "excluded_test_module"
    if name.endswith(".bak") or any(part.endswith(".bak") for part in lowered_parts):
        return "excluded_backup_artifact"
    if name.startswith(".") and "bundle" in name:
        return "excluded_generated_bundle"
    return None


def candidate_source_selection(paths: Iterable[str]) -> tuple[list[str], list[dict[str, str]]]:
    included: list[str] = []
    excluded: list[dict[str, str]] = []
    for path in sorted(set(paths)):
        reason = candidate_source_exclusion_reason(path)
        if reason:
            if Path(path).suffix.lower() in SOURCE_EXTENSIONS and "src" in Path(path).parts:
                excluded.append({"path": path, "reason": reason})
            continue
        included.append(path)
    return included, excluded


def candidate_support_file(path: str) -> bool:
    relative = Path(path)
    lowered_parts = tuple(part.lower() for part in relative.parts)
    if "src" not in relative.parts:
        return False
    if any(part in CANDIDATE_EXCLUDED_TREE_PARTS for part in lowered_parts):
        return False
    name = relative.name.lower()
    if re.search(r"\.(?:test|spec)\.(?:[cm]?[jt]sx?)$", name):
        return False
    if name.endswith(".bak") or any(part.endswith(".bak") for part in lowered_parts):
        return False
    return relative.suffix.lower() in RESOLVE_EXTENSIONS


IMPORT_PATTERN = re.compile(
    r"(?:\bimport\s*(?:[^;\n]*?\sfrom\s*)?\(?\s*|\bexport\s+[^;\n]*?\sfrom\s*)"
    r"['\"]([^'\"]+)['\"]",
    re.MULTILINE,
)


def imports_for(source: str) -> list[str]:
    clean = strip_js_comments(source)
    return sorted(set(match.group(1) for match in IMPORT_PATTERN.finditer(clean)))


def package_name(specifier: str) -> str:
    if specifier.startswith("@"):
        return "/".join(specifier.split("/")[:2])
    return specifier.split("/", 1)[0]


def candidate_module_paths(origin: str, specifier: str) -> list[str]:
    base = (Path(origin).parent / specifier).as_posix()
    candidates = [base]
    if Path(base).suffix == "":
        candidates.extend(base + extension for extension in RESOLVE_EXTENSIONS)
        candidates.extend(f"{base}/index{extension}" for extension in RESOLVE_EXTENSIONS)
    return candidates


def resolve_import(origin: str, specifier: str, known: set[str]) -> str | None:
    if not specifier.startswith("."):
        return None
    for candidate in candidate_module_paths(origin, specifier):
        normalized = os.path.normpath(candidate).replace(os.sep, "/")
        if normalized in known:
            return normalized
    return ""


def entrypoints(repo: Path, app: str, known: set[str]) -> list[str]:
    index_path = repo / "frontend" / app / "index.html"
    entries: list[str] = []
    if index_path.is_file():
        html = read_text(index_path)
        for match in re.finditer(
            r"<script[^>]+type=['\"]module['\"][^>]+src=['\"]([^'\"]+)['\"]", html
        ):
            value = match.group(1).lstrip("/")
            candidate = f"frontend/{app}/{value}"
            if candidate in known:
                entries.append(candidate)
    fallback = f"frontend/{app}/src/main.jsx"
    if not entries and fallback in known:
        entries.append(fallback)
    return sorted(set(entries))


def import_graph(
    repo: Path,
    app: str,
    files: list[str],
    tracked_support_files: set[str],
    untracked_files: set[str],
) -> dict[str, object]:
    known_source = set(files)
    known_support = set(tracked_support_files)
    entries = entrypoints(repo, app, known_source)
    graph: dict[str, list[str]] = {}
    external: set[str] = set()
    unresolved: list[dict[str, object]] = []
    for path in files:
        source = read_text(repo / path)
        resolved: list[str] = []
        for specifier in imports_for(source):
            if not specifier.startswith("."):
                external.add(package_name(specifier))
                continue
            target = resolve_import(path, specifier, known_support)
            if target in known_source:
                resolved.append(target)
        graph[path] = sorted(set(resolved))

    reachable: set[str] = set()
    queue = collections.deque(entries)
    while queue:
        current = queue.popleft()
        if current in reachable:
            continue
        reachable.add(current)
        queue.extend(graph.get(current, ()))

    for path in sorted(reachable):
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        for match in IMPORT_PATTERN.finditer(clean):
            specifier = match.group(1)
            if not specifier.startswith("."):
                continue
            if resolve_import(path, specifier, known_support):
                continue
            candidates = [
                os.path.normpath(candidate).replace(os.sep, "/")
                for candidate in candidate_module_paths(path, specifier)
            ]
            untracked_target = next((item for item in candidates if item in untracked_files), None)
            unresolved.append(
                evidence(
                    path,
                    source,
                    match.start(1),
                    specifier=specifier,
                    classification=(
                        "target_present_untracked" if untracked_target else "target_not_in_tracked_source"
                    ),
                    observed_target=untracked_target,
                )
            )
    return {
        "entrypoints": entries,
        "reachable_files": sorted(reachable),
        "unreachable_files": sorted(known_source - reachable),
        "external_import_packages": sorted(external),
        "unresolved_relative_imports_from_reachable_files": sorted(
            unresolved, key=lambda item: (item["path"], item["line"], item["specifier"])
        ),
    }


def page_inventory(repo: Path, files: list[str], reachable: set[str]) -> list[dict[str, object]]:
    pages = []
    for path in files:
        parts = Path(path).parts
        if "pages" not in parts and "screens" not in parts:
            continue
        source = read_text(repo / path)
        match = re.search(r"export\s+default\s+(?:function|class)\s+([A-Za-z_$][\w$]*)", source)
        pages.append(
            {
                "path": path,
                "component": match.group(1) if match else Path(path).stem,
                "module_class": "screen" if "screens" in parts else "page",
                "statically_reachable_from_entrypoint": path in reachable,
            }
        )
    return sorted(pages, key=lambda item: item["path"])


def route_inventory(repo: Path, files: list[str], reachable: set[str]) -> dict[str, object]:
    routes: list[dict[str, object]] = []
    nav_targets: list[dict[str, object]] = []
    host_branches: list[dict[str, object]] = []
    absolute_redirects: list[dict[str, object]] = []
    for path in files:
        if path not in reachable:
            continue
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        route_pattern = re.compile(
            r"<Route\b(?:(?!<Route\b).){0,700}?\bpath\s*=\s*['\"]([^'\"]+)['\"]",
            re.DOTALL,
        )
        for match in route_pattern.finditer(clean):
            next_route = clean.find("<Route", match.end())
            segment_end = next_route if next_route != -1 else min(len(clean), match.start() + 700)
            segment = clean[match.start() : segment_end]
            components = sorted(
                set(
                    name
                    for name in re.findall(r"<([A-Z][A-Za-z0-9_$]*)\b", segment)
                    if name not in {"Route", "Navigate"}
                )
            )
            routes.append(
                evidence(
                    path,
                    source,
                    match.start(1),
                    route=match.group(1),
                    components=components,
                    router="react-router",
                )
            )

        nav_patterns = (
            ("jsx_to", re.compile(r"<(?:Link|NavLink)\b[^>]{0,500}?\bto\s*=\s*['\"]([^'\"]+)['\"]", re.DOTALL)),
            ("navigate_call", re.compile(r"\bnavigate\(\s*['\"]([^'\"]+)['\"]")),
            ("navigation_object_to", re.compile(r"\bto\s*:\s*['\"](/[^'\"]*)['\"]")),
            ("command_path", re.compile(r"\bpath\s*:\s*['\"](/[^'\"]*)['\"]")),
            ("location_assignment", re.compile(r"(?:location\.href\s*=|location\.assign\()\s*['\"]([^'\"]+)['\"]")),
            ("panel_navigation", re.compile(r"\bgoPanel\(\s*['\"]([^'\"]+)['\"]")),
        )
        for kind, pattern in nav_patterns:
            for match in pattern.finditer(clean):
                nav_targets.append(
                    evidence(path, source, match.start(1), target=match.group(1), kind=kind)
                )

        for match in re.finditer(
            r"(?:_host|host|hostname)\s*===\s*['\"]([^'\"]+)['\"]\s*\)?\s*return\s*<([A-Z][\w$]*)",
            clean,
        ):
            host_branches.append(
                evidence(
                    path,
                    source,
                    match.start(1),
                    host_prefix=match.group(1),
                    component=match.group(2),
                )
            )
        for match in re.finditer(
            r"\blocation\.(?:replace|assign)\(\s*['\"](https?://[^'\"]+)['\"]", clean
        ):
            value = match.group(1)
            absolute_redirects.append(
                evidence(
                    path,
                    source,
                    match.start(1),
                    url=value,
                    host=(urlparse(value).hostname or "").lower(),
                )
            )

    route_names = {str(item["route"]) for item in routes}
    for item in nav_targets:
        target = str(item["target"]).split("?", 1)[0].split("#", 1)[0]
        if item["kind"] == "panel_navigation":
            # goPanel() in the canonical ProChart source prepends a configured
            # user-panel origin; these paths are not same-router declarations.
            item["route_match"] = "external_host_path_via_panel_base"
        elif not target.startswith("/"):
            item["route_match"] = "external_or_non_route"
        elif target in route_names:
            item["route_match"] = "declared_exact"
        elif any(route != "*" and ":" in route and route.split(":", 1)[0] in target for route in route_names):
            item["route_match"] = "declared_parameterized_candidate"
        elif "*" in route_names:
            item["route_match"] = "falls_through_wildcard_not_declared"
        else:
            item["route_match"] = "not_declared_in_reachable_router"

    deduped_targets: dict[tuple[object, ...], dict[str, object]] = {}
    for item in nav_targets:
        key = (item["path"], item["line"], item["target"], item["kind"])
        deduped_targets[key] = item
    return {
        "declared_routes": sorted(routes, key=lambda item: (item["route"], item["path"], item["line"])),
        "navigation_targets": sorted(
            deduped_targets.values(), key=lambda item: (item["target"], item["path"], item["line"])
        ),
        "host_conditional_branches": sorted(
            host_branches, key=lambda item: (item["host_prefix"], item["path"], item["line"])
        ),
        "absolute_host_redirects": sorted(
            absolute_redirects, key=lambda item: (item["host"], item["path"], item["line"])
        ),
    }


def balanced_end(source: str, start: int, opening: str, closing: str) -> int | None:
    """Find a balanced JS delimiter while ignoring quoted string contents."""
    if start < 0 or start >= len(source) or source[start] != opening:
        return None
    depth = 0
    quote = ""
    index = start
    while index < len(source):
        char = source[index]
        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = ""
        elif char in ("'", '"', "`"):
            quote = char
        elif char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return index
        index += 1
    return None


def split_top_level_entries(source: str, start: int, end: int) -> list[tuple[str, int]]:
    entries: list[tuple[str, int]] = []
    quote = ""
    depths = {"(": 0, "[": 0, "{": 0}
    closing_to_opening = {")": "(", "]": "[", "}": "{"}
    item_start = start
    index = start
    while index < end:
        char = source[index]
        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = ""
        elif char in ("'", '"', "`"):
            quote = char
        elif char in depths:
            depths[char] += 1
        elif char in closing_to_opening:
            opening = closing_to_opening[char]
            depths[opening] = max(0, depths[opening] - 1)
        elif char == "," and not any(depths.values()):
            value = source[item_start:index].strip()
            if value:
                offset = item_start + len(source[item_start:index]) - len(source[item_start:index].lstrip())
                entries.append((value, offset))
            item_start = index + 1
        index += 1
    value = source[item_start:end].strip()
    if value:
        offset = item_start + len(source[item_start:end]) - len(source[item_start:end].lstrip())
        entries.append((value, offset))
    return entries


def static_array_entries(source: str, identifier: str) -> list[tuple[str, int]]:
    pattern = re.compile(rf"\b(?:export\s+)?const\s+{re.escape(identifier)}\s*=")
    result: list[tuple[str, int]] = []
    for match in pattern.finditer(source):
        bracket = source.find("[", match.end(), min(len(source), match.end() + 240))
        if bracket == -1:
            continue
        end = balanced_end(source, bracket, "[", "]")
        if end is not None:
            result.extend(split_top_level_entries(source, bracket + 1, end))
    return result


STATIC_PROPERTY_PATTERN = re.compile(
    r"(?:^|[,\{]\s*)"
    r"(?P<key>[A-Za-z_$][\w$]*)\s*:\s*"
    r"(?P<value>"
    r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|`(?:\\.|[^`\\])*`|"
    r"true|false|null|"
    r"PANEL_ROUTES(?:\.[A-Za-z_$][\w$]*|\[\s*['\"][^'\"]+['\"]\s*\])"
    r")",
    re.MULTILINE,
)


def static_object_properties(entry: str) -> dict[str, str]:
    start = entry.find("{")
    if start == -1:
        return {}
    end = balanced_end(entry, start, "{", "}")
    if end is None:
        return {}
    body = entry[start : end + 1]
    return {
        match.group("key"): match.group("value")
        for match in STATIC_PROPERTY_PATTERN.finditer(body)
    }


def static_literal(value: str | None) -> object | None:
    if value is None:
        return None
    if value == "true":
        return True
    if value == "false":
        return False
    if value == "null":
        return None
    if value.startswith("`") and value.endswith("`") and "${" not in value:
        return value[1:-1]
    if value[:1] in {"'", '"'}:
        try:
            return ast.literal_eval(value)
        except (SyntaxError, ValueError):
            return None
    return None


def panel_route_key(expression: str) -> str | None:
    dotted = re.fullmatch(r"PANEL_ROUTES\.([A-Za-z_$][\w$]*)", expression)
    if dotted:
        return dotted.group(1)
    bracketed = re.fullmatch(
        r"PANEL_ROUTES\[\s*(['\"])([^'\"]+)\1\s*\]", expression
    )
    return bracketed.group(2) if bracketed else None


def resolve_static_route(expression: str | None, panel_routes: dict[str, str]) -> str | None:
    literal = static_literal(expression)
    if isinstance(literal, str):
        return literal
    if expression:
        key = panel_route_key(expression)
        if key:
            return panel_routes.get(key)
    return None


def direct_panel_route_object(source: str) -> dict[str, str]:
    pattern = re.compile(
        r"\b(?:export\s+)?const\s+PANEL_ROUTES\s*=\s*(?:Object\.freeze\(\s*)?\{"
    )
    match = pattern.search(source)
    if not match:
        return {}
    start = source.find("{", match.start(), match.end())
    end = balanced_end(source, start, "{", "}")
    if end is None:
        return {}
    result: dict[str, str] = {}
    for key, raw in static_object_properties(source[start : end + 1]).items():
        value = static_literal(raw)
        if isinstance(value, str):
            result[key] = value
    return result


def collect_route_registries(
    repo: Path, files: list[str]
) -> tuple[dict[str, str], dict[str, list[dict[str, object]]]]:
    registry_names = (
        "PUBLIC_PANEL_ROUTES",
        "PROTECTED_PANEL_ROUTES",
        "LEGACY_PANEL_REDIRECTS",
    )
    registries: dict[str, list[dict[str, object]]] = {
        name: [] for name in registry_names
    }
    panel_routes: dict[str, str] = {}
    for path in files:
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        panel_routes.update(direct_panel_route_object(clean))
        for name in registry_names:
            for entry, offset in static_array_entries(clean, name):
                registries[name].append(
                    {
                        "properties": static_object_properties(entry),
                        "path": path,
                        "offset": offset,
                    }
                )

    for name in ("PUBLIC_PANEL_ROUTES", "PROTECTED_PANEL_ROUTES"):
        for record in registries[name]:
            properties = record["properties"]
            identifier = static_literal(properties.get("id"))
            route = resolve_static_route(properties.get("path"), panel_routes)
            if isinstance(identifier, str) and route and "*" not in route:
                panel_routes[identifier] = route
    return panel_routes, registries


def add_source_provenance(
    item: dict[str, object], provenance_by_path: dict[str, str]
) -> dict[str, object]:
    result = dict(item)
    path = str(result.get("path", ""))
    result["source_provenance"] = provenance_by_path.get(path, "unknown")
    return result


def candidate_command_inventory(
    repo: Path,
    files: list[str],
    panel_routes: dict[str, str],
    provenance_by_path: dict[str, str],
) -> tuple[list[dict[str, object]], list[dict[str, object]], list[dict[str, object]]]:
    actionable: list[dict[str, object]] = []
    audit_metadata: list[dict[str, object]] = []
    resolution_issues: list[dict[str, object]] = []
    declaration_pattern = re.compile(
        r"\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]*COMMANDS)\s*="
    )
    for path in files:
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        for declaration in declaration_pattern.finditer(clean):
            name = declaration.group(1)
            for entry, offset in static_array_entries(clean, name):
                properties = static_object_properties(entry)
                if not properties:
                    continue
                stripped = entry.lstrip()
                helper_disabled = stripped.startswith("unavailableCommand(")
                helper_enabled = stripped.startswith("enabledCommand(")
                explicit_enabled = static_literal(properties.get("enabled"))
                enabled = helper_enabled or (
                    not helper_disabled and explicit_enabled is not False
                )
                identifier = static_literal(properties.get("id"))
                identifier = identifier if isinstance(identifier, str) else None
                route = resolve_static_route(properties.get("path"), panel_routes)
                previous = resolve_static_route(properties.get("previousPath"), panel_routes)
                reason = static_literal(properties.get("unavailableReason"))

                if enabled and route:
                    actionable.append(
                        add_source_provenance(
                            evidence(
                                path,
                                source,
                                offset,
                                target=route,
                                kind="enabled_command_path",
                                command_id=identifier,
                            ),
                            provenance_by_path,
                        )
                    )
                elif enabled and properties.get("path"):
                    resolution_issues.append(
                        add_source_provenance(
                            evidence(
                                path,
                                source,
                                offset,
                                command_id=identifier,
                                expression=properties["path"],
                                classification="enabled_command_path_not_statically_resolved",
                            ),
                            provenance_by_path,
                        )
                    )

                if helper_disabled or explicit_enabled is False:
                    former_target = previous or route
                    audit_metadata.append(
                        add_source_provenance(
                            evidence(
                                path,
                                source,
                                offset,
                                command_id=identifier,
                                metadata_kind="disabled_command",
                                former_target=former_target,
                                unavailable_reason=(reason if isinstance(reason, str) else None),
                                actionable=False,
                            ),
                            provenance_by_path,
                        )
                    )
                elif previous:
                    audit_metadata.append(
                        add_source_provenance(
                            evidence(
                                path,
                                source,
                                offset,
                                command_id=identifier,
                                metadata_kind="previous_path",
                                former_target=previous,
                                unavailable_reason=None,
                                actionable=False,
                            ),
                            provenance_by_path,
                        )
                    )
    return actionable, audit_metadata, resolution_issues


def candidate_route_inventory(
    repo: Path,
    files: list[str],
    reachable: set[str],
    provenance_by_path: dict[str, str],
) -> dict[str, object]:
    reachable_files = sorted(path for path in files if path in reachable)
    panel_routes, registries = collect_route_registries(repo, reachable_files)
    routes: list[dict[str, object]] = []
    wildcard_fallbacks: list[dict[str, object]] = []
    nav_targets: list[dict[str, object]] = []
    registry_issues: list[dict[str, object]] = []

    def record_route(
        route: str,
        path: str,
        source: str,
        offset: int,
        **values: object,
    ) -> None:
        item = add_source_provenance(
            evidence(path, source, offset, route=route, router="react-router", **values),
            provenance_by_path,
        )
        if "*" in route:
            item["support_semantics"] = "fallback_only_not_declared_support"
            wildcard_fallbacks.append(item)
        else:
            item["support_semantics"] = "explicit_non_wildcard_declaration"
            routes.append(item)

    literal_route_pattern = re.compile(
        r"<Route\b(?:(?!<Route\b).){0,700}?\bpath\s*=\s*['\"]([^'\"]+)['\"]",
        re.DOTALL,
    )
    panel_reference_pattern = (
        r"PANEL_ROUTES(?:\.[A-Za-z_$][\w$]*|\[\s*['\"][^'\"]+['\"]\s*\])"
    )

    for path in reachable_files:
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        for match in literal_route_pattern.finditer(clean):
            record_route(
                match.group(1),
                path,
                source,
                match.start(1),
                declaration_kind="literal_jsx_route",
            )
        expression_route_pattern = re.compile(
            rf"<Route\b(?:(?!<Route\b).){{0,700}}?\bpath\s*=\s*\{{\s*({panel_reference_pattern})\s*\}}",
            re.DOTALL,
        )
        for match in expression_route_pattern.finditer(clean):
            route = resolve_static_route(match.group(1), panel_routes)
            if route:
                record_route(
                    route,
                    path,
                    source,
                    match.start(1),
                    declaration_kind="static_route_registry_expression",
                    expression=match.group(1),
                )
            else:
                registry_issues.append(
                    add_source_provenance(
                        evidence(
                            path,
                            source,
                            match.start(1),
                            registry="PANEL_ROUTES",
                            expression=match.group(1),
                            classification="route_registry_expression_not_statically_resolved",
                        ),
                        provenance_by_path,
                    )
                )

        for registry_name, records in registries.items():
            for map_match in re.finditer(rf"\b{re.escape(registry_name)}\.map\(", clean):
                segment = clean[map_match.start() : min(len(clean), map_match.start() + 1800)]
                destructure = re.search(r"\.map\(\s*\(\s*\{([^}]*)\}", segment)
                route_use = re.search(
                    r"<Route\b(?:(?!<Route\b).){0,900}?\bpath\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}",
                    segment,
                    re.DOTALL,
                )
                if not destructure or not route_use:
                    registry_issues.append(
                        add_source_provenance(
                            evidence(
                                path,
                                source,
                                map_match.start(),
                                registry=registry_name,
                                classification="registry_map_route_shape_not_statically_recognized",
                            ),
                            provenance_by_path,
                        )
                    )
                    continue
                fields = {
                    item.strip().split(":", 1)[0].strip()
                    for item in destructure.group(1).split(",")
                    if item.strip()
                }
                route_field = route_use.group(1)
                if route_field not in fields:
                    continue
                if not records:
                    registry_issues.append(
                        add_source_provenance(
                            evidence(
                                path,
                                source,
                                map_match.start(),
                                registry=registry_name,
                                classification="mapped_route_registry_definition_not_reachable",
                            ),
                            provenance_by_path,
                        )
                    )
                    continue
                for record in records:
                    raw = record["properties"].get(route_field)
                    route = resolve_static_route(raw, panel_routes)
                    if not route:
                        registry_issues.append(
                            add_source_provenance(
                                evidence(
                                    path,
                                    source,
                                    map_match.start(),
                                    registry=registry_name,
                                    registry_record_id=static_literal(
                                        record["properties"].get("id")
                                    ),
                                    expression=raw,
                                    classification="mapped_route_value_not_statically_resolved",
                                ),
                                provenance_by_path,
                            )
                        )
                        continue
                    record_route(
                        route,
                        path,
                        source,
                        map_match.start(),
                        declaration_kind="imported_static_registry_map",
                        registry=registry_name,
                        registry_record_id=static_literal(record["properties"].get("id")),
                        registry_source_path=record["path"],
                        registry_source_provenance=provenance_by_path.get(
                            str(record["path"]), "unknown"
                        ),
                    )

        literal_nav_patterns = (
            (
                "jsx_to",
                re.compile(
                    r"<(?:Link|NavLink|Navigate)\b[^>]{0,500}?\bto\s*=\s*['\"]([^'\"]+)['\"]",
                    re.DOTALL,
                ),
            ),
            ("navigate_call", re.compile(r"\bnavigate\(\s*['\"]([^'\"]+)['\"]")),
            ("navigation_object_to", re.compile(r"\bto\s*:\s*['\"](/[^'\"]*)['\"]")),
            (
                "location_assignment",
                re.compile(
                    r"(?:location\.href\s*=|location\.assign\()\s*['\"]([^'\"]+)['\"]"
                ),
            ),
            ("panel_navigation", re.compile(r"\bgoPanel\(\s*['\"]([^'\"]+)['\"]")),
        )
        for kind, pattern in literal_nav_patterns:
            for match in pattern.finditer(clean):
                nav_targets.append(
                    add_source_provenance(
                        evidence(
                            path,
                            source,
                            match.start(1),
                            target=match.group(1),
                            kind=kind,
                        ),
                        provenance_by_path,
                    )
                )

        expression_nav_patterns = (
            (
                "jsx_to_static_registry",
                re.compile(
                    rf"<(?:Link|NavLink|Navigate)\b[^>]{{0,500}}?\bto\s*=\s*\{{\s*({panel_reference_pattern})\s*\}}",
                    re.DOTALL,
                ),
            ),
            (
                "navigate_static_registry",
                re.compile(rf"\bnavigate\(\s*({panel_reference_pattern})\s*\)"),
            ),
            (
                "navigation_object_to_static_registry",
                re.compile(rf"\bto\s*:\s*({panel_reference_pattern})"),
            ),
        )
        for kind, pattern in expression_nav_patterns:
            for match in pattern.finditer(clean):
                target = resolve_static_route(match.group(1), panel_routes)
                if target:
                    nav_targets.append(
                        add_source_provenance(
                            evidence(
                                path,
                                source,
                                match.start(1),
                                target=target,
                                kind=kind,
                                expression=match.group(1),
                            ),
                            provenance_by_path,
                        )
                    )

    command_targets, command_audit, command_issues = candidate_command_inventory(
        repo, reachable_files, panel_routes, provenance_by_path
    )
    nav_targets.extend(command_targets)
    registry_issues.extend(command_issues)

    deduped_routes: dict[tuple[object, ...], dict[str, object]] = {}
    for item in routes:
        key = (
            item["route"],
            item["path"],
            item["line"],
            item.get("declaration_kind"),
            item.get("registry_record_id"),
        )
        deduped_routes[key] = item
    routes = list(deduped_routes.values())
    route_names = {str(item["route"]) for item in routes if "*" not in str(item["route"])}

    for item in nav_targets:
        target = str(item["target"]).split("?", 1)[0].split("#", 1)[0]
        if item["kind"] == "panel_navigation":
            item["route_match"] = "external_host_path_via_panel_base"
        elif not target.startswith("/"):
            item["route_match"] = "external_or_non_route"
        elif target in route_names:
            item["route_match"] = "declared_exact"
        elif any(
            ":" in route and route.split(":", 1)[0] in target
            for route in route_names
        ):
            item["route_match"] = "declared_parameterized_candidate"
        else:
            item["route_match"] = "not_declared_in_candidate_router"

    deduped_targets: dict[tuple[object, ...], dict[str, object]] = {}
    for item in nav_targets:
        key = (item["path"], item["line"], item["target"], item["kind"])
        deduped_targets[key] = item

    return {
        "declared_routes": sorted(
            routes,
            key=lambda item: (
                item["route"],
                item["path"],
                item["line"],
                str(item.get("registry_record_id", "")),
            ),
        ),
        "wildcard_fallbacks_not_support": sorted(
            wildcard_fallbacks,
            key=lambda item: (item["path"], item["line"], item["route"]),
        ),
        "navigation_targets": sorted(
            deduped_targets.values(),
            key=lambda item: (item["target"], item["path"], item["line"], item["kind"]),
        ),
        "non_actionable_command_metadata": sorted(
            command_audit,
            key=lambda item: (
                str(item.get("former_target", "")),
                item["path"],
                item["line"],
                str(item.get("command_id", "")),
            ),
        ),
        "static_resolution_issues": sorted(
            registry_issues,
            key=lambda item: (
                item["path"],
                item["line"],
                str(item.get("classification", "")),
            ),
        ),
    }


def extract_jsx_tags(source: str) -> list[tuple[str, str, int, int]]:
    clean = strip_js_comments(source)
    result: list[tuple[str, str, int, int]] = []
    start_pattern = re.compile(
        r"<(button|input|textarea|select|a|Link|NavLink|div|span|li|tr|section|article)\b"
    )
    for match in start_pattern.finditer(clean):
        index = match.end()
        quote = ""
        braces = 0
        while index < len(clean):
            char = clean[index]
            if quote:
                if char == "\\":
                    index += 2
                    continue
                if char == quote:
                    quote = ""
            elif char in ("'", '"', "`"):
                quote = char
            elif char == "{":
                braces += 1
            elif char == "}":
                braces = max(0, braces - 1)
            elif char == ">" and braces == 0:
                result.append((match.group(1), clean[match.start() : index + 1], match.start(), index + 1))
                break
            index += 1
    return result


def attribute_literal(attrs: str, name: str) -> str | None:
    match = re.search(rf"\b{re.escape(name)}\s*=\s*['\"]([^'\"]*)['\"]", attrs)
    return match.group(1) if match else None


def visible_label(source: str, tag: str, attrs: str, end: int) -> str | None:
    for attribute in ("aria-label", "title", "placeholder", "alt"):
        value = attribute_literal(attrs, attribute)
        if value:
            return value[:120]
    if tag in {"input", "textarea", "select"}:
        return None
    closing = source.find(f"</{tag}>", end)
    if closing == -1 or closing - end > 500:
        return None
    body = source[end:closing]
    body = re.sub(r"<[^>]+>", " ", body)
    body = re.sub(r"\{[^{}]*\}", " ", body)
    body = re.sub(r"\s+", " ", body).strip()
    return body[:120] or None


def controls_inventory(repo: Path, files: list[str], reachable: set[str]) -> dict[str, object]:
    controls: list[dict[str, object]] = []
    event_handlers: list[dict[str, object]] = []
    empty_handlers: list[dict[str, object]] = []
    placeholder_candidates: list[dict[str, object]] = []
    for path in files:
        if path not in reachable:
            continue
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        for tag, attrs, start, end in extract_jsx_tags(source):
            handlers = sorted(set(re.findall(r"\b(on[A-Z][A-Za-z]+)\s*=", attrs)))
            semantic_role = attribute_literal(attrs, "role")
            generic_interactive = tag in {"div", "span", "li", "tr", "section", "article"}
            if generic_interactive and not handlers and semantic_role not in {
                "button",
                "link",
                "menuitem",
                "option",
                "switch",
                "tab",
            }:
                continue
            native = False
            if tag == "a":
                native = bool(
                    attribute_literal(attrs, "href") or re.search(r"\bhref\s*=\s*\{", attrs)
                )
            elif tag in {"Link", "NavLink"}:
                native = bool(attribute_literal(attrs, "to") or re.search(r"\bto\s*=\s*\{", attrs))
            elif tag == "button":
                native = (attribute_literal(attrs, "type") or "").lower() in {"submit", "reset"}
            elif tag in {"input", "textarea", "select"}:
                native = True
            disabled_or_readonly = bool(re.search(r"\b(?:disabled|readOnly)\b", attrs))
            spread = bool(re.search(r"\{\.\.\.", attrs))
            if handlers:
                binding = "explicit_event_handler"
            elif native:
                binding = "native_semantics_or_destination"
            elif disabled_or_readonly:
                binding = "disabled_or_readonly"
            elif spread:
                binding = "manual_review_props_spread"
            else:
                binding = "manual_review_no_static_binding"
            controls.append(
                evidence(
                    path,
                    source,
                    start,
                    tag=tag,
                    label=visible_label(source, tag, attrs, end),
                    event_handlers=handlers,
                    semantic_role=semantic_role,
                    binding_classification=binding,
                )
            )
        for match in re.finditer(r"\b(on[A-Z][A-Za-z]+)\s*=", clean):
            event_handlers.append(
                evidence(path, source, match.start(1), handler_attribute=match.group(1))
            )
        empty_pattern = re.compile(
            r"\b(on[A-Z][A-Za-z]+)\s*=\s*\{\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*"
            r"(?:\{\s*\}|(?:undefined|null))\s*\}"
        )
        for match in empty_pattern.finditer(clean):
            empty_handlers.append(
                evidence(path, source, match.start(1), handler_attribute=match.group(1))
            )
        placeholder_pattern = re.compile(
            r"(?:TODO|FIXME|coming\s+soon|not\s+implemented|به.?زودی|در\s+آینده)",
            re.IGNORECASE,
        )
        for match in placeholder_pattern.finditer(clean):
            placeholder_candidates.append(
                evidence(path, source, match.start(), matched=match.group(0))
            )

    return {
        "controls": sorted(controls, key=lambda item: (item["path"], item["line"], item["tag"])),
        "event_handler_attributes": sorted(
            event_handlers, key=lambda item: (item["path"], item["line"], item["handler_attribute"])
        ),
        "empty_inline_handler_candidates": sorted(
            empty_handlers, key=lambda item: (item["path"], item["line"])
        ),
        "placeholder_text_candidates": sorted(
            placeholder_candidates, key=lambda item: (item["path"], item["line"])
        ),
    }


def component_surfaces(repo: Path, files: list[str], reachable: set[str]) -> dict[str, object]:
    dialogs: list[dict[str, object]] = []
    menus: list[dict[str, object]] = []
    tabs: list[dict[str, object]] = []
    for path in files:
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        reachable_flag = path in reachable
        stem = Path(path).stem
        dialog_signals = []
        if re.search(r"(?:Modal|Dialog|Drawer|Popover|Sheet)", stem, re.IGNORECASE):
            dialog_signals.append("filename")
        if re.search(r"\brole\s*=\s*['\"](?:dialog|alertdialog)['\"]", clean):
            dialog_signals.append("aria_role")
        if re.search(r"\baria-modal\s*=", clean):
            dialog_signals.append("aria_modal")
        if dialog_signals:
            dialogs.append(
                {
                    "path": path,
                    "component": stem,
                    "signals": sorted(dialog_signals),
                    "statically_reachable_from_entrypoint": reachable_flag,
                }
            )
        menu_signals = []
        if re.search(r"(?:Menu|ContextMenu|Palette)", stem, re.IGNORECASE):
            menu_signals.append("filename")
        if re.search(r"\brole\s*=\s*['\"]menu(?:item)?['\"]", clean):
            menu_signals.append("aria_role")
        if re.search(r"\bonContextMenu\s*=", clean):
            menu_signals.append("context_handler")
        if menu_signals:
            menus.append(
                {
                    "path": path,
                    "component": stem,
                    "signals": sorted(menu_signals),
                    "statically_reachable_from_entrypoint": reachable_flag,
                }
            )
        tab_patterns = (
            re.compile(r"\b(tab|section|activeTab|active_tab|view)\s*===\s*['\"]([^'\"]+)['\"]"),
            re.compile(r"['\"]([^'\"]+)['\"]\s*===\s*\b(tab|section|activeTab|active_tab|view)\b"),
        )
        for pattern_index, pattern in enumerate(tab_patterns):
            for match in pattern.finditer(clean):
                if pattern_index == 0:
                    variable, value = match.group(1), match.group(2)
                else:
                    value, variable = match.group(1), match.group(2)
                item = evidence(
                    path,
                    source,
                    match.start(),
                    state_variable=variable,
                    value=value,
                    statically_reachable_from_entrypoint=reachable_flag,
                )
                tabs.append(item)
    unique_tabs: dict[tuple[object, ...], dict[str, object]] = {}
    for item in tabs:
        key = (item["path"], item["line"], item["state_variable"], item["value"])
        unique_tabs[key] = item
    return {
        "dialogs_modals_drawers": sorted(dialogs, key=lambda item: item["path"]),
        "menus_context_menus_palettes": sorted(menus, key=lambda item: item["path"]),
        "tab_state_occurrences": sorted(
            unique_tabs.values(),
            key=lambda item: (item["state_variable"], item["value"], item["path"], item["line"]),
        ),
    }


STATE_PATTERNS = {
    "loading": re.compile(r"\b(?:isLoading|loading|pending|isPending|Skeleton|Spinner)\b|بارگذاری", re.I),
    "empty": re.compile(r"\b(?:EmptyState|empty|noResults)\b|length\s*===\s*0|یافت\s+نشد|خالی", re.I),
    "error": re.compile(r"\b(?:isError|error|ErrorBoundary|catch)\b|خطا", re.I),
    "offline": re.compile(r"\b(?:offline|navigator\.onLine|online)\b|آفلاین", re.I),
    "retry_reconnect": re.compile(r"\b(?:retry|retries|refetch|reload|reconnect|controllerchange)\b|تلاش.?مجدد", re.I),
    "permission_denied": re.compile(r"\b(?:permission|denied|forbidden|unauthori[sz]ed|403)\b|دسترسی", re.I),
}


def states_shortcuts_storage_flags(
    repo: Path, files: list[str], reachable: set[str]
) -> dict[str, object]:
    states: list[dict[str, object]] = []
    shortcuts: list[dict[str, object]] = []
    storage: list[dict[str, object]] = []
    flags: list[dict[str, object]] = []
    retry_configuration: list[dict[str, object]] = []
    for path in files:
        if path not in reachable:
            continue
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        for category, pattern in STATE_PATTERNS.items():
            for match in pattern.finditer(clean):
                states.append(
                    evidence(path, source, match.start(), category=category, matched=match.group(0))
                )
        keyboard_patterns = (
            ("listener", re.compile(r"addEventListener\(\s*['\"]key(?:down|up|press)['\"]")),
            ("react_handler", re.compile(r"\bonKey(?:Down|Up|Press)\s*=")),
            ("key_comparison", re.compile(r"\b(?:e|event|ev)\.key\s*={2,3}\s*['\"]([^'\"]+)['\"]")),
            ("key_code", re.compile(r"\b(?:e|event|ev)\.(?:code|keyCode|which)\b")),
        )
        for kind, pattern in keyboard_patterns:
            for match in pattern.finditer(clean):
                shortcuts.append(
                    evidence(
                        path,
                        source,
                        match.start(),
                        kind=kind,
                        key=(match.group(1) if match.lastindex else None),
                    )
                )
        storage_pattern = re.compile(
            r"\b(localStorage|sessionStorage)\.(getItem|setItem|removeItem|clear)\s*\(\s*"
            r"(?:(['\"])(.*?)\3)?"
        )
        for match in storage_pattern.finditer(clean):
            storage.append(
                evidence(
                    path,
                    source,
                    match.start(),
                    store=match.group(1),
                    operation=match.group(2),
                    literal_key=match.group(4),
                )
            )
        for kind, pattern in (
            ("cookie", re.compile(r"\bdocument\.cookie\b")),
            ("indexeddb", re.compile(r"\bindexedDB\b")),
            ("cache_storage", re.compile(r"\bcaches\.(?:open|match|delete)\b")),
        ):
            for match in pattern.finditer(clean):
                storage.append(
                    evidence(path, source, match.start(), store=kind, operation="reference", literal_key=None)
                )
        for match in re.finditer(r"\b(?:import\.meta\.env|process\.env)\.([A-Z][A-Z0-9_]*)", clean):
            flags.append(
                evidence(path, source, match.start(), category="environment", name=match.group(1))
            )
        entitlement_pattern = re.compile(
            r"\b(isPremium|premium|vip|panel_allowed|isAuthenticated|permission|entitlement|"
            r"subscription|tier|plan|allowed|role)\b",
            re.I,
        )
        for match in entitlement_pattern.finditer(clean):
            flags.append(
                evidence(
                    path,
                    source,
                    match.start(),
                    category="entitlement_or_auth_candidate",
                    name=match.group(1),
                )
            )
        for match in re.finditer(r"\b(?:retry|retries)\s*:\s*([^,}\n]+)", clean, re.I):
            retry_configuration.append(
                evidence(
                    path,
                    source,
                    match.start(),
                    configured_value=re.sub(r"\s+", " ", match.group(1)).strip()[:100],
                )
            )
    return {
        "state_evidence": sorted(
            states, key=lambda item: (item["category"], item["path"], item["line"])
        ),
        "keyboard_shortcut_evidence": sorted(
            shortcuts, key=lambda item: (item["path"], item["line"], item["kind"])
        ),
        "browser_storage_evidence": sorted(
            storage, key=lambda item: (item["store"], item["path"], item["line"])
        ),
        "feature_flag_entitlement_evidence": sorted(
            flags, key=lambda item: (item["category"], str(item["name"]).lower(), item["path"], item["line"])
        ),
        "explicit_retry_configuration": sorted(
            retry_configuration, key=lambda item: (item["path"], item["line"])
        ),
    }


def tracked_license_files(repo: Path) -> list[str]:
    result = []
    for path in git_paths(repo, "ls-files"):
        name = Path(path).name.lower()
        if re.match(r"^(?:license|licence|copying|notice)(?:\.|$)", name) and (repo / path).is_file():
            result.append(path)
    return sorted(result)


def license_for_asset(asset: str, licenses: list[str]) -> list[str]:
    asset_parts = Path(asset).parts
    candidates = []
    for license_path in licenses:
        license_parts = Path(license_path).parts
        common = os.path.commonpath([str(Path(*asset_parts[:-1])), str(Path(*license_parts[:-1]))])
        if common not in ("", "."):
            candidates.append(license_path)
    return sorted(candidates)


def asset_inventory(
    repo: Path, app: str, tracked_present: list[str], licenses: list[str]
) -> dict[str, object]:
    assets = []
    for path in tracked_present:
        if any(part in {"dist", "www", "src.bak"} for part in Path(path).parts):
            continue
        suffix = Path(path).suffix.lower()
        if suffix not in ASSET_EXTENSIONS:
            continue
        lowered = path.lower()
        if "crypto-icons" in lowered:
            provenance_class = "third_party_candidate_crypto_icon"
        elif "/partners/" in lowered:
            provenance_class = "third_party_brand_logo"
        elif "/fonts/" in lowered:
            provenance_class = "third_party_candidate_font"
        elif "/assets/" in lowered or "/res/" in lowered:
            provenance_class = "product_asset_or_generated_variant"
        else:
            provenance_class = "unclassified_visible_asset_candidate"
        license_evidence = license_for_asset(path, licenses)
        assets.append(
            {
                "path": path,
                "kind": ASSET_EXTENSIONS[suffix],
                "bytes": (repo / path).stat().st_size,
                "sha256": sha256_file(repo / path),
                "provenance_class": provenance_class,
                "tracked_license_evidence": license_evidence,
                "license_status": "evidence_present" if license_evidence else "no_tracked_license_evidence",
            }
        )
    groups: dict[tuple[str, str], list[dict[str, object]]] = collections.defaultdict(list)
    for item in assets:
        relative = Path(str(item["path"]))
        group = "/".join(relative.parts[:4]) if len(relative.parts) >= 4 else str(relative.parent)
        groups[(group, str(item["provenance_class"]))].append(item)
    summary = []
    for (group, provenance), items in sorted(groups.items()):
        summary.append(
            {
                "group": group,
                "provenance_class": provenance,
                "count": len(items),
                "bytes": sum(int(item["bytes"]) for item in items),
                "without_tracked_license_evidence": sum(
                    item["license_status"] == "no_tracked_license_evidence" for item in items
                ),
            }
        )
    return {"items": sorted(assets, key=lambda item: item["path"]), "groups": summary}


def third_party_references(
    repo: Path, files: list[str], reachable: set[str]
) -> dict[str, object]:
    urls: list[dict[str, object]] = []
    brands: list[dict[str, object]] = []
    for path in files:
        if path not in reachable:
            continue
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        for match in re.finditer(r"https?://[^\s'\"`<>)]+", clean):
            value = match.group(0).rstrip(".,;}")
            host = (urlparse(value).hostname or "").lower()
            urls.append(
                evidence(path, source, match.start(), url=value, host=host, visibility="source_reference_only")
            )
        brand_pattern = re.compile(r"\b(" + "|".join(re.escape(item) for item in BRAND_TERMS) + r")\b", re.I)
        for match in brand_pattern.finditer(clean):
            brands.append(
                evidence(
                    path,
                    source,
                    match.start(),
                    brand=match.group(1),
                    visibility="reachable_source_reference_not_runtime_proof",
                )
            )
    unique_urls: dict[tuple[object, ...], dict[str, object]] = {}
    for item in urls:
        unique_urls[(item["path"], item["line"], item["url"])] = item
    unique_brands: dict[tuple[object, ...], dict[str, object]] = {}
    for item in brands:
        unique_brands[(item["path"], item["line"], str(item["brand"]).lower())] = item
    return {
        "external_urls": sorted(
            unique_urls.values(), key=lambda item: (item["host"], item["path"], item["line"])
        ),
        "brand_provider_term_occurrences": sorted(
            unique_brands.values(),
            key=lambda item: (str(item["brand"]).lower(), item["path"], item["line"]),
        ),
    }


def nginx_hosts(repo: Path, config_path: str) -> list[str]:
    path = repo / config_path
    if not path.is_file():
        return []
    hosts = []
    source = re.sub(r"#.*$", "", read_text(path), flags=re.MULTILINE)
    for match in re.finditer(r"\bserver_name\s+([^;]+);", source):
        for value in match.group(1).split():
            if value != "_" and not value.startswith("$"):
                hosts.append(value)
    return sorted(set(hosts))


def host_deployment_inventory(repo: Path, app: str, compose_text: str) -> dict[str, object]:
    context = EXPECTED_BUILD_CONTEXTS[app]
    context_declared = bool(re.search(rf"\bcontext\s*:\s*{re.escape(context)}\s*$", compose_text, re.M))
    configs = []
    for config in HOST_CONFIGS[app]:
        tracked = bool(run_git(repo, "ls-files", "--error-unmatch", "--", config, check=False))
        present = (repo / config).is_file()
        compose_mounted = config in compose_text
        configs.append(
            {
                "path": config,
                "tracked": tracked,
                "present": present,
                "mounted_by_canonical_compose_literal": compose_mounted,
                "server_names": nginx_hosts(repo, config),
            }
        )
    return {
        "expected_build_context": context,
        "build_context_declared_in_canonical_compose": context_declared,
        "host_configs": configs,
    }


def removal_and_ignore(repo: Path, app: str) -> dict[str, object]:
    probe = f"frontend/{app}/src/App.jsx"
    removal = run_git(
        repo,
        "log",
        "-1",
        "--diff-filter=D",
        "--format=%H%x09%cs%x09%s",
        "--",
        probe,
        check=False,
    ).strip()
    ignore = run_git(repo, "check-ignore", "-v", "--", probe, check=False).strip()
    removal_data = None
    if removal:
        parts = removal.split("\t", 2)
        removal_data = {
            "commit": parts[0],
            "date": parts[1] if len(parts) > 1 else None,
            "subject": parts[2] if len(parts) > 2 else None,
        }
    ignore_data = None
    if ignore:
        match = re.match(r"(.+?):(\d+):([^\t]+)\t(.+)", ignore)
        if match:
            ignore_data = {
                "source": match.group(1),
                "line": int(match.group(2)),
                "pattern": match.group(3),
                "probe": match.group(4),
            }
        else:
            ignore_data = {"raw": ignore}
    return {"historical_removal": removal_data, "ignore_rule": ignore_data}


def counts_for_application(app_data: dict[str, object]) -> dict[str, int]:
    canonical = app_data.get("canonical_inventory") or {}
    source = canonical.get("source") or {}
    routes = canonical.get("routing") or {}
    controls = canonical.get("interaction_inventory") or {}
    surfaces = canonical.get("surfaces") or {}
    states = canonical.get("states_shortcuts_storage_flags") or {}
    assets = canonical.get("assets") or {}
    return {
        "tracked_present_files": len(app_data["file_classes"]["tracked_present"]),
        "tracked_present_noncanonical_tree_files": len(
            app_data["file_classes"]["tracked_present_noncanonical_tree"]
        ),
        "tracked_deleted_files": len(app_data["file_classes"]["tracked_deleted"]),
        "untracked_present_files": len(app_data["file_classes"]["untracked_present"]),
        "ignored_present_files": len(app_data["file_classes"]["ignored_present"]),
        "canonical_source_files": len(source.get("all_files", [])),
        "reachable_source_files": len(source.get("reachable_files", [])),
        "unreachable_source_files": len(source.get("unreachable_files", [])),
        "declared_routes": len(routes.get("declared_routes", [])),
        "navigation_targets": len(routes.get("navigation_targets", [])),
        "unmatched_navigation_targets": sum(
            item.get("route_match") in {"falls_through_wildcard_not_declared", "not_declared_in_reachable_router"}
            for item in routes.get("navigation_targets", [])
        ),
        "pages_screens": len(canonical.get("pages_screens", [])),
        "reachable_pages_screens": sum(
            item.get("statically_reachable_from_entrypoint")
            for item in canonical.get("pages_screens", [])
        ),
        "dialogs_modals_drawers": len(surfaces.get("dialogs_modals_drawers", [])),
        "reachable_dialogs_modals_drawers": sum(
            item.get("statically_reachable_from_entrypoint")
            for item in surfaces.get("dialogs_modals_drawers", [])
        ),
        "menus_context_menus_palettes": len(surfaces.get("menus_context_menus_palettes", [])),
        "reachable_menus_context_menus_palettes": sum(
            item.get("statically_reachable_from_entrypoint")
            for item in surfaces.get("menus_context_menus_palettes", [])
        ),
        "tab_state_occurrences": len(surfaces.get("tab_state_occurrences", [])),
        "reachable_tab_state_occurrences": sum(
            item.get("statically_reachable_from_entrypoint")
            for item in surfaces.get("tab_state_occurrences", [])
        ),
        "controls": len(controls.get("controls", [])),
        "manual_review_controls": sum(
            str(item.get("binding_classification", "")).startswith("manual_review")
            for item in controls.get("controls", [])
        ),
        "empty_inline_handler_candidates": len(controls.get("empty_inline_handler_candidates", [])),
        "placeholder_text_candidates": len(controls.get("placeholder_text_candidates", [])),
        "keyboard_shortcut_evidence": len(states.get("keyboard_shortcut_evidence", [])),
        "browser_storage_evidence": len(states.get("browser_storage_evidence", [])),
        "feature_flag_entitlement_evidence": len(states.get("feature_flag_entitlement_evidence", [])),
        "asset_items": len(assets.get("items", [])),
        "assets_without_tracked_license_evidence": sum(
            item.get("license_status") == "no_tracked_license_evidence"
            for item in assets.get("items", [])
        ),
    }


def aggregate_gaps(applications: list[dict[str, object]]) -> list[dict[str, object]]:
    gaps: list[dict[str, object]] = []
    for app in applications:
        app_id = str(app["id"])
        classification = str(app["source_classification"])
        if classification != "tracked_present_canonical_source":
            gaps.append(
                {
                    "application": app_id,
                    "code": "NONCANONICAL_FRONTEND_SOURCE",
                    "severity": "high",
                    "detail": "No tracked, present application source; filesystem observations are excluded from canonical support counts.",
                }
            )
        if app["deployment"]["build_context_declared_in_canonical_compose"] and classification != "tracked_present_canonical_source":
            gaps.append(
                {
                    "application": app_id,
                    "code": "COMPOSE_CONTEXT_NOT_REPRODUCIBLE",
                    "severity": "critical",
                    "detail": "Canonical compose declares a build context whose application source is ignored/noncanonical.",
                }
            )
        canonical = app.get("canonical_inventory") or {}
        source = canonical.get("source") or {}
        for item in source.get("unresolved_relative_imports_from_reachable_files", []):
            gaps.append(
                {
                    "application": app_id,
                    "code": "REACHABLE_IMPORT_OUTSIDE_TRACKED_SOURCE",
                    "severity": "high",
                    "detail": f"{item['path']}:{item['line']} imports {item['specifier']} ({item['classification']}).",
                }
            )
        routing = canonical.get("routing") or {}
        configured_hosts = {
            host.lower()
            for config in app["deployment"].get("host_configs", [])
            for host in config.get("server_names", [])
        }
        for item in routing.get("absolute_host_redirects", []):
            if item.get("host") and str(item["host"]).lower() not in configured_hosts:
                gaps.append(
                    {
                        "application": app_id,
                        "code": "SOURCE_REDIRECT_HOST_NOT_IN_APP_NGINX_SERVER_NAMES",
                        "severity": "high",
                        "detail": (
                            f"{item['path']}:{item['line']} redirects to {item['host']}, while the app's "
                            f"tracked nginx server names are {sorted(configured_hosts)}. Deployment runtime was not inferred."
                        ),
                    }
                )
        for item in routing.get("navigation_targets", []):
            if item.get("route_match") in {"falls_through_wildcard_not_declared", "not_declared_in_reachable_router"}:
                gaps.append(
                    {
                        "application": app_id,
                        "code": "NAVIGATION_TARGET_WITHOUT_DECLARED_ROUTE",
                        "severity": "high",
                        "detail": f"{item['path']}:{item['line']} targets {item['target']} ({item['route_match']}).",
                    }
                )
        interaction = canonical.get("interaction_inventory") or {}
        manual_controls = [
            item
            for item in interaction.get("controls", [])
            if str(item.get("binding_classification", "")).startswith("manual_review")
        ]
        for item in manual_controls:
            gaps.append(
                {
                    "application": app_id,
                    "code": "CONTROL_WITHOUT_STATIC_BINDING_CANDIDATE",
                    "severity": "high",
                    "detail": (
                        f"{item['path']}:{item['line']} <{item['tag']}> has no native destination or "
                        "statically visible event binding; manual/runtime confirmation is required."
                    ),
                }
            )
        for item in interaction.get("empty_inline_handler_candidates", []):
            gaps.append(
                {
                    "application": app_id,
                    "code": "EMPTY_INLINE_HANDLER_CANDIDATE",
                    "severity": "high",
                    "detail": f"{item['path']}:{item['line']} has an empty inline {item['handler_attribute']} candidate.",
                }
            )
        placeholder_count = len(interaction.get("placeholder_text_candidates", []))
        if placeholder_count:
            gaps.append(
                {
                    "application": app_id,
                    "code": "PLACEHOLDER_OR_DEFERRED_UI_TEXT_CANDIDATES",
                    "severity": "high",
                    "detail": (
                        f"{placeholder_count} reachable lexical candidate(s) contain TODO/FIXME/coming-soon/future wording; "
                        "the JSON preserves line evidence and does not assert all are defects."
                    ),
                }
            )
        assets = canonical.get("assets") or {}
        missing_license = sum(
            item.get("license_status") == "no_tracked_license_evidence"
            for item in assets.get("items", [])
        )
        if missing_license:
            gaps.append(
                {
                    "application": app_id,
                    "code": "ASSET_LICENSE_EVIDENCE_MISSING",
                    "severity": "high",
                    "detail": f"{missing_license} tracked asset files have no colocated tracked license evidence.",
                }
            )
    return sorted(gaps, key=lambda item: (item["severity"], item["code"], item["application"], item["detail"]))


def test_reliability_inventory(repo: Path) -> dict[str, object]:
    candidates = []
    untracked_candidates = []
    for prefix in ("qa", "frontend"):
        for path in git_paths(repo, "ls-files", "--", prefix):
            if not (repo / path).is_file():
                continue
            lowered = path.lower()
            if (
                "/test" in lowered
                or "/tests/" in lowered
                or lowered.endswith(("playwright.config.mjs", "package.json"))
            ):
                candidates.append(path)
        for path in git_paths(repo, "ls-files", "--others", "--exclude-standard", "--", prefix):
            if not (repo / path).is_file():
                continue
            lowered = path.lower()
            if (
                "/test" in lowered
                or "/tests/" in lowered
                or lowered.endswith(("playwright.config.mjs", "package.json"))
            ):
                untracked_candidates.append(path)
    occurrences = []
    pattern = re.compile(
        r"\b(?:retries|retry)\s*[:=(]|\.skip\s*\(|\.only\s*\(|test\.fixme\s*\(|flak(?:e|y)|"
        r"setDefaultTimeout\s*\(|timeout\s*:",
        re.I,
    )
    classified_candidates = [
        (path, "tracked_present") for path in sorted(set(candidates))
    ] + [
        (path, "untracked_present") for path in sorted(set(untracked_candidates))
    ]
    for path, source_classification in classified_candidates:
        source = read_text(repo / path)
        clean = strip_js_comments(source)
        for match in pattern.finditer(clean):
            occurrences.append(
                evidence(
                    path,
                    source,
                    match.start(),
                    matched=match.group(0),
                    source_classification=source_classification,
                )
            )
    return {
        "tracked_test_or_config_files": sorted(set(candidates)),
        "untracked_test_or_config_files": sorted(set(untracked_candidates)),
        "retry_skip_only_timeout_candidates": sorted(
            occurrences, key=lambda item: (item["path"], item["line"], item["matched"])
        ),
        "limitation": "Static candidates do not establish flakiness; repeated clean executions and CI history are required for PC-157.",
    }


def candidate_counts(application: dict[str, object]) -> dict[str, int]:
    source = application.get("source") or {}
    routing = application.get("routing") or {}
    provenance = source.get("file_provenance") or []
    reachable = set(source.get("reachable_files") or [])
    return {
        "candidate_source_files": len(source.get("all_files") or []),
        "candidate_tracked_source_files": sum(
            str(item.get("provenance", "")).startswith("git_tracked_present")
            for item in provenance
        ),
        "candidate_untracked_source_files": sum(
            item.get("provenance") == "git_untracked_present_candidate"
            for item in provenance
        ),
        "candidate_excluded_untracked_source_files": len(
            source.get("excluded_untracked_source") or []
        ),
        "candidate_excluded_source_files": len(source.get("excluded_source") or []),
        "candidate_reachable_source_files": len(reachable),
        "candidate_reachable_untracked_source_files": sum(
            item.get("path") in reachable
            and item.get("provenance") == "git_untracked_present_candidate"
            for item in provenance
        ),
        "candidate_unreachable_source_files": len(source.get("unreachable_files") or []),
        "candidate_declared_non_wildcard_routes": len(routing.get("declared_routes") or []),
        "candidate_wildcard_fallbacks": len(
            routing.get("wildcard_fallbacks_not_support") or []
        ),
        "candidate_navigation_targets": len(routing.get("navigation_targets") or []),
        "candidate_unmatched_navigation_targets": sum(
            item.get("route_match") == "not_declared_in_candidate_router"
            for item in routing.get("navigation_targets") or []
        ),
        "candidate_non_actionable_command_metadata": len(
            routing.get("non_actionable_command_metadata") or []
        ),
        "candidate_static_resolution_issues": len(
            routing.get("static_resolution_issues") or []
        ),
        "candidate_gaps": len(application.get("gaps") or []),
    }


def candidate_application_gaps(application: dict[str, object]) -> list[dict[str, object]]:
    app_id = str(application["id"])
    source = application.get("source") or {}
    routing = application.get("routing") or {}
    gaps: list[dict[str, object]] = []
    untracked = [
        item["path"]
        for item in source.get("file_provenance") or []
        if item.get("provenance") == "git_untracked_present_candidate"
    ]
    if untracked:
        gaps.append(
            {
                "application": app_id,
                "code": "CURRENT_CANDIDATE_INCLUDES_UNTRACKED_SOURCE",
                "severity": "high",
                "detail": (
                    f"{len(untracked)} candidate source file(s) are present but untracked; "
                    "the candidate fingerprint binds their current bytes, not a reproducible Git revision."
                ),
            }
        )
    modified = [
        item["path"]
        for item in source.get("file_provenance") or []
        if item.get("provenance") == "git_tracked_present_worktree_modified"
    ]
    if modified:
        gaps.append(
            {
                "application": app_id,
                "code": "CURRENT_CANDIDATE_INCLUDES_MODIFIED_TRACKED_SOURCE",
                "severity": "high",
                "detail": (
                    f"{len(modified)} tracked candidate source file(s) differ from HEAD; "
                    "repository_head alone cannot reproduce the analyzed bytes."
                ),
            }
        )
    for item in source.get("unresolved_relative_imports_from_reachable_files") or []:
        gaps.append(
            {
                "application": app_id,
                "code": "CANDIDATE_REACHABLE_IMPORT_NOT_RESOLVED",
                "severity": "high",
                "detail": (
                    f"{item['path']}:{item['line']} imports {item['specifier']} "
                    f"({item['classification']})."
                ),
            }
        )
    for item in routing.get("navigation_targets") or []:
        if item.get("route_match") == "not_declared_in_candidate_router":
            gaps.append(
                {
                    "application": app_id,
                    "code": "CANDIDATE_NAVIGATION_TARGET_WITHOUT_DECLARED_ROUTE",
                    "severity": "high",
                    "detail": (
                        f"{item['path']}:{item['line']} targets {item['target']} "
                        "without an explicit non-wildcard candidate route."
                    ),
                }
            )
    for item in routing.get("static_resolution_issues") or []:
        gaps.append(
            {
                "application": app_id,
                "code": "CANDIDATE_STATIC_ROUTE_RESOLUTION_LIMIT",
                "severity": "high",
                "detail": (
                    f"{item['path']}:{item['line']} {item['classification']}; "
                    "no route or actionable target was inferred."
                ),
            }
        )
    return sorted(
        gaps,
        key=lambda item: (
            item["severity"],
            item["code"],
            item["application"],
            item["detail"],
        ),
    )


def empty_candidate_application(app: dict[str, object]) -> dict[str, object]:
    result: dict[str, object] = {
        "id": app["id"],
        "root": app["root"],
        "analysis_status": "not_analyzed_without_tracked_canonical_entrypoint",
        "candidate_support_claim": False,
        "source": {
            "all_files": [],
            "file_provenance": [],
            "excluded_source": [],
            "excluded_untracked_source": [],
            "entrypoints": [],
            "reachable_files": [],
            "unreachable_files": [],
            "external_import_packages": [],
            "unresolved_relative_imports_from_reachable_files": [],
            "candidate_source_fingerprint": digest_provenance_file_set(Path("."), {}),
        },
        "pages_screens": [],
        "routing": {
            "declared_routes": [],
            "wildcard_fallbacks_not_support": [],
            "navigation_targets": [],
            "non_actionable_command_metadata": [],
            "static_resolution_issues": [],
        },
        "gaps": [],
        "limitation": (
            "Candidate expansion is allowed only beneath a frontend root that already has a "
            "tracked, present canonical entrypoint; ignored legacy source is not promoted."
        ),
    }
    result["counts"] = candidate_counts(result)
    return result


def build_current_candidate_analysis(
    repo: Path, canonical_applications: list[dict[str, object]]
) -> dict[str, object]:
    applications: list[dict[str, object]] = []
    aggregate_provenance: dict[str, str] = {}

    for canonical_app in canonical_applications:
        if not canonical_app.get("canonical_support_claim"):
            applications.append(empty_candidate_application(canonical_app))
            continue

        root = str(canonical_app["root"])
        classes = canonical_app["file_classes"]
        canonical_source = list(
            (canonical_app.get("canonical_inventory") or {}).get("source", {}).get(
                "all_files", []
            )
        )
        tracked_source, tracked_excluded = candidate_source_selection(canonical_source)
        untracked_source, untracked_excluded = candidate_source_selection(
            classes.get("untracked_present", [])
        )
        candidate_files = sorted(set(tracked_source) | set(untracked_source))
        modified_tracked = set(
            git_paths(repo, "diff", "--name-only", "HEAD", "--", root)
        )
        provenance_by_path = {
            path: (
                "git_tracked_present_worktree_modified"
                if path in modified_tracked
                else "git_tracked_present"
            )
            for path in tracked_source
        }
        provenance_by_path.update(
            {path: "git_untracked_present_candidate" for path in untracked_source}
        )
        aggregate_provenance.update(provenance_by_path)

        support_files = {
            path
            for path in [
                *classes.get("tracked_present", []),
                *classes.get("untracked_present", []),
            ]
            if candidate_support_file(path)
        }
        all_untracked_source = set(source_files(classes.get("untracked_present", [])))
        graph = import_graph(
            repo,
            str(canonical_app["id"]),
            candidate_files,
            support_files,
            all_untracked_source,
        )
        excluded_paths = {
            item["path"] for item in [*tracked_excluded, *untracked_excluded]
        }
        unresolved = []
        for item in graph["unresolved_relative_imports_from_reachable_files"]:
            updated = add_source_provenance(item, provenance_by_path)
            if updated.get("observed_target") in excluded_paths:
                updated["classification"] = (
                    "target_present_but_excluded_from_current_candidate"
                )
            else:
                updated["classification"] = "target_not_in_current_candidate_source"
            unresolved.append(updated)
        graph["unresolved_relative_imports_from_reachable_files"] = unresolved
        reachable = set(graph["reachable_files"])
        routing = candidate_route_inventory(
            repo, candidate_files, reachable, provenance_by_path
        )
        pages = [
            add_source_provenance(item, provenance_by_path)
            for item in page_inventory(repo, candidate_files, reachable)
        ]
        excluded = [
            {**item, "provenance": "git_tracked_present_excluded_by_candidate_policy"}
            for item in tracked_excluded
        ] + [
            {**item, "provenance": "git_untracked_present_excluded_by_candidate_policy"}
            for item in untracked_excluded
        ]
        source_data = {
            "all_files": candidate_files,
            "file_provenance": [
                {"path": path, "provenance": provenance_by_path[path]}
                for path in candidate_files
            ],
            "excluded_source": sorted(
                excluded,
                key=lambda item: (item["path"], item["reason"], item["provenance"]),
            ),
            "excluded_untracked_source": sorted(
                [
                    item
                    for item in excluded
                    if item["provenance"].startswith("git_untracked")
                ],
                key=lambda item: (item["path"], item["reason"]),
            ),
            **graph,
            "candidate_source_fingerprint": digest_provenance_file_set(
                repo, provenance_by_path
            ),
        }
        application: dict[str, object] = {
            "id": canonical_app["id"],
            "root": root,
            "analysis_status": "current_worktree_static_candidate",
            "candidate_support_claim": False,
            "source": source_data,
            "pages_screens": pages,
            "routing": routing,
            "gaps": [],
            "limitation": (
                "This is a static view of present worktree bytes. It does not replace the "
                "tracked-only canonical inventory or establish runtime support."
            ),
        }
        application["gaps"] = candidate_application_gaps(application)
        application["counts"] = candidate_counts(application)
        applications.append(application)

    aggregate_counts: dict[str, int] = collections.Counter()
    aggregate_gaps: list[dict[str, object]] = []
    for application in applications:
        for name, count in application["counts"].items():
            aggregate_counts[name] += int(count)
        aggregate_gaps.extend(application["gaps"])
    aggregate_counts["candidate_applications_analyzed"] = sum(
        application["analysis_status"] == "current_worktree_static_candidate"
        for application in applications
    )

    return {
        "schema_version": CANDIDATE_SCHEMA_VERSION,
        "classification": "current_dirty_worktree_static_candidate_noncanonical",
        "candidate_support_claim": False,
        "candidate_source_fingerprint": digest_provenance_file_set(
            repo, aggregate_provenance
        ),
        "scope": {
            "root_rule": (
                "Tracked, present canonical frontend roots only; ignored/source-absent roots "
                "are never promoted by filesystem presence."
            ),
            "included": (
                "Present canonical Git-tracked source plus present nonignored Git-untracked "
                "source located beneath each canonical src root."
            ),
            "excluded": sorted(CANDIDATE_EXCLUDED_TREE_PARTS),
            "test_module_filename_policy": "*.test.* and *.spec.* are excluded",
        },
        "limitations": [
            "No browser, server, API, service worker, native shell, or provider was executed; all candidate findings are static.",
            "Untracked files have no repository revision identity. The candidate fingerprint binds only their present paths, provenance, and bytes.",
            "Tracked worktree modifications may also differ from repository_head; their provenance is explicit and the candidate fingerprint binds current bytes.",
            "Static relative-import reachability does not prove runtime loading, route rendering, authorization, interaction behavior, or deployment.",
            "Only literal route records and literal PANEL_ROUTES references in recognized imported registry maps are resolved; computed/dynamic registries remain unresolved.",
            "Wildcard routes are fallback evidence only and never satisfy a candidate navigation target.",
            "previousPath and disabled command records are preserved as non-actionable audit metadata; only enabled command path values become navigation targets.",
            "Ignored legacy trees, node_modules, dist, www, android, generated/backup/test artifacts, and noncanonical frontend roots are excluded.",
        ],
        "applications": applications,
        "aggregate_counts": dict(sorted(aggregate_counts.items())),
        "gaps": sorted(
            aggregate_gaps,
            key=lambda item: (
                item["severity"],
                item["code"],
                item["application"],
                item["detail"],
            ),
        ),
    }


def build_inventory(repo: Path) -> dict[str, object]:
    if not (repo / ".git").exists():
        raise RuntimeError(f"not a Git repository: {repo}")
    head = run_git(repo, "rev-parse", "HEAD").strip()
    compose_path = repo / "docker-compose.prochart.yml"
    compose_text = read_text(compose_path)
    licenses = tracked_license_files(repo)
    apps: list[dict[str, object]] = []
    canonical_file_union: set[str] = set()

    for app in APPLICATIONS:
        root = f"frontend/{app}"
        classes = tracked_status(repo, root)
        tracked_present = list(classes["tracked_present"])
        tracked_source = source_files(tracked_present)
        untracked_source = set(source_files(classes["untracked_present"]))
        legacy_source = filesystem_source_files(repo, app)

        has_tracked_entry = any(
            item in tracked_present
            for item in (f"{root}/index.html", f"{root}/src/main.jsx", f"{root}/package.json")
        )
        if tracked_source and has_tracked_entry:
            classification = "tracked_present_canonical_source"
        elif legacy_source:
            classification = "ignored_filesystem_legacy_observation"
        else:
            classification = "source_absent"

        deployment = host_deployment_inventory(repo, app, compose_text)
        historical = removal_and_ignore(repo, app)
        app_data: dict[str, object] = {
            "id": app,
            "root": root,
            "source_classification": classification,
            "canonical_support_claim": classification == "tracked_present_canonical_source",
            "file_classes": classes,
            "deployment": deployment,
            "history_and_ignore": historical,
        }

        if classification == "tracked_present_canonical_source":
            graph = import_graph(repo, app, tracked_source, set(tracked_present), untracked_source)
            reachable = set(graph["reachable_files"])
            canonical_file_union.update(tracked_present)
            canonical = {
                "source": {
                    "all_files": tracked_source,
                    **graph,
                    "tracked_source_digest": digest_file_set(repo, tracked_source),
                },
                "pages_screens": page_inventory(repo, tracked_source, reachable),
                "routing": route_inventory(repo, tracked_source, reachable),
                "surfaces": component_surfaces(repo, tracked_source, reachable),
                "interaction_inventory": controls_inventory(repo, tracked_source, reachable),
                "states_shortcuts_storage_flags": states_shortcuts_storage_flags(
                    repo, tracked_source, reachable
                ),
                "assets": asset_inventory(repo, app, tracked_present, licenses),
                "third_party_references": third_party_references(repo, tracked_source, reachable),
            }
            app_data["canonical_inventory"] = canonical
        else:
            legacy_routes = route_inventory(repo, legacy_source, set(legacy_source))
            app_data["legacy_observation"] = {
                "source_files": legacy_source,
                "source_digest": digest_file_set(repo, legacy_source),
                "page_screen_files": [
                    path for path in legacy_source if "pages" in Path(path).parts or "screens" in Path(path).parts
                ],
                "route_like_source_matches": legacy_routes,
                "disclaimer": (
                    "Observed ignored filesystem content only. It was removed from Git and is excluded from "
                    "canonical/current support, compatibility, build, route, and control counts."
                ),
            }

        app_data["counts"] = counts_for_application(app_data)
        apps.append(app_data)

    gaps = aggregate_gaps(apps)
    aggregate_counts: dict[str, int] = collections.Counter()
    for app in apps:
        for name, count in app["counts"].items():
            aggregate_counts[name] += int(count)
    aggregate_counts["applications_declared"] = len(apps)
    aggregate_counts["applications_with_tracked_canonical_source"] = sum(
        app["canonical_support_claim"] for app in apps
    )
    aggregate_counts["applications_legacy_observation_only"] = sum(
        app["source_classification"] == "ignored_filesystem_legacy_observation" for app in apps
    )
    current_candidate = build_current_candidate_analysis(repo, apps)

    return {
        "schema_version": SCHEMA_VERSION,
        "generator": "qa/scripts/frontend-source-inventory.py",
        "repository_head": head,
        "canonical_source_fingerprint": digest_file_set(repo, canonical_file_union),
        "scope": {
            "applications": list(APPLICATIONS),
            "canonical_compose": "docker-compose.prochart.yml",
            "requirements": ["PC-002", "PC-003", "PC-005", "PC-024", "PC-157", "PC-159"],
            "canonical_rule": "Git-tracked and present application source rooted at a tracked entrypoint.",
        },
        "false_positive_controls": [
            "JS line and block comments are blanked while strings and line numbers are preserved.",
            "Only relative imports from tracked entrypoints establish static reachability.",
            "node_modules, dist, www, .vite and src.bak never enter source analysis.",
            "Ignored legacy trees, untracked additions and tracked deletions remain separate evidence classes.",
            "Tracked dist, www and src.bak trees are listed as noncanonical and excluded from source reachability and asset counts.",
            "Controls without a visible binding are manual-review candidates, not asserted defects.",
            "State, entitlement, provider and placeholder matches are lexical candidates, not runtime assertions.",
            "A wildcard redirect is not treated as declaration/support for an otherwise missing navigation target.",
            "License evidence requires a tracked LICENSE/LICENCE/COPYING/NOTICE file; package-manager licenses are not attributed to product assets.",
        ],
        "limitations": [
            "No browser, server, API, service worker, native shell, or external provider was executed.",
            "Conditional/dynamic imports assembled from nonliteral strings are outside the import graph.",
            "Static reachability does not prove a route, dialog, menu, CTA, keyboard shortcut, state, or entitlement works.",
            "The regex inventory cannot prove empty/error/offline/permission visual completeness or fake-success absence.",
            "Asset presence and hashes do not establish ownership, provenance, trademark permission, or license compatibility.",
            "PC-157 requires repeated clean runs and CI history; this inventory only surfaces retry/skip/timeout candidates.",
            "Host config presence and compose literals do not prove DNS, certificates, deployed containers, or nginx selection order.",
        ],
        "tracked_license_files": licenses,
        "applications": apps,
        "aggregate_counts": dict(sorted(aggregate_counts.items())),
        "gaps": gaps,
        "test_reliability": test_reliability_inventory(repo),
        "current_candidate_analysis": current_candidate,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="repository root (default: inferred from script location)",
    )
    parser.add_argument("--output", type=Path, help="write JSON to this path instead of stdout")
    parser.add_argument("--compact", action="store_true", help="emit compact JSON")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    repo = args.repo.resolve()
    inventory = build_inventory(repo)
    payload = json.dumps(
        inventory,
        ensure_ascii=False,
        indent=None if args.compact else 2,
        separators=(",", ":") if args.compact else None,
        sort_keys=True,
    ) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    else:
        sys.stdout.write(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
