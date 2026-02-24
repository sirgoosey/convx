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

interface StackedChartProps {
  data: StatsData;
  topN?: number;
}

export function StackedChart({ data, topN = 10 }: StackedChartProps) {
  const word = data?.word;
  if (!word?.dates?.length) {
    return <div className="text-muted-foreground text-sm p-4">No data.</div>;
  }

  const top = topNByTotal(word.projects, word.series, topN);
  const buckets = bucketSeries(word.dates, top, word.series);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={buckets} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend align="left" />
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
