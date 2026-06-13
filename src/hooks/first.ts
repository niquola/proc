// Run hooks under `name` until one returns a non-null result; return it (or
// undefined). Use for "first responder" points — authenticate, resolve-handler,
// where the first hook that handles it wins.
export default async function (ctx: Context, session: Session | null, opts: { name: string; opts?: any }) {
    const map = ctx.state.hooks?.[opts.name];
    if (!map) return undefined;
    for (const fn of map.values()) {
        const r = await fn(ctx, session, opts.opts ?? {});
        if (r !== undefined && r !== null) return r;
    }
    return undefined;
}
