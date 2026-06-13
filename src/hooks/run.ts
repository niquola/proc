// Run every hook registered under `name`, in registration order, each with the
// current ctx+session and `opts`. Returns the array of results. Use for
// fan-out extension points (on-request, collect-menu-items, …).
export default async function (ctx: Context, session: Session | null, opts: { name: string; opts?: any }) {
    const map = ctx.state.hooks?.[opts.name];
    if (!map) return [];
    const out: any[] = [];
    for (const fn of map.values()) out.push(await fn(ctx, session, opts.opts ?? {}));
    return out;
}
