// GET /processes?name= — the supervisor tab: every declared service as a card,
// and the log pane of the selected one. Everything below this line is `panel`;
// the route only reads the selection off the query string.
//
// The client wiring is loaded here rather than through `headExtra` because the
// tab strip is `hx-boost`ed: a boosted navigation swaps `#main` alone, so the
// head of the first page that happened to be rendered is all the document ever
// gets. htmx runs `<script src>` in what it swaps in, so this comes along.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const selected = new URL(opts.req.url).searchParams.get("name") ?? undefined;
    // The page marker wraps the panel with `display: contents`, so it names the
    // screen for the agent without adding a box to the panel's full-height layout.
    return {
        title: "processes",
        main: `<script src="/processes/client.js"></script><div class="contents" ${ctx.fns.ui.attr({ page: "services" })}>${await ctx.fns.processes.panel({ selected })}</div>`,
    };
}
