// GET /chart/view?id=&<param>=… — one chart, large, with the rows behind it and
// the spec that drew them. The three questions in order: what does it look like,
// what is it made of, and what exactly did I write.
//
// A chart may name its query parameters (`dataSource.paramNames`), and then the
// same spec serves many pages: /chart/view?id=vitals&patient=pt-1.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const id = url.searchParams.get("id") ?? "";
    const chart = await ctx.fns.chart.load({ id }).catch(() => null);
    if (!chart) return { title: "charts", status: 404, main: ctx.fns.ui.page({ page: "chart", main: ctx.fns.ui.notice({ text: `No chart "${id}" in this project`, tone: "danger" }) }) };

    const names: string[] = chart.dataSource?.paramNames ?? [];
    const params = names.length ? names.map(n => url.searchParams.get(n)) : undefined;
    const rows = await ctx.fns.chart.data({ chart, params: params?.some(p => p !== null) ? params : undefined });

    return {
        title: chart.title,
        main: ctx.fns.ui.page({
            page: "chart",
            main: `<div class="flex items-baseline justify-between gap-4">
  <div>
    <h1 class="text-lg font-semibold">${esc(chart.title)}</h1>
    <div class="mt-0.5 text-2xs text-text-tertiary">
      <a class="font-mono text-text-link hover:underline" href="/filemanager?path=${encodeURIComponent(chart.file)}"
        hx-get="/filemanager?path=${encodeURIComponent(chart.file)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(chart.file)}</a>
      ${names.length ? ` · takes ${names.map(n => `<span class="font-mono">${esc(n)}</span>`).join(", ")}` : ""}
    </div>
  </div>
  <a class="shrink-0 text-2xs text-text-link hover:underline" href="/chart" hx-get="/chart" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← back</a>
</div>

<div class="mt-6" ${ctx.fns.ui.attr({ entity: "chart", id: chart.id })}>${await ctx.fns.chart.render({ chart, height: 320, rows })}</div>

${ctx.fns.ui.box({
                class: "mt-6",
                title: rows.error ? "no rows" : `${rows.rows.length} rows`,
                body: rows.error || !rows.rows.length ? "" : table(rows.rows),
                empty: rows.error ?? "the query returned nothing",
            })}

<details class="mt-6 overflow-hidden rounded-md border border-border-subtle">
  <summary class="cursor-pointer bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">Spec${chart.dataSource?.sql ? " and query" : ""}</summary>
  <pre class="overflow-x-auto border-t border-border-subtle p-4 font-mono text-2xs">${esc(JSON.stringify({ dataSource: chart.dataSource, spec: chart.spec }, null, 2))}</pre>
</details>`,
        }),
    };
}

// The rows as they came back — the chart's own truth, before Vega decided how to
// draw it. Twenty is enough to see whether the query is right.
function table(rows: any[]): string {
    const names = Object.keys(rows[0]);
    return `<div class="overflow-x-auto border-t border-border-subtle">
  <table class="w-full text-2xs">
    <thead><tr class="bg-bg-content text-left text-text-tertiary">${names.map(n => `<th class="px-3 py-1.5 font-medium">${esc(n)}</th>`).join("")}</tr></thead>
    <tbody>${rows.slice(0, 20).map(row => `<tr class="border-t border-border-subtle">${names.map(n => `<td class="px-3 py-1.5 font-mono">${esc(cell(row[n]))}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
</div>`;
}

function cell(value: any): string {
    return value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
