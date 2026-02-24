# Conversation 00074457-d110-46ca-acb6-86019bf37a9b

- Source: `cursor`
- User: `pascal`
- System: `Pascals-MBP.local`
- Started: `2026-02-24T19:06:03.783000Z`
- CWD: `/Users/pascal/Code/business/convx`

## User

check the cli commands. are they consistent? parameters especially

## Agent

Here’s what stands out in the CLI:

## Commands and path parameters

| Command     | Path option   | Default   | Help wording |
|------------|---------------|-----------|--------------|
| sync       | (uses cwd)    | —         | — |
| backup     | `--output-path` | required  | "Directory to export conversations to..." |
| explore    | `--output-path` | `Path.cwd()` | "Directory containing exported conversations." |
| tui        | `--output-path` | `Path.cwd()` | "Directory containing exported conversations." |
| stats      | `--output-path` | required  | "Git repo containing exported conversations." |
| word-stats | **`--repo`**   | `Path.cwd()` | "Git repo containing exported conversations." |

## Inconsistencies

1. **Different name for the same concept**  
   `word-stats` is the only one using `--repo`. The others use `--output-path` for “where the exported history / repo lives”. For consistency, `word-stats` could use `--output-path` as well.

2. **Required vs default for “repo path”**  
   - `stats` requires `--output-path`.  
   - `explore`, `tui`, and `word-stats` default to cwd.  
   So “path to the repo” is sometimes required and sometimes defaulted. If the usual case is “run from the repo”, `stats` could also default to cwd like the others.

3. **Help text**  
   Wording varies between “Directory …” and “Git repo …”. Not wrong, but could be aligned once you fix the param name and default.

## What is consistent

- **sync** and **backup** share the same option set and names: `--source-system`, `--input-path`, `--user`, `--system-name`, `--history-subpath`, `--dry-run`, `--no-redact`, `--with-context`, `--with-thinking`, `--skip-if-contains`.
- **explore** and **tui** both use `--output-path` with the same default and similar help.
- **hooks install** uses `--history-subpath` like sync/backup.

**Recommendation:** Use `--output-path` for `word-stats` (and the same help style as explore/tui/stats), and consider defaulting `stats` to cwd so all “browse/analyze this repo” commands behave the same.

## User

and are they all pointing at "history" folder or at the parent?

## Agent

From the CLI code:

**All path options point at the parent (repo root), not at the `history` folder.**

- **sync** – Uses cwd as the repo; writes under `repo / history_subpath` (default `"history"`).
- **backup** – `--output-path` is the repo root; writes under `output_repo / history_subpath` (default `"history"`).
- **explore** – `--output-path` is the repo root; looks for `repo/.convx/index.json` and serves from there.
- **tui** – Same as explore: repo root, uses `repo/.convx/index.json`.
- **stats** – `--output-path` is the repo root; reads `repo/.convx/index.json`.
- **word-stats** – `--repo` is the repo root; then uses **`repo / "history"`** (hardcoded).

So:

- Every command that takes a path expects the **parent** (repo root).
- The `history` directory is always a **child** of that path (either via `--history-subpath` or hardcoded).

One real inconsistency: **word-stats** always uses the subfolder `"history"` and does not respect `--history-subpath`. If you run sync/backup with e.g. `--history-subpath my-history`, word-stats will still look at `repo/history`, not `repo/my-history`. The others (sync, backup, explore, tui, stats) either write/read under the configurable `history_subpath` or rely on the index under the repo root, which already reflects that subpath.

## User

ok let's make that properly consistent and intuitive.

## Agent

Implementing consistency: use `--output-path` everywhere (rename `--repo` in word-stats), default `stats` to cwd, and add `--history-subpath` to word-stats so it respects the same history location as sync/backup.

## Agent

Applying changes: making `stats` use default cwd and `--output-path`; renaming `word-stats` to `--output-path` and adding `--history-subpath`; unifying help text.

## Agent

Verifying edits and checking for tests that need updating:

## Agent

Tests use the stats module directly, not the CLI. Running the test suite to confirm nothing broke:

## Agent

Summary of what was changed:

**1. Single path option name**
- **word-stats** now uses `--output-path` (replacing `--repo`) so it matches **backup**, **explore**, **tui**, and **stats**.

**2. Same default for “repo” path**
- **stats** now defaults `--output-path` to the current directory (same as **explore**, **tui**, **word-stats**). It’s no longer required.

**3. Same help text**
- All of these use the same description for the path: *“Directory containing exported conversations.”*

**4. word-stats and history location**
- **word-stats** now has `--history-subpath` (default `"history"`), aligned with **sync** and **backup**. So if you use e.g. `convx sync --history-subpath my-history`, `convx word-stats --history-subpath my-history` will use that same folder.

**5. Path handling**
- **stats** now calls `.expanduser().resolve()` on `output_path` before `_require_git_repo`, consistent with the other commands.

All 44 tests pass, and `convx stats` / `convx word-stats` work from the repo root with no arguments.
