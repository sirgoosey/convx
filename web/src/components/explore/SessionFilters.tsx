"use client";

import { useState, useMemo } from "react";
import {
  ListFilter,
  Sparkles,
  Terminal,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Session, sessionProject } from "@/lib/api";

const SOURCES = ["claude", "cursor", "codex"] as const;

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  claude: <Sparkles className="size-4 text-orange-600" />,
  codex: <Terminal className="size-4 text-green-600" />,
  cursor: <MousePointerClick className="size-4 text-blue-600" />,
};

interface SessionFiltersProps {
  sessions: Session[];
  sources: Set<string>;
  projects: Set<string>;
  onSourcesChange: (sources: Set<string>) => void;
  onProjectsChange: (projects: Set<string>) => void;
}

export function SessionFilters({
  sessions,
  sources,
  projects,
  onSourcesChange,
  onProjectsChange,
}: SessionFiltersProps) {
  const [projectSearch, setProjectSearch] = useState("");

  const allProjects = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      const p = sessionProject(s);
      if (p) set.add(p);
    }
    return Array.from(set).sort();
  }, [sessions]);

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return allProjects;
    const q = projectSearch.toLowerCase();
    return allProjects.filter((p) => p.toLowerCase().includes(q));
  }, [allProjects, projectSearch]);

  const toggleSource = (source: string) => {
    const next = new Set(sources);
    if (next.has(source)) next.delete(source);
    else next.add(source);
    onSourcesChange(next);
  };

  const toggleProject = (project: string) => {
    const next = new Set(projects);
    if (next.has(project)) next.delete(project);
    else next.add(project);
    onProjectsChange(next);
  };

  const activeCount = sources.size + projects.size;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 relative"
          title="Filters"
        >
          <ListFilter className="h-4 w-4" />
          {activeCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 p-0 justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Tools submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Tools
            {sources.size > 0 && (
              <Badge variant="secondary" className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px]">
                {sources.size}
              </Badge>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Show sessions from
            </DropdownMenuLabel>
            {SOURCES.map((source) => (
              <DropdownMenuCheckboxItem
                key={source}
                checked={sources.has(source)}
                onCheckedChange={() => toggleSource(source)}
              >
                <span className="flex items-center gap-2">
                  {SOURCE_ICONS[source]}
                  <span className="capitalize">{source}</span>
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Projects submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Projects
            {projects.size > 0 && (
              <Badge variant="secondary" className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px]">
                {projects.size}
              </Badge>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52 p-0">
            <div className="p-2">
              <Input
                placeholder="Search projects…"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="h-7 text-xs"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <DropdownMenuSeparator className="my-0" />
            <div className="max-h-48 overflow-y-auto p-1">
              {filteredProjects.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No projects
                </p>
              ) : (
                filteredProjects.map((project) => (
                  <DropdownMenuCheckboxItem
                    key={project}
                    checked={projects.has(project)}
                    onCheckedChange={() => toggleProject(project)}
                  >
                    <span className="truncate">{project}</span>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
