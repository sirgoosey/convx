"""Tests for word count statistics aggregation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from convx_ai.stats import (
    _count_words,
    _extract_project_name,
    _parse_date,
    _process_session,
    compute_word_series,
)


def test_parse_date_valid_iso8601() -> None:
    """Test parsing valid ISO 8601 timestamps."""
    assert _parse_date("2026-02-19T18:05:59.880000Z") == "2026-02-19"
    assert _parse_date("2026-01-01T00:00:00Z") == "2026-01-01"
    assert _parse_date("2026-12-31T23:59:59.999999Z") == "2026-12-31"


def test_parse_date_invalid_returns_none() -> None:
    """Test that invalid timestamps return None."""
    assert _parse_date("invalid") is None
    assert _parse_date("") is None
    assert _parse_date("2026-13-45") is None


def test_extract_project_name_valid() -> None:
    """Test extracting project name from valid cwd paths."""
    assert _extract_project_name("/Users/pascal/Code/business/convx") == "convx"
    assert _extract_project_name("/home/user/projects/my-app") == "my-app"
    assert _extract_project_name("/simple") == "simple"


def test_extract_project_name_empty_returns_none() -> None:
    """Test that empty or whitespace cwd returns None."""
    assert _extract_project_name("") is None
    assert _extract_project_name("   ") is None


def test_count_words_user_and_assistant_only() -> None:
    """Test word counting only includes user and assistant messages."""
    messages = [
        {"kind": "user", "text": "hello world"},
        {"kind": "assistant", "text": "hi there friend"},
        {"kind": "system", "text": "this should be ignored"},
        {"kind": "tool", "text": "also ignored"},
    ]
    assert _count_words(messages) == 5  # 2 + 3


def test_count_words_empty_messages() -> None:
    """Test word counting with empty message list."""
    assert _count_words([]) == 0


def test_count_words_missing_text_field() -> None:
    """Test word counting handles missing text field gracefully."""
    messages = [
        {"kind": "user", "text": "hello"},
        {"kind": "assistant"},  # missing 'text'
    ]
    assert _count_words(messages) == 1


def test_process_session_basic() -> None:
    """Test processing a basic session."""
    session = {
        "started_at": "2026-02-19T18:05:59.880000Z",
        "cwd": "/Users/pascal/Code/convx",
        "messages": [
            {"kind": "user", "text": "hello world"},
            {"kind": "assistant", "text": "hi there"},
        ],
    }
    word_agg: dict[tuple[str, str], int] = {}
    tool_agg: dict[tuple[str, str], int] = {}
    _process_session(session, word_agg, tool_agg)

    assert word_agg == {("2026-02-19", "convx"): 4}
    assert tool_agg == {("2026-02-19", "convx"): 0}


def test_process_session_with_children() -> None:
    """Test processing a session with child sessions."""
    session = {
        "started_at": "2026-02-19T10:00:00Z",
        "cwd": "/Users/pascal/Code/convx",
        "messages": [{"kind": "user", "text": "hello"}],
        "child_sessions": [
            {
                "started_at": "2026-02-19T11:00:00Z",
                "cwd": "/Users/pascal/Code/convx",
                "messages": [{"kind": "assistant", "text": "hi there"}],
            },
        ],
    }
    word_agg: dict[tuple[str, str], int] = {}
    tool_agg: dict[tuple[str, str], int] = {}
    _process_session(session, word_agg, tool_agg)

    assert word_agg == {("2026-02-19", "convx"): 3}


def test_process_session_skips_invalid() -> None:
    """Test that sessions with missing required fields are skipped."""
    word_agg: dict[tuple[str, str], int] = {}
    tool_agg: dict[tuple[str, str], int] = {}

    _process_session(
        {"cwd": "/Users/pascal/Code/convx", "messages": [{"kind": "user", "text": "test"}]},
        word_agg,
        tool_agg,
    )
    assert len(word_agg) == 0

    _process_session(
        {"started_at": "2026-02-19T10:00:00Z", "messages": [{"kind": "user", "text": "test"}]},
        word_agg,
        tool_agg,
    )
    assert len(word_agg) == 0

    _process_session(
        {"started_at": "2026-02-19T10:00:00Z", "cwd": "", "messages": [{"kind": "user", "text": "test"}]},
        word_agg,
        tool_agg,
    )
    assert len(word_agg) == 0


def test_compute_word_series_empty_directory(tmp_path: Path) -> None:
    """Test compute_word_series with no JSON files."""
    history_path = tmp_path / "history"
    history_path.mkdir()

    result = compute_word_series(history_path)

    assert result == {"dates": [], "projects": [], "series": {}}


def test_compute_word_series_single_project(tmp_path: Path) -> None:
    """Test compute_word_series with a single project."""
    history_path = tmp_path / "history"
    history_path.mkdir()

    session_file = history_path / ".2026-02-19-test.json"
    session_data = {
        "started_at": "2026-02-19T10:00:00Z",
        "cwd": "/Users/test/project-a",
        "messages": [
            {"kind": "user", "text": "one two three"},
            {"kind": "assistant", "text": "four five"},
        ],
    }
    session_file.write_text(json.dumps(session_data))

    result = compute_word_series(history_path)

    assert result["dates"] == ["2026-02-19"]
    assert result["projects"] == ["project-a"]
    assert result["series"]["project-a"] == [5]


def test_compute_word_series_fills_date_gaps(tmp_path: Path) -> None:
    """Test that date gaps are filled with zeros."""
    history_path = tmp_path / "history"
    history_path.mkdir()

    # Create sessions on 2026-02-19 and 2026-02-21 (skip 2026-02-20)
    session1 = history_path / ".2026-02-19-test.json"
    session1.write_text(
        json.dumps(
            {
                "started_at": "2026-02-19T10:00:00Z",
                "cwd": "/Users/test/myapp",
                "messages": [{"kind": "user", "text": "hello"}],
            }
        )
    )

    session2 = history_path / ".2026-02-21-test.json"
    session2.write_text(
        json.dumps(
            {
                "started_at": "2026-02-21T10:00:00Z",
                "cwd": "/Users/test/myapp",
                "messages": [{"kind": "user", "text": "world"}],
            }
        )
    )

    result = compute_word_series(history_path)

    assert result["dates"] == ["2026-02-19", "2026-02-20", "2026-02-21"]
    assert result["projects"] == ["myapp"]
    assert result["series"]["myapp"] == [1, 0, 1]


def test_compute_word_series_multiple_projects(tmp_path: Path) -> None:
    """Test word series with multiple projects."""
    history_path = tmp_path / "history"
    history_path.mkdir()

    session1 = history_path / ".2026-02-19-proj1.json"
    session1.write_text(
        json.dumps(
            {
                "started_at": "2026-02-19T10:00:00Z",
                "cwd": "/Users/test/alpha",
                "messages": [{"kind": "user", "text": "one two"}],
            }
        )
    )

    session2 = history_path / ".2026-02-19-proj2.json"
    session2.write_text(
        json.dumps(
            {
                "started_at": "2026-02-19T10:00:00Z",
                "cwd": "/Users/test/beta",
                "messages": [{"kind": "user", "text": "three"}],
            }
        )
    )

    result = compute_word_series(history_path)

    assert result["dates"] == ["2026-02-19"]
    assert sorted(result["projects"]) == ["alpha", "beta"]
    assert result["series"]["alpha"] == [2]
    assert result["series"]["beta"] == [1]


def test_compute_word_series_accumulates_same_day_project(tmp_path: Path) -> None:
    """Test that multiple sessions on the same day for the same project accumulate."""
    history_path = tmp_path / "history"
    history_path.mkdir()

    session1 = history_path / ".2026-02-19-morning.json"
    session1.write_text(
        json.dumps(
            {
                "started_at": "2026-02-19T08:00:00Z",
                "cwd": "/Users/test/app",
                "messages": [{"kind": "user", "text": "one two"}],
            }
        )
    )

    session2 = history_path / ".2026-02-19-afternoon.json"
    session2.write_text(
        json.dumps(
            {
                "started_at": "2026-02-19T14:00:00Z",
                "cwd": "/Users/test/app",
                "messages": [{"kind": "user", "text": "three four five"}],
            }
        )
    )

    result = compute_word_series(history_path)

    assert result["dates"] == ["2026-02-19"]
    assert result["projects"] == ["app"]
    assert result["series"]["app"] == [5]  # 2 + 3


def test_compute_word_series_skips_malformed_json(tmp_path: Path, capsys: Any) -> None:
    """Test that malformed JSON files are skipped with a warning."""
    history_path = tmp_path / "history"
    history_path.mkdir()

    # Valid session
    valid = history_path / ".valid.json"
    valid.write_text(
        json.dumps(
            {
                "started_at": "2026-02-19T10:00:00Z",
                "cwd": "/Users/test/app",
                "messages": [{"kind": "user", "text": "hello"}],
            }
        )
    )

    # Malformed JSON
    invalid = history_path / ".invalid.json"
    invalid.write_text("{invalid json}")

    result = compute_word_series(history_path)

    # Should only process valid session
    assert result["dates"] == ["2026-02-19"]
    assert result["projects"] == ["app"]
    assert result["series"]["app"] == [1]

    # Check warning was printed
    captured = capsys.readouterr()
    assert "Warning: Failed to process" in captured.err
    assert ".invalid.json" in captured.err


def test_compute_word_series_nested_directories(tmp_path: Path) -> None:
    """Test that JSON files in nested directories are discovered."""
    history_path = tmp_path / "history"
    nested = history_path / "user" / "source" / "2026"
    nested.mkdir(parents=True)

    session = nested / ".session.json"
    session.write_text(
        json.dumps(
            {
                "started_at": "2026-02-19T10:00:00Z",
                "cwd": "/Users/test/project",
                "messages": [{"kind": "user", "text": "nested test"}],
            }
        )
    )

    result = compute_word_series(history_path)

    assert result["dates"] == ["2026-02-19"]
    assert result["projects"] == ["project"]
    assert result["series"]["project"] == [2]
