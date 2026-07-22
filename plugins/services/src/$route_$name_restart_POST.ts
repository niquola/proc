// POST /processes/:name/restart — 204, nothing rendered. Same reason as start:
// a restart stops, waits for the dependencies and comes back, and the card
// reports each of those steps by itself.
export default function (ctx: Context, _session: Session, opts: { params: { name: string } }) {
    ctx.fns.services.restart({ name: opts.params.name }).catch(() => {});
    return new Response(null, { status: 204 });
}
