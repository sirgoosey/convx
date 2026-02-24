from __future__ import annotations

import tomllib
from pathlib import Path

SANITIZED = "[SANITIZED]"


def load_sanitize_keywords(repo_path: Path) -> list[str]:
    """Load keyword list from .convx/sanitize.toml in the output repo.

    Returns an empty list if the file does not exist or contains no keywords.
    """
    config_path = repo_path / ".convx" / "sanitize.toml"
    if not config_path.exists():
        return []
    try:
        with config_path.open("rb") as f:
            data = tomllib.load(f)
        keywords = data.get("keywords", [])
        if isinstance(keywords, list):
            return [str(k) for k in keywords if k]
        return []
    except (tomllib.TOMLDecodeError, OSError):
        return []


def sanitize_lines(text: str, keywords: list[str]) -> str:
    """Replace any line containing a keyword (case-insensitive) with [SANITIZED]."""
    if not keywords:
        return text
    lower_keywords = [k.lower() for k in keywords]
    lines = text.split("\n")
    result = []
    for line in lines:
        if any(kw in line.lower() for kw in lower_keywords):
            result.append(SANITIZED)
        else:
            result.append(line)
    return "\n".join(result)
