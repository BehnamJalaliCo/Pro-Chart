from __future__ import annotations

import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "qa" / "scripts" / "frontend-source-inventory.py"
EXPECTED = json.loads(
    (
        REPO_ROOT
        / "qa"
        / "fixtures"
        / "frontend-source-inventory"
        / "expected-candidate.json"
    ).read_text(encoding="utf-8")
)

SPEC = importlib.util.spec_from_file_location("frontend_source_inventory", SCRIPT)
assert SPEC and SPEC.loader
INVENTORY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INVENTORY)


def run(repo: Path, *args: str) -> str:
    process = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    if process.returncode:
        raise AssertionError(process.stderr)
    return process.stdout


def write(repo: Path, relative: str, content: str) -> None:
    path = repo / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_fixture(repo: Path) -> None:
    run(repo, "init", "-q")
    run(repo, "config", "user.name", "Inventory Fixture")
    run(repo, "config", "user.email", "inventory@example.invalid")
    write(
        repo,
        ".gitignore",
        "**/node_modules/\n**/dist/\n**/www/\n**/src.bak/\n",
    )
    write(repo, "docker-compose.prochart.yml", "services: {}\n")
    write(
        repo,
        "frontend/panel/index.html",
        '<script type="module" src="/src/main.jsx"></script>\n',
    )
    write(repo, "frontend/panel/package.json", '{"name":"fixture","private":true}\n')
    write(
        repo,
        "frontend/panel/src/main.jsx",
        "import App from './App';\nexport default App;\n",
    )
    write(
        repo,
        "frontend/panel/src/App.jsx",
        """import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import './newFeature';
import { PANEL_ROUTES, PROTECTED_PANEL_ROUTES } from './navigation';

export default function App() {
  return <Routes>
    <Route path={PANEL_ROUTES.login} element={<Home />} />
    {PROTECTED_PANEL_ROUTES.map(({ id, path }) => {
      const Page = Home;
      return <Route key={id} path={path} element={<Page />} />;
    })}
    <NavLink to="/missing">missing</NavLink>
    <Route path="*" element={<Navigate to={PANEL_ROUTES.home} replace />} />
  </Routes>;
}
""",
    )
    write(
        repo,
        "frontend/panel/src/pages/Home.jsx",
        "export default function Home() { return <main>home</main>; }\n",
    )
    run(repo, "add", ".gitignore", "docker-compose.prochart.yml", "frontend/panel")
    environment = {
        **os.environ,
        "GIT_AUTHOR_DATE": "2026-01-01T00:00:00Z",
        "GIT_COMMITTER_DATE": "2026-01-01T00:00:00Z",
    }
    process = subprocess.run(
        ["git", "commit", "-q", "-m", "fixture"],
        cwd=repo,
        env=environment,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if process.returncode:
        raise AssertionError(process.stderr)

    write(
        repo,
        "frontend/panel/src/navigation.js",
        """export const PUBLIC_PANEL_ROUTES = Object.freeze([
  Object.freeze({ id: 'login', path: '/login' }),
]);
export const PROTECTED_PANEL_ROUTES = Object.freeze([
  Object.freeze({ id: 'home', path: '/home' }),
  Object.freeze({ id: 'new', path: '/new' }),
  Object.freeze({ id: 'fallback', path: '*' }),
]);
export const PANEL_ROUTES = Object.freeze(
  Object.fromEntries([...PUBLIC_PANEL_ROUTES, ...PROTECTED_PANEL_ROUTES].map(({ id, path }) => [id, path]))
);
const enabledCommand = (command) => ({ ...command, enabled: true });
const unavailableCommand = ({ path, ...command }) => ({ ...command, previousPath: path, enabled: false });
export const DEFAULT_NAV_COMMANDS = [
  enabledCommand({ id: 'home', path: PANEL_ROUTES.home }),
  enabledCommand({ id: 'new', path: PANEL_ROUTES.new, previousPath: '/old' }),
  unavailableCommand({ id: 'dead', path: '/dead', unavailableReason: 'not implemented' }),
  { id: 'raw-disabled', path: '/raw-dead', enabled: false },
];
""",
    )
    write(repo, "frontend/panel/src/newFeature.js", "export const value = 1;\n")
    write(repo, "frontend/panel/src/navigation.test.mjs", "throw new Error('test only');\n")
    write(repo, "frontend/panel/src/android/Bridge.js", "export const native = true;\n")
    write(repo, "frontend/panel/src/generated/Generated.js", "export const generated = true;\n")
    write(repo, "frontend/panel/src/src.bak/Legacy.js", "export const ignored = true;\n")
    write(repo, "frontend/panel/src/node_modules/pkg/index.js", "export const cache = true;\n")
    write(repo, "frontend/panel/src/dist/bundle.js", "export const bundle = true;\n")
    write(repo, "frontend/panel/src/www/app.js", "export const generated = true;\n")


def candidate_panel(inventory: dict[str, object]) -> dict[str, object]:
    candidate = inventory["current_candidate_analysis"]
    return next(item for item in candidate["applications"] if item["id"] == "panel")


def canonical_projection(inventory: dict[str, object]) -> dict[str, object]:
    result = copy.deepcopy(inventory)
    result.pop("current_candidate_analysis", None)
    return result


class FrontendSourceInventoryCandidateTests(unittest.TestCase):
    def test_candidate_provenance_reachability_and_exclusions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            create_fixture(repo)
            inventory = INVENTORY.build_inventory(repo)
            panel = candidate_panel(inventory)
            provenance = {
                item["path"]: item["provenance"]
                for item in panel["source"]["file_provenance"]
            }

            self.assertEqual(
                sorted(
                    path
                    for path, source_class in provenance.items()
                    if source_class == "git_untracked_present_candidate"
                ),
                EXPECTED["included_untracked_source"],
            )
            self.assertEqual(
                sorted(item["path"] for item in panel["source"]["excluded_untracked_source"]),
                EXPECTED["excluded_untracked_source"],
            )
            self.assertIn("frontend/panel/src/navigation.js", panel["source"]["reachable_files"])
            self.assertIn("frontend/panel/src/newFeature.js", panel["source"]["reachable_files"])
            self.assertNotIn(
                "frontend/panel/src/navigation.js",
                inventory["applications"][2]["canonical_inventory"]["source"]["all_files"],
            )

    def test_registry_routes_commands_and_wildcard_are_conservative(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            create_fixture(repo)
            panel = candidate_panel(INVENTORY.build_inventory(repo))
            routing = panel["routing"]

            self.assertEqual(
                sorted({item["route"] for item in routing["declared_routes"]}),
                EXPECTED["declared_routes"],
            )
            self.assertEqual(
                sorted({item["route"] for item in routing["wildcard_fallbacks_not_support"]}),
                EXPECTED["fallback_routes"],
            )
            actionable = {item["target"] for item in routing["navigation_targets"]}
            self.assertEqual(sorted(actionable), EXPECTED["actionable_targets"])
            non_actionable = {
                item["former_target"]
                for item in routing["non_actionable_command_metadata"]
            }
            self.assertEqual(sorted(non_actionable), EXPECTED["non_actionable_targets"])
            self.assertTrue(actionable.isdisjoint(non_actionable))
            self.assertNotIn("*", {item["route"] for item in routing["declared_routes"]})
            missing = [
                item
                for item in routing["navigation_targets"]
                if item["target"] == "/missing"
            ]
            self.assertEqual({item["route_match"] for item in missing}, {"not_declared_in_candidate_router"})

    def test_untracked_bytes_change_only_the_candidate_projection(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            create_fixture(repo)
            before = INVENTORY.build_inventory(repo)
            write(repo, "frontend/panel/src/newFeature.js", "export const value = 2;\n")
            after = INVENTORY.build_inventory(repo)

            self.assertEqual(canonical_projection(before), canonical_projection(after))
            self.assertEqual(
                before["canonical_source_fingerprint"],
                after["canonical_source_fingerprint"],
            )
            self.assertNotEqual(
                before["current_candidate_analysis"]["candidate_source_fingerprint"],
                after["current_candidate_analysis"]["candidate_source_fingerprint"],
            )

    def test_serialized_output_is_byte_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            create_fixture(repo)
            first = json.dumps(
                INVENTORY.build_inventory(repo),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
            second = json.dumps(
                INVENTORY.build_inventory(repo),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
            self.assertEqual(first.encode("utf-8"), second.encode("utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
