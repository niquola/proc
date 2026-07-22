// Stop then start — a fresh port each time.
export default async function (ctx: Context, _session: Session | null, opts: { name?: string }) {
    await ctx.fns.services.stop({ name: opts.name });
    return ctx.fns.services.start({ name: opts.name });
}
