"""Minimal stdlib HTTP server for the convx web dashboard."""

from __future__ import annotations

import json
import mimetypes
import socket
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


class ConvxHandler(BaseHTTPRequestHandler):
    repo: Path  # set on the class by ConvxServer

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        pass  # suppress default request logging

    def send_json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, content_type: str = "text/plain; charset=utf-8", status: int = 200) -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/sessions":
            self._handle_sessions()
        elif path.startswith("/api/sessions/") and path.endswith("/content"):
            raw_key = path[len("/api/sessions/"):-len("/content")]
            key = urllib.parse.unquote(raw_key)
            self._handle_session_content(key)
        elif path.startswith("/api/sessions/") and path.endswith("/json"):
            raw_key = path[len("/api/sessions/"):-len("/json")]
            key = urllib.parse.unquote(raw_key)
            self._handle_session_json(key)
        elif path == "/api/search":
            q = query.get("q", [""])[0]
            self._handle_search(q)
        elif path == "/api/stats":
            self._handle_stats()
        else:
            self._handle_static(path)

    def _handle_sessions(self) -> None:
        from convx_ai.search import list_sessions

        sessions = list_sessions(self.repo)
        self.send_json(sessions)

    def _load_session_record(self, key: str) -> dict | None:
        """Load a session record from the index, sending error responses on failure."""
        index_path = self.repo / ".convx" / "index.json"
        if not index_path.exists():
            self.send_json({"error": "Index not found"}, 404)
            return None
        try:
            index_data = json.loads(index_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            self.send_json({"error": "Failed to read index"}, 500)
            return None
        record = index_data.get("sessions", {}).get(key)
        if not record:
            self.send_json({"error": "Session not found"}, 404)
            return None
        return record

    def _read_record_file(self, record: dict, path_key: str) -> str | None:
        """Read a file referenced by path_key in a session record, sending errors on failure."""
        rel = record.get(path_key)
        if not rel:
            self.send_json({"error": f"No {path_key} in record"}, 404)
            return None
        file_path = self.repo / rel
        if not file_path.exists():
            self.send_json({"error": "File not found"}, 404)
            return None
        try:
            return file_path.read_text(encoding="utf-8")
        except OSError:
            self.send_json({"error": "Failed to read file"}, 500)
            return None

    def _handle_session_content(self, key: str) -> None:
        record = self._load_session_record(key)
        if not record:
            return
        content = self._read_record_file(record, "markdown_path")
        if content is not None:
            self.send_text(content, content_type="text/markdown; charset=utf-8")

    def _handle_session_json(self, key: str) -> None:
        record = self._load_session_record(key)
        if not record:
            return
        raw = self._read_record_file(record, "json_path")
        if raw is None:
            return
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, 500)
            return
        self.send_json(data)

    def _handle_search(self, q: str) -> None:
        if not q.strip():
            self.send_json([])
            return
        try:
            from convx_ai.search import query_index

            results = query_index(self.repo, q)
            self.send_json(results)
        except Exception:
            self.send_json([])

    def _handle_stats(self) -> None:
        try:
            from convx_ai.config import ConvxConfig
            from convx_ai.stats import compute_stats_series, pick_history_path

            config = ConvxConfig.for_repo(self.repo)
            history_path = pick_history_path(
                self.repo,
                [
                    config.word_stats.history_subpath,
                    config.sync.history_subpath,
                    config.backup.history_subpath,
                    ".ai/history",
                    "history",
                ],
            )
            if history_path is None:
                self.send_json({
                    "word": {"dates": [], "projects": [], "series": {}},
                    "tool": {"dates": [], "projects": [], "series": {}},
                    "by_source": {"dates": [], "projects": [], "series": {}},
                })
                return
            data = compute_stats_series(history_path)
            self.send_json(data)
        except Exception as exc:
            self.send_json({"error": str(exc)}, 500)

    def _handle_static(self, path: str) -> None:
        from importlib.resources import files

        web_pkg = files("convx_ai.web")
        rel = path.lstrip("/") or "index.html"
        try:
            parts = [p for p in rel.split("/") if p and p not in (".", "..")]
            resource = web_pkg
            for part in parts:
                resource = resource.joinpath(part)  # type: ignore[assignment]
            body = resource.read_bytes()
            content_type, _ = mimetypes.guess_type(rel)
            if content_type is None:
                content_type = "application/octet-stream"
        except Exception:
            # SPA fallback: serve index.html for unknown routes
            try:
                body = web_pkg.joinpath("index.html").read_bytes()  # type: ignore[assignment]
                content_type = "text/html; charset=utf-8"
            except Exception:
                self.send_error(404, "Not found")
                return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ConvxServer:
    def __init__(self, repo: Path, port: int = 0) -> None:
        self.repo = repo
        # Bind handler class with repo attached
        handler_class = type("BoundConvxHandler", (ConvxHandler,), {"repo": repo})
        if port == 0:
            port = find_free_port()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", port), handler_class)
        self.port: int = self.httpd.server_address[1]

    def serve_forever_in_thread(self) -> None:
        import threading

        t = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        t.start()

    def shutdown(self) -> None:
        self.httpd.shutdown()
