// Lifecycle: take every service down with the workspace. In parallel, because
// each `stop` spends up to five seconds waiting for its child to go quietly and
// serialising that would make shutdown take as long as the process list.
export default async function (ctx: Context, _state: any) {
    await Promise.all(Object.keys(ctx.state.services ?? {}).map(name => ctx.fns.services.stop({ name })));
}
