"""Word count statistics aggregator for exported AI sessions."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path


def _parse_date(started_at: str) -> str | None:
    """Parse ISO 8601 timestamp to YYYY-MM-DD date string.

    Returns None if parsing fails.
    """
    try:
        dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return None


def _extract_project_name(cwd: str) -> str | None:
    """Extract project name from cwd path.

    Resolves subagent worktree paths (e.g. /project/.claude/worktrees/agent-XXX)
    back to the parent project directory.

    Returns the last segment of the path, or None if cwd is empty.
    """
    if not cwd or not cwd.strip():
        return None
    # Subagent worktrees live under <project>/.claude/worktrees/agent-XXX
    marker = "/.claude/worktrees/"
    idx = cwd.find(marker)
    if idx != -1:
        cwd = cwd[:idx]
    return Path(cwd).name


def _count_words(messages: list[dict]) -> int:
    """Count words in user and assistant messages.

    Args:
        messages: List of message dicts with 'text' and 'kind' fields

    Returns:
        Total word count
    """
    return sum(
        len(msg.get("text", "").split())
        for msg in messages
        if msg.get("kind") in ("user", "assistant")
    )


def _count_tools(messages: list[dict]) -> int:
    """Count tool messages (tool calls/results)."""
    return sum(1 for msg in messages if msg.get("kind") == "tool")


def _process_session(
    session_data: dict,
    word_aggregator: dict[tuple[str, str], int],
    tool_aggregator: dict[tuple[str, str], int],
    source_system: str | None = None,
    by_source_aggregator: dict[tuple[str, str], int] | None = None,
) -> None:
    started_at = session_data.get("started_at")
    cwd = session_data.get("cwd")
    messages = session_data.get("messages", [])

    date_str = _parse_date(started_at) if started_at else None
    project = _extract_project_name(cwd) if cwd else None

    if not date_str or not project:
        return

    key = (date_str, project)
    wc = _count_words(messages)
    word_aggregator[key] = word_aggregator.get(key, 0) + wc
    tool_aggregator[key] = tool_aggregator.get(key, 0) + _count_tools(messages)

    if source_system and by_source_aggregator is not None:
        sk = (date_str, source_system)
        by_source_aggregator[sk] = by_source_aggregator.get(sk, 0) + wc

    for child in session_data.get("child_sessions") or []:
        if isinstance(child, dict):
            _process_session(
                child, word_aggregator, tool_aggregator,
                source_system=source_system, by_source_aggregator=by_source_aggregator,
            )


def _build_series_result(aggregator: dict[tuple[str, str], int]) -> dict:
    if not aggregator:
        return {"dates": [], "projects": [], "series": {}}
    all_dates = sorted(set(d for d, _ in aggregator.keys()))
    all_projects = sorted(set(p for _, p in aggregator.keys()))
    if all_dates:
        min_date = datetime.strptime(all_dates[0], "%Y-%m-%d")
        max_date = datetime.strptime(all_dates[-1], "%Y-%m-%d")
        filled_dates = []
        current = min_date
        while current <= max_date:
            filled_dates.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
    else:
        filled_dates = []
    series = {
        project: [aggregator.get((date, project), 0) for date in filled_dates]
        for project in all_projects
    }
    return {"dates": filled_dates, "projects": all_projects, "series": series}


def _compute_aggregates(
    history_path: Path,
    word_aggregator: dict[tuple[str, str], int],
    tool_aggregator: dict[tuple[str, str], int],
    by_source_aggregator: dict[tuple[str, str], int] | None = None,
) -> None:
    for json_file in history_path.glob("**/.*.json"):
        try:
            session_data = json.loads(json_file.read_text(encoding="utf-8"))
            try:
                rel = json_file.relative_to(history_path)
                source = rel.parts[1] if len(rel.parts) >= 2 else session_data.get("source_system") or "unknown"
            except ValueError:
                source = session_data.get("source_system") or "unknown"
            _process_session(
                session_data, word_aggregator, tool_aggregator,
                source_system=source if by_source_aggregator is not None else None,
                by_source_aggregator=by_source_aggregator,
            )
        except (json.JSONDecodeError, OSError) as e:
            print(f"Warning: Failed to process {json_file}: {e}", file=sys.stderr)


def compute_word_series(history_path: Path) -> dict:
    """Aggregate word counts per day per project. Returns dates, projects, series."""
    word_agg: dict[tuple[str, str], int] = {}
    tool_agg: dict[tuple[str, str], int] = {}
    _compute_aggregates(history_path, word_agg, tool_agg)
    return _build_series_result(word_agg)


def compute_stats_series(history_path: Path) -> dict:
    word_agg: dict[tuple[str, str], int] = {}
    tool_agg: dict[tuple[str, str], int] = {}
    by_source_agg: dict[tuple[str, str], int] = {}
    _compute_aggregates(history_path, word_agg, tool_agg, by_source_aggregator=by_source_agg)
    return {
        "word": _build_series_result(word_agg),
        "tool": _build_series_result(tool_agg),
        "by_source": _build_series_result(by_source_agg),
    }
