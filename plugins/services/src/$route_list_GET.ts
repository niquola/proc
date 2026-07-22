// GET /processes/list?name= — just `#service-list`, which is what the list asks
// for on its own timer and on every `{type:"service"}` event. A Response rather
// than a string, so the layout does not wrap a fragment in a page.
export default function (ctx: Context, _session: Session, opts: { req: Request }) {
    const selected = new URL(opts.req.url).searchParams.get("name") ?? undefined;
    return new Response(ctx.fns.processes.list({ selected }), { headers: { "content-type": "text/html; charset=utf-8" } });
}
