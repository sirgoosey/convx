import { useState, useEffect, useRef, useMemo } from "react";
import { Session, fetchSessions, searchSessions, humanTitle, sessionProject } from "@/lib/api";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemFooter,
} from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SessionFilters } from "@/components/explore/SessionFilters";
import { Search, Calendar } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

interface SessionListProps {
  onSelect: (session: Session) => void;
  selected: Session | null;
  onSearchFocusRef?: (focus: () => void) => void;
}

const SOURCE_BADGE: Record<string, string> = {
  claude: "border-orange-200 bg-orange-50 text-orange-700",
  codex: "border-green-200 bg-green-50 text-green-700",
  cursor: "border-blue-200 bg-blue-50 text-blue-700",
};

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function SessionList({ onSelect, selected, onSearchFocusRef }: SessionListProps) {
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [displayed, setDisplayed] = useState<Session[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [projects, setProjects] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredByToolAndProject = useMemo(() => {
    return allSessions.filter((s) => {
      if (sources.size > 0 && !sources.has(s.source)) return false;
      const proj = sessionProject(s);
      if (projects.size > 0 && (!proj || !projects.has(proj))) return false;
      return true;
    });
  }, [allSessions, sources, projects]);

  useEffect(() => {
    onSearchFocusRef?.(() => searchInputRef.current?.focus());
  }, [onSearchFocusRef]);

  useEffect(() => {
    fetchSessions()
      .then((data) => setAllSessions(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setDisplayed(filteredByToolAndProject);
    } else {
      const lower = query.toLowerCase();
      setDisplayed(
        filteredByToolAndProject.filter(
          (s) =>
            humanTitle(s).toLowerCase().includes(lower) ||
            s.source.toLowerCase().includes(lower) ||
            s.folder.toLowerCase().includes(lower) ||
            sessionProject(s).toLowerCase().includes(lower)
        )
      );
    }
  }, [filteredByToolAndProject, query]);

  useEffect(() => {
    if (!query.trim()) {
      setDisplayed(filteredByToolAndProject);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchSessions(query);
        if (results.length > 0) {
          const filtered = results.filter((s) => {
            if (sources.size > 0 && !sources.has(s.source)) return false;
            const proj = sessionProject(s);
            if (projects.size > 0 && (!proj || !projects.has(proj))) return false;
            return true;
          });
          setDisplayed(filtered.length > 0 ? filtered : results);
        }
      } catch {
        // keep fuzzy results
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, filteredByToolAndProject, sources, projects]);

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden">
      <div className="p-3 border-b space-y-2">
        <div className="flex gap-1 items-center">
          <InputGroup className="flex-1 min-w-0">
            <InputGroupInput
              ref={searchInputRef}
              placeholder="Search sessions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <Kbd>/</Kbd>
            </InputGroupAddon>
          </InputGroup>
          <SessionFilters
            sessions={allSessions}
            sources={sources}
            projects={projects}
            onSourcesChange={setSources}
            onProjectsChange={setProjects}
          />
        </div>
        <p className="text-xs text-muted-foreground px-1">
          {searching ? "Searching…" : `${displayed.length} sessions`}
        </p>
      </div>

      <ScrollArea className="flex-1 min-w-0">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No sessions found.</div>
        ) : (
          <div className="min-w-0">
            {displayed.map((session, i) => (
              <div key={session.session_key}>
                {i > 0 && <Separator />}
                <Item
                  size="sm"
                  onClick={() => onSelect(session)}
                  className={cn(
                    "cursor-pointer rounded-none hover:bg-accent/50 transition-colors",
                    selected?.session_key === session.session_key &&
                      "bg-accent hover:bg-accent"
                  )}
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="line-clamp-2 leading-snug">
                      {humanTitle(session) || session.session_key.slice(-8)}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-1">
                      {sessionProject(session) || session.folder || "—"}
                    </ItemDescription>
                  </ItemContent>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] capitalize",
                      SOURCE_BADGE[session.source] ?? ""
                    )}
                  >
                    {session.source}
                  </Badge>
                  <ItemFooter>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatDate(session.date)}
                    </span>
                    {session.user && (
                      <span className="text-xs text-muted-foreground">
                        {session.user}
                      </span>
                    )}
                  </ItemFooter>
                </Item>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
