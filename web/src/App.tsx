import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SessionList } from "@/components/explore/SessionList";
import { SessionPreview } from "@/components/explore/SessionPreview";
import { StackedChart } from "@/components/stats/StackedChart";
import { ExpandedChart } from "@/components/stats/ExpandedChart";
import { StackedSourceChart } from "@/components/stats/StackedSourceChart";
import { Session, StatsData, fetchStats } from "@/lib/api";

export default function App() {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("explore");
  const [searchFocusRef, setSearchFocusRef] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/") {
        const tag = (e.target as HTMLElement)?.tagName ?? "";
        if (!["INPUT", "TEXTAREA"].includes(tag)) {
          e.preventDefault();
          searchFocusRef?.();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchFocusRef]);

  // Load stats when switching to stats tab
  useEffect(() => {
    if (activeTab !== "stats" || statsData) return;
    setStatsLoading(true);
    fetchStats()
      .then(setStatsData)
      .catch((e) => setStatsError(e.message))
      .finally(() => setStatsLoading(false));
  }, [activeTab, statsData]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-2 flex items-center justify-between shrink-0">
        <span className="font-mono font-semibold text-sm">
          convx
        </span>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="explore">Explore</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "explore" && (
          <div className="flex h-full">
            {/* Left: session list */}
            <div className="w-80 shrink-0 border-r h-full overflow-hidden">
              <SessionList
                onSelect={setSelectedSession}
                selected={selectedSession}
                onSearchFocusRef={setSearchFocusRef}
              />
            </div>
            {/* Right: preview */}
            <div className="flex-1 h-full overflow-hidden">
              <SessionPreview session={selectedSession} />
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="p-6 space-y-8 overflow-auto h-full">
            {statsLoading && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}
            {statsError && (
              <div className="text-sm text-destructive">
                Error: {statsError}
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold mb-1">
                Volume by source
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Stacked area — word count per day (Codex / Claude / Cursor)
              </p>
              {statsData && <StackedSourceChart data={statsData} />}
            </div>
            {statsData && statsData.word.projects.length > 1 && (
              <>
                <div>
                  <h2 className="text-base font-semibold mb-1">
                    Word volume by project
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Stacked area — absolute word count per day
                  </p>
                  <StackedChart data={statsData} />
                </div>

                <div>
                  <h2 className="text-base font-semibold mb-1">
                    Project share over time
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Stacked area — percentage share per day
                  </p>
                  <ExpandedChart data={statsData} />
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
