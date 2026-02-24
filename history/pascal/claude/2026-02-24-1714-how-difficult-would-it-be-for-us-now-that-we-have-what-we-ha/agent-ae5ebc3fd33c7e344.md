# Conversation ae5ebc3fd33c7e344

- Source: `claude`
- User: `pascal`
- System: `Pascals-MBP.local`
- Started: `2026-02-24T17:57:48.241Z`
- CWD: `/Users/pascal/Code/business/convx`

## User

_`2026-02-24T17:57:48.241Z`_

In the repo at /Users/pascal/Code/business/convx, explore and report on:

1. `src/convx_ai/cli.py` - how is `convx explore` invoked? What arguments does it take? How does it call the TUI?
2. `src/convx_ai/tui.py` - what does ExploreApp do? What data does it need (repo path, sessions list)?
3. `src/convx_ai/search.py` - what functions exist? What do `list_sessions` and `query_index` return? What fields are in each session dict?
4. `src/convx_ai/stats.py` - what does `compute_word_series` return exactly?
5. `pyproject.toml` - what is the build backend, package name, version, and how is the package structured? Any existing package data config?
6. Check if there's any existing `dashboard/`, `web/`, or `frontend/` directory

Report exact function signatures, return types, and data shapes. This is for planning a web frontend that replaces the TUI.

## Agent

_`2026-02-24T17:57:49.537Z`_

I'll explore the repository to understand the current architecture, particularly around the CLI, TUI, and data structures. Let me start with parallel reads of the key files.

## Agent

_`2026-02-24T17:57:51.922Z`_

Now let me read the search.py and stats.py files:

## Agent

_`2026-02-24T17:57:54.175Z`_

Let me check the project structure to see if there are any dashboard/web/frontend directories:

## Agent

_`2026-02-24T17:57:56.452Z`_

Perfect! Now let me get the full source tree listing and check for any CSS or configuration files that might inform the frontend setup:

## Agent

_`2026-02-24T17:57:59.102Z`_

Perfect! Now let me check if there's a package.json or any JavaScript/Node setup that's already in place:

## Agent

_`2026-02-24T17:58:00.732Z`_

Excellent! Now let me look at the models to understand the data structures:

## Agent

_`2026-02-24T17:58:01.891Z`_

Now let me check the engine to understand the SyncResult structure:

## Agent

_`2026-02-24T17:58:25.916Z`_

Perfect! I now have all the information needed to provide a comprehensive report. Let me compile the findings:

## Report: Exploration of ConvX Architecture for Web Frontend Planning

### 1. **`cli.py` - `convx explore` Command Invocation**

**Function signature (lines 255-275):**
```python
@app.command("explore")
def explore_command(
    output_path: Path = typer.Option(
        Path.cwd(),
        "--output-path",
        help="Directory containing exported conversations.",
    ),
) -> None:
    """Browse and search exported conversations in a TUI."""
    from convx_ai.search import ensure_index
    from convx_ai.tui import ExploreApp

    repo = output_path.expanduser().resolve()
    if not repo.exists():
        raise typer.BadParameter(f"Path does not exist: {repo}")
    index_path = repo / ".convx" / "index.json"
    if not index_path.exists():
        typer.echo("No index found. Run `convx sync` or `convx backup` first.")
        raise typer.Exit(1)
    ensure_index(repo)
    ExploreApp(repo).run()
```

**Arguments:**
- `--output-path`: Optional path (defaults to current working directory). Must contain exported conversations in a git repo structure.

**Invocation flow:**
1. Validates repo path exists
2. Checks for `.convx/index.json` (idempotency index)
3. Calls `ensure_index(repo)` from search module
4. Instantiates `ExploreApp(repo)` with repo path and calls `.run()`

---

### 2. **`tui.py` - ExploreApp Data Requirements**

**ExploreApp constructor (lines 212-217):**
```python
def __init__(self, repo: Path) -> None:
    super().__init__()
    self.repo = repo
    self.sessions: list[dict] = []
    self.displayed: list[dict] = []
    self._formatted: list[str] = []
```

**Data Requirements:**
- `repo`: `Path` object pointing to repository root
- Internally loads `sessions` list via `list_sessions(self.repo)` in `on_mount()` (line 229)
- Maintains `displayed` (filtered subset) and `_formatted` (rendered display strings)

**Key responsibilities:**
- Displays session list with search (fuzzy + full-text)
- Shows markdown preview of selected session
- Supports stats screen with word count charts
- Keyboard navigation (vim-style: j/k, g/G, tab)

**Index data passed to compose:**
```python
def on_mount(self) -> None:
    self.sessions = list_sessions(self.repo)  # Load all sessions
    self._formatted = [_format_session(s) for s in self.sessions]
    self.displayed = self.sessions
    self._refresh_list()
    self.query_one("#sessions", ListView).focus()
```

---

### 3. **`search.py` - Session Data Structure and Functions**

**`list_sessions(repo: Path) -> list[dict]` (lines 74-97):**
```python
def list_sessions(repo: Path) -> list[dict]:
    index_path = repo / ".convx" / "index.json"
    if not index_path.exists():
        return []
    data = json.loads(index_path.read_text(encoding="utf-8"))
    sessions = data.get("sessions", {})
    out = []
    for r in sessions.values():
        path = r["markdown_path"]
        date = r.get("started_at") or r.get("updated_at", "")
        out.append({
            "session_key": r["session_key"],
            "title": r.get("basename", ""),
            "date": date,
            "source": r.get("source_system", ""),
            "path": path,
            "user": _user_from_path(path),
            "folder": _folder_from_path(path),
        })
    out.sort(key=lambda x: x["path"])
    out.sort(key=lambda x: x["date"], reverse=True)
    return out
```

**Session dict fields returned:**
```python
{
    "session_key": str,           # "<source>:<session_id>"
    "title": str,                 # basename from index
    "date": str,                  # ISO 8601 timestamp (started_at or updated_at)
    "source": str,                # "codex", "claude", or "cursor"
    "path": str,                  # "history/user/source/..." relative to repo
    "user": str,                  # extracted from path[1]
    "folder": str,                # compacted directory path (empty when flat)
}
```

**`query_index(repo: Path, q: str, limit: int = 50) -> list[dict]` (lines 100-136):**
- Uses Tantivy full-text search on markdown content
- Returns same dict structure as `list_sessions()`
- Searches "title" and "content" fields
- Gracefully returns `[]` if search fails or index missing

**`ensure_index(repo: Path) -> None` (lines 23-56):**
- Builds Tantivy search index from markdown files
- Loads session metadata from `.convx/index.json`
- Skips rebuild if index is newer than source index.json
- Stores at `repo / ".convx" / "search-index"`

---

### 4. **`stats.py` - Word Count Statistics**

**`compute_word_series(history_path: Path) -> dict` (lines 84-148):**

**Return type:**
```python
{
    "dates": ["2026-01-01", "2026-01-02", ...],  # Sorted, gap-filled date range
    "projects": ["convx", "other-repo", ...],     # Sorted alphabetically
    "series": {
        "convx": [0, 142, 0, 88, ...],            # Word count per date in dates order
        "other-repo": [0, 0, 55, 0, ...],         # Parallel array to dates
    }
}
```

**Processing:**
1. Scans `history_path / "**/.*.json"` (hidden JSON blobs)
2. Extracts `started_at`, `cwd`, and `messages` from each session JSON
3. Counts words in messages where `kind in ("user", "assistant")`
4. Extracts project name from `cwd` (last path segment)
5. Aggregates by `(date, project)` tuple
6. Fills date range with gaps (no missing dates)
7. Returns parallel arrays for chart rendering

**Usage in TUI (lines 96):**
```python
data = await asyncio.get_event_loop().run_in_executor(
    None, lambda: compute_word_series(self.repo / "history")
)
```

---

### 5. **`pyproject.toml` - Build System & Package Configuration**

**Build backend:** `hatchling` (>=1.25.0)

**Package info:**
- **Name:** `convx-ai`
- **Version:** `0.2.2`
- **Python:** >=3.11
- **CLI entry point:** `convx = "convx_ai.cli:main"`
- **License:** MIT

**Dependencies:**
- `hyperscan>=0.2.0` (regex pattern matching)
- `rapidfuzz>=3.0` (fuzzy string matching)
- `tantivy>=0.22` (full-text search)
- `textual>=8.0` (TUI framework)
- `textual-plotext>=1.0` (TUI charts)
- `typer>=0.12.0` (CLI framework)

**No package data config** - Python modules only in `src/convx_ai/`

---

### 6. **Existing Frontend/Web Directories**

**No existing dashboard, web, or frontend directories found.**

**What exists:**
- Root has `node_modules/` and `package.json` (only contains shadcn devDependency)
- `.mcp.json` configured to use shadcn MCP server
- TUI is the only existing interface

**CSS for TUI:**
- `explore.css` (266 bytes) - Textual CSS for layout:
  - `#sessions`: 40% height, ListV
iew
  - `#preview_scroll`: 1fr height for markdown preview
  - `#stats_chart` and `#stats_loading`: chart display

---

### 7. **Index Structure** (`.convx/index.json`)

From `engine.py` lines 200-210, each session record contains:
```python
{
    "session_key": str,          # "<source>:<session_id>"
    "fingerprint": str,          # SHA-256 of source file
    "source_system": str,        # "codex", "claude", "cursor"
    "source_path": str,          # Original source file path
    "markdown_path": str,        # Relative path to .md file
    "json_path": str,            # Relative path to hidden .json blob
    "basename": str,             # Filename without timestamp prefix
    "updated_at": str,           # ISO 8601 when last synced
    "started_at": str,           # Session start timestamp
}
```

---

### 8. **Data Flow for Web Frontend**

```
.convx/index.json
    ↓
list_sessions() → [session_dict, ...]
    ↓
ExploreApp displays list + search
    ↓
User selects session
    ↓
Read history/{user}/{source}/.*.json → Load full session data
    ↓
Display markdown from history/{user}/{source}/*.md
    ↓
compute_word_series() for stats screen
```

---

### Key Insights for Web Frontend

1. **No breaking API changes needed** - Session dict structure is stable and complete
2. **Tantivy index ready** - Full-text search already built, can be reused as-is
3. **Data flows from index** - Everything starts from `.convx/index.json`, no direct filesystem scanning needed
4. **Markdown + JSON storage** - Sessions stored as human-readable `.md` and machine-readable `.json`
5. **Project setup** - Already has shadcn configured via MCP, Node environment ready
6. **No conflicting frontend** - TUI is completely separate, can coexist with web UI
