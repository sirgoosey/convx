# Conversation d58045ed-648d-4ba8-9793-76dc4ce20475

- Source: `cursor`
- User: `pascal`
- System: `Pascals-MBP.local`
- Started: `2026-02-24T18:33:50.789000Z`
- CWD: `/Users/pascal/Code/business/convx`

## User

DOM Path: div#root > div.h-.creen flex flex-col > main.flex-1 overflow-hidden > div.p-6 .pace-y-8 overflow-auto h-full > div[1] > div.rechart.-re.pon.ive-container > div.rechart.-wrapper > svg > g[2] > g > g[4] > text > tspan
Position: top=544px, left=61px, width=15px, height=13px
React Component: Text2
HTML Element: <tspan x="52" dy="0.355em" data-cursor-element-id="cursor-el-1"></tspan> all show as 1%, make the legend left aligned

## Agent

Updating both chart components: adding `align="left"` and a legend formatter that shows only the project name (not the percentage).

## Agent

Summary of changes:

**StackedChart.tsx**
- Set `align="left"` on the Legend.

**ExpandedChart.tsx**
- Set `align="left"` on the Legend.
- Added a Legend `formatter` that uses `entry.dataKey` (project name) instead of the last data point value, so the legend shows project names instead of percentages like "1%".

The "1%" labels came from Recharts using the last data point value for each series in the 100% stacked chart. The formatter now forces the legend to show the series `dataKey` (project name) instead.
