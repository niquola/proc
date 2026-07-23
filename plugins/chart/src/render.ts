// One chart as a fragment: an empty host element that the client fills in. The
// spec goes in as an argument on hx-on--load rather than through a data-*
// attribute, because state the server already knows must not be recovered out
// of the DOM.
//
// The theme is merged under the spec's own config, and the rows the server
// resolved are baked in — the browser draws, it does not fetch.
export default async function (ctx: Context, _session: Session | null, opts: { chart: any; params?: any[]; height?: number; rows?: { rows: any[]; error: string | null } }): Promise<string> {
    const { rows, error } = opts.rows ?? await ctx.fns.chart.data({ chart: opts.chart, params: opts.params });
    if (error) return ctx.fns.ui.notice({ text: `${opts.chart.id}: ${error}`, tone: "warning" });

    const base = opts.chart.spec ?? {};
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        // Fill the host instead of Vega-Lite's fixed 200px, unless the spec says otherwise.
        ...(base.width ? {} : { width: "container" }),
        // The caller's height is a default too — a spec that states one meant it.
        ...(base.height || !opts.height ? {} : { height: opts.height }),
        ...base,
        config: { ...ctx.fns.chart.theme({}), ...(base.config ?? {}) },
        ...(rows.length ? { data: { values: rows } } : {}),
    };

    // The host is the drawing, not the identity: a list wraps it in the card that
    // carries entity+id (and the link to open it), a single page carries them on
    // the page itself. Marking it here too would report every chart twice and
    // hand page.open an element with no link inside.
    return `<div class="w-full" ${ctx.fns.ui.attr({ role: "chart" })}
  hx-on--load="window.charts.draw(this, ${esc(JSON.stringify(spec))})"></div>`;
}

function esc(s: string): string {
    return s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
