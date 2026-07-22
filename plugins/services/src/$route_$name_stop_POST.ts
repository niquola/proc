// POST /processes/:name/stop — 204, nothing rendered.
//
// Stopping waits up to five seconds for the child to go quietly, so it is kicked
// off un-awaited: the supervisor emits `{type:"service"}` as the state moves and
// `#service-list` refreshes itself, which is a better answer than a held request.
export default function (ctx: Context, _session: Session, opts: { params: { name: string } }) {
    ctx.fns.services.stop({ name: opts.params.name }).catch(() => {});
    return new Response(null, { status: 204 });
}
