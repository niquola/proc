// GET /chart — every chart the project declares, drawn small. A list of chart
// names would be useless: the point of a chart is what it looks like.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    const charts = await ctx.fns.chart.local({});
    const drawn = await Promise.all(charts.map(async c => {
        const chart = await ctx.fns.chart.load({ id: c.id }).catch(() => null);
        return { ...c, html: chart ? await ctx.fns.chart.render({ chart, height: 180 }) : ctx.fns.ui.notice({ text: `${c.file} is not readable`, tone: "danger" }) };
    }));

    return {
        title: "charts",
        main: ctx.fns.ui.page({
            page: "charts",
            title: "Charts",
            lead: `A chart is a <span class="font-mono">$chart_&lt;id&gt;.json</span>: a Vega-Lite spec, and a small <span class="font-mono">SELECT</span> over a materialized view. Put the FHIR extraction in the view, not in the chart.`,
            main: charts.length
                ? drawn.map(c => ctx.fns.ui.box({
                    class: "mt-4",
                    title: c.title,
                    right: `<a class="text-text-link hover:underline" href="/chart/view?id=${encodeURIComponent(c.id)}"
      hx-get="/chart/view?id=${encodeURIComponent(c.id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"
      ${ctx.fns.ui.attr({ entity: "chart", id: c.id })}>open</a>`,
                    body: `<div class="border-t border-border-subtle p-4">${c.html}</div>`,
                })).join("")
                : ctx.fns.ui.box({ class: "mt-4", title: "0 in this project", body: "", empty: "none yet — write $chart_<id>.json with { dataSource: { sql }, spec }" }),
        }),
    };
}
