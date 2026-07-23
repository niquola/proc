// GET /questionnaire/search?q=&by= — just the results list, so typing a new
// query swaps the list and leaves the project's forms and the box alone.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const query = url.searchParams.get("q") ?? "";
    const by = url.searchParams.get("by") ?? "item";
    try {
        const found = await ctx.fns.questionnaire.search({ query, by: by as any });
        return new Response(ctx.fns.questionnaire.results({ query, by, total: found.total, results: found.results }), { headers: { "content-type": "text/html" } });
    } catch (error: any) {
        return new Response(`<div id="qr-results" class="mt-4 rounded-md border border-state-danger-border bg-state-danger-bg px-4 py-2 text-ui text-state-danger-fg">${String(error?.message ?? error)}</div>`, { headers: { "content-type": "text/html" } });
    }
}
