// What the file manager shows instead of a `$chart_*.json`: the chart itself. A
// spec is not something anyone reads to find out what it draws.
export default async function (ctx: Context, _session: Session | null, opts: { path: string }): Promise<string | null> {
    const chart = await ctx.fns.chart.load({ file: opts.path }).catch(() => null);
    if (!chart) return null;                                     // malformed — the JSON view says why

    return `<div class="flex items-baseline justify-between gap-4 border-b border-border-subtle bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">
  <span>Vega-Lite chart${chart.dataSource?.sql ? " · one SELECT" : ""}</span>
  <a class="shrink-0 text-text-link hover:underline" href="/chart/view?id=${encodeURIComponent(chart.id)}"
    hx-get="/chart/view?id=${encodeURIComponent(chart.id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">open in Charts</a>
</div>
<div class="p-4" ${ctx.fns.ui.attr({ entity: "chart", id: chart.id })}>${await ctx.fns.chart.render({ chart, height: 260 })}</div>`;
}
