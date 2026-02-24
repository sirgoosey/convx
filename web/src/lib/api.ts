export interface Session {
  session_key: string;
  title: string;
  date: string;
  source: string;
  path: string;
  user: string;
  folder: string;
  project?: string;
}

export interface SessionMessage {
  kind: "user" | "assistant" | "system" | "tool" | "thinking";
  role: string;
  text: string;
  timestamp?: string;
}

export interface SessionData {
  session_key?: string;
  source_system: string;
  session_id: string;
  started_at: string;
  user: string;
  system_name: string;
  cwd: string;
  messages: SessionMessage[];
}

export interface SeriesData {
  dates: string[];
  projects: string[];
  series: Record<string, number[]>;
}

export interface StatsData {
  word: SeriesData;
  tool: SeriesData;
  by_source?: SeriesData;
}

const BASE = "";

export function humanTitle(session: Session): string {
  const title = session.title || "";
  return title
    .replace(/^\d{4}-\d{2}-\d{2}-\d{4}-/, "")
    .replace(/-/g, " ")
    .trim();
}

export function sessionProject(session: Session): string {
  return session.project || session.folder?.split("/").pop() || "";
}

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch(`${BASE}/api/sessions`);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
  return res.json();
}

export async function fetchSessionContent(key: string): Promise<string> {
  const res = await fetch(
    `${BASE}/api/sessions/${encodeURIComponent(key)}/content`
  );
  if (!res.ok) throw new Error(`Failed to fetch content: ${res.status}`);
  return res.text();
}

export async function fetchSessionJson(key: string): Promise<SessionData> {
  const res = await fetch(
    `${BASE}/api/sessions/${encodeURIComponent(key)}/json`
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`);
  if (text.trimStart().startsWith("<")) {
    throw new Error("API returned HTML. Start backend: uv run convx explore");
  }
  try {
    return JSON.parse(text) as SessionData;
  } catch {
    throw new Error("Invalid JSON from API");
  }
}

export async function searchSessions(q: string): Promise<Session[]> {
  if (!q.trim()) return [];
  const res = await fetch(
    `${BASE}/api/search?q=${encodeURIComponent(q)}`
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

const emptySeries: SeriesData = { dates: [], projects: [], series: {} };

export async function fetchStats(): Promise<StatsData> {
  const res = await fetch(`${BASE}/api/stats`);
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  const raw = await res.json();
  if (raw.word && raw.tool) {
    return {
      word: raw.word,
      tool: raw.tool,
      by_source: raw.by_source ?? emptySeries,
    } as StatsData;
  }
  return { word: raw as SeriesData, tool: emptySeries };
}
