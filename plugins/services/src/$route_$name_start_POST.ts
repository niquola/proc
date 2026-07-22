// POST /processes/:name/start — 204, nothing rendered.
//
// `start` waits for every `needs` to become ready, which can take a minute, so
// it is kicked off un-awaited and the browser gets its answer at once. The
// supervisor emits `{type:"service"}` as the service moves, `#service-list`
// refreshes itself with its own URL (selection included), and a failure lands
// on the record as `error` and shows up on the card — so there is nothing for
// this route to swap in.
export default async function (ctx: Context, _session: Session, opts: { params: { name: string } }) {
    ctx.fns.services.start({ name: opts.params.name }).catch(() => {});
    return new Response(null, { status: 204 });
}
