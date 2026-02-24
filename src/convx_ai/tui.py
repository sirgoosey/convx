from __future__ import annotations

import asyncio
import re
from pathlib import Path

from rapidfuzz import fuzz, process
from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Vertical, VerticalScroll
from textual.screen import Screen
from textual.widgets import Footer, Header, Input, Label, ListItem, ListView, Markdown
from textual_plotext import PlotextPlot

from convx_ai.search import list_sessions, query_index
from convx_ai.stats import compute_word_series


def _slug_only(basename: str) -> str:
    return re.sub(r"^\d{4}-\d{2}-\d{2}-\d{4}-", "", basename)


def _slug_readable(slug: str) -> str:
    return slug.replace("-", " ")


def _compact_folder(path: str, max_width: int) -> str:
    """Fish-style: abbreviate intermediate segments to first 3 chars, keep last full."""
    if not path:
        return ""
    parts = path.split("/")
    if len(parts) == 1:
        return path[:max_width] if len(path) > max_width else path
    intermediates = [p[:3] for p in parts[:-1]]
    last = parts[-1]
    compacted = "/".join(intermediates) + "/" + last
    if len(compacted) > max_width:
        return "..." + compacted[-(max_width - 3) :]
    return compacted


W_USER = 8
W_DATE = 10
W_SOURCE = 8
W_FOLDER = 26
W_SLUG = 44


def _cell(s: str, width: int) -> str:
    if len(s) > width:
        s = s[: width - 3] + "..."
    return s.ljust(width)[:width]


def _format_session(s: dict) -> str:
    user = _cell((s.get("user") or ""), W_USER)
    date = _cell((s.get("date") or "")[:10], W_DATE)
    source = _cell((s.get("source") or ""), W_SOURCE)
    folder_raw = s.get("folder", "")
    folder = _cell(_compact_folder(folder_raw, W_FOLDER), W_FOLDER)
    slug = _cell(_slug_readable(_slug_only(s.get("title") or "")), W_SLUG)
    return f"{user} {date} {source} {folder} │ {slug}"


class StatsScreen(Screen):
    """Screen showing word count statistics per project over time."""

    TITLE = "Word count by project"
    BINDINGS = [
        Binding("escape", "dismiss", "Back"),
        Binding("q", "dismiss", "Back", show=False),
    ]

    def __init__(self, repo: Path) -> None:
        super().__init__()
        self.repo = repo

    def compose(self) -> ComposeResult:
        yield Header()
        with Vertical():
            yield Label("Loading statistics...", id="stats_loading")
            yield PlotextPlot(id="stats_chart")
        yield Footer()

    def on_mount(self) -> None:
        # Hide chart initially, show loading message
        self.query_one("#stats_chart").display = False
        self._load_data()

    @work(exclusive=True)
    async def _load_data(self) -> None:
        """Load word series data in background thread and render chart."""
        # Run compute_word_series in executor to avoid blocking UI
        data = await asyncio.get_event_loop().run_in_executor(
            None, lambda: compute_word_series(self.repo / "history")
        )

        # Render chart on UI thread
        self._render_chart(data)

    @staticmethod
    def _bucket_weekly(
        dates: list[str], plot_series: list[tuple[str, list[int]]]
    ) -> tuple[list[str], list[tuple[str, list[int]]]]:
        """Re-aggregate daily series into ISO week buckets."""
        from datetime import datetime

        week_order: list[str] = []
        # week_label -> project -> total
        week_totals: dict[str, dict[str, int]] = {}

        for i, date_str in enumerate(dates):
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            year, week, _ = dt.isocalendar()
            label = f"{year}-W{week:02d}"
            if label not in week_totals:
                week_totals[label] = {}
                week_order.append(label)
            for proj, values in plot_series:
                week_totals[label][proj] = week_totals[label].get(proj, 0) + values[i]

        bucketed = [
            (proj, [week_totals[w].get(proj, 0) for w in week_order])
            for proj, _ in plot_series
        ]
        return week_order, bucketed

    def _render_chart(self, data: dict) -> None:
        """Render stacked bar chart, bucketed by day (≤30 d) or week (>30 d)."""
        dates = data["dates"]
        projects = data["projects"]
        series = data["series"]

        self.query_one("#stats_loading").display = False
        chart = self.query_one("#stats_chart", PlotextPlot)
        chart.display = True

        if not dates or not projects:
            chart.plt.title("No data available")
            chart.refresh()
            return

        _COLORS = [
            "red", "green", "blue", "yellow", "magenta",
            "cyan", "orange", "pink", "violet", "lime", "white",
        ]

        # Top 10 + others
        totals = {p: sum(series[p]) for p in projects}
        ranked = sorted(projects, key=lambda p: totals[p], reverse=True)
        top10 = ranked[:10]
        rest = ranked[10:]

        plot_series: list[tuple[str, list[int]]] = [(p, series[p]) for p in top10]
        if rest:
            others = [sum(series[p][i] for p in rest) for i in range(len(dates))]
            plot_series.append(("others", others))

        # Bucket by day or week
        use_weekly = len(dates) > 30
        if use_weekly:
            x_labels, plot_series = self._bucket_weekly(dates, plot_series)
            period = "week"
        else:
            x_labels = dates
            period = "day"

        # stacked_bar(labels, data, color, label)
        # data: one list per segment, each value = height for that x bucket
        bar_data = [values for _, values in plot_series]
        bar_colors = list(_COLORS[: len(plot_series)])
        bar_labels = [label for label, _ in plot_series]

        chart.plt.stacked_bar(x_labels, bar_data, color=bar_colors, labels=bar_labels)
        chart.plt.title(f"Words per project per {period}  (top 10 + others)")
        chart.plt.xlabel(period.capitalize())
        chart.plt.ylabel("Word count")

        # Force integer y-axis ticks — plotext defaults to floats
        max_y = max((sum(col) for col in zip(*bar_data)), default=0)
        if max_y > 0:
            step = max(1, max_y // 6)
            int_ticks = list(range(0, max_y + step, step))
            chart.plt.yticks(int_ticks, [f"{v:,}" for v in int_ticks])

        chart.refresh()

    def action_dismiss(self) -> None:
        """Return to main screen."""
        self.app.pop_screen()


class ExploreApp(App[None]):
    CSS_PATH = "explore.css"
    TITLE = "convx"
    SUB_TITLE = "AI session explorer"

    BINDINGS = [
        Binding("escape", "clear_search", "Clear search"),
        Binding("q", "quit", "Quit"),
        Binding("s", "stats", "Stats"),
        Binding("tab", "focus_next", "Next pane", show=False),
        Binding("shift+tab", "focus_previous", "Prev pane", show=False),
        Binding("l", "focus_list", "List", show=False),
        Binding("j", "cursor_down", "Down", show=False),
        Binding("k", "cursor_up", "Up", show=False),
        Binding("g", "cursor_home", "Top", show=False),
        Binding("G", "cursor_end", "Bottom", show=False),
    ]

    def __init__(self, repo: Path) -> None:
        super().__init__()
        self.repo = repo
        self.sessions: list[dict] = []
        self.displayed: list[dict] = []
        self._formatted: list[str] = []

    def compose(self) -> ComposeResult:
        yield Header()
        with Vertical():
            yield Input(placeholder="Search... (Enter for full-text)", id="search")
            yield ListView(id="sessions")
            with VerticalScroll(id="preview_scroll"):
                yield Markdown("", id="preview")
        yield Footer()

    def on_mount(self) -> None:
        self.sessions = list_sessions(self.repo)
        self._formatted = [_format_session(s) for s in self.sessions]
        self.displayed = self.sessions
        self._refresh_list()
        self.query_one("#sessions", ListView).focus()

    def _refresh_list(self) -> None:
        lst = self.query_one("#sessions", ListView)
        lst.clear()
        for s in self.displayed:
            lst.append(ListItem(Label(_format_session(s))))
        if self.displayed:
            lst.index = 0
            self._show_preview(self.displayed[0])
        else:
            self._show_preview(None)

    def _show_preview(self, s: dict | None) -> None:
        if s is None:
            self.query_one("#preview", Markdown).update(
                "*Select a session (↑↓ j k) to view conversation.*"
            )
            return
        path = self.repo / s["path"]
        if path.exists():
            content = path.read_text(encoding="utf-8")
            self.query_one("#preview", Markdown).update(content)
        else:
            self.query_one("#preview", Markdown).update("")

    @work(exclusive=True)
    async def _apply_fuzzy(self, query: str) -> None:
        # Debounce: if another keystroke arrives within 80ms this coroutine is
        # cancelled before we touch the DOM at all.
        await asyncio.sleep(0.08)
        if not query.strip():
            self.displayed = self.sessions
        else:
            hits = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: process.extract(
                    query,
                    self._formatted,
                    scorer=fuzz.WRatio,
                    limit=50,
                    score_cutoff=30,
                ),
            )
            self.displayed = [self.sessions[idx] for _, _, idx in hits]
        self._refresh_list()

    @work(exclusive=True)
    async def _run_tantivy(self, query: str) -> None:
        if not query.strip():
            self.displayed = self.sessions
        else:
            self.displayed = await asyncio.get_event_loop().run_in_executor(
                None, lambda: query_index(self.repo, query, limit=50)
            )
        self._refresh_list()

    def on_input_changed(self, event: Input.Changed) -> None:
        self._apply_fuzzy(event.value)

    def on_input_submitted(self, event: Input.Submitted) -> None:
        self._run_tantivy(event.value)

    def on_list_view_highlighted(self, event: ListView.Highlighted) -> None:
        lst = self.query_one("#sessions", ListView)
        idx = lst.index
        if idx is not None and 0 <= idx < len(self.displayed):
            self._show_preview(self.displayed[idx])

    def action_clear_search(self) -> None:
        self.query_one("#search", Input).value = ""
        self.displayed = self.sessions
        self._refresh_list()

    def action_cursor_down(self) -> None:
        self.query_one("#sessions", ListView).action_cursor_down()

    def action_cursor_up(self) -> None:
        self.query_one("#sessions", ListView).action_cursor_up()

    def action_cursor_home(self) -> None:
        lst = self.query_one("#sessions", ListView)
        lst.index = 0
        if self.displayed:
            self._show_preview(self.displayed[0])

    def action_cursor_end(self) -> None:
        lst = self.query_one("#sessions", ListView)
        if self.displayed:
            lst.index = len(self.displayed) - 1
            self._show_preview(self.displayed[-1])

    def action_focus_list(self) -> None:
        self.query_one("#sessions", ListView).focus()

    def action_stats(self) -> None:
        self.push_screen(StatsScreen(self.repo))
