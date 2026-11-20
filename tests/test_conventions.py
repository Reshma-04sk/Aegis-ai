"""Code-size and structure conventions from CODE_QUALITY.md, checked on every test run."""

import ast
from pathlib import Path

import pytest

SRC = Path(__file__).parent.parent / "src" / "aegis"
MODULES = sorted(SRC.rglob("*.py"))
MAX_MODULE_LINES = 110
MAX_FUNCTION_LINES = 30


def _tree(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"))


def _functions(path: Path):
    return [
        n for n in ast.walk(_tree(path)) if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef)
    ]


def _name(path: Path) -> str:
    return str(path.relative_to(SRC))


@pytest.mark.parametrize("path", MODULES, ids=_name)
def test_module_is_small_and_states_its_job(path):
    assert len(path.read_text(encoding="utf-8").splitlines()) <= MAX_MODULE_LINES
    assert ast.get_docstring(_tree(path)), "every module opens with a docstring naming its job"


@pytest.mark.parametrize("path", MODULES, ids=_name)
def test_functions_are_short(path):
    long = [f.name for f in _functions(path) if f.end_lineno - f.lineno + 1 > MAX_FUNCTION_LINES]
    assert not long


@pytest.mark.parametrize("path", MODULES, ids=_name)
def test_no_prints_or_bare_excepts(path):
    tree = _tree(path)
    calls = [
        n.func.id
        for n in ast.walk(tree)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
    ]
    bare = [n for n in ast.walk(tree) if isinstance(n, ast.ExceptHandler) and n.type is None]
    assert "print" not in calls and not bare


def _imports(path: Path) -> set[str]:
    """Absolute names of every module the file imports, relative imports resolved."""
    package = ["aegis", *path.relative_to(SRC).parent.parts]
    names = set()
    for node in ast.walk(_tree(path)):
        if isinstance(node, ast.Import):
            names.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            base = package[: len(package) - node.level + 1] if node.level else []
            names.add(".".join([*base, *([node.module] if node.module else [])]))
    return names


PURE = ["rules", "planner", "commute", "models", "exposure.py", "aqi.py", "indoor.py"]
OUTER = ("aegis.api", "aegis.airdata", "aegis.stations", "aegis.advisor", "httpx", "fastapi")


@pytest.mark.parametrize("entry", PURE)
def test_domain_never_imports_http_or_upstream_adapters(entry):
    """The decision engines are pure: no HTTP layer, no upstream clients, no network library."""
    paths = [SRC / entry] if entry.endswith(".py") else sorted((SRC / entry).rglob("*.py"))
    for path in paths:
        bad = [name for name in _imports(path) if name.startswith(OUTER)]
        assert not bad, f"{_name(path)} imports {bad}"


def test_import_resolution_catches_relative_imports():
    """Guard for the guard: a three-dot import is resolved to its absolute name."""
    assert "aegis.models" in _imports(SRC / "rules" / "advice" / "__init__.py")
