// GET /processes/list?name= — the cards inside `#service-list`, which is what
// the list asks for on its own timer and on every `{type:"service"}` event. Only
// the contents: the container stays, keeping its scroll and its timer.
export default function (ctx: Context, _session: Session, opts: { req: Request }) {
    const selected = new URL(opts.req.url).searchParams.get("name") ?? undefined;
    return new Response(ctx.fns.processes.cards({ selected }), { headers: { "content-type": "text/html; charset=utf-8" } });
}
