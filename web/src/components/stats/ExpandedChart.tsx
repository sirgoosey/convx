import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { StatsData } from "@/lib/api";
import { CHART_COLORS, bucketSeries, topNByTotal } from "@/lib/chart-utils";

interface ExpandedChartProps {
  data: StatsData;
  topN?: number;
}

export function ExpandedChart({ data, topN = 10 }: ExpandedChartProps) {
  const word = data?.word;
  if (!word?.dates?.length) {
    return <div className="text-muted-foreground text-sm p-4">No data.</div>;
  }

  const top = topNByTotal(word.projects, word.series, topN);
  const rawBuckets = bucketSeries(word.dates, top, word.series);

  // Normalize each bucket to percentages
  const buckets = rawBuckets.map((entry) => {
    const normalized: Record<string, number | string> = { date: entry.date };
    let rowTotal = 0;
    for (const project of top) {
      rowTotal += (entry[project] as number) || 0;
    }
    for (const project of top) {
      normalized[project] = rowTotal > 0
        ? (((entry[project] as number) || 0) / rowTotal) * 100
        : 0;
    }
    return normalized;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={buckets} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} stackOffset="expand">
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis tickFormatter={(v: number) => `${Math.round(v)}%`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
        <Legend align="left" formatter={(_: any, entry: any) => (entry as { dataKey?: string })?.dataKey ?? ""} />
        {top.map((project, idx) => (
          <Area
            key={project}
            type="monotone"
            dataKey={project}
            stackId="1"
            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
            fill={CHART_COLORS[idx % CHART_COLORS.length]}
            fillOpacity={0.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
