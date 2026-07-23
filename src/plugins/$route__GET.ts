// GET /plugins — the plugin manager.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    return { title: "plugins", main: await ctx.fns.plugins.panel({}) };
}
