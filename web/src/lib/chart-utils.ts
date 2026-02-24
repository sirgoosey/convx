export const CHART_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed",
  "#0891b2", "#be185d", "#65a30d", "#ea580c", "#6366f1",
];

/**
 * Bucket a date-indexed series into weekly aggregates when there are more than 60 dates.
 * Returns an array of records with `date` plus one key per series name.
 */
export function bucketSeries(
  dates: string[],
  seriesNames: string[],
  series: Record<string, number[]>,
): Array<Record<string, number | string>> {
  const bucketSize = dates.length > 60 ? 7 : 1;
  const buckets: Array<Record<string, number | string>> = [];
  for (let i = 0; i < dates.length; i += bucketSize) {
    const entry: Record<string, number | string> = { date: dates[i] };
    for (const name of seriesNames) {
      let sum = 0;
      for (let j = i; j < Math.min(i + bucketSize, dates.length); j++) {
        sum += series[name]?.[j] ?? 0;
      }
      entry[name] = sum;
    }
    buckets.push(entry);
  }
  return buckets;
}

/**
 * Rank series names by total value descending and return the top N.
 */
export function topNByTotal(
  names: string[],
  series: Record<string, number[]>,
  n: number,
): string[] {
  return names
    .map((name) => ({ name, total: series[name]?.reduce((a, b) => a + b, 0) ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
    .map((p) => p.name);
}
